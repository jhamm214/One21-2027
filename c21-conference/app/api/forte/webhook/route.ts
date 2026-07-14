import { NextRequest, NextResponse } from "next/server";
import { q, one, audit } from "@/lib/db";
import { confirmPaidInFull } from "@/lib/email";

/**
 * Forte posts transaction outcomes here. The webhook — not the browser — is
 * authoritative for settlement, funding, and reversals. A client-side "success"
 * only means the authorization returned A01; this is what tells you the money
 * actually moved, and it is how a refund issued by hand in Dex finds its way
 * back into our tables.
 *
 * Configure the endpoint in Dex, and set FORTE_WEBHOOK_SECRET to match.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();

  // Verify before trusting. Confirm the exact signature scheme in Forte's docs
  // for your account — do not skip this in production.
  const sig = req.headers.get("x-forte-signature");
  if (process.env.NODE_ENV === "production" && !verify(raw, sig)) {
    return new NextResponse("Bad signature", { status: 401 });
  }

  const evt = JSON.parse(raw);
  const txnId: string | undefined = evt?.transaction_id;
  if (!txnId) return NextResponse.json({ ok: true });

  const payment = await one<any>(
    `select p.*, r.email, r.agent_name, r.amount_total
       from payments p join registrations r on r.id = p.registration_id
      where p.forte_transaction_id = $1`,
    [txnId]
  );
  if (!payment) return NextResponse.json({ ok: true }); // not ours

  const status = String(evt?.status ?? "").toLowerCase();

  if (status === "funded" || status === "settled") {
    await audit(payment.registration_id, "forte", "settled", { txn: txnId });
  }

  if (status === "voided" || status === "reversed" || status === "refunded") {
    await q(`update payments set status = 'refunded' where id = $1`, [payment.id]);

    // Recompute from the payments table rather than decrementing — a refund
    // issued in Dex and a refund issued here must converge on the same answer.
    const [{ paid }] = await q<any>(
      `select coalesce(sum(amount),0) as paid from payments
        where registration_id = $1 and status = 'paid'`,
      [payment.registration_id]
    );
    const newStatus =
      Number(paid) >= Number(payment.amount_total)
        ? "paid_in_full"
        : Number(paid) > 0
        ? "reserved"
        : "pending_payment";

    await q(
      `update registrations set amount_paid=$2, status=$3, updated_at=now()
        where id=$1`,
      [payment.registration_id, paid, newStatus]
    );
    await audit(payment.registration_id, "forte", "refunded", { txn: txnId, paid });
  }

  return NextResponse.json({ ok: true });
}

function verify(raw: string, sig: string | null): boolean {
  if (!sig || !process.env.FORTE_WEBHOOK_SECRET) return false;
  const crypto = require("crypto");
  const expected = crypto
    .createHmac("sha256", process.env.FORTE_WEBHOOK_SECRET)
    .update(raw)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}
