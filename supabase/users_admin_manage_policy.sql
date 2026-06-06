-- Hardened companion policy for the users-admin/users-auth Edge Function approach.
-- After moving auth and account-management reads/writes into Edge Functions,
-- public.users should no longer be readable or mutable directly by anon clients.
-- The only public access that remains is the signup insert policy in users_signup_policy.sql.

alter table public.users enable row level security;

drop policy if exists "allow users select for app" on public.users;
drop policy if exists "allow users insert for app" on public.users;
drop policy if exists "allow users update for app" on public.users;
drop policy if exists "allow users delete for app" on public.users;

-- Keep public signup policy in:
-- supabase/users_signup_policy.sql
