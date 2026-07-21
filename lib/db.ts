import { neon } from "@neondatabase/serverless";

// Neon's HTTP driver. No connection pool to manage and no client to close,
// which is what makes it a good fit for serverless functions on Vercel.
//
// Requires DATABASE_URL in your environment. Use the POOLED connection string
// from the Neon console — the hostname contains "-pooler".

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Add it in Vercel > Settings > Environment Variables.");
}

export const sql = neon(process.env.DATABASE_URL);
