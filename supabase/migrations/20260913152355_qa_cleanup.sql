-- Additive session editing fields; existing timestamps and exercise references stay intact.
alter table public.workout_sets add column if not exists updated_at timestamptz not null default now();
alter table public.workout_sets add column if not exists load_basis text;
alter table public.workout_sets add column if not exists load_multiplier numeric not null default 1;
alter table public.workout_sessions add column if not exists updated_at timestamptz not null default now();
alter table public.exercises add column if not exists load_basis text not null default 'total';
alter table public.app_users add column if not exists is_qa boolean not null default false;
create or replace function public.cleanup_bodysmith_qa(p_user uuid) returns void language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from app_users where id=p_user and is_qa and username ~ '^bodysmith_qa_[a-f0-9]{12}$' and created_at>now()-interval '24 hours') then raise exception 'Not an eligible test account'; end if;
 delete from supplement_logs where user_id=p_user;
 delete from supplements where user_id=p_user;
 delete from push_subscriptions where user_id=p_user;
 delete from notification_deliveries where user_id=p_user;
 delete from workout_sets where user_id=p_user;
 delete from workout_sessions where user_id=p_user;
 update app_users set active_plan_id=null where id=p_user;
 delete from workout_plans where owner_id=p_user;
 delete from exercises where owner_id=p_user;
 delete from app_users where id=p_user;
end $$;
revoke all on function public.cleanup_bodysmith_qa(uuid) from public,anon,authenticated;
grant execute on function public.cleanup_bodysmith_qa(uuid) to service_role;
-- Serialize new sessions per user without deleting or changing existing sessions.
create or replace function public.start_bodysmith_session(p_user uuid,p_day uuid,p_snapshot jsonb) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare result public.workout_sessions;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 if exists(select 1 from workout_sessions where user_id=p_user and status='in_progress') then raise exception 'An active workout already exists'; end if;
 insert into workout_sessions(user_id,plan_day_id,status,day_snapshot,started_at) values(p_user,p_day,'in_progress',p_snapshot,now()) returning * into result;
 return to_jsonb(result);
end $$;
revoke all on function public.start_bodysmith_session(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.start_bodysmith_session(uuid,uuid,jsonb) to service_role;
