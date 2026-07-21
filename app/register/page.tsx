"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PRICING,
  OFFICES,
  OFFICE_RSM,
  DATES,
  INCLUSIONS,
  money,
  longDate,
  installmentsAvailable,
} from "@/lib/config";

export default function RegisterPage() {
  const router = useRouter();
  const threePay = installmentsAvailable();

  const [plan, setPlan] = useState<"full" | "installment">("full");
  const [office, setOffice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rsm = office ? OFFICE_RSM[office] : "";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries());
    payload.plan = plan;
    payload.office = office;
    payload.rsm = rsm;

    const res = await fetch("/api/registrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Something went wrong. Call Rebecca.");
      setBusy(false);
      return;
    }
    router.push(`/register/${data.id}/pay`);
  }

  return (
    <>
      <p className="eyebrow">Step 1 of 2</p>
      <h1>Your registration</h1>
      <p style={{ color: "var(--ink-70)" }}>
        Fill this out once. We'll take payment on the next screen.
      </p>

      {error && <div className="error">{error}</div>}

      <form onSubmit={submit}>
        <div className="card">
          <h3>About you</h3>

          <div className="field">
            <label htmlFor="agent_name">Full name</label>
            <input id="agent_name" name="agent_name" required autoComplete="name" />
          </div>

          <div className="row">
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="field">
              <label htmlFor="phone">Mobile</label>
              <input id="phone" name="phone" type="tel" required autoComplete="tel" />
            </div>
          </div>

          <div className="row">
            <div className="field">
              <label htmlFor="office">Office</label>
              <select
                id="office"
                name="office"
                required
                value={office}
                onChange={(e) => setOffice(e.target.value)}
              >
                <option value="" disabled>
                  Select your office
                </option>
                {OFFICES.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="rsm_display">Your RSM</label>
              <input
                id="rsm_display"
                value={rsm}
                readOnly
                placeholder="Select an office first"
                style={{ background: "var(--shell)", color: "var(--ink-70)" }}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="dietary">Dietary needs (optional)</label>
            <input id="dietary" name="dietary" />
          </div>
          <div className="field">
            <label htmlFor="accessibility">Accessibility needs (optional)</label>
            <input id="accessibility" name="accessibility" />
          </div>
        </div>

        <div className="card">
          <h3>How you'd like to pay</h3>

          <div className="scope">
            <b>{INCLUSIONS.covers}</b>
            {INCLUSIONS.notCovered}
          </div>

          <label
            className={`card ${plan === "full" ? "selected" : ""}`}
            style={{ cursor: "pointer", marginBottom: 12 }}
          >
            <div className="check">
              <input
                type="radio"
                name="planChoice"
                checked={plan === "full"}
                onChange={() => setPlan("full")}
              />
              <div>
                <strong>Pay in full — {money(PRICING.fullAmount)}</strong>
                <div style={{ fontSize: "0.9rem", color: "var(--slate)" }}>
                  Charged today. Your seat is confirmed immediately.
                </div>
              </div>
            </div>
          </label>

          {threePay ? (
            <label
              className={`card ${plan === "installment" ? "selected" : ""}`}
              style={{ cursor: "pointer", marginBottom: 0 }}
            >
              <div className="check">
                <input
                  type="radio"
                  name="planChoice"
                  checked={plan === "installment"}
                  onChange={() => setPlan("installment")}
                />
                <div>
                  <strong>
                    {PRICING.installmentCount} payments of{" "}
                    {money(PRICING.installmentAmount)}
                  </strong>
                  <div style={{ fontSize: "0.9rem", color: "var(--slate)" }}>
                    Today, {longDate(DATES.installment2)}, and{" "}
                    {longDate(DATES.installment3)}. Charged automatically to the
                    card you provide.
                    <br />
                    <strong>
                      Your seat is reserved until the final payment clears, then
                      Confirmed.
                    </strong>
                  </div>
                </div>
              </div>
            </label>
          ) : (
            <p style={{ fontSize: "0.9rem", color: "var(--slate)" }}>
              The 3-payment plan closed on {longDate(DATES.installmentCutoff)}.
            </p>
          )}
        </div>

        <button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Continue to payment"}
        </button>
      </form>
    </>
  );
}
