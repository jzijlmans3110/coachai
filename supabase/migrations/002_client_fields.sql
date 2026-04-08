-- Extra client velden
alter table public.clients
  add column if not exists age           int,
  add column if not exists weight_kg     numeric,
  add column if not exists height_cm     numeric,
  add column if not exists gender        text check (gender in ('man', 'vrouw', 'anders')),
  add column if not exists experience_years numeric default 0,
  add column if not exists training_time text check (training_time in ('ochtend', 'middag', 'avond', 'wisselend')),
  add column if not exists medical_notes text,
  add column if not exists phone         text;
