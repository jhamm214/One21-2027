import { one } from "@/lib/db";
import PayForm from "./PayForm";
import {
  PRICING,
  DATES,
  CONSENT_FULL,
  CONSENT_INSTALLMENT,
  money,
  longDate,
} from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function PayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const reg = await one<any>(
    `select id, agent_name, email, plan, status, amount_paid, amount_total
       from registrations where id = $1`,
    [id]
  );

  if (!reg) return <h1>We couldn't find that registration.</h1>;

  if (reg.status === "paid_in_full") {
    return (
      <>
        <p className="eyebrow">Confirmed</p>
        <h1>You're all set, {reg.agent_name.split(" ")[0]}.</h1>
        <p>
          We've received {money(PRICING.fullAmount)} in full. Your confirmation
          number is <strong>{reg.id.slice(0, 8).toUpperCase()}</strong>.
        </p>
        <div className="scope">
          <b>Your fee covers conference registration only.</b>
          Hotel, travel, and meals are booked and paid separately by you.
        </div>
      </>
    );
  }

  if (reg.status === "reserved") {
    return (
      <>
        <p className="eyebrow">Reserved — not yet confirmed</p>
        <h1>Your seat is reserved.</h1>
        <p>
          We've received {money(Number(reg.amount_paid))} of{" "}
          {money(Number(reg.amount_total))}. Your remaining payments charge
          automatically to the card on file.
        </p>
        <p>
          <strong>
            Your seat becomes Confirmed when your final payment clears on{" "}
            {longDate(DATES.installment3)}.
          </strong>
        </p>
      </>
    );
  }

  if (reg.status === "cancelled") {
    return (
      <>
        <h1>This registration was cancelled.</h1>
        <p>Call Rebecca and she'll sort it out.</p>
      </>
    );
  }

  const isInstallment = reg.plan === "installment";

  return (
    <PayForm
      registrationId={reg.id}
      agentName={reg.agent_name}
      isInstallment={isInstallment}
      amountToday={isInstallment ? PRICING.installmentAmount : PRICING.fullAmount}
      consentText={isInstallment ? CONSENT_INSTALLMENT : CONSENT_FULL}
    />
  );
}
