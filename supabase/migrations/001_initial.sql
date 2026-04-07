-- ============================================================
-- CoachAI — Initial Schema
-- Run this in the Supabase SQL editor
-- ============================================================

-- coaches (mirrors auth.users)
create table if not exists public.coaches (
  id               uuid primary key references auth.users(id) on delete cascade,
  full_name        text,
  stripe_customer_id text,
  plan             text not null default 'free' check (plan in ('free', 'pro')),
  created_at       timestamptz not null default now()
);

-- clients
create table if not exists public.clients (
  id             uuid primary key default gen_random_uuid(),
  coach_id       uuid not null references public.coaches(id) on delete cascade,
  full_name      text not null,
  goal           text not null,
  level          text not null check (level in ('beginner', 'intermediate', 'advanced')),
  days_per_week  int  not null check (days_per_week between 1 and 6),
  injuries       text,
  equipment      text[] not null default '{}',
  created_at     timestamptz not null default now()
);

-- programs
create table if not exists public.programs (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients(id) on delete cascade,
  coach_id      uuid not null references public.coaches(id) on delete cascade,
  title         text not null,
  weeks         int  not null default 4,
  content       jsonb not null default '{}',
  ai_generated  bool not null default true,
  created_at    timestamptz not null default now()
);

-- check_ins
create table if not exists public.check_ins (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  week_number  int  not null,
  weight_kg    numeric,
  energy       int  not null check (energy between 1 and 10),
  sleep_hrs    numeric,
  notes        text,
  ai_feedback  text,
  submitted_at timestamptz not null default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.coaches   enable row level security;
alter table public.clients   enable row level security;
alter table public.programs  enable row level security;
alter table public.check_ins enable row level security;

-- coaches: each coach sees only their own row
create policy "coaches_self" on public.coaches
  for all using (auth.uid() = id);

-- clients: coach owns their clients
create policy "clients_coach" on public.clients
  for all using (auth.uid() = coach_id);

-- programs: coach owns their programs
create policy "programs_coach" on public.programs
  for all using (auth.uid() = coach_id);

-- check_ins: coach can read check-ins for their own clients
create policy "checkins_coach_read" on public.check_ins
  for select using (
    exists (
      select 1 from public.clients
      where clients.id = check_ins.client_id
        and clients.coach_id = auth.uid()
    )
  );

-- check_ins: allow unauthenticated insert (public check-in form)
create policy "checkins_public_insert" on public.check_ins
  for insert with check (true);

-- ============================================================
-- Trigger: auto-create coach row on signup
-- ============================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.coaches (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
