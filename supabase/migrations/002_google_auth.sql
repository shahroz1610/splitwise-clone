-- Link group members to Google accounts (Supabase Auth users).
alter table members add column if not exists auth_user_id uuid unique references auth.users (id) on delete set null;
alter table members add column if not exists email text;
alter table members add column if not exists avatar_url text;
