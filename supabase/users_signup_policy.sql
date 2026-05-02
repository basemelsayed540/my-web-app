-- Allow public signup requests from the website to insert pending users.
-- Run this in Supabase SQL Editor for the current project.

alter table public.users enable row level security;

drop policy if exists "allow public signup insert" on public.users;

create policy "allow public signup insert"
on public.users
for insert
to anon
with check (
    coalesce(username, '') <> ''
    and coalesce(phone, '') <> ''
    and coalesce(password, '') <> ''
    and coalesce(email, '') <> 'admin@admin.com'
    and phone <> 'admin'
    and approved = false
    and role in ('rep', 'sub-rep', 'sender', 'follower')
);
