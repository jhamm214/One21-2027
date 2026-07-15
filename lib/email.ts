/**
 * Email. Swap the transport for whatever you already use (Resend, SendGrid,
 * Microsoft Graph / Outlook — you already have the M365 tenant).
 *
 * Every email ends with Rebecca. One contact, everywhere.
 */
import { CONTACT, CONFERENCE, DATES, longDate, money, PRICING } from "./config";

const FROM = process.env.MAIL_FROM ?? "conference@judgefite.com";

async function send(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[email:dev] to=${to} subject=${subject}`);
    return;
  }
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to, subject, html: wrap(html) }),
  });
}

const footer = `
  <hr style="border:none;border-top:1px solid #ddd;margin:28px 0 16px">
  <p style="font:14px/1.5 system-ui;color:#555">
    <strong>Questions?</strong> ${CONTACT.name} is ${CONTACT.role}.<br>
    C ${CONTACT.mobile} &nbsp;|&nbsp; O ${CONTACT.office}<br>
    <a href="mailto:${CONTACT.email}">${CONTACT.email}</a>
  </p>`;

const wrap = (body: string) =>
  `<div style="max-width:560px;margin:0 auto;font:16px/1.6 system-ui;color:#111">${body}${footer}</div>`;

/** Sent the moment the form is submitted — before any payment. */
export function confirmFormReceived(to: string, name: string, id: string) {
  return send(
    to,
    `We have your registration — payment is the next step`,
    `<h2>Thanks, ${name}.</h2>
     <p>Your registration for the ${CONFERENCE.name} is recorded. <strong>It is not complete until payment is made.</strong></p>
     <p><a href="${process.env.APP_URL}/register/${id}/pay">Finish your payment</a></p>
     <p>Your fee covers <strong>conference registration only</strong>. Hotel, travel, and meals are booked and paid separately by you.</p>`
  );
}

/** Sent when the balance hits zero. This is the registration checklist. */
export function confirmPaidInFull(to: string, name: string, id: string) {
  return send(
    to,
    `You're confirmed for the ${CONFERENCE.shortName}`,
    `<h2>You're confirmed, ${name}.</h2>
     <p>We've received ${money(PRICING.fullAmount)} in full. Your seat is confirmed.</p>
     <p><strong>Confirmation number:</strong> ${id.slice(0, 8).toUpperCase()}</p>
     <h3>Your checklist</h3>
     <ul>
       <li>Conference begins <strong>${longDate(CONFERENCE.startsOn)}</strong>.</li>
       <li><strong>Book your own hotel and travel.</strong> Your fee covers conference registration only.</li>
       <li>Watch for the agenda and session sign-ups closer to the date.</li>
     </ul>`
  );
}

/** Sent on installment #1. Says RESERVED, not confirmed. */
export function confirmReserved(to: string, name: string, id: string) {
  return send(
    to,
    `Your seat is reserved — 2 payments remain`,
    `<h2>Reserved, ${name}.</h2>
     <p>We've received your first payment of ${money(PRICING.installmentAmount)}.</p>
     <p><strong>Your seat is Reserved. It becomes Confirmed when your final payment clears on ${longDate(DATES.installment3)}.</strong></p>
     <h3>Your remaining payments</h3>
     <ul>
       <li>${money(PRICING.installmentAmount)} on <strong>${longDate(DATES.installment2)}</strong></li>
       <li>${money(PRICING.installmentAmount)} on <strong>${longDate(DATES.installment3)}</strong></li>
     </ul>
     <p>These charge automatically to the card on file. Nothing further is required from you.</p>
     <p>Your fee covers <strong>conference registration only</strong>. Hotel, travel, and meals are booked and paid separately by you.</p>`
  );
}

/** Failed installment. Sent on each retry. */
export function paymentFailed(to: string, name: string, id: string, attempt: number) {
  return send(
    to,
    `Action needed: your conference payment didn't go through`,
    `<h2>We couldn't process your payment.</h2>
     <p>${name}, the ${money(PRICING.installmentAmount)} payment for the ${CONFERENCE.shortName} was declined.</p>
     <p>We'll try again automatically. <strong>If it isn't resolved within 14 days, your registration will be cancelled and your seat released.</strong></p>
     <p><a href="${process.env.APP_URL}/register/${id}/pay">Update your card</a></p>
     ${attempt >= 2 ? `<p>${CONTACT.name} will also reach out by phone.</p>` : ""}`
  );
}

/** Weekly digest to each RSM. This is what kills "missing agents on the list." */
export function rsmDigest(to: string, rsm: string, rows: any[]) {
  const by = (s: string) => rows.filter((r) => r.status === s);
  const line = (label: string, rs: any[]) =>
    `<h3>${label} (${rs.length})</h3><ul>${
      rs.map((r) => `<li>${r.agent_name} — ${r.office}</li>`).join("") || "<li>None</li>"
    }</ul>`;

  return send(
    to,
    `Conference registration status — ${rsm}`,
    `<h2>${rsm} — weekly registration status</h2>
     ${line("Confirmed (paid in full)", by("paid_in_full"))}
     ${line("Reserved (installments in progress)", by("reserved"))}
     ${line("Started but not paid", by("pending_payment"))}
     ${line("Cancelled", by("cancelled"))}
     <p><strong>Deadline: ${longDate(DATES.registrationDeadline)}.</strong> Installment plan closes ${longDate(DATES.installmentCutoff)}.</p>`
  );
}

/** Escalation to Rebecca after a second failed attempt. */
export function notifyContact(name: string, phone: string, email: string, id: string) {
  return send(
    CONTACT.email,
    `Call needed: failed conference payment — ${name}`,
    `<h2>Second failed payment attempt</h2>
     <p><strong>${name}</strong><br>${phone}<br>${email}</p>
     <p>Registration ${id.slice(0, 8).toUpperCase()} has failed twice. Please call.</p>
     <p>The system will cancel and release the seat 14 days after the original due date if this isn't cured.</p>`
  );
}

/** Notify Rebecca on EVERY successful charge. Flags the ones that complete. */
export function notifyRebeccaPayment(opts: {
  agentName: string;
  office: string;
  amount: number;
  plan: "full" | "installment";
  installmentNo: number | null;
  completed: boolean; // true when this payment brings them to paid-in-full
}) {
  const kind = opts.completed
    ? opts.plan === "installment"
      ? "COMPLETED their payment plan"
      : "PAID IN FULL"
    : `made installment payment ${opts.installmentNo} of ${PRICING.installmentCount}`;

  const banner = opts.completed
    ? `<p style="background:#e8f5ee;border-left:3px solid #1e6b45;padding:12px 16px;font-weight:600;color:#1e6b45">
         ✓ Registration complete — ${opts.agentName} is confirmed for the conference.
       </p>`
    : "";

  return send(
    CONTACT.email,
    opts.completed
      ? `✓ CONFIRMED: ${opts.agentName} — conference registration complete`
      : `Payment received: ${opts.agentName} (${money(opts.amount)})`,
    `<h2>${opts.agentName} ${kind}.</h2>
     ${banner}
     <p><strong>Office:</strong> ${opts.office}<br>
        <strong>Amount:</strong> ${money(opts.amount)}<br>
        <strong>Plan:</strong> ${opts.plan === "full" ? "Paid in full" : "3-payment plan"}</p>`
  );
}

/** Weekly outstanding-payments report emailed to Rebecca. */
export function outstandingReport(
  rows: Array<{
    agent_name: string;
    office: string;
    balance: number;
    paid_count: number;
    next_due: string | null;
  }>,
  totalOutstanding: number
) {
  const body =
    rows.length === 0
      ? `<p>Everyone on a payment plan is paid up. Nothing outstanding.</p>`
      : `<p><strong>${rows.length}</strong> ${
          rows.length === 1 ? "agent is" : "agents are"
        } mid-plan, with <strong>${money(totalOutstanding)}</strong> still to collect.</p>
         <table style="width:100%;border-collapse:collapse;font-size:14px">
           <tr style="text-align:left;border-bottom:2px solid #111">
             <th style="padding:6px">Agent</th><th style="padding:6px">Office</th>
             <th style="padding:6px">Balance</th><th style="padding:6px">Made</th>
             <th style="padding:6px">Next due</th>
           </tr>
           ${rows
             .map(
               (r) => `<tr style="border-bottom:1px solid #ddd">
                 <td style="padding:6px">${r.agent_name}</td>
                 <td style="padding:6px">${r.office}</td>
                 <td style="padding:6px">${money(Number(r.balance))}</td>
                 <td style="padding:6px">${r.paid_count}/${PRICING.installmentCount}</td>
                 <td style="padding:6px">${
                   r.next_due ? longDate(String(r.next_due).slice(0, 10)) : "—"
                 }</td>
               </tr>`
             )
             .join("")}
         </table>`;

  return send(
    CONTACT.email,
    `Outstanding conference payments — ${rows.length} on a plan`,
    `<h2>Outstanding payment report</h2>${body}`
  );
}
