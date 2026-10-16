# SDA Church Kofiase District

Multi-page Vite site for the SDA Church Kofiase District website and admin area.

## Getting started

```powershell
npm.cmd install
npm.cmd start
```

Open the dev server at <http://localhost:5173/> or your network address <http://192.168.249.140:5173/> (do not open the `file:///` path).

On Windows PowerShell, `npm.cmd` avoids execution-policy blocks from the `npm.ps1` shim. If your shell already allows npm scripts, `npm install` and `npm start` work too.

## Build

```powershell
npm.cmd run build
```

The production files are generated in `dist/`.

## Supabase

Backend setup lives in `supabase/README.md`. Run `supabase/schema.sql`, then edit and run `supabase/add-admin.sql` in the Supabase SQL Editor.

### Creating an Admin Account

1. Open your Supabase project and navigate to the Authentication -> Users panel.
2. Create a new user with the email you want for the admin (e.g. `admin@example.com`) and set a password.
3. In the Supabase SQL Editor run `supabase/add-admin.sql` (edit the email and display name at the top of that file to match the user you created). This will insert a row into `public.admin_profiles` linking the auth user to admin privileges.
4. After adding the admin user, the admin portal is available at `admin/login.html` on your site. Sign in using the credentials you created.

If you prefer automation, you can create the auth user via the Supabase Admin API and then run the SQL snippet to add the profile. The helper script `supabase/add-admin.sql` is provided for convenience.
