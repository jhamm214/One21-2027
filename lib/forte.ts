/**
 * CSG Forte REST API v3 client. SERVER-SIDE ONLY.
 *
 * FORTE_API_SECURE_KEY must never reach the browser. Card data never touches
 * this server — Forte.js tokenizes in the browser and hands us a one-time
 * token, which we exchange for a stored paymethod token for installments 2
 * and 3. That keeps us in SAQ-A scope.
 *
 * NOTE: verify field names against the current Forte v3 docs before going to
 * production. UAT and production have historically differed in response shape.
 */

const BASE = process.env.FORTE_BASE_URL!; // sandbox vs production
const ORG = process.env.FORTE_ORG_ID!; // org_xxxxxx
const LOC = process.env.FORTE_LOCATION_ID!; // loc_xxxxxx

function headers() {
  const basic = Buffer.from(
    `${process.env.FORTE_API_ACCESS_ID}:${process.env.FORTE_API_SECURE_KEY}`
  ).toString("base64");
  return {
    Authorization: `Basic ${basic}`,
    "X-Forte-Auth-Organization-Id": ORG,
    "Content-Type": "application/json",
  };
}

const txnUrl = () =>
  `${BASE}/organizations/${ORG}/locations/${LOC}/transactions`;

export type ForteResult = {
  approved: boolean;
  transactionId?: string;
  paymethodToken?: string;
  last4?: string;
  cardType?: string;
  code?: string;
  message?: string;
  raw: any;
};

function parse(data: any): ForteResult {
  console.log("FORTE RESPONSE", JSON.stringify(data));
  const code = data?.response?.response_code;
  return {
    approved: code === "A01",
    transactionId: data?.transaction_id,
    paymethodToken: data?.paymethod_token,
    last4: data?.card?.last_4_account_number,
    cardType: data?.card?.card_type,
    code,
    message: data?.response?.response_desc,
    raw: data,
  };
}

export type Billing = {
  first_name: string;
  last_name: string;
  physical_address?: {
    street_line1?: string;
    locality?: string;
    region?: string;
    postal_code?: string;
  };
};

/**
 * Charge a one-time token from Forte.js. Used for pay-in-full, and for
 * installment #1 at signup.
 *
 * `save_token: true` asks Forte to return a reusable paymethod token, which we
 * persist for installments 2 and 3. Without it, the 3-pay plan cannot work.
 */
export async function saleWithOneTimeToken(opts: {
  oneTimeToken: string;
  amount: number;
  referenceId: string;
  billing: Billing;
  saveToken?: boolean;
}): Promise<ForteResult> {
  const res = await fetch(txnUrl(), {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      action: "sale",
      authorization_amount: opts.amount,
      reference_id: opts.referenceId,
      card: {
        one_time_token: opts.oneTimeToken,
        save_token: opts.saveToken ?? false,
      },
      billing_address: opts.billing,
    }),
  });
  return parse(await res.json());
}

/** Charge a STORED paymethod token. Used by the cron for installments 2 and 3. */
export async function saleWithStoredToken(opts: {
  paymethodToken: string;
  amount: number;
  referenceId: string;
}): Promise<ForteResult> {
  const res = await fetch(txnUrl(), {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      action: "sale",
      authorization_amount: opts.amount,
      reference_id: opts.referenceId,
      paymethod_token: opts.paymethodToken,
    }),
  });
  return parse(await res.json());
}

/**
 * Refund a settled transaction. Note: refunds can also be issued by hand in
 * Dex. Doing it here keeps our payments table as the source of truth and
 * writes an audit row — prefer this path.
 */
export async function refund(opts: {
  originalTransactionId: string;
  amount: number;
  referenceId: string;
}): Promise<ForteResult> {
  const res = await fetch(txnUrl(), {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      action: "reverse",
      authorization_amount: opts.amount,
      original_transaction_id: opts.originalTransactionId,
      reference_id: opts.referenceId,
    }),
  });
  return parse(await res.json());
}
