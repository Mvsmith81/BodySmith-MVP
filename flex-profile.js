(()=>{
  const TOKEN_KEY='bodysmith-token-v2';
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function currentCache(){
    const token=localStorage.getItem(TOKEN_KEY)||'';
    if(!token)return null;
    try{return JSON.parse(localStorage.getItem('bodysmith-cache-v3-'+token.slice(-24))||'null')}catch{return null}
  }

  function suggestedWorkout(cache){
    const plan=cache?.plan,history=cache?.history||[];
    const days=(plan?.plan_days||[]).slice().sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
    if(!days.length)return null;
    const last=history.find(h=>h.status==='completed');
    if(!last)return days[0];
    const idx=days.findIndex(d=>d.id===last.plan_day_id);
    return days[(idx+1+days.length)%days.length]||days[0];
  }

  function addStyles(){
    if(document.getElementById('flexProfileStyles'))return;
    const style=document.createElement('style');
    style.id='flexProfileStyles';
    style.textContent=`
      .flexible-workout-note{margin:-4px 0 14px;padding:11px 13px;border:1px solid var(--border,#293247);border-radius:12px;background:rgba(37,99,255,.08);line-height:1.45}
      .profile-baseline-setup{margin:14px 0;padding:14px;border:1px solid var(--border,#293247);border-radius:14px;background:rgba(37,99,255,.06)}
      .profile-baseline-setup h2{margin:0 0 4px;font-size:18px}.profile-baseline-setup>p{margin:0 0 12px}
      .training-baseline-card .baseline-grid,.weight-trend-card .baseline-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:10px}
      .training-baseline-card .baseline-item,.weight-trend-card .baseline-item{padding:10px 12px;border:1px solid var(--border,#293247);border-radius:12px;background:rgba(255,255,255,.025)}
      .training-baseline-card .baseline-item span,.weight-trend-card .baseline-item span{display:block;font-size:11px;color:var(--muted,#a8b0c0);margin-bottom:4px}.training-baseline-card .baseline-item strong,.weight-trend-card .baseline-item strong{font-size:15px}
      @media(max-width:520px){.training-baseline-card .baseline-grid,.weight-trend-card .baseline-grid{grid-template-columns:1fr 1fr}}
    `;
    document.head.appendChild(style);
  }

  function enhanceFlexibleWorkouts(){
    const homeTitle=[...document.querySelectorAll('.section-title h1')].find(h=>h.textContent.trim()==='Your next workout');
    if(homeTitle){
      const section=homeTitle.closest('.section-title');
      if(!section?.dataset.flexibleWorkoutChoice){
        section.dataset.flexibleWorkoutChoice='1';
        homeTitle.textContent="Choose today's workout";
        const meta=section.querySelector('.muted');if(meta)meta.textContent='Any focus';
        const note=document.createElement('p');note.className='muted flexible-workout-note';
        const suggested=suggestedWorkout(currentCache());
        note.innerHTML=`Pick the workout that fits today. BodySmith will never lock you into a weekday or force the plan order.${suggested?` <strong>Suggested next:</strong> ${esc(suggested.name)}.`:''}`;
        section.insertAdjacentElement('afterend',note);
      }
    }
    const tabs=document.querySelector('.day-tabs');
    if(tabs&&!tabs.dataset.flexibleWorkoutChoice){
      tabs.dataset.flexibleWorkoutChoice='1';
      tabs.setAttribute('role','group');
      tabs.setAttribute('aria-label','Choose any workout focus from your current plan');
    }
    const planTitle=[...document.querySelectorAll('.section-title h1')].find(h=>h.textContent.trim()==='Training Plan');
    if(planTitle){
      const section=planTitle.closest('.section-title');
      if(section&&!section.dataset.flexiblePlanNote){
        section.dataset.flexiblePlanNote='1';
        const note=document.createElement('p');note.className='muted flexible-workout-note';
        note.textContent='These are workout options, not assigned weekdays. Start any focus whenever it fits your recovery, schedule, or training partner.';
        section.insertAdjacentElement('afterend',note);
      }
    }
  }

  function labelFor(form,name){return form.querySelector(`[name="${name}"]`)?.closest('label.field')||null}
  function renameLabel(label,text){if(!label)return;const node=[...label.childNodes].find(n=>n.nodeType===Node.TEXT_NODE);if(node)node.textContent=text;}

  function enhanceOnboarding(){
    const form=document.getElementById('onboardForm');
    if(!form||form.dataset.expandedProfile==='1')return;
    form.dataset.expandedProfile='1';
    const goal=form.querySelector('select[name="goal"]');
    if(goal){
      for(const value of ['Lose fat','Improve endurance'])if(![...goal.options].some(o=>o.value===value)){const o=document.createElement('option');o.value=value;o.textContent=value;goal.appendChild(o)}
    }
    const unitsLabel=labelFor(form,'units');
    const heightLabel=labelFor(form,'height');
    const weightLabel=labelFor(form,'bodyWeight');
    const height=form.querySelector('[name="height"]');
    const weight=form.querySelector('[name="bodyWeight"]');
    if(height){height.required=true;height.maxLength=24;height.placeholder='6 ft 2 in or 188 cm'}
    if(weight){weight.required=true;weight.min='1';weight.step='0.1';weight.placeholder='Current weight'}
    renameLabel(heightLabel,'Height');
    renameLabel(weightLabel,'Current body weight (selected units)');
    const box=document.createElement('section');box.className='profile-baseline-setup';box.dataset.profileBaseline='1';
    box.innerHTML='<h2>Your starting profile</h2><p class="muted tiny">Height and current weight give BodySmith a baseline for progress tracking. No body-type label is required.</p>';
    if(heightLabel)box.appendChild(heightLabel);
    if(weightLabel)box.appendChild(weightLabel);
    const goalWeight=document.createElement('label');goalWeight.className='field';goalWeight.innerHTML='<span>Goal body weight (optional)</span><input name="goalWeight" type="number" min="1" step="0.1" placeholder="Optional">';
    const cache=currentCache(),prefs=cache?.user?.preferences||{};
    const goalInput=goalWeight.querySelector('input');if(prefs.goalWeight)goalInput.value=prefs.goalWeight;
    box.appendChild(goalWeight);
    const hidden=document.createElement('input');hidden.type='hidden';hidden.name='startingWeight';hidden.value=prefs.startingWeight||prefs.bodyWeight||weight?.value||'';box.appendChild(hidden);
    if(weight&&!hidden.value)weight.addEventListener('input',()=>{if(!prefs.startingWeight)hidden.value=weight.value});
    if(unitsLabel)unitsLabel.insertAdjacentElement('afterend',box);else form.insertBefore(box,form.querySelector('details'));
    const details=form.querySelector('details');if(details){const summary=details.querySelector('summary');if(summary)summary.textContent='Optional details';}
    const help=document.createElement('p');help.className='muted tiny';help.textContent='After setup, use Profile → Daily check-in to record new weights and build your weight trend over time.';box.appendChild(help);
  }

  function profileData(){
    const c=currentCache(),p=c?.user?.preferences||{},units=c?.user?.units||'lb';
    const checkins=(c?.checkins||[]).filter(x=>x.body_weight!=null&&x.body_weight!=='').slice().sort((a,b)=>String(b.checkin_date||'').localeCompare(String(a.checkin_date||'')));
    const start=p.startingWeight||p.bodyWeight||null;
    const latest=checkins[0]?.body_weight??p.bodyWeight??null;
    return{p,units,start,latest,checkins};
  }

  function enhanceProfile(){
    const title=[...document.querySelectorAll('.section-title h1')].find(h=>h.textContent.trim()==='Profile');
    if(!title||document.querySelector('.training-baseline-card'))return;
    const {p,units,start,latest}=profileData();
    if(!p.goal&&!p.height&&!start)return;
    const card=document.createElement('section');card.className='panel training-baseline-card';
    card.innerHTML=`<h3>Training profile</h3><p class="muted tiny">Your baseline and goals can be changed from Training preferences & schedule.</p><div class="baseline-grid"><div class="baseline-item"><span>Primary goal</span><strong>${esc(p.goal||'Not set')}</strong></div><div class="baseline-item"><span>Experience</span><strong>${esc(p.experience||'Not set')}</strong></div><div class="baseline-item"><span>Height</span><strong>${esc(p.height||'Not set')}</strong></div><div class="baseline-item"><span>Starting weight</span><strong>${start?`${esc(start)} ${esc(units)}`:'Not set'}</strong></div>${p.goalWeight?`<div class="baseline-item"><span>Goal weight</span><strong>${esc(p.goalWeight)} ${esc(units)}</strong></div>`:''}${latest?`<div class="baseline-item"><span>Latest logged weight</span><strong>${esc(latest)} ${esc(units)}</strong></div>`:''}</div>`;
    const edit=document.querySelector('[data-extra="editprofile"]');if(edit)edit.insertAdjacentElement('afterend',card);else title.closest('.section-title')?.insertAdjacentElement('afterend',card);
  }

  function enhanceProgress(){
    const title=[...document.querySelectorAll('.section-title h1')].find(h=>h.textContent.trim()==='Progress');
    if(!title||document.querySelector('.weight-trend-card'))return;
    const {units,start,latest,checkins}=profileData();
    if(!start&&!latest)return;
    const startNum=Number(start),latestNum=Number(latest),delta=Number.isFinite(startNum)&&Number.isFinite(latestNum)?Math.round((latestNum-startNum)*10)/10:null;
    const card=document.createElement('section');card.className='panel weight-trend-card';
    card.innerHTML=`<h3>Body-weight trend</h3><div class="baseline-grid"><div class="baseline-item"><span>Starting profile</span><strong>${start?`${esc(start)} ${esc(units)}`:'—'}</strong></div><div class="baseline-item"><span>Latest check-in</span><strong>${latest?`${esc(latest)} ${esc(units)}`:'—'}</strong></div>${delta!=null?`<div class="baseline-item"><span>Change</span><strong>${delta>0?'+':''}${delta} ${esc(units)}</strong></div>`:''}<div class="baseline-item"><span>Weight check-ins</span><strong>${checkins.length}</strong></div></div><p class="muted tiny">BodySmith reports the trend only; whether gaining, losing, or maintaining weight is desirable depends on the goal you chose.</p>`;
    const stats=title.closest('.section-title')?.nextElementSibling;let anchor=stats;while(anchor?.nextElementSibling&&!anchor.nextElementSibling.matches('.panel'))anchor=anchor.nextElementSibling;anchor?.insertAdjacentElement('afterend',card);
  }

  function enhance(){addStyles();enhanceFlexibleWorkouts();enhanceOnboarding();enhanceProfile();enhanceProgress()}
  let queued=false;
  const schedule=()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;enhance()})};
  const app=document.getElementById('app');if(app)new MutationObserver(schedule).observe(app,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance,{once:true});else enhance();
})();
