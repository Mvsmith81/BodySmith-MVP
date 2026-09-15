(()=>{
  const ENDPOINT='https://uuzctytbguqjumwpczfh.supabase.co/functions/v1/bodysmith-planner';
  const API_KEY='sb_publishable_ibEVVafS4THz-16p4euMfg_qjG2WeU2';
  const state={loaded:false,loading:false,error:'',events:[],plans:[],enrollments:[],month:new Date(new Date().getFullYear(),new Date().getMonth(),1),selectedPlanId:'',selectedProgram:'pushup'};
  let ctx=null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const localDate=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const parseLocal=s=>{const [y,m,d]=String(s).split('-').map(Number);return new Date(y,m-1,d)};
  const addDays=(s,n)=>{const d=parseLocal(s);d.setDate(d.getDate()+n);return localDate(d)};
  const monthTitle=d=>d.toLocaleDateString([],{month:'long',year:'numeric'});
  const programName=k=>k==='pushup'?'Push-Up Progression':k==='pullup'?'Pull-Up Progression':'Push + Pull Progression';

  async function call(action,payload={}){
    if(!ctx?.token)throw Error('Sign in again to use the calendar.');
    const res=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json','apikey':API_KEY},body:JSON.stringify({action,...payload,token:ctx.token})});
    const data=await res.json().catch(()=>({error:'Invalid planner response'}));
    if(!res.ok)throw Error(data.error||'Planner request failed.');
    return data;
  }
  async function load(){
    if(state.loading)return;
    state.loading=true;state.error='';ctx?.render?.();
    try{
      const today=localDate(),d=await call('bootstrap',{from:addDays(today,-120),to:addDays(today,180)});
      state.events=d.events||[];state.plans=d.plans||[];state.enrollments=d.enrollments||[];state.loaded=true;
      if(!state.selectedPlanId)state.selectedPlanId=(state.plans.find(p=>p.id===ctx?.plan?.id)||state.plans[0])?.id||'';
    }catch(e){state.error=e.message||'Calendar could not load.'}
    finally{state.loading=false;ctx?.render?.();}
  }
  function category(p){const n=(p.name+' '+(p.goal||'')).toLowerCase();if(/progression/.test(n))return'Progressions';if(/1 day|focus|standalone/.test(n))return'Single-day workouts';if(/home|minimal/.test(n))return'Home & minimal equipment';if(/fat loss|muscle gain|strength foundation|beginner/.test(n))return'Goal-based plans';return'Splits & routines';}
  function planLibrary(plans,current){
    const templates=(plans||[]).filter(p=>p.is_template);
    if(!templates.length)return'';
    const groups={};for(const p of templates)(groups[category(p)]??=[]).push(p);
    return `<section class="panel preset-library"><div class="mini-row"><div><span class="eyebrow">PRESET LIBRARY</span><h3>Pick a starting point</h3></div><span class="pill">${templates.length} presets</span></div><p class="muted">Use a preset as-is or clone it into your own private plan.</p>${Object.entries(groups).map(([name,items])=>`<div class="preset-group"><h4>${esc(name)}</h4><div class="preset-grid">${items.map(p=>`<button type="button" class="preset-card ${p.id===current?.id?'active':''}" data-preset-plan="${p.id}"><strong>${esc(p.name)}</strong><small>${p.days_per_week} day${p.days_per_week===1?'':'s'} / week</small><span>${esc(p.goal||'Training plan')}</span></button>`).join('')}</div></div>`).join('')}</section>`;
  }
  function targetText(e){const t=e?.target||{};const bits=[];if(t.pushups)bits.push(`${t.pushups} push-ups total`);if(t.pullups)bits.push(`${t.pullups} pull-ups total`);return bits.join(' · ')}
  function historyByDate(history=[]){const map={};for(const h of history){if(h.status!=='completed')continue;const k=localDate(new Date(h.started_at));(map[k]??=[]).push(h);}return map;}
  function eventsByDate(){const map={};for(const e of state.events)(map[e.scheduled_date]??=[]).push(e);return map;}
  function monthGrid(history=[]){
    const m=state.month,y=m.getFullYear(),mo=m.getMonth(),first=new Date(y,mo,1),last=new Date(y,mo+1,0),start=new Date(y,mo,1-first.getDay());
    const eventMap=eventsByDate(),histMap=historyByDate(history),today=localDate(),cells=[];
    for(let i=0;i<42;i++){
      const d=new Date(start);d.setDate(start.getDate()+i);const key=localDate(d),outside=d.getMonth()!==mo,evs=eventMap[key]||[],done=histMap[key]||[];
      cells.push(`<div class="calendar-day ${outside?'outside':''} ${key===today?'today':''}"><div class="calendar-date">${d.getDate()}</div>${done.length?`<span class="calendar-chip done">✓ ${done.length} completed</span>`:''}${evs.slice(0,3).map(e=>`<span class="calendar-chip ${e.kind} ${e.status==='planned'&&key<today?'missed':''}">${e.kind==='rest'?'Rest':e.kind==='note'?'Note':e.status==='completed'?'Done':'Workout'}</span>`).join('')}${evs.length>3?`<span class="calendar-more">+${evs.length-3}</span>`:''}</div>`);
    }
    return `<div class="calendar-weekdays">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(x=>`<span>${x}</span>`).join('')}</div><div class="calendar-grid">${cells.join('')}</div>`;
  }
  function schedulePanel(){
    const plans=state.plans||[],selected=plans.find(p=>p.id===state.selectedPlanId)||plans[0],days=selected?.plan_days||[];
    return `<section class="panel"><div class="mini-row"><div><span class="eyebrow">SCHEDULE</span><h3>Put a workout on the calendar</h3></div></div><p class="muted tiny">Preset days and your saved personal plans can be scheduled here. A one-day personal plan works as a reusable custom workout.</p><label class="field">Plan<select id="plannerPlan">${plans.map(p=>`<option value="${p.id}" ${p.id===selected?.id?'selected':''}>${esc(p.name)}${p.is_template?' · Preset':' · Yours'}</option>`).join('')}</select></label><label class="field">Workout<select id="plannerDay">${days.map(d=>`<option value="${d.id}">${esc(d.name)}${d.focus?' · '+esc(d.focus):''}</option>`).join('')}</select></label><label class="field">Date<input id="plannerDate" type="date" value="${localDate()}"></label><div class="row-actions"><button class="primary" data-planner-schedule>Schedule workout</button><button class="secondary" data-planner-rest>Add rest day</button></div></section>`;
  }
  function progressionPanel(){
    const active=state.enrollments||[],k=state.selectedProgram;
    return `<section class="panel progression-panel"><div class="mini-row"><div><span class="eyebrow">4-WEEK PROGRAMS</span><h3>Push-up & pull-up progression</h3></div></div><p class="muted">BodySmith uses your current comfortable max set to build three weekly sessions with recovery days between them. Targets increase gradually instead of sending you to failure every session.</p>${active.length?`<div class="active-programs">${active.map(x=>`<div class="mini-row"><div><strong>${esc(programName(x.program_key))}</strong><div class="muted tiny">Started ${x.start_date}</div></div><button class="secondary" data-cancel-program="${x.program_key}">Cancel</button></div>`).join('')}</div>`:''}<label class="field">Program<select id="progressionProgram"><option value="pushup" ${k==='pushup'?'selected':''}>Push-Up Progression</option><option value="pullup" ${k==='pullup'?'selected':''}>Pull-Up Progression</option><option value="pushpull" ${k==='pushpull'?'selected':''}>Push + Pull Progression</option></select></label>${k!=='pullup'?'<label class="field">Comfortable max push-ups in one set<input id="baselinePushups" type="number" min="1" max="500" inputmode="numeric" placeholder="Example: 15"></label>':''}${k!=='pushup'?'<label class="field">Comfortable max pull-ups in one set<input id="baselinePullups" type="number" min="1" max="200" inputmode="numeric" placeholder="Example: 5"></label>':''}<label class="field">Start date<input id="programStart" type="date" value="${localDate()}"></label><button class="primary huge" data-start-program>Build my 4-week calendar</button><p class="muted tiny">Example: a comfortable max of 15 push-ups starts around 45 total reps on the first volume day, spread across multiple sets.</p></section>`;
  }
  function upcoming(){
    const today=localDate(),items=state.events.filter(e=>e.scheduled_date>=addDays(today,-7)).sort((a,b)=>a.scheduled_date.localeCompare(b.scheduled_date)).slice(0,30);
    if(!items.length)return'<section class="panel empty">Nothing scheduled yet. Add a workout or start a progression program above.</section>';
    return `<section class="panel"><h3>Upcoming & recent schedule</h3>${items.map(e=>{const target=targetText(e),missed=e.status==='planned'&&e.scheduled_date<today;return `<article class="planner-event ${e.kind} ${missed?'missed':''}"><div><strong>${esc(e.title)}</strong><div class="muted tiny">${parseLocal(e.scheduled_date).toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'})}${missed?' · Missed / not logged':''}</div>${target?`<div class="target-line">${esc(target)}</div>`:''}</div><div class="planner-event-actions">${e.kind==='workout'&&e.custom_snapshot?`<button class="primary" data-start-event="${e.id}">Start</button>`:''}${e.kind!=='workout'&&e.status==='planned'?`<button class="secondary" data-event-done="${e.id}">Done</button>`:''}<button class="linkbtn danger-text" data-delete-event="${e.id}">Remove</button></div></article>`}).join('')}</section>`;
  }
  function view(c){
    const month=monthTitle(state.month);
    const body=`<div class="section-title"><div><span class="eyebrow">TRAINING PLANNER</span><h1>Calendar</h1></div><span class="pill">Plan · Train · Recover</span></div><section class="panel calendar-panel"><div class="calendar-head"><button class="secondary" data-planner-month="-1" aria-label="Previous month">←</button><h2>${esc(month)}</h2><button class="secondary" data-planner-month="1" aria-label="Next month">→</button></div>${state.error?`<div class="form-error">${esc(state.error)}</div>`:''}${state.loading&&!state.loaded?'<div class="empty">Loading your calendar…</div>':monthGrid(c.history||[])}</section>${state.loaded?schedulePanel()+progressionPanel()+upcoming():'<section class="panel empty">Loading schedule tools…</section>'}`;
    return c.shell(body,'calendar');
  }
  async function refresh(){state.loaded=false;await load();}
  function bind(c){
    ctx=c;
    if(!state.loaded&&!state.loading){load();return}
    document.querySelectorAll('[data-planner-month]').forEach(b=>b.onclick=()=>{state.month=new Date(state.month.getFullYear(),state.month.getMonth()+Number(b.dataset.plannerMonth),1);ctx.render();});
    const plan=document.getElementById('plannerPlan');if(plan)plan.onchange=()=>{state.selectedPlanId=plan.value;ctx.render();};
    const program=document.getElementById('progressionProgram');if(program)program.onchange=()=>{state.selectedProgram=program.value;ctx.render();};
    const schedule=document.querySelector('[data-planner-schedule]');if(schedule)schedule.onclick=async()=>{try{const date=document.getElementById('plannerDate').value,day=document.getElementById('plannerDay').value;if(!day)throw Error('Choose a workout day.');schedule.disabled=true;await call('schedule',{date,kind:'workout',planDayId:day});ctx.toast('Workout added to calendar');await refresh()}catch(e){ctx.toast(e.message,true)}finally{schedule.disabled=false}};
    const rest=document.querySelector('[data-planner-rest]');if(rest)rest.onclick=async()=>{try{const date=document.getElementById('plannerDate').value;rest.disabled=true;await call('schedule',{date,kind:'rest',title:'Rest / Recovery'});ctx.toast('Rest day added');await refresh()}catch(e){ctx.toast(e.message,true)}finally{rest.disabled=false}};
    document.querySelectorAll('[data-start-event]').forEach(b=>b.onclick=async()=>{const e=state.events.find(x=>x.id===b.dataset.startEvent);if(!e?.custom_snapshot)return;try{await ctx.startCustomDay(structuredClone(e.custom_snapshot))}catch(err){ctx.toast(err.message,true)}});
    document.querySelectorAll('[data-delete-event]').forEach(b=>b.onclick=async()=>{if(!confirm('Remove this item from your calendar?'))return;try{await call('delete_event',{eventId:b.dataset.deleteEvent});ctx.toast('Calendar item removed');await refresh()}catch(e){ctx.toast(e.message,true)}});
    document.querySelectorAll('[data-event-done]').forEach(b=>b.onclick=async()=>{try{await call('set_status',{eventId:b.dataset.eventDone,status:'completed'});await refresh()}catch(e){ctx.toast(e.message,true)}});
    const start=document.querySelector('[data-start-program]');if(start)start.onclick=async()=>{try{const k=state.selectedProgram,push=document.getElementById('baselinePushups')?.value,pull=document.getElementById('baselinePullups')?.value,startDate=document.getElementById('programStart').value;start.disabled=true;await call('enroll_program',{programKey:k,baselinePushups:push?Number(push):null,baselinePullups:pull?Number(pull):null,startDate});ctx.toast(`${programName(k)} added to your calendar`);await refresh()}catch(e){ctx.toast(e.message,true)}finally{start.disabled=false}};
    document.querySelectorAll('[data-cancel-program]').forEach(b=>b.onclick=async()=>{if(!confirm(`Cancel ${programName(b.dataset.cancelProgram)} and remove its future planned days?`))return;try{await call('cancel_program',{programKey:b.dataset.cancelProgram});ctx.toast('Progression program cancelled');await refresh()}catch(e){ctx.toast(e.message,true)}});
  }
  document.addEventListener('click',e=>{const b=e.target.closest?.('[data-preset-plan]');if(!b)return;const select=document.getElementById('planChoice');if(select){select.value=b.dataset.presetPlan;document.querySelectorAll('[data-preset-plan]').forEach(x=>x.classList.toggle('active',x===b));select.scrollIntoView({behavior:'smooth',block:'center'});}});
  window.BodySmithPlanner={view,bind,planLibrary,refresh};
})();