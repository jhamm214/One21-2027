/**
 * CSG Forte REST API v3 client. SERVER-SIDE ONLY.
 *
 * One-time token from Forte.js goes in the transaction body as `onetime_token`
 * at the top level (Forte v3). Org/location are prefixed (org_, loc_) and sent
 * in the URL and the X-Forte-Auth-Organization-Id header.
 */

const BASE = process.env.FORTE_BASE_URL!;
const ORG = process.env.FORTE_ORG_ID!;
const LOC = process.env.FORTE_LOCATION_ID!;

function headers() {
  const basic = Buffer.from(
    `${process.env.FORTE_API_ACCESS_ID}:${process.env.FORTE_API_SECURE_KEY}`
  ).toString("base64");
  return {
    Authorization: `Basic ${basic}`,
    "X-Forte-Auth-Organization-Id": ORG,
    "Content-Type": "application/json",
    Accept: "application/json",
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
  const code = data?.response?.response_code;
  return {
    approved: code === "A01",
    transactionId: data?.transaction_id,
    paymethodToken: data?.paymethod?.paymethod_token ?? data?.paymethod_token,
    last4: data?.card?.last_4_account_number,
    cardType: data?.card?.card_type,
    code,
    // Surface Forte's raw error text so failures are legible.
    message:
      data?.response?.response_desc ??
      data?.message ??
      (Array.isArray(data?.errors)
        ? data.errors.map((e: any) => e.description ?? e.message ?? JSON.stringify(e)).join(" | ")
        : undefined),
    raw: data,
  };
}

export type Billing = {
  first_name: string;
  last_name: string;
};

export async function saleWithOneTimeToken(opts: {
  oneTimeToken: string;
  amount: number;
  referenceId: string;
  billing: Billing;
  saveToken?: boolean;
}): Promise<ForteResult> {
  const body = {
    action: "sale",
    authorization_amount: opts.amount,
    reference_id: opts.referenceId,
    billing_address: opts.billing,
    // Forte v3: a Forte.js one-time token nests inside the card object.
    card: { one_time_token: opts.oneTimeToken },
    save_token: opts.saveToken ?? false,
  };
  const res = await fetch(txnUrl(), {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  // Log the full exchange in Vercel's function logs for diagnosis.
  console.log("FORTE sale request:", JSON.stringify(body));
  console.log("FORTE sale response:", JSON.stringify(data));
  return parse(data);
}

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
  const data = await res.json();
  console.log("FORTE stored-sale response:", JSON.stringify(data));
  return parse(data);
}

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
