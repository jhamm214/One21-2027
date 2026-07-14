import { NextRequest, NextResponse } from "next/server";
import { q, one, audit } from "@/lib/db";
import { confirmFormReceived } from "@/lib/email";
import {
  PRICING,
  installmentsAvailable,
  registrationOpen,
  installmentSchedule,
  today,
} from "@/lib/config";

/**
 * ONE form, submitted BEFORE any payment.
 *
 * This is the fix for last year's biggest failure: agents who intended to come
 * but never appeared on an attendee list. Everyone who submits this form exists
 * in the database from that moment, paid or not. Nobody falls through.
 */
export async function POST(req: NextRequest) {
  const b = await req.json();

  if (!registrationOpen()) {
    return NextResponse.json({ error: "Registration is closed." }, { status: 400 });
  }

  const required = ["agent_name", "office", "rsm", "email", "phone", "plan"];
  for (const f of required) {
    if (!b[f]) return NextResponse.json({ error: `Missing ${f}` }, { status: 400 });
  }

  if (b.plan !== "full" && b.plan !== "installment") {
    return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
  }

  // Option A, enforced. After the cutoff the 3-pay plan does not exist —
  // not in the UI, and not here either. Never trust the client.
  if (b.plan === "installment" && !installmentsAvailable()) {
    return NextResponse.json(
      { error: "The installment plan closed on November 15, 2026. Pay in full only." },
      { status: 400 }
    );
  }

  const dupe = await one(
    `select id, status from registrations
      where lower(email) = lower($1) and status <> 'cancelled'`,
    [b.email]
  );
  if (dupe) {
    return NextResponse.json(
      { error: "A registration already exists for this email.", id: dupe.id },
      { status: 409 }
    );
  }

  const reg = await one<{ id: string }>(
    `insert into registrations
       (agent_name, agent_id, office, rsm, email, phone, dietary, accessibility,
        plan, amount_total, status)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending_payment')
     returning id`,
    [
      b.agent_name,
      b.agent_id ?? null,
      b.office,
      b.rsm,
      b.email,
      b.phone,
      b.dietary ?? null,
      b.accessibility ?? null,
      b.plan,
      PRICING.fullAmount,
    ]
  );

  // Write the payment schedule up front. For a 3-pay plan that's three rows,
  // due today / Dec 16 / Jan 15. The cron works off these.
  if (b.plan === "installment") {
    const dues = installmentSchedule(today());
    for (let i = 0; i < PRICING.installmentCount; i++) {
      await q(
        `insert into payments (registration_id, installment_no, amount, due_date, status)
         values ($1,$2,$3,$4,'scheduled')`,
        [reg!.id, i + 1, PRICING.installmentAmount, dues[i]]
      );
    }
  } else {
    await q(
      `insert into payments (registration_id, installment_no, amount, due_date, status)
       values ($1, null, $2, $3, 'scheduled')`,
      [reg!.id, PRICING.fullAmount, today()]
    );
  }

  await audit(reg!.id, "system", "created", { plan: b.plan, office: b.office });
  await confirmFormReceived(b.email, b.agent_name, reg!.id);

  return NextResponse.json({ id: reg!.id });
}
