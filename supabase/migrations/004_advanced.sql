-- Extend clients
alter table public.clients
  add column if not exists status text default 'actief' check (status in ('intake', 'actief', 'inactief', 'gestopt')),
  add column if not exists portal_token uuid default gen_random_uuid(),
  add column if not exists training_days text[] default '{}',
  add column if not exists intake_notes text;

-- Extend coaches
alter table public.coaches
  add column if not exists intake_token uuid default gen_random_uuid(),
  add column if not exists referral_code text;

update public.coaches set referral_code = substr(md5(id::text), 1, 8) where referral_code is null;

alter table public.coaches add constraint if not exists coaches_referral_code_unique unique (referral_code);

-- Add referred_by to coaches
alter table public.coaches add column if not exists referred_by text;

-- Benchmarks
create table if not exists public.benchmarks (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references public.clients(id) on delete cascade not null,
  exercise text not null,
  value numeric not null,
  unit text not null default 'kg',
  recorded_at date not null default current_date,
  notes text,
  created_at timestamptz default now()
);

-- Progress photos
create table if not exists public.progress_photos (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references public.clients(id) on delete cascade not null,
  photo_url text not null,
  label text default 'voortgang' check (label in ('voor', 'na', 'voortgang')),
  taken_at date not null default current_date,
  notes text,
  created_at timestamptz default now()
);

-- Invoices
create table if not exists public.invoices (
  id uuid default gen_random_uuid() primary key,
  coach_id uuid references public.coaches(id) on delete cascade not null,
  client_id uuid references public.clients(id) on delete set null,
  amount_cents int not null,
  description text not null,
  status text default 'open' check (status in ('open', 'betaald', 'verlopen')),
  due_date date,
  paid_at timestamptz,
  created_at timestamptz default now()
);

-- RLS
alter table public.benchmarks enable row level security;
alter table public.progress_photos enable row level security;
alter table public.invoices enable row level security;

create policy "Coach manages benchmarks" on public.benchmarks
  for all using (exists (select 1 from public.clients where id = client_id and coach_id = auth.uid()));

create policy "Coach manages photos" on public.progress_photos
  for all using (exists (select 1 from public.clients where id = client_id and coach_id = auth.uid()));

create policy "Coach manages invoices" on public.invoices
  for all using (coach_id = auth.uid());
