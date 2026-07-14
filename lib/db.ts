import { Pool } from "pg";

const globalForPg = global as unknown as { pool?: Pool };

export const pool =
  globalForPg.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });

if (process.env.NODE_ENV !== "production") globalForPg.pool = pool;

export async function q<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}

export async function one<T = any>(
  text: string,
  params: any[] = []
): Promise<T | null> {
  const rows = await q<T>(text, params);
  return rows[0] ?? null;
}

export async function audit(
  registrationId: string | null,
  actor: string,
  action: string,
  detail: any = {}
) {
  await q(
    `insert into audit_log (registration_id, actor, action, detail)
     values ($1,$2,$3,$4)`,
    [registrationId, actor, action, JSON.stringify(detail)]
  );
}
