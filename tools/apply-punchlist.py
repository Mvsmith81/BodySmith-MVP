from pathlib import Path
import re


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)

app_path = Path('app.js')
app = app_path.read_text()

app = replace_once(
    app,
    "swapOpen:false,exercises:[]",
    "swapOpen:false,swapBrowseAll:false,swapSearch:'',exercises:[]",
    'swap state',
)

helper_marker = "async function swapExercise(id)"
if helper_marker not in app:
    raise SystemExit('swap helper insertion point not found')
helper = """function swapChoices(ex){
 const occupied=new Set(dayExercises(S.activeDay).map(s=>s.exercise.id));
 if(!S.swapBrowseAll)return substitutes(ex);
 return searchExercises(S.swapSearch||'').filter(a=>a.id!==ex.id&&!occupied.has(a.id)).slice(0,60)
}
"""
app = app.replace(helper_marker, helper + helper_marker, 1)

app = replace_once(app, "const alternates=substitutes(ex);return", "const alternates=swapChoices(ex);return", 'active swap choices')

swap_pattern = re.compile(r'<section class="panel swap-panel \$\{S\.swapOpen\?\'show\':\'\'\}"><h3>Swap \$\{esc\(ex\.name\)\}</h3>.*?</section>')
matches = list(swap_pattern.finditer(app))
if len(matches) != 1:
    raise SystemExit(f'swap panel: expected one match, found {len(matches)}')
new_swap_panel = r'''<section class="panel swap-panel ${S.swapOpen?'show':''}"><h3>Swap ${esc(ex.name)}</h3><p class="muted tiny">${S.swapBrowseAll?'Search the full exercise library by name, alias, muscle or equipment.':'Suggested first: similar movements that fit this slot.'}</p>${logs.length?`<div class="pain">You already logged ${logs.length} set${logs.length===1?'':'s'} for this exercise. Delete those logged sets before changing this slot.</div>`:''}<div class="row-actions"><button class="${!S.swapBrowseAll?'primary':'secondary'}" data-swap-mode="suggested">Suggested</button><button class="${S.swapBrowseAll?'primary':'secondary'}" data-swap-mode="all">Browse full library</button></div>${S.swapBrowseAll?`<label class="field">Search all exercises<input id="swapSearch" value="${esc(S.swapSearch||'')}" placeholder="Try legs, cable, bench, row…"></label><p class="muted tiny">${alternates.length} matching movements shown. Search reaches the full library.</p>`:''}<div class="swap-options">${alternates.map(a=>`<button data-swap="${a.id}"><span>${esc(a.name)}</span><span class="muted">${esc(a.equipment||'')} · ${esc(a.primary_muscle||'')}</span></button>`).join('')||'<div class="muted">No matching exercises. Try a different search.</div>'}</div></section>'''
app = swap_pattern.sub(lambda m: new_swap_panel, app, count=1)

app = replace_once(
    app,
    "document.querySelectorAll('[data-swap]').forEach(b=>b.onclick=()=>swapExercise(b.dataset.swap));",
    "document.querySelectorAll('[data-swap]').forEach(b=>b.onclick=()=>swapExercise(b.dataset.swap));\n  document.querySelectorAll('[data-swap-mode]').forEach(b=>b.onclick=()=>{S.swapBrowseAll=b.dataset.swapMode==='all';S.swapSearch='';render()});\n  const swapSearch=document.querySelector('#swapSearch');if(swapSearch)swapSearch.oninput=e=>{S.swapSearch=e.target.value;const pos=e.target.selectionStart;render();const n=document.querySelector('#swapSearch');n?.focus();n?.setSelectionRange(pos,pos)};",
    'swap bindings',
)

app = replace_once(
    app,
    "else if(a==='toggleswap'){S.swapOpen=!S.swapOpen;render()}",
    "else if(a==='toggleswap'){S.swapOpen=!S.swapOpen;if(!S.swapOpen){S.swapBrowseAll=false;S.swapSearch=''}render()}",
    'swap toggle reset',
)

app = app.replace(
    "cacheWorkoutMedia();S.swapOpen=false;render()",
    "cacheWorkoutMedia();S.swapOpen=false;S.swapBrowseAll=false;S.swapSearch='';render()",
)

app = replace_once(
    app,
    "S.swapOpen=false;persist();cacheWorkoutMedia();render();await syncQueue();toast('Substitution saved for this workout')",
    "S.swapOpen=false;S.swapBrowseAll=false;S.swapSearch='';persist();cacheWorkoutMedia();render();await syncQueue();toast('Substitution saved for this workout')",
    'swap success reset',
)

app = replace_once(
    app,
    '<label class="field">RPE<input id="rpe"',
    '<label class="field">RPE <span class="muted tiny">5 easy · 7–8 challenging with about 2–3 reps left · 10 max effort</span><input id="rpe"',
    'RPE helper',
)

app = replace_once(
    app,
    'Michael Muscle Builder is the recommended four-day starter.',
    'The Smith Method is the recommended four-day starter.',
    'plan helper name',
)

app = replace_once(app, '<span class="release">v2.2</span>', '<span class="release">v2.3</span>', 'release badge')
app_path.write_text(app)

index_path = Path('index.html')
index = index_path.read_text()
if '20260914-release22' not in index:
    raise SystemExit('index release22 marker missing')
index_path.write_text(index.replace('20260914-release22', '20260914-release23'))

sw_path = Path('sw.js')
sw = sw_path.read_text()
if "bodysmith-release-2.2.0" not in sw or '20260914-release22' not in sw:
    raise SystemExit('service-worker release markers missing')
sw = sw.replace("bodysmith-release-2.2.0", "bodysmith-release-2.3.0").replace('20260914-release22', '20260914-release23')
sw_path.write_text(sw)

pkg_path = Path('package.json')
pkg = pkg_path.read_text()
pkg = replace_once(pkg, '"version": "2.2.0"', '"version": "2.3.0"', 'package version')
pkg = replace_once(
    pkg,
    'node tests/workout-edit-smoke.cjs && node tests/sw-smoke.cjs',
    'node tests/workout-edit-smoke.cjs && node tests/swap-library-smoke.cjs && node tests/sw-smoke.cjs',
    'package swap test',
)
pkg_path.write_text(pkg)

swap_test = r'''const {JSDOM}=require('jsdom'),fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const dom=new JSDOM('<main id="app"></main><div id="toast"></div>',{url:'https://mvsmith81.github.io/BodySmith-MVP/',runScripts:'outside-only'}),w=dom.window,ctx=dom.getInternalVMContext();
w.structuredClone=structuredClone;w.AbortController=AbortController;w.confirm=()=>true;w.fetch=async()=>{throw Error('offline')};
vm.runInContext(fs.readFileSync('training.js','utf8'),ctx);vm.runInContext(fs.readFileSync('app.js','utf8').replace(/bootstrap\(\);\s*$/,''),ctx);
const run=c=>vm.runInContext(c,ctx),q=s=>w.document.querySelector(s);
const catalog=require('../data/exercises.json').map((e,i)=>({...e,id:'e'+i}));
run(`S.exercises=${JSON.stringify(catalog)};S.user={id:'test',units:'lb',preferences:{},onboarding_completed:true};S.token='test';S.online=false;const bench=S.exercises.find(e=>e.slug==='barbell-bench-press');S.plan={id:'p',name:'The Smith Method',days_per_week:4,plan_days:[{id:'d',name:'Chest Day',plan_day_exercises:[{id:'slot',target_sets:3,min_reps:8,max_reps:12,target_rpe:'7-8',rest_seconds:90,exercises:bench}]}]};S.plans=[S.plan];S.active={id:'s',status:'in_progress',started_at:new Date().toISOString(),sets:[]};S.activeDay=structuredClone(S.plan.plan_days[0]);S.screen='active';S.swapOpen=true;render();`);
assert.match(w.document.body.textContent,/Suggested first/);assert.ok(q('[data-swap-mode="all"]'),'browse-all button');
q('[data-swap-mode="all"]').click();assert.ok(q('#swapSearch'),'full-library search');
q('#swapSearch').value='leg extension';q('#swapSearch').dispatchEvent(new w.Event('input',{bubbles:true}));
assert.match(w.document.body.textContent,/Leg Extension/);assert.ok([...w.document.querySelectorAll('[data-swap]')].some(b=>/Leg Extension/.test(b.textContent)),'leg extension selectable from bench slot');
run(`S.active.sets=[{exercise_id:S.activeDay.plan_day_exercises[0].exercises.id,set_number:1,weight:90,reps:10,completion_status:'completed'}];S.swapOpen=true;render()`);
assert.match(w.document.body.textContent,/Delete those logged sets before changing this slot/);
assert.match(run('planControls()'),/The Smith Method is the recommended four-day starter/);
run(`S.active.sets=[];S.swapOpen=true;S.swapBrowseAll=true;S.swapSearch='row';render()`);assert.ok(w.document.querySelectorAll('[data-swap]').length>0,'full library search returns options');
console.log('PASS suggested substitutions, full-library search, logged-set guidance, and Smith Method naming');dom.window.close();
'''
Path('tests/swap-library-smoke.cjs').write_text(swap_test)

print('BodySmith v2.3 punchlist patch applied')
