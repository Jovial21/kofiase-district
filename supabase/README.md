# Supabase Setup

1. Create a Supabase project.
2. Open the Supabase SQL Editor and run `supabase/schema.sql`.
3. In Supabase Auth, create an admin user with email and password.
4. Register that Auth user as an admin. The easiest way is to edit and run `supabase/add-admin.sql` in the SQL Editor.

Or run this manually:

```sql
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
```

5. Copy your project URL and anon/publishable key into `js/supabase-config.js`.
6. Open `admin/login.html` and sign in with the Auth user.

The anon/publishable key is safe to expose in this static frontend. Row Level Security in `schema.sql` protects admin-only reads and writes.

The schema includes public/admin tables for sermons, events, gallery items, messages, giving records, and site settings. It also creates a public Supabase Storage bucket named `gallery`.

Gallery images can be uploaded from `admin/gallery.html` or saved as URLs in `gallery_items.image_url`; use local paths such as `assets/images/event-prayer.png`, hosted image URLs, or Supabase Storage public URLs.
