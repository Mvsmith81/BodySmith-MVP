select cron.schedule('bodysmith-reminders','* * * * *', $job$
 select net.http_post(
  url:='https://uuzctytbguqjumwpczfh.supabase.co/functions/v1/bodysmith-api',
  headers:=jsonb_build_object('Content-Type','application/json','x-scheduler-secret',(select value->>'secret' from public.notification_config where name='scheduler')),
  body:='{"action":"dispatch_reminders"}'::jsonb,
  timeout_milliseconds:=30000
 );
$job$);
update plan_days set name='Upper + Arms' where name='Upper Arms Day' and plan_id in (select id from workout_plans where is_template=true and name='Michael Muscle Builder');
