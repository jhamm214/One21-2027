-- Migration 002: decline auto-expiry
-- Adds the expires_at column used to clean up abandoned pending_payment rows
-- after a declined first charge. Run once in Neon's SQL editor.

alter table registrations
  add column if not exists expires_at timestamptz;

create index if not exists idx_reg_expires
  on registrations(expires_at) where expires_at is not null;
