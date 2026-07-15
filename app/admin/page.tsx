import { q } from "@/lib/db";
import { money, longDate, DATES, PRICING } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * The tracking spreadsheet — except nobody maintains it.
 *
 * Gate this behind your auth (Microsoft Entra / M365 SSO is the obvious choice
 * given the tenant you already run). Access: James + Rebecca.
 */
export default async function Admin() {
  const rows = await q<any>(
    `select r.*, coalesce(sum(p.amount) filter (where p.status='paid'),0) as collected
       from registrations r
       left join payments p on p.registration_id = r.id
      group by r.id
      order by r.status, r.office, r.agent_name`
  );

  const count = (s: string) => rows.filter((r) => r.status === s).length;
  const collected = rows.reduce((a, r) => a + Number(r.collected), 0);
  const outstanding = rows
    .filter((r) => r.status === "reserved")
    .reduce((a, r) => a + (Number(r.amount_total) - Number(r.amount_paid)), 0);

  const failing = await q<any>(
    `select r.agent_name, r.phone, r.office, p.installment_no, p.attempts, p.last_error, p.due_date
       from payments p join registrations r on r.id = p.registration_id
      where p.status = 'failed' and r.status <> 'cancelled'
      order by p.due_date`
  );

  // Everyone on a payment plan who hasn't finished paying — the outstanding report.
  const outstandingRows = await q<any>(
    `select r.agent_name, r.office, r.rsm, r.email, r.phone,
            r.amount_paid, r.amount_total,
            (r.amount_total - r.amount_paid) as balance,
            (select count(*) from payments p
              where p.registration_id = r.id and p.status = 'paid') as paid_count,
            (select min(due_date) from payments p
              where p.registration_id = r.id and p.status in ('scheduled','failed')) as next_due
       from registrations r
      where r.status = 'reserved'
      order by next_due nulls last, r.agent_name`
  );
  const totalOutstanding = outstandingRows.reduce(
    (a, r) => a + Number(r.balance),
    0
  );

  return (
    <>
      <p className="eyebrow">Internal</p>
      <h1>Registration status</h1>

      <table style={{ marginBottom: 32 }}>
        <tbody>
          <tr>
            <td>Confirmed (paid in full)</td>
            <td><strong>{count("paid_in_full")}</strong></td>
          </tr>
          <tr>
            <td>Reserved (installments in progress)</td>
            <td><strong>{count("reserved")}</strong></td>
          </tr>
          <tr>
            <td>Started, not paid</td>
            <td><strong>{count("pending_payment")}</strong></td>
          </tr>
          <tr>
            <td>Cancelled</td>
            <td><strong>{count("cancelled")}</strong></td>
          </tr>
          <tr>
            <td>Cash collected</td>
            <td><strong>{money(collected)}</strong></td>
          </tr>
          <tr>
            <td>Outstanding on installment plans</td>
            <td><strong>{money(outstanding)}</strong></td>
          </tr>
          <tr>
            <td>Seats purchased</td>
            <td>
              <strong>{rows.filter((r) => r.seat_purchased_at).length}</strong>
            </td>
          </tr>
        </tbody>
      </table>

      <p style={{ fontSize: "0.9rem", color: "var(--slate)" }}>
        3-pay closes {longDate(DATES.installmentCutoff)} · Deadline{" "}
        {longDate(DATES.registrationDeadline)}
      </p>

      {failing.length > 0 && (
        <>
          <h2 style={{ color: "var(--alert)" }}>Needs a call ({failing.length})</h2>
          <table>
            <thead>
              <tr>
                <th>Agent</th>
                <th>Phone</th>
                <th>Pmt</th>
                <th>Attempts</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {failing.map((f, i) => (
                <tr key={i}>
                  <td>{f.agent_name}</td>
                  <td>{f.phone}</td>
                  <td>{f.installment_no} of {PRICING.installmentCount}</td>
                  <td>{f.attempts}</td>
                  <td>{f.last_error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h2>Outstanding payments ({outstandingRows.length})</h2>
      <p style={{ color: "var(--slate)" }}>
        On a payment plan, not yet paid in full. Total still owed:{" "}
        <strong>{money(totalOutstanding)}</strong>.
      </p>
      {outstandingRows.length === 0 ? (
        <p style={{ color: "var(--slate)" }}>Everyone on a plan is paid up.</p>
      ) : (
        <table style={{ marginBottom: 32 }}>
          <thead>
            <tr>
              <th>Agent</th>
              <th>Office</th>
              <th>Paid</th>
              <th>Balance</th>
              <th>Payments made</th>
              <th>Next due</th>
            </tr>
          </thead>
          <tbody>
            {outstandingRows.map((r, i) => (
              <tr key={i}>
                <td>{r.agent_name}</td>
                <td>{r.office}</td>
                <td>{money(Number(r.amount_paid))}</td>
                <td><strong>{money(Number(r.balance))}</strong></td>
                <td>{r.paid_count} of {PRICING.installmentCount}</td>
                <td>{r.next_due ? longDate(String(r.next_due).slice(0, 10)) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Everyone ({rows.length})</h2>
      <p>
        <a href="/api/admin/export">Download CSV</a>
      </p>
      <table>
        <thead>
          <tr>
            <th>Agent</th>
            <th>Office</th>
            <th>RSM</th>
            <th>Plan</th>
            <th>Paid</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.agent_name}</td>
              <td>{r.office}</td>
              <td>{r.rsm}</td>
              <td>{r.plan === "full" ? "Full" : "3-pay"}</td>
              <td>{money(Number(r.amount_paid))}</td>
              <td>
                <span className={`pill ${r.status}`}>
                  {r.status.replace(/_/g, " ")}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
