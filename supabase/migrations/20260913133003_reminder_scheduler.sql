create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
insert into public.notification_config(name,value) values('scheduler',jsonb_build_object('secret',encode(extensions.gen_random_bytes(32),'hex'))) on conflict(name) do nothing;
select cron.schedule('bodysmith-reminders','* * * * *', $job$
 select net.http_post(
  url:='https://uuzctytbguqjumwpczfh.supabase.co/functions/v1/bodysmith-api',
  headers:=jsonb_build_object('Content-Type','application/json','x-scheduler-secret',(select value->>'secret' from public.notification_config where name='scheduler')),
  body:='{"action":"dispatch_reminders"}'::jsonb,
  timeout_milliseconds:=10000
 );
$job$);
