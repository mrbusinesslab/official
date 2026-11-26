
create table public.service_usage_events (
 id uuid primary key,
 service text not null check(service in ('outstanding_quote','lifeos')),
 operation text not null check(operation ~ '^[a-z][a-z0-9_]{0,59}$'),
 outcome text not null check(outcome in ('success','failure','partial','response')),
 duration_ms integer not null check(duration_ms between 0 and 3600000),
 error_code text check(error_code is null or error_code ~ '^[a-z][a-z0-9_]{0,59}$'),
 session_id uuid,
 tenant_id text,
 source text not null check(source in ('browser','server')),
 is_test boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.service_usage_events enable row level security;
revoke all on public.service_usage_events from public,anon,authenticated;
grant select,insert on public.service_usage_events to service_role;
create index service_usage_events_time_idx on public.service_usage_events(created_at desc);
create index service_usage_events_session_idx on public.service_usage_events(session_id,created_at desc);
create view public.service_usage_daily with (security_invoker=true) as
 select (created_at at time zone 'Asia/Taipei')::date as day,service,operation,outcome,is_test,
 count(*) as events,round(avg(duration_ms)) as average_duration_ms,
 percentile_cont(0.5) within group(order by duration_ms) as median_duration_ms
 from public.service_usage_events group by 1,2,3,4,5;
revoke all on public.service_usage_daily from public,anon,authenticated;
grant select on public.service_usage_daily to service_role;
