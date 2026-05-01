-- Run this in the Supabase SQL Editor after creating the user in Authentication.
-- Change the email, display name, and role before running.

insert into public.admin_profiles (id, display_name, role)
select
  u.id,
  'Office Admin',
  'Administrator'
from auth.users u
where u.email = 'admin@example.com'
on conflict (id) do update
set
  display_name = excluded.display_name,
  role = excluded.role;

-- Confirm the admin was added.
select
  p.id,
  u.email,
  p.display_name,
  p.role,
  p.created_at
from public.admin_profiles p
join auth.users u on u.id = p.id
order by p.created_at desc;
