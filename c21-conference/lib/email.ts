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
