import { NextRequest, NextResponse } from "next/server";
import { q, one, audit } from "@/lib/db";
import { saleWithOneTimeToken } from "@/lib/forte";
import { confirmPaidInFull, confirmReserved, notifyRebeccaPayment } from "@/lib/email";
import {
  PRICING,
  CONSENT_FULL,
  CONSENT_INSTALLMENT,
  installmentsAvailable,
} from "@/lib/config";

/**
 * The FIRST charge. The browser tokenized the card with Forte.js and sent us a
 * ONE-TIME token — no card data touched this server. We charge it via Forte's
 * REST API (token goes in as payment_token). For installments we also save a
 * reusable token so the cron can charge payments 2 and 3.
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
  if (!one_time_token) {
    return NextResponse.json(
      { error: "Card wasn't processed. Please re-enter your card." },
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

  const [first, ...rest] = String(reg.agent_name).trim().split(" ");
  const result = await saleWithOneTimeToken({
    oneTimeToken: one_time_token,
    amount,
    referenceId: reg.id,
    billing: { first_name: first ?? reg.agent_name, last_name: rest.join(" ") },
    saveToken: isInstallment,
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
    // Card declined: the registration stays 'pending_payment' so the agent can
    // retry with another card, but we stamp an expiry. The cleanup cron removes
    // it if still unpaid 2 hours from now. A later successful charge clears the
    // stamp (see the success path below).
    await q(
      `update registrations set expires_at = now() + interval '2 hours', updated_at = now()
        where id = $1 and status = 'pending_payment'`,
      [reg.id]
    );
    await audit(reg.id, "system", "failed", { code: result.code, message: result.message });
    return NextResponse.json(
      { error: result.message ?? "Your card was declined." },
      { status: 402 }
    );
  }

  // Success: clear any prior decline expiry stamp.
  await q(`update registrations set expires_at = null where id = $1`, [reg.id]);

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

  // Notify Rebecca on every successful charge; flag the completing one.
  await notifyRebeccaPayment({
    agentName: reg.agent_name,
    office: reg.office,
    amount,
    plan: reg.plan,
    installmentNo: isInstallment ? 1 : null,
    completed: status === "paid_in_full",
  });

  return NextResponse.json({ ok: true, status, last4: result.last4 });
}
