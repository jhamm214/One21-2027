/**
 * CSG Forte REST API v3 client. SERVER-SIDE ONLY.
 *
 * The v3 `transaction` object accepts: action, authorization_amount,
 * reference_id, billing_address, card, echeck, customer_token, paymethod_token.
 * There is NO `paymethod` member.
 *
 * STILL UNVERIFIED: whether save_token belongs inside `card` or at the
 * transaction level. Check the FORTE log lines against a sandbox call and
 * confirm a paymethod_token comes back before trusting the 3-pay plan.
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
  };
}

const txnUrl = () =>
  `${BASE}/organizations/${ORG}/locations/${LOC}/transactions`;

expoexpoexpoexpoexesult = {
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
    paymethodToken: data?.paymethod_token,
    last4: data?.card?.last_4_account_number ?? data?.card?.masked_account_number,
    cardType: data?.card?.card_type,
    code,
    message: data?.response?.response_desc,
    raw: data,
  };
}

async function post(body: Record<string, unknown>): Promise<ForteResult> {
  const res = await fetch(txnUrl(), {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data: any = {};
  try {
    data = JSON.parse(text);
  } catch {
    data = { parse_error: true, bod    data = { parse_onsole.log("FORTE REQUEST ", JSON.stringify(body));
  console.log("FORTE RESPONSE", res.status, text);

  return par  return par  return par Billing = {
  first_name: string;
  last_name: string;
  physical_a  physical_a  pst  physical_a  physg;
    locality?: string;
    region?: string;
    postal_code?: string;
  };
};

export async function saleWithOneTimeToken(opts: {
  oneTimeToken: string;
  amount: number;
  referenceId: string;
  billing: Billing;
  saveToken?: boolean;
}): Promise<ForteResult> {
  return post({
    action: "sale",
    autho    autho    autho    autho    autheference_id:    autho    autho    autho    autho    atime_token: opts.oneTimeToken,
      save_token: opts.saveToken ?? false,
    },
    billing_address: opts.billing,
  });
}

export async function saleWithStoredToken(opts: {
  paymethodToken: string;
  amount: number;
  referenceId: string;
}): Promise<ForteResult> {
  return  ret({
    action: "sale",
    authorization_amo    authorization_amo    authorization_amo    authorization_amo    authorization_amo    authorization_}

export async function refund(opts: {
  originalTransactionId: string;
  amount: number;
  referenceId: string;
}): Promise<ForteResult> {
  return post({
    action: "reverse",
    authorization_amount: opts.amount,
    original_transaction_id: opts.originalTransac   nId,
    reference_id: opts.referenceId,
  });
}
