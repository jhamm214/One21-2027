import { NextRequest, NextResponse } from "next/server";
import { q, audit } from "@/lib/db";
import { rsmDigest } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * Runs every Monday. Two jobs.
 *
 * 1. SEAT PURCHASE BATCH. Anyone at paid_in_full who hasn't had a seat
 *    purchased gets one. This is the ONLY place seat_purchased_at is written.
 *    Nothing else touches it. Zero cash exposure: we never buy a seat for an
 *    agent who hasn't paid the full $690.
 *
 * 2. RSM DIGEST. Each RSM gets their office's roster by status. This is what
 *    permanently kills "an agent I expected wasn't on the attendee list" —
 *    the RSM sees the gap weeks out, not at the registration desk.
 */
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // --- 1. Seat purchase batch -------------------------------------------------
  const toPurchase = await q<any>(
    `select id, agent_name, office, email
       from registrations
      where status = 'paid_in_full' and seat_purchased_at is null`
  );

  for (const r of toPurchase) {
    // If C21 corporate ever exposes an API, call it here. Until then this marks
    // the batch and the export below is what Rebecca sends them.
    await q(
      `update registrations set seat_purchased_at = now(), updated_at = now()
        where id = $1`,
      [r.id]
    );
    await audit(r.id, "cron", "seat_purchased", { office: r.office });
  }

  // --- 2. RSM digests ---------------------------------------------------------
  const rsms = await q<any>(
    `select distinct rsm from registrations where rsm is not null`
  );

  for (const { rsm } of rsms) {
    const rows = await q<any>(
      `select agent_name, office, status from registrations
        where rsm = $1 order by status, agent_name`,
      [rsm]
    );
    const to = rsmEmail(rsm);
    if (to) await rsmDigest(to, rsm, rows);
  }

  return NextResponse.json({
    seats_purchased: toPurchase.length,
    digests_sent: rsms.length,
  });
}

/** TODO: replace with the real RSM -> email map, or a column on registrations. */
function rsmEmail(rsm: string): string | null {
  const map: Record<string, string> = {
    // "Jane Doe": "janedoe@judgefite.com",
  };
  return map[rsm] ?? null;
}
