"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PRICING, DATES, INCLUSIONS, money, longDate } from "@/lib/config";

/**
 * The card fields are posted to our /api/payments/charge endpoint, which runs
 * the sale via Forte's REST API server-side. No Forte.js in the browser.
 */
export default function PayForm({
  registrationId,
  agentName,
  isInstallment,
  amountToday,
  consentText,
}: {
  registrationId: string;
  agentName: string;
  isInstallment: boolean;
  amountToday: number;
  consentText: string;
}) {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    if (!accepted) {
      setError("Please accept the payment authorization to continue.");
      return;
    }
    setBusy(true);
    setError(null);

    const el = (id: string) =>
      (document.getElementById(id) as HTMLInputElement).value.trim();

    const r = await fetch("/api/payments/charge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        registration_id: registrationId,
        consent_accepted: true,
        card_number: el("card_number"),
        expire_month: el("exp_month"),
        expire_year: el("exp_year"),
        cvv: el("cvv"),
      }),
    });
    const out = await r.json();

    if (!r.ok) {
      setError(out.error ?? "Your card was declined. Try another card.");
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <>
      <p className="eyebrow">Step 2 of 2</p>
      <h1>Payment</h1>

      {error && <div className="error">{error}</div>}

      <div className="card">
        <p className="eyebrow">Charged today</p>
        <p style={{ fontSize: "2.2rem", margin: 0, fontWeight: 600 }}>
          {money(amountToday)}
        </p>

        {isInstallment && (
          <div className="spine">
            <ol>
              <li className="done">
                <span className="amt">{money(PRICING.installmentAmount)}</span>
                <span className="when">Today</span>
              </li>
              <li>
                <span className="amt">{money(PRICING.installmentAmount)}</span>
                <span className="when">{longDate(DATES.installment2)}</span>
              </li>
              <li>
                <span className="amt">{money(PRICING.installmentAmount)}</span>
                <span className="when">{longDate(DATES.installment3)}</span>
              </li>
            </ol>
          </div>
        )}

        <div className="scope">
          <b>{INCLUSIONS.covers}</b>
          {INCLUSIONS.notCovered}
        </div>
      </div>

      <div className="card">
        <h3>Card details</h3>

        <div className="field">
          <label htmlFor="card_number">Card number</label>
          <input id="card_number" inputMode="numeric" autoComplete="cc-number" />
        </div>

        <div className="row">
          <div className="field">
            <label htmlFor="exp_month">Expiration month</label>
            <input id="exp_month" placeholder="MM" inputMode="numeric" autoComplete="cc-exp-month" />
          </div>
          <div className="field">
            <label htmlFor="exp_year">Expiration year</label>
            <input id="exp_year" placeholder="YYYY" inputMode="numeric" autoComplete="cc-exp-year" />
          </div>
        </div>

        <div className="field" style={{ maxWidth: 160 }}>
          <label htmlFor="cvv">Security code</label>
          <input id="cvv" inputMode="numeric" autoComplete="cc-csc" />
        </div>
      </div>

      <div className="card">
        <h3>Payment authorization</h3>
        <div className="consent">{consentText}</div>
        <label className="check">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
          />
          <span>
            I am {agentName}, and I authorize this payment as described above.
          </span>
        </label>
      </div>

      <button onClick={pay} disabled={busy || !accepted}>
        {busy ? "Processing…" : `Pay ${money(amountToday)}`}
      </button>
    </>
  );
}
