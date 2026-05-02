create table if not exists public.calls_log (
    id bigserial primary key,
    shipment_code text,
    rep_name text,
    method text,
    result text,
    created_at timestamp without time zone default now()
);

create index if not exists calls_log_created_at_idx on public.calls_log (created_at desc);
