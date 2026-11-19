create table if not exists public.sw_settings (
    user_id uuid primary key references auth.users(id) on delete cascade,
    tariff numeric(10,4) not null default 0.8900 check (tariff > 0 and tariff <= 100),
    updated_at timestamptz not null default now()
);

create table if not exists public.sw_locations (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    title text not null check (char_length(trim(title)) between 1 and 45),
    type text not null default 'home' check (type in ('home','office','warehouse')),
    city text not null default '',
    street text not null default '',
    number text not null default '',
    cep text not null default '',
    district text not null default '',
    extra text not null default '',
    created_at timestamptz not null default now(),
    unique (id, user_id)
);

create table if not exists public.sw_readings (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    location_id uuid not null,
    reading_date date not null,
    kwh numeric(12,2) not null check (kwh > 0 and kwh <= 10000000),
    due_date date,
    created_at timestamptz not null default now(),
    constraint sw_readings_location_owner_fk foreign key (location_id, user_id)
      references public.sw_locations(id, user_id) on delete cascade
);

create index if not exists sw_locations_user_idx on public.sw_locations(user_id);
create index if not exists sw_readings_user_date_idx on public.sw_readings(user_id, reading_date desc);
create index if not exists sw_readings_user_location_idx on public.sw_readings(user_id, location_id);

alter table public.sw_settings enable row level security;
alter table public.sw_locations enable row level security;
alter table public.sw_readings enable row level security;

drop policy if exists sw_settings_owner on public.sw_settings;
create policy sw_settings_owner on public.sw_settings for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists sw_locations_owner on public.sw_locations;
create policy sw_locations_owner on public.sw_locations for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists sw_readings_owner on public.sw_readings;
create policy sw_readings_owner on public.sw_readings for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.sw_settings to authenticated;
grant select, insert, update, delete on public.sw_locations to authenticated;
grant select, insert, update, delete on public.sw_readings to authenticated;
revoke all on public.sw_settings from anon;
revoke all on public.sw_locations from anon;
revoke all on public.sw_readings from anon;
