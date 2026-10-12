-- Splitwise clone schema (single group).
-- Run this once in the Supabase SQL editor (new projects). Existing projects: run migrations/ instead.
-- All money is stored as integer cents to avoid floating point drift.
-- RLS is enabled with no policies: the anon key cannot read or write anything.
-- The Next.js server talks to Supabase with the service role key, which bypasses RLS.

create extension if not exists pgcrypto;

create table if not exists settings (
  id int primary key default 1 check (id = 1),
  group_name text not null default 'Our Group',
  currency text not null default 'USD',
  simplify_debts boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into settings (id) values (1) on conflict (id) do nothing;

create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  color text not null default '#6366f1',
  archived boolean not null default false,
  -- The Google account (Supabase Auth user) that has claimed this member, if any.
  auth_user_id uuid unique references auth.users (id) on delete set null,
  email text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null check (char_length(description) between 1 and 120),
  amount_cents bigint not null check (amount_cents > 0),
  paid_by uuid not null references members (id),
  category text not null default 'general',
  split_type text not null check (split_type in ('equal', 'exact', 'percent', 'shares')),
  expense_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists expenses_date_idx on expenses (expense_date desc, created_at desc);

create table if not exists expense_splits (
  expense_id uuid not null references expenses (id) on delete cascade,
  member_id uuid not null references members (id),
  share_cents bigint not null check (share_cents >= 0),
  -- What the user typed (exact amount, percent or share count) so the form can be re-opened for editing.
  input_value numeric,
  primary key (expense_id, member_id)
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  from_member uuid not null references members (id),
  to_member uuid not null references members (id),
  amount_cents bigint not null check (amount_cents > 0),
  payment_date date not null default current_date,
  note text,
  created_at timestamptz not null default now(),
  check (from_member <> to_member)
);

create table if not exists activity (
  id bigserial primary key,
  kind text not null,
  message text not null,
  actor_name text,
  amount_cents bigint,
  created_at timestamptz not null default now()
);
create index if not exists activity_created_idx on activity (created_at desc);

alter table settings enable row level security;
alter table members enable row level security;
alter table expenses enable row level security;
alter table expense_splits enable row level security;
alter table payments enable row level security;
alter table activity enable row level security;

-- Create or update an expense together with its splits in one transaction.
create or replace function save_expense(
  p_id uuid,
  p_description text,
  p_amount_cents bigint,
  p_paid_by uuid,
  p_category text,
  p_split_type text,
  p_expense_date date,
  p_notes text,
  p_splits jsonb
) returns uuid
language plpgsql
as $$
declare
  v_id uuid;
  v_total bigint;
begin
  if p_id is null then
    insert into expenses (description, amount_cents, paid_by, category, split_type, expense_date, notes)
    values (p_description, p_amount_cents, p_paid_by, p_category, p_split_type, p_expense_date, p_notes)
    returning id into v_id;
  else
    update expenses
       set description = p_description,
           amount_cents = p_amount_cents,
           paid_by = p_paid_by,
           category = p_category,
           split_type = p_split_type,
           expense_date = p_expense_date,
           notes = p_notes,
           updated_at = now()
     where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Expense % not found', p_id;
    end if;
    delete from expense_splits where expense_id = v_id;
  end if;

  insert into expense_splits (expense_id, member_id, share_cents, input_value)
  select v_id,
         (s ->> 'member_id')::uuid,
         (s ->> 'share_cents')::bigint,
         nullif(s ->> 'input_value', '')::numeric
    from jsonb_array_elements(p_splits) as s;

  select coalesce(sum(share_cents), 0) into v_total from expense_splits where expense_id = v_id;
  if v_total <> p_amount_cents then
    raise exception 'Splits (%) do not add up to the total (%)', v_total, p_amount_cents;
  end if;

  return v_id;
end;
$$;

revoke execute on function save_expense(uuid, text, bigint, uuid, text, text, date, text, jsonb) from public, anon, authenticated;
