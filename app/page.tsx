import Link from "next/link";
import {
  CONFERENCE,
  DATES,
  PRICING,
  INCLUSIONS,
  money,
  longDate,
  shortDate,
  installmentsAvailable,
  registrationOpen,
} from "@/lib/config";

export default function Home() {
  const threePay = installmentsAvailable();
  const open = registrationOpen();

  return (
    <>
      <p className="eyebrow">{longDate(CONFERENCE.startsOn)}</p>
      <h1>{CONFERENCE.name}</h1>

      <p style={{ fontSize: "1.1rem", color: "var(--ink-70)" }}>
        One form. One payment. One person to call. Register below — your
        registration is recorded the moment you submit the form, and completed
        when your payment clears.
      </p>

      {/* The fee scope, stated affirmatively, right next to the price. */}
      <div className="card">
        <p className="eyebrow">Registration fee</p>
        <p style={{ fontSize: "2.4rem", margin: 0, fontWeight: 600 }}>
          {money(PRICING.fullAmount)}
        </p>
        <div className="scope">
          <b>{INCLUSIONS.covers}</b>
          {INCLUSIONS.notCovered}
        </div>

        {threePay ? (
          <p>
            You may pay in full, or in{" "}
            <strong>
              {PRICING.installmentCount} payments of{" "}
              {money(PRICING.installmentAmount)}
            </strong>
            . There is no additional cost to pay over time.
          </p>
        ) : (
          <p>
            The installment plan closed on {longDate(DATES.installmentCutoff)}.
            Registration is now <strong>{money(PRICING.fullAmount)}, paid in full</strong>.
          </p>
        )}
      </div>

      {/* The signature element: the dates, in order, as a spine. */}
      <h2>The dates that matter</h2>
      <div className="spine">
        <ol>
          <li className="done">
            <span className="amt">Register</span>
            <span className="when">Opens {shortDate(DATES.registrationOpens)}</span>
          </li>
          <li className={threePay ? "done" : ""}>
            <span className="amt">3-pay closes</span>
            <span className="when">{shortDate(DATES.installmentCutoff)}</span>
          </li>
          <li>
            <span className="amt">Paid in full</span>
            <span className="when">By {shortDate(DATES.registrationDeadline)}</span>
          </li>
          <li>
            <span className="amt">Conference</span>
            <span className="when">{shortDate(CONFERENCE.startsOn)}</span>
          </li>
        </ol>
      </div>

      <table>
        <tbody>
          <tr>
            <td>Registration opens</td>
            <td>{longDate(DATES.registrationOpens)}</td>
          </tr>
          <tr>
            <td>
              <strong>Last day to choose the 3-payment plan</strong>
            </td>
            <td>
              <strong>{longDate(DATES.installmentCutoff)}</strong>
            </td>
          </tr>
          <tr>
            <td>Payment 2 of 3 charges automatically</td>
            <td>{longDate(DATES.installment2)}</td>
          </tr>
          <tr>
            <td>Payment 3 of 3 charges automatically</td>
            <td>{longDate(DATES.installment3)}</td>
          </tr>
          <tr>
            <td>
              <strong>Registration deadline — paid in full</strong>
            </td>
            <td>
              <strong>{longDate(DATES.registrationDeadline)}</strong>
            </td>
          </tr>
          <tr>
            <td>Conference begins</td>
            <td>{longDate(CONFERENCE.startsOn)}</td>
          </tr>
        </tbody>
      </table>

      <p style={{ marginTop: 32 }}>
        {open ? (
          <Link href="/register">
            <button>Start your registration</button>
          </Link>
        ) : (
          <em>Registration is closed.</em>
        )}
      </p>
    </>
  );
}
