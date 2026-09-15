-- BodySmith v2.8 account migration and flexible workout naming.
-- Applied to production before this repository copy was added.
alter table public.app_users add column if not exists email text;
alter table public.app_users add column if not exists auth_user_id uuid;
create unique index if not exists app_users_email_lower_uidx on public.app_users (lower(email)) where email is not null;
create unique index if not exists app_users_auth_user_uidx on public.app_users (auth_user_id) where auth_user_id is not null;

-- Preserve Michael's existing BodySmith account while giving it the requested email identity.
update public.app_users
set email='mvsmith81@gmail.com', updated_at=now()
where username='michael';

-- Old automated accounts remain distinguishable from the two human accounts.
update public.app_users
set is_qa=true
where username ~ '^(qa_|qb_|uiqa_)';

-- Workout focus names are choices. Training-day numbers are calculated by the client per week.
update public.plan_days
set name=regexp_replace(name, '^Day [0-9]+ · ', '')
where name ~ '^Day [0-9]+ · ';
