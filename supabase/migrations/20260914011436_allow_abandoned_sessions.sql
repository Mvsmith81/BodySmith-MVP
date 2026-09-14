-- Preserve existing session states and allow non-completed abandoned workouts.
alter table public.workout_sessions drop constraint workout_sessions_status_check;
alter table public.workout_sessions add constraint workout_sessions_status_check check (status in ('in_progress','completed','partial','skipped','abandoned'));
