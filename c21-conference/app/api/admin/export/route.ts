import { NextResponse } from "next/server";
import { q } from "@/lib/db";

export const dynamic = "force-dynamic";

/** The attendee list. One click, always current. Gate behind admin auth. */
export async function GET() {
  const rows = await q<any>(
    `select agent_name, agent_id, office, rsm, email, phone,
            plan, amount_total, amount_paid, status,
            dietary, accessibility,
            to_char(seat_purchased_at,'YYYY-MM-DD') as seat_purchased,
            to_char(created_at,'YYYY-MM-DD') as registered_on
       from registrations
      order by status, office, agent_name`
  );

  const headers = Object.keys(
    rows[0] ?? {
      agent_name: "",
      agent_id: "",
      office: "",
      rsm: "",
      email: "",
      phone: "",
      plan: "",
      amount_total: "",
      amount_paid: "",
      status: "",
      dietary: "",
      accessibility: "",
      seat_purchased: "",
      registered_on: "",
    }
  );

  const esc = (v: any) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => esc(r[h])).join(",")),
  ].join("\n");

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="c21jfc-conference-${stamp}.csv"`,
    },
  });
}
