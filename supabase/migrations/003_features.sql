-- Body measurements tracker
create table if not exists public.body_measurements (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references public.clients(id) on delete cascade not null,
  measured_at date not null default current_date,
  weight_kg numeric,
  chest_cm numeric,
  waist_cm numeric,
  hips_cm numeric,
  bicep_cm numeric,
  thigh_cm numeric,
  notes text,
  created_at timestamptz default now()
);

-- Session notes
create table if not exists public.session_notes (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references public.clients(id) on delete cascade not null,
  coach_id uuid references public.coaches(id) on delete cascade not null,
  content text not null,
  session_date date not null default current_date,
  created_at timestamptz default now()
);

-- Milestones / goals
create table if not exists public.milestones (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references public.clients(id) on delete cascade not null,
  title text not null,
  target_date date,
  achieved_at timestamptz,
  created_at timestamptz default now()
);

-- Program templates
create table if not exists public.program_templates (
  id uuid default gen_random_uuid() primary key,
  coach_id uuid references public.coaches(id) on delete cascade not null,
  title text not null,
  weeks int not null default 4,
  content jsonb not null,
  created_at timestamptz default now()
);

-- Meal plans
create table if not exists public.meal_plans (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references public.clients(id) on delete cascade not null,
  coach_id uuid references public.coaches(id) on delete cascade not null,
  title text not null,
  content jsonb not null,
  ai_generated boolean default true,
  created_at timestamptz default now()
);

-- RLS
alter table public.body_measurements enable row level security;
alter table public.session_notes enable row level security;
alter table public.milestones enable row level security;
alter table public.program_templates enable row level security;
alter table public.meal_plans enable row level security;

create policy "Coach manages measurements" on public.body_measurements
  for all using (
    exists (select 1 from public.clients where id = client_id and coach_id = auth.uid())
  );

create policy "Coach manages session notes" on public.session_notes
  for all using (coach_id = auth.uid());

create policy "Coach manages milestones" on public.milestones
  for all using (
    exists (select 1 from public.clients where id = client_id and coach_id = auth.uid())
  );

create policy "Coach manages templates" on public.program_templates
  for all using (coach_id = auth.uid());

create policy "Coach manages meal plans" on public.meal_plans
  for all using (coach_id = auth.uid());
