import { NextRequest, NextResponse } from "next/server";
import { q, one, audit } from "@/lib/db";
import { saleWithOneTimeToken } from "@/lib/forte";
import { confirmPaidInFull, confirmReserved } from "@/lib/email";
import {
  PRICING,
  CONSENT_FULL,
  CONSENT_INSTALLMENT,
  installmentsAvailable,
} from "@/lib/config";

/**
 * The FIRST charge. Forte.js tokenized the card in the browser and handed us a
 * one-time token — no card data has ever touched this server.
 *
 * Pay in full  -> charge $690, status = paid_in_full.
 * Installments -> charge $230, SAVE the paymethod token, status = reserved.
 *                 The saved token is what makes payments 2 and 3 possible.
 *                 Without save_token, the 3-pay plan cannot work.
 */
export async function POST(req: NextRequest) {
  const b = await req.json();
  const { registration_id, one_time_token, consent_accepted } = b;

  if (!consent_accepted) {
    return NextResponse.json(
      { error: "Payment authorization is required." },
      { status: 400 }
    );
  }

  const reg = await one<any>(`select * from registrations where id = $1`, [
    registration_id,
  ]);
  if (!reg) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (reg.status === "paid_in_full" || reg.status === "reserved") {
    return NextResponse.json({ error: "Already paid." }, { status: 409 });
  }
  if (reg.plan === "installment" && !installmentsAvailable()) {
    return NextResponse.json(
      { error: "The installment plan has closed." },
      { status: 400 }
    );
  }

  const isInstallment = reg.plan === "installment";
  const amount = isInstallment ? PRICING.installmentAmount : PRICING.fullAmount;

  // Record consent BEFORE charging. Verbatim, with IP and user agent.
  // This is the chargeback defense, and it must match the packet word for word.
  await q(
    `insert into consents (registration_id, consent_text, ip, user_agent)
     values ($1,$2,$3,$4)`,
    [
      reg.id,
      isInstallment ? CONSENT_INSTALLMENT : CONSENT_FULL,
      req.headers.get("x-forwarded-for")?.split(",")[0] ?? null,
      req.headers.get("user-agent") ?? null,
    ]
  );

  const [first, last] = String(reg.agent_name).split(" ");
  const result = await saleWithOneTimeToken({
    oneTimeToken: one_time_token,
    amount,
    referenceId: reg.id,
    billing: { first_name: first ?? reg.agent_name, last_name: last ?? "" },
    saveToken: isInstallment, // <- the whole 3-pay plan hangs on this
  });

  const payment = await one<any>(
    `select * from payments
      where registration_id = $1 and status in ('scheduled','failed')
      order by due_date asc limit 1`,
    [reg.id]
  );

  if (!result.approved) {
    await q(
      `update payments set status='failed', attempts = attempts + 1,
              last_error = $2 where id = $1`,
      [payment.id, result.message ?? result.code ?? "declined"]
    );
    await audit(reg.id, "system", "failed", { code: result.code });
    return NextResponse.json(
      { error: result.message ?? "Your card was declined." },
      { status: 402 }
    );
  }

  await q(
    `update payments
        set status='paid', forte_transaction_id=$2, forte_paymethod_token=$3,
            card_last4=$4, card_type=$5, charged_at=now(), attempts = attempts + 1
      where id = $1`,
    [
      payment.id,
      result.transactionId,
      result.paymethodToken ?? null,
      result.last4 ?? null,
      result.cardType ?? null,
    ]
  );

  // Propagate the saved token to the remaining installments so the cron can use it.
  if (isInstallment && result.paymethodToken) {
    await q(
      `update payments set forte_paymethod_token = $2, card_last4 = $3
        where registration_id = $1 and status = 'scheduled'`,
      [reg.id, result.paymethodToken, result.last4 ?? null]
    );
  }

  const newPaid = Number(reg.amount_paid) + amount;
  const status = newPaid >= Number(reg.amount_total) ? "paid_in_full" : "reserved";

  await q(
    `update registrations set amount_paid = $2, status = $3, updated_at = now()
      where id = $1`,
    [reg.id, newPaid, status]
  );

  await audit(reg.id, "system", "charged", {
    amount,
    transaction: result.transactionId,
    status,
  });

  if (status === "paid_in_full") {
    await confirmPaidInFull(reg.email, reg.agent_name, reg.id);
  } else {
    await confirmReserved(reg.email, reg.agent_name, reg.id);
  }

  return NextResponse.json({ ok: true, status, last4: result.last4 });
}
