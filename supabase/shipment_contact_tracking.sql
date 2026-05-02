create table if not exists public.calls_log (
    id bigserial primary key,
    shipment_code text,
    rep_name text,
    method text,
    result text,
    created_at timestamp without time zone default now()
);

create index if not exists calls_log_created_at_idx on public.calls_log (created_at desc);

alter table public.calls_log enable row level security;

drop policy if exists calls_log_insert_policy on public.calls_log;
create policy calls_log_insert_policy
on public.calls_log
for insert
to anon, authenticated
with check (true);

drop policy if exists calls_log_select_policy on public.calls_log;
create policy calls_log_select_policy
on public.calls_log
for select
to anon, authenticated
using (true);
