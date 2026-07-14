-- C21JFC Conference registration schema
-- Postgres 14+. Run once against your database (Neon / Supabase / RDS).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- registrations
-- A row is created the moment an agent submits the form — BEFORE any payment.
-- This is what kills the "missing agents on attendee lists" problem: every
-- human who intends to come exists here from minute one, paid or not.
-- ---------------------------------------------------------------------------

do $$ begin
  create type reg_status as enum (
    'pending_payment',  -- form submitted, no money yet
    'reserved',         -- installment plan, payment 1 cleared, not yet paid in full
    'paid_in_full',     -- $690 received
    'cancelled',        -- withdrew, or installments failed past cure period
    'transferred'       -- seat reassigned to another agent
  );
exception when duplicate_object then null; end $$;

create table if not exists registrations (
  id                 uuid primary key default gen_random_uuid(),
  agent_name         text not null,
  agent_id           text,
  office             text not null,
  rsm                text not null,
  email              text not null,
  phone              text not null,
  dietary            text,
  accessibility      text,

  plan               text not null check (plan in ('full','installment')),
  amount_total       numeric(10,2) not null,
  amount_paid        numeric(10,2) not null default 0,
  status             reg_status not null default 'pending_payment',

  -- Set ONLY by the weekly seat-purchase batch, and only for paid_in_full rows.
  seat_purchased_at  timestamptz,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_reg_status on registrations(status);
create index if not exists idx_reg_rsm    on registrations(rsm);
create index if not exists idx_reg_office on registrations(office);
create unique index if not exists idx_reg_email on registrations(lower(email))
  where status <> 'cancelled';

-- ---------------------------------------------------------------------------
-- payments
-- One row per intended charge. For a 3-pay plan, three rows are written at
-- signup: #1 due today, #2 due 2026-12-16, #3 due 2027-01-15.
-- We store Forte's paymethod TOKEN. Never a card number.
-- ---------------------------------------------------------------------------

create table if not exists payments (
  id                    uuid primary key default gen_random_uuid(),
  registration_id       uuid not null references registrations(id) on delete cascade,

  forte_transaction_id  text,
  forte_paymethod_token text,          -- token only
  card_last4            text,          -- display only
  card_type             text,

  installment_no        smallint,      -- 1..3; null for pay-in-full
  amount                numeric(10,2) not null,
  due_date              date not null,

  status                text not null default 'scheduled'
                        check (status in ('scheduled','paid','failed','refunded','voided')),
  attempts              smallint not null default 0,
  last_error            text,
  charged_at            timestamptz,

  created_at            timestamptz not null default now()
);

create index if not exists idx_pay_due on payments(status, due_date);
create index if not exists idx_pay_reg on payments(registration_id);
create unique index if not exists idx_pay_forte_txn
  on payments(forte_transaction_id) where forte_transaction_id is not null;

-- ---------------------------------------------------------------------------
-- consents
-- The chargeback defense. Card-network rules require documented cardholder
-- authorization for installment billing. Store the text EXACTLY as displayed.
-- ---------------------------------------------------------------------------

create table if not exists consents (
  id              uuid primary key default gen_random_uuid(),
  registration_id uuid not null references registrations(id) on delete cascade,
  consent_text    text not null,      -- verbatim, as shown on screen
  ip              inet,
  user_agent      text,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- audit_log
-- Every refund, transfer, cancellation, and manual override. Non-negotiable
-- for a payment system you will be asked to explain later.
-- ---------------------------------------------------------------------------

create table if not exists audit_log (
  id              bigserial primary key,
  registration_id uuid references registrations(id) on delete set null,
  actor           text not null,      -- 'system' | 'cron' | admin email
  action          text not null,      -- 'created' | 'charged' | 'failed' | 'refunded' | 'transferred' | 'cancelled' | 'seat_purchased'
  detail          jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists idx_audit_reg on audit_log(registration_id, created_at desc);
