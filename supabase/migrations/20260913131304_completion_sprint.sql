alter table public.app_users add column if not exists preferences jsonb not null default '{}'::jsonb;
alter table public.app_users add column if not exists onboarding_completed boolean not null default false;
alter table public.workout_sessions add column if not exists day_snapshot jsonb;
alter table public.workout_sets add column if not exists duration_seconds integer;
alter table public.workout_sets add column if not exists units text not null default 'lb';
alter table public.exercises add column if not exists owner_id uuid references public.app_users(id);
create index if not exists exercises_owner_idx on public.exercises(owner_id);
drop policy if exists exercises_read_all on public.exercises;
create policy exercises_read_all on public.exercises for select using (owner_id is null);
create table if not exists public.supplements (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.app_users(id),
 name text not null check(length(name) between 1 and 100), dose text not null default '', unit text not null default '',
 schedule_days integer[] not null default '{0,1,2,3,4,5,6}', times text[] not null default '{09:00}',
 with_food text not null default '', notes text not null default '', active boolean not null default true,
 reminders boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.supplement_logs (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.app_users(id),
 supplement_id uuid not null references public.supplements(id), scheduled_date date not null, scheduled_time text not null,
 status text not null check(status in ('taken','skipped','snoozed')), snoozed_until timestamptz, logged_at timestamptz not null default now(),
 unique(user_id,supplement_id,scheduled_date,scheduled_time)
);
create table if not exists public.push_subscriptions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.app_users(id),
 endpoint text not null unique, subscription jsonb not null, created_at timestamptz not null default now()
);
create table if not exists public.notification_deliveries (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.app_users(id),
 delivery_key text not null, sent_at timestamptz not null default now(), unique(user_id,delivery_key)
);
create table if not exists public.notification_config (name text primary key, value jsonb not null);
create table if not exists public.auth_attempts (key text primary key, attempts integer not null default 0, window_start timestamptz not null default now());
create index if not exists supplements_user_idx on public.supplements(user_id);
create index if not exists supplement_logs_user_idx on public.supplement_logs(user_id,scheduled_date);
create index if not exists supplement_logs_supplement_idx on public.supplement_logs(supplement_id);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);
create index if not exists notification_deliveries_user_idx on public.notification_deliveries(user_id);
-- BodySmith uses custom hashed sessions, not auth.users JWTs. All private access is through the authenticated Edge Function.
-- Explicit deny policies prevent browser Data API access; service_role is server-only and checks ownership on each operation.
do $$ declare t text; begin foreach t in array array['supplements','supplement_logs','push_subscriptions','notification_deliveries','notification_config','auth_attempts'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 execute format('create policy server_only on public.%I for all to anon, authenticated using (false) with check (false)',t);
end loop; end $$;
create or replace function public.save_bodysmith_plan(p_user uuid,p_plan jsonb) returns uuid
language plpgsql security invoker set search_path=public,pg_temp as $$
declare pid uuid; did uuid; d jsonb; x jsonb; di integer:=0; xi integer;
begin
 insert into workout_plans(owner_id,name,goal,days_per_week,is_template) values(p_user,left(p_plan->>'name',100),left(coalesce(p_plan->>'goal','Build strength'),200),jsonb_array_length(p_plan->'plan_days'),false) returning id into pid;
 for d in select value from jsonb_array_elements(p_plan->'plan_days') loop
  insert into plan_days(plan_id,day_key,name,focus,sort_order) values(pid,'day-'||di,left(d->>'name',100),left(coalesce(d->>'focus',''),200),di) returning id into did;
  xi:=0;
  for x in select value from jsonb_array_elements(d->'plan_day_exercises') loop
   insert into plan_day_exercises(day_id,exercise_id,sort_order,target_sets,min_reps,max_reps,target_rpe,rest_seconds,duration_minutes,progression_rule,pain_rule)
   values(did,coalesce(x->'exercises'->>'id',x->>'exercise_id')::uuid,xi,(x->>'target_sets')::int,(x->>'min_reps')::int,(x->>'max_reps')::int,x->>'target_rpe',(x->>'rest_seconds')::int,nullif((x->>'duration_minutes')::int,0),left(coalesce(x->>'progression_rule','Add reps before increasing load.'),1000),left(coalesce(x->>'pain_rule','Stop if movement causes sharp or increasing pain.'),1000));
   xi:=xi+1;
  end loop;
  di:=di+1;
 end loop;
 update app_users set active_plan_id=pid where id=p_user;
 return pid;
end $$;
revoke all on function public.save_bodysmith_plan(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_bodysmith_plan(uuid,jsonb) to service_role;
-- New movements make a real minimal-equipment template possible.
insert into exercises(slug,name,primary_muscle,movement_type,equipment,cue) values
('goblet-squat','Goblet Squat','Quads/Glutes','Squat','Dumbbell','Hold one dumbbell at your chest. Sit between your hips, keep heels grounded, then stand tall.'),
('dumbbell-row','One-Arm Dumbbell Row','Back','Pull','Dumbbell/Bench','Support one hand on a bench, keep hips square, pull the elbow toward your hip, then lower with control.'),
('push-up','Push-Up','Chest','Push','Bodyweight','Place hands slightly wider than shoulders. Keep a straight body, lower chest between hands, then press up.'),
('glute-bridge','Glute Bridge','Glutes','Hinge','Bodyweight','Lie on your back with knees bent and feet flat. Lift hips by squeezing glutes, without arching the lower back.'),
('plank','Plank','Abs','Brace','Bodyweight','Place elbows below shoulders. Brace abs and glutes; maintain a straight line while breathing normally.')
on conflict(slug) do nothing;
do $$ declare spec jsonb; d jsonb; ex text; pid uuid; did uuid; di int; xi int; eid uuid; strength boolean; beginner boolean;
begin
 for spec in select value from jsonb_array_elements('[
 {"name":"Beginner Full Body — 3 days","days":[["Full Body A","goblet-squat","dumbbell-bench-press","seated-cable-row","plank"],["Full Body B","romanian-deadlift","machine-shoulder-press","neutral-grip-lat-pulldown","calf-raise"],["Full Body C","leg-press-or-squat","incline-machine-press","chest-supported-row","cable-crunch"]]},
 {"name":"Upper/Lower — 4 days","days":[["Upper A","dumbbell-bench-press","seated-cable-row","machine-shoulder-press","cable-curl"],["Lower A","leg-press-or-squat","romanian-deadlift","calf-raise","plank"],["Upper B","incline-dumbbell-press","neutral-grip-lat-pulldown","lateral-raise","rope-triceps-pressdown"],["Lower B","walking-lunge-or-split-squat","seated-leg-curl","leg-extension","cable-crunch"]]},
 {"name":"Push/Pull/Legs — 6 days","days":[["Push A","dumbbell-bench-press","machine-shoulder-press","cable-lateral-raise","rope-triceps-pressdown"],["Pull A","neutral-grip-lat-pulldown","seated-cable-row","rear-delt-fly","hammer-curl"],["Legs A","leg-press-or-squat","romanian-deadlift","calf-raise","plank"],["Push B","incline-machine-press","cable-chest-fly","lateral-raise","rope-triceps-pressdown"],["Pull B","chest-supported-row","one-arm-cable-row","rear-delt-fly","cable-curl"],["Legs B","walking-lunge-or-split-squat","seated-leg-curl","leg-extension","cable-crunch"]]},
 {"name":"Strength Foundation — 3 days","days":[["Strength A","leg-press-or-squat","dumbbell-bench-press","seated-cable-row","plank"],["Strength B","romanian-deadlift","machine-shoulder-press","neutral-grip-lat-pulldown","calf-raise"],["Strength C","goblet-squat","incline-dumbbell-press","chest-supported-row","cable-crunch"]]},
 {"name":"Minimal Equipment — 3 days","days":[["Minimal A","goblet-squat","push-up","dumbbell-row","plank"],["Minimal B","romanian-deadlift","incline-dumbbell-press","hammer-curl","glute-bridge"],["Minimal C","walking-lunge-or-split-squat","push-up","dumbbell-row","lateral-raise"]]}
 ]'::jsonb) loop
 if exists(select 1 from workout_plans where name=spec->>'name' and is_template) then continue;end if;
 strength:=spec->>'name' like 'Strength%';beginner:=spec->>'name' like 'Beginner%';
 insert into workout_plans(name,goal,days_per_week,is_template) values(spec->>'name',case when strength then 'Build foundational strength' when beginner then 'Learn consistent full-body training' else 'Build strength and muscle' end,jsonb_array_length(spec->'days'),true) returning id into pid;
 di:=0;for d in select value from jsonb_array_elements(spec->'days') loop
 insert into plan_days(plan_id,day_key,name,focus,sort_order) values(pid,'day-'||di,d->>0,'Balanced training',di) returning id into did;
 xi:=0;for ex in select value from jsonb_array_elements_text(d) with ordinality as a(value,n) where n>1 loop
 select id into eid from exercises where slug=ex;
 insert into plan_day_exercises(day_id,exercise_id,sort_order,target_sets,min_reps,max_reps,target_rpe,rest_seconds,duration_minutes,progression_rule,pain_rule)
 values(did,eid,xi,case when beginner then 2 else 3 end,case when strength then 5 else 8 end,case when strength then 8 else 12 end,case when beginner then '6–7' else '7–8' end,case when strength then 150 else 90 end,case when ex='plank' then 1 else null end,'Add reps within the range before a small load increase.','Stop for sharp or increasing pain.');xi:=xi+1;
 end loop;di:=di+1;end loop;
 end loop;
end $$;
