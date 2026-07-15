import { NextRequest, NextResponse } from "next/server";
import { q, audit } from "@/lib/db";
import { saleWithStoredToken } from "@/lib/forte";
import { paymentFailed, confirmPaidInFull, notifyContact, notifyRebeccaPayment } from "@/lib/email";
import { DUNNING } from "@/lib/config";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Runs daily. Charges any installment that is due, using the stored Forte
 * paymethod token. Retries a failure at +3 and +7 days, escalates to Rebecca
 * after the second attempt, and cancels + releases the seat at +14.
 *
 * The dunning schedule is why the calendar has a 13-day buffer between the
 * final installment (Jan 15) and the deadline (Jan 28): a card that fails on
 * Jan 15 gets retried on the 18th and the 22nd, with a call from Rebecca in
 * between, and there is still time to cancel cleanly rather than scramble.
 */
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Clean up abandoned registrations: a declined first charge stamped
  // expires_at 2 hours out. If still unpaid past that, remove it so the admin
  // list and counts stay clean. (Runs daily; the stamp is 2h so this catches
  // anything from the prior day. Cascades delete the linked payment rows.)
  const expired = await q<any>(
    `delete from registrations
      where status = 'pending_payment'
        and expires_at is not null
        and expires_at < now()
      returning id`
  );
  for (const e of expired) {
    await audit(e.id, "cron", "expired", { reason: "declined, unpaid past 2h" });
  }

  const due = await q<any>(
    `select p.*, r.email, r.agent_name, r.phone, r.office, r.amount_paid, r.amount_total
       from payments p
       join registrations r on r.id = p.registration_id
      where p.forte_paymethod_token is not null
        and r.status in ('reserved','pending_payment')
        and (
          (p.status = 'scheduled' and p.due_date <= current_date)
          or (p.status = 'failed' and p.attempts = 1
              and p.due_date + ${DUNNING.retryDays[0]} <= current_date)
          or (p.status = 'failed' and p.attempts = 2
              and p.due_date + ${DUNNING.retryDays[1]} <= current_date)
        )`
  );

  const log: any[] = [];

  for (const p of due) {
    // Past the cure period — cancel and release the seat.
    const daysPast = Math.floor(
      (Date.now() - new Date(p.due_date).getTime()) / 86400000
    );
    if (p.status === "failed" && daysPast >= DUNNING.cancelAfterDays) {
      await q(
        `update registrations set status='cancelled', updated_at=now() where id=$1`,
        [p.registration_id]
      );
      await audit(p.registration_id, "cron", "cancelled", {
        reason: "installment unpaid past cure period",
        days_past: daysPast,
      });
      log.push({ id: p.id, action: "cancelled" });
      continue;
    }

    const result = await saleWithStoredToken({
      paymethodToken: p.forte_paymethod_token,
      amount: Number(p.amount),
      referenceId: p.registration_id,
    });

    if (result.approved) {
      await q(
        `update payments set status='paid', forte_transaction_id=$2,
                charged_at=now(), attempts = attempts + 1, last_error = null
          where id=$1`,
        [p.id, result.transactionId]
      );

      const newPaid = Number(p.amount_paid) + Number(p.amount);
      const paidInFull = newPaid >= Number(p.amount_total);

      await q(
        `update registrations
            set amount_paid=$2, status=$3, updated_at=now()
          where id=$1`,
        [p.registration_id, newPaid, paidInFull ? "paid_in_full" : "reserved"]
      );

      await audit(p.registration_id, "cron", "charged", {
        installment: p.installment_no,
        amount: p.amount,
      });

      if (paidInFull) {
        await confirmPaidInFull(p.email, p.agent_name, p.registration_id);
      }
      await notifyRebeccaPayment({
        agentName: p.agent_name,
        office: p.office ?? "",
        amount: Number(p.amount),
        plan: "installment",
        installmentNo: p.installment_no,
        completed: paidInFull,
      });
      log.push({ id: p.id, action: "charged" });
    } else {
      const attempts = p.attempts + 1;
      await q(
        `update payments set status='failed', attempts=$2, last_error=$3 where id=$1`,
        [p.id, attempts, result.message ?? result.code ?? "declined"]
      );
      await audit(p.registration_id, "cron", "failed", {
        installment: p.installment_no,
        code: result.code,
        attempts,
      });

      await paymentFailed(p.email, p.agent_name, p.registration_id, attempts);

      if (attempts >= DUNNING.escalateAfterAttempts) {
        await notifyContact(p.agent_name, p.phone, p.email, p.registration_id);
      }
      log.push({ id: p.id, action: "failed", attempts });
    }
  }

  return NextResponse.json({ processed: due.length, log });
}
