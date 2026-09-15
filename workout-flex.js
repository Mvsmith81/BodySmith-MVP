(()=>{
  const TOKEN_KEY='bodysmith-token-v2';
  const cleanFocus=value=>String(value||'').replace(/^Day\s+\d+\s*[·:\-–]\s*/i,'').trim();
  function currentCache(){const token=localStorage.getItem(TOKEN_KEY)||'';if(!token)return null;try{return JSON.parse(localStorage.getItem('bodysmith-cache-v3-'+token.slice(-24))||'null')}catch{return null}}
  function weekStart(now=new Date()){const d=new Date(now);d.setHours(0,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7));return d}
  function trainingDayNumber(cache){const start=weekStart(),now=new Date();const completed=(cache?.history||[]).filter(h=>h.status==='completed').filter(h=>{const t=new Date(h.started_at||h.completed_at||0);return Number.isFinite(t.getTime())&&t>=start&&t<=now});return completed.length+1}
  function suggested(cache){const plan=cache?.plan,history=cache?.history||[],days=(plan?.plan_days||[]).slice().sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));if(!days.length)return null;const last=history.find(h=>h.status==='completed');if(!last)return days[0];const i=days.findIndex(d=>d.id===last.plan_day_id);return days[(i+1+days.length)%days.length]||days[0]}
  function enhance(){
    const cache=currentCache();if(!cache?.plan)return;
    const n=trainingDayNumber(cache),pick=suggested(cache),active=(cache?.active&&cache.active.status==='in_progress')?cache.active:null;
    const section=[...document.querySelectorAll('.section-title')].find(s=>/^(Your next workout|Choose today's workout|Resume workout|Training Day \d+ this week)$/i.test(s.querySelector('h1')?.textContent.trim()||''));
    if(section){const h=section.querySelector('h1'),meta=section.querySelector('.muted');h.textContent=`Training Day ${n} this week`;if(meta)meta.textContent=active?'Workout in progress':'Choose a focus';let note=section.nextElementSibling;if(!note?.classList?.contains('weekly-flex-note')){note=document.createElement('p');note.className='muted flexible-workout-note weekly-flex-note';section.insertAdjacentElement('afterend',note)}note.innerHTML=active?`You already started <strong>${cleanFocus(active.day_snapshot?.name||'a workout')}</strong>. Finish it or use Change Workout to choose another focus.`:`Day ${n} means your ${n===1?'first':n===2?'second':n===3?'third':`${n}th`} training session this week — not a fixed muscle group. Choose any focus below.${pick?` <strong>Suggested next:</strong> ${cleanFocus(pick.name)}.`:''}`}
    }
    document.querySelectorAll('.day-tabs button').forEach(b=>{const v=cleanFocus(b.textContent);if(v&&b.textContent!==v)b.textContent=v});
    document.querySelectorAll('.workout-head h2').forEach(h=>{const v=cleanFocus(h.textContent);if(v&&h.textContent!==v)h.textContent=v});
    document.querySelectorAll('.day-card summary strong').forEach(h=>{const v=cleanFocus(h.textContent);if(v&&h.textContent!==v)h.textContent=v});
    document.querySelectorAll('.day-card [data-action="start"]').forEach(b=>{const m=b.textContent.match(/^Start\s+(.+)$/);if(m)b.textContent='Start '+cleanFocus(m[1])});
    const tabs=document.querySelector('.day-tabs');if(tabs){tabs.setAttribute('aria-label',`Choose the focus for Training Day ${n} this week`);tabs.dataset.weeklyFlexible='1'}
  }
  let queued=false;const schedule=()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;enhance()})};
  const app=document.getElementById('app');if(app)new MutationObserver(schedule).observe(app,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance,{once:true});else enhance();
  window.BodySmithWorkoutFlex={trainingDayNumber,cleanFocus};
})();
