-- Run this once in your Supabase project's SQL editor
-- (Dashboard -> SQL Editor -> New query -> paste -> Run)

create table if not exists documents (
    id uuid primary key default gen_random_uuid(),
    doc_type text not null check (doc_type in ('invoice', 'receipt')),
    doc_number text not null,
    issue_date date,
    due_date date,
    business_name text,
    business_email text,
    business_phone text,
    business_address text,
    customer_name text,
    customer_email text,
    customer_phone text,
    customer_address text,
    items jsonb not null default '[]',
    subtotal numeric not null default 0,
    discount numeric not null default 0,
    tax_rate numeric not null default 0,
    tax numeric not null default 0,
    total numeric not null default 0,
    notes text,
    bank_name text,
    account_name text,
    account_number text,
    payment_method text,
    created_at timestamptz not null default now()
);

-- Row Level Security
alter table documents enable row level security;

-- NOTE: these policies allow anyone with your public "anon" key to
-- read/write/delete every row. That's fine for a small internal tool
-- where the anon key isn't shared publicly, but it is NOT safe for a
-- multi-tenant public product. See the README's "Extend it further"
-- section for how to lock this down with Supabase Auth.
create policy "public insert" on documents
    for insert with check (true);

create policy "public select" on documents
    for select using (true);

create policy "public delete" on documents
    for delete using (true);

create index if not exists documents_created_at_idx on documents (created_at desc);
