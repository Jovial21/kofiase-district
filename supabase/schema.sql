create extension if not exists pgcrypto;

create table if not exists public.admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Admin',
  role text not null default 'Administrator',
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_profiles
    where id = auth.uid()
  );
$$;

create table if not exists public.sermons (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  speaker text,
  sermon_date date,
  category text default 'worship',
  series text,
  summary text,
  video_url text,
  thumbnail_url text,
  duration text,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published')),
  featured boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_date date not null,
  start_time time,
  end_time time,
  ministry text,
  location text,
  description text,
  image_url text,
  status text not null default 'draft' check (status in ('draft', 'featured', 'published')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  ministry text,
  announcement_date date not null default current_date,
  summary text,
  body text,
  link_url text,
  link_label text,
  priority text not null default 'normal' check (priority in ('normal', 'featured', 'urgent')),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  expires_on date,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  caption text,
  category text not null default 'worship',
  image_url text not null,
  alt_text text,
  taken_on date,
  status text not null default 'draft' check (status in ('draft', 'featured', 'published')),
  sort_order integer not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ministries (
  slug text primary key,
  name text not null,
  page_url text,
  summary text,
  focus_title text,
  focus_body text,
  programs jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published')),
  sort_order integer not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  phone text,
  topic text,
  message text not null,
  status text not null default 'unread' check (status in ('unread', 'open', 'resolved')),
  reply text,
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.giving_records (
  id uuid primary key default gen_random_uuid(),
  giver_name text,
  email text,
  phone text,
  payment_channel text,
  fund text not null,
  amount numeric(12,2) not null check (amount > 0),
  reference text,
  status text not null default 'pending' check (status in ('pending', 'recorded', 'reconciled')),
  received_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gallery',
  'gallery',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sermons_touch_updated_at on public.sermons;
create trigger sermons_touch_updated_at
before update on public.sermons
for each row execute function public.touch_updated_at();

drop trigger if exists events_touch_updated_at on public.events;
create trigger events_touch_updated_at
before update on public.events
for each row execute function public.touch_updated_at();

drop trigger if exists announcements_touch_updated_at on public.announcements;
create trigger announcements_touch_updated_at
before update on public.announcements
for each row execute function public.touch_updated_at();

drop trigger if exists gallery_items_touch_updated_at on public.gallery_items;
create trigger gallery_items_touch_updated_at
before update on public.gallery_items
for each row execute function public.touch_updated_at();

drop trigger if exists ministries_touch_updated_at on public.ministries;
create trigger ministries_touch_updated_at
before update on public.ministries
for each row execute function public.touch_updated_at();

drop trigger if exists messages_touch_updated_at on public.messages;
create trigger messages_touch_updated_at
before update on public.messages
for each row execute function public.touch_updated_at();

drop trigger if exists giving_records_touch_updated_at on public.giving_records;
create trigger giving_records_touch_updated_at
before update on public.giving_records
for each row execute function public.touch_updated_at();

alter table public.admin_profiles enable row level security;
alter table public.sermons enable row level security;
alter table public.events enable row level security;
alter table public.announcements enable row level security;
alter table public.gallery_items enable row level security;
alter table public.ministries enable row level security;
alter table public.messages enable row level security;
alter table public.giving_records enable row level security;
alter table public.site_settings enable row level security;

drop policy if exists "Admins can read admin profiles" on public.admin_profiles;
create policy "Admins can read admin profiles"
on public.admin_profiles for select
to authenticated
using (public.is_admin() or id = auth.uid());

drop policy if exists "Public can read published sermons" on public.sermons;
create policy "Public can read published sermons"
on public.sermons for select
to anon, authenticated
using (status = 'published' or public.is_admin());

drop policy if exists "Admins can manage sermons" on public.sermons;
create policy "Admins can manage sermons"
on public.sermons for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read published events" on public.events;
create policy "Public can read published events"
on public.events for select
to anon, authenticated
using (status = 'published' or public.is_admin());

drop policy if exists "Admins can manage events" on public.events;
create policy "Admins can manage events"
on public.events for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read published announcements" on public.announcements;
create policy "Public can read published announcements"
on public.announcements for select
to anon, authenticated
using (status = 'published' or public.is_admin());

drop policy if exists "Admins can manage announcements" on public.announcements;
create policy "Admins can manage announcements"
on public.announcements for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read published gallery items" on public.gallery_items;
create policy "Public can read published gallery items"
on public.gallery_items for select
to anon, authenticated
using (status in ('published', 'featured') or public.is_admin());

drop policy if exists "Admins can manage gallery items" on public.gallery_items;
create policy "Admins can manage gallery items"
on public.gallery_items for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read published ministries" on public.ministries;
create policy "Public can read published ministries"
on public.ministries for select
to anon, authenticated
using (status = 'published' or public.is_admin());

drop policy if exists "Admins can manage ministries" on public.ministries;
create policy "Admins can manage ministries"
on public.ministries for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read gallery images" on storage.objects;
create policy "Public can read gallery images"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'gallery');

drop policy if exists "Admins can upload gallery images" on storage.objects;
create policy "Admins can upload gallery images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'gallery' and public.is_admin());

drop policy if exists "Admins can update gallery images" on storage.objects;
create policy "Admins can update gallery images"
on storage.objects for update
to authenticated
using (bucket_id = 'gallery' and public.is_admin())
with check (bucket_id = 'gallery' and public.is_admin());

drop policy if exists "Admins can delete gallery images" on storage.objects;
create policy "Admins can delete gallery images"
on storage.objects for delete
to authenticated
using (bucket_id = 'gallery' and public.is_admin());

drop policy if exists "Public can create messages" on public.messages;
create policy "Public can create messages"
on public.messages for insert
to anon, authenticated
with check (true);

drop policy if exists "Admins can manage messages" on public.messages;
create policy "Admins can manage messages"
on public.messages for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can create giving records" on public.giving_records;
create policy "Public can create giving records"
on public.giving_records for insert
to anon, authenticated
with check (status = 'pending');

drop policy if exists "Admins can manage giving records" on public.giving_records;
create policy "Admins can manage giving records"
on public.giving_records for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read site settings" on public.site_settings;
create policy "Public can read site settings"
on public.site_settings for select
to anon, authenticated
using (true);

drop policy if exists "Admins can manage site settings" on public.site_settings;
create policy "Admins can manage site settings"
on public.site_settings for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Seeded sermon sample removed. Use migrations or an admin UI to add sermons.

insert into public.events (title, event_date, start_time, ministry, location, description, image_url, status)
select *
from (values
  ('Youth Week of Prayer', date '2026-06-01', null::time, 'Youth Ministry', 'SDA Church Kofiase District', 'A week of prayer, music, Bible study, and mission focus for young people.', 'assets/images/event-prayer.png', 'published'),
  ('District Sabbath School Program', date '2026-06-14', time '09:00', 'District', 'SDA Church Kofiase District', 'District-wide lesson discussion, testimonies, and fellowship.', 'assets/images/event-bible.png', 'published'),
  ('Health & Wellness Seminar', date '2026-06-28', time '14:00', 'Health Ministry', 'SDA Church Kofiase District', 'Practical teaching on nutrition, lifestyle, and whole-person health.', 'assets/images/event-health.png', 'published')
) as seed(title, event_date, start_time, ministry, location, description, image_url, status)
where not exists (
  select 1 from public.events e
  where e.title = seed.title and e.event_date = seed.event_date
);

insert into public.announcements (title, ministry, announcement_date, summary, body, link_url, link_label, priority, status, expires_on)
select *
from (values
  ('Youth Camp Registration', 'Youth Ministry', date '2026-05-05', 'Registration details, camp preparation, and payment guidance will be shared by the Youth Ministry team.', 'Youth Camp registration is open. Members should contact the Youth Ministry leaders for registration deadlines, transport arrangements, and camp preparation.', 'youth.html', 'Youth Ministry', 'featured', 'published', date '2026-06-01'),
  ('All-night Prayer', 'District', date '2026-05-10', 'Join the district family for prayer, praise, testimonies, and Bible reflection.', 'The district will hold an all-night prayer program with worship, testimonies, Bible reflection, and intercession for families, youth, and mission.', 'events.html', 'View Events', 'urgent', 'published', date '2026-05-11'),
  ('Health Outreach Volunteers', 'Health Ministry', date '2026-05-15', 'Health Ministry is receiving names of members available to support upcoming community outreach.', 'Volunteers are needed for registration, hospitality, wellness education, and community follow-up during the next health outreach.', 'health.html', 'Health Ministry', 'normal', 'published', null::date)
) as seed(title, ministry, announcement_date, summary, body, link_url, link_label, priority, status, expires_on)
where not exists (
  select 1 from public.announcements a
  where a.title = seed.title and a.announcement_date = seed.announcement_date
);

insert into public.gallery_items (title, caption, category, image_url, alt_text, taken_on, status, sort_order)
select *
from (values
  ('Sabbath at Kofiase', 'The church gathers for worship and fellowship.', 'worship', 'assets/images/hero-church.png', 'SDA Church Kofiase District building', date '2026-04-25', 'featured', 1),
  ('Growing in Scripture', 'Members meet around the Word of God.', 'worship', 'assets/images/about-bible.png', 'Open Bible in warm light', date '2026-04-18', 'published', 2),
  ('Youth Week of Prayer', 'Young people leading in prayer and mission.', 'youth', 'assets/images/event-prayer.png', 'Youth group gathered in prayer', date '2026-06-01', 'published', 3),
  ('Health & Wellness', 'Serving the community through practical care.', 'outreach', 'assets/images/event-health.png', 'Health and wellness items', date '2026-06-28', 'published', 4),
  ('Messages of Hope', 'Christ-centered preaching from the district pulpit.', 'worship', 'assets/images/sermon-main.png', 'Pastor preaching from a pulpit', date '2026-04-25', 'published', 5),
  ('Lesson Discussion', 'Learning and sharing in Sabbath School.', 'study', 'assets/images/event-bible.png', 'Person reading a Bible', date '2026-06-14', 'published', 6)
) as seed(title, caption, category, image_url, alt_text, taken_on, status, sort_order)
where not exists (
  select 1 from public.gallery_items g
  where g.title = seed.title and g.image_url = seed.image_url
);

insert into public.ministries (slug, name, page_url, summary, focus_title, focus_body, programs, status, sort_order)
values
  ('youth', 'Youth Ministry', 'youth.html', 'Youth camp, mini camps, AY programs, leadership, evangelism, and service projects for young people.', 'Faith That Becomes Service', 'Helping young people build a personal walk with Jesus, grow in Scripture, serve their communities, and use their gifts in worship and mission.', '["Youth Camp","Mini Camps","AY Programs","Leadership Training","Fellowship & Recreation"]'::jsonb, 'published', 1),
  ('women', 'Women''s Ministry', 'women.html', 'Prayer circles, Bible study, mentoring, family support, fellowship, and compassionate outreach.', 'Discipleship With A Caring Heart', 'Encouraging women to grow in Christ, support one another, strengthen families, and serve the church and community with compassion.', '["Prayer Circles","Bible Study","Mentorship","Family Life Support","Compassionate Outreach","Skills & Stewardship"]'::jsonb, 'published', 2),
  ('children', 'Children''s Ministry', 'children.html', 'Sabbath School, Bible stories, memory verses, songs, creative lessons, and safe spiritual care for children.', 'Faith Foundations For Little Hearts', 'Helping children know that Jesus loves them, understand Bible truth in simple ways, and feel at home in the church family.', '["Sabbath School","Bible Stories","Memory Verses","Children''s Worship","Creative Lessons","Family Support"]'::jsonb, 'published', 3),
  ('health', 'Health Ministry', 'health.html', 'Wellness seminars, screenings, nutrition education, mental wellbeing, and community health outreach.', 'Serving Body, Mind, and Spirit', 'Encouraging members and the wider community to care for the body as God''s gift while growing in balanced spiritual, mental, and physical wellbeing.', '["Wellness Seminars","Health Screenings","Nutrition Education","Exercise & Activity","Mental Wellbeing","Community Outreach"]'::jsonb, 'published', 4),
  ('personal', 'Personal Ministries', 'about.html#ministries', 'Training and outreach that equip members to share their faith naturally.', 'Every Member In Mission', 'Equipping members to witness, visit, study the Bible with others, and participate in practical evangelism.', '["Bible Worker Support","Visitation","Evangelism Training","Literature Sharing","Follow-up Care"]'::jsonb, 'published', 5)
on conflict (slug) do nothing;

insert into public.site_settings (key, value)
values
  ('profile', '{"name":"SDA Church Kofiase District","tagline":"To know Christ and to make Him known","location":"Kofiase, Atwima Kwanwoma\nAshanti Region, Ghana","phone":"+233 24 123 4567","email":"info@kofiaseadventist.org","tiktok_url":"","resources":{"adventist_org":"https://www.adventist.org/","ssnet":"","youversion":"","youth_gc":"https://youth.adventist.org/","hopechannel":"","children":"https://children.adventist.org/"}}'),
  ('schedule', '{"sabbath":"Saturday 8:00 AM - 12:00 PM","bible_study":"Wednesday 6:30 PM - 7:30 PM","prayer":"Friday 6:30 PM - 7:30 PM","live_status":"Live Soon"}')
on conflict (key) do nothing;
