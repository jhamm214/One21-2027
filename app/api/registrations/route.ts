import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { OFFICE_RSM, installmentsAvailable } from "@/lib/config";

// API route handler — no JSX in this file. Page markup belongs in a .tsx page.

export const runtime = "nodejs";

type Registration = {
  agent_name: string;
  email: string;
  phone: string;
  office: string;
  rsm: string;
  plan: "full" | "installment";
  dietary?: string | null;
  accessibility?: string | null;
};

export async function POST(req: NextRequest) {
  let body: Partial<Registration>;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Could not read the submitted form." }, { status: 400 });
  }

  // --- Validate -----------------------------------------------------------

  const required: (keyof Registration)[] = ["agent_name", "email", "phone", "office", "plan"];
  const missing = required.filter((f) => !String(body[f] ?? "").trim());

  if (missing.length) {
    return NextResponse.json(
      { error: `Missing required fields: ${missing.join(", ")}.` },
      { status: 400 }
    );
  }

  const email = String(body.email).trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const office = String(body.office);

  if (!(office in OFFICE_RSM)) {
    return NextResponse.json({ error: "Select an office from the list." }, { status: 400 });
  }

  if (body.plan !== "full" && body.plan !== "installment") {
    return NextResponse.json({ error: "Choose a payment option." }, { status: 400 });
  }

  // Re-check the cutoff server side. The client hides the installment option
  // after the cutoff, but a browser tab left open across that date would still
  // submit it.
  if (body.plan === "installment" && !installmentsAvailable()) {
    return NextResponse.json(
      { error: "The 3-payment plan has closed. Choose pay in full." },
      { status: 400 }
    );
  }

  // --- Persist ------------------------------------------------------------

  const reg: Registration = {
    agent_name: String(body.agent_name).trim(),
    email,
    phone: String(body.phone).trim(),
    office,
    // Derive the RSM from the office rather than trusting the client value.
    rsm: OFFICE_RSM[office],
    plan: body.plan,
    dietary: String(body.dietary ?? "").trim() || null,
    accessibility: String(body.accessibility ?? "").trim() || null,
  };

  try {
    // Tagged-template syntax parameterizes every value, so this is safe from
    // SQL injection. Do not build this string with concatenation.
    const rows = await sql`
      insert into registrations
        (agent_name, email, phone, office, rsm, plan, dietary, accessibility)
      values
        (${reg.agent_name}, ${reg.email}, ${reg.phone}, ${reg.office},
         ${reg.rsm}, ${reg.plan}, ${reg.dietary}, ${reg.accessibility})
      returning id
    `;

    return NextResponse.json({ id: rows[0].id }, { status: 201 });
  } catch (err: unknown) {
    // 23505 = unique violation, i.e. this email already registered. Return the
    // existing row so a double-submit resumes the same registration instead of
    // creating a second one.
    if (typeof err === "object" && err !== null && (err as { code?: string }).code === "23505") {
      const existing = await sql`
        select id, payment_status from registrations where lower(email) = ${email}
      `;

      if (existing[0]?.payment_status === "pending") {
        return NextResponse.json({ id: existing[0].id }, { status: 200 });
      }

      return NextResponse.json(
        { error: "That email is already registered. Call Rebecca if you need to change it." },
        { status: 409 }
      );
    }

    console.error("Registration save failed:", err);
    return NextResponse.json(
      { error: "Something went wrong. Call Rebecca." },
      { status: 500 }
    );
  }
}
