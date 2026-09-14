import json
from pathlib import Path
catalog=json.loads(Path('data/exercises.json').read_text())
for e in catalog:e['default_rest_seconds']=e['rest_min_seconds'];e['animation_url']=e['motion_url']
cols={'load_basis':"text not null default 'total'",
'canonical_name':"text",'aliases':"jsonb not null default '[]'::jsonb",'secondary_muscles':"jsonb not null default '[]'::jsonb",'body_region':"text",'movement_pattern':"text",'laterality':"text",'exercise_type':"text",'difficulty':"text",'setup_instructions':"text",'movement_instructions':"text",'common_mistakes':"jsonb not null default '[]'::jsonb",'rest_min_seconds':"integer",'rest_max_seconds':"integer",'substitution_group':"text",'thumbnail_url':"text",'motion_url':"text",'motion_kind':"text",'is_legacy':"boolean not null default false"}
s='-- Additive catalog expansion: keep existing exercise UUIDs and user-owned records.\n'
s+='\n'.join(f'alter table public.exercises add column if not exists {k} {v};' for k,v in cols.items())+'\n'
fields=list(catalog[0]);names=','.join(fields)
s+=f"insert into public.exercises({names})\nselect {names} from jsonb_populate_recordset(null::public.exercises,$catalog${json.dumps(catalog,ensure_ascii=False)}$catalog$::jsonb)\non conflict(slug) do update set "+','.join(f'{k}=excluded.{k}' for k in fields if k!='slug')+' where exercises.owner_id is null;\n'
s+='''-- Only non-Michael shared templates get more precise exercise choices. User plans are untouched.
update public.plan_day_exercises pe set exercise_id=e.id
from public.plan_days d, public.workout_plans p, public.exercises old, public.exercises e
where pe.day_id=d.id and d.plan_id=p.id and p.is_template=true and p.name<>'Michael Muscle Builder'
and pe.exercise_id=old.id and old.slug='leg-press-or-squat' and e.slug='leg-press' and e.owner_id is null;
update public.plan_day_exercises pe set exercise_id=e.id
from public.plan_days d, public.workout_plans p, public.exercises old, public.exercises e
where pe.day_id=d.id and d.plan_id=p.id and p.is_template=true and p.name<>'Michael Muscle Builder'
and pe.exercise_id=old.id and old.slug='walking-lunge-or-split-squat' and e.slug='reverse-lunge' and e.owner_id is null;
-- A named barbell press makes Strength Foundation's upper-body strength day clearer.
update public.plan_day_exercises pe set exercise_id=e.id
from public.plan_days d, public.workout_plans p, public.exercises old, public.exercises e
where pe.day_id=d.id and d.plan_id=p.id and p.is_template=true and p.name='Strength Foundation — 3 days'
and pe.exercise_id=old.id and old.slug='dumbbell-bench-press' and e.slug='barbell-bench-press' and e.owner_id is null;
'''
Path('supabase/migrations/20260913150616_expanded_exercise_library.sql').write_text(s)
print('migration bytes',len(s.encode()))
