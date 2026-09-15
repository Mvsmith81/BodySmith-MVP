(()=>{
  const TOKEN_KEY='bodysmith-token-v2';
  const ORDER=['Chest','Back','Shoulders','Biceps','Triceps','Quads','Hamstrings','Glutes','Calves','Core','Cardio','Full Body','Other'];
  function currentCache(){const token=localStorage.getItem(TOKEN_KEY)||'';if(!token)return null;try{return JSON.parse(localStorage.getItem('bodysmith-cache-v3-'+token.slice(-24))||'null')}catch{return null}}
  function category(ex){
    const m=String(ex?.primary_muscle||'').trim();
    if(['Abs','Obliques'].includes(m))return'Core';
    if(m==='Posterior chain')return'Full Body';
    return ORDER.includes(m)?m:'Other';
  }
  function groupSelect(select){
    if(!select||select.querySelector('optgroup'))return;
    const cache=currentCache(),map=new Map((cache?.exercises||[]).map(e=>[e.id,e]));
    const options=[...select.querySelectorAll('option')].map(o=>({value:o.value,text:o.textContent||'',selected:o.selected,disabled:o.disabled}));
    if(!options.length)return;
    const groups=new Map();
    for(const o of options){const c=category(map.get(o.value));if(!groups.has(c))groups.set(c,[]);groups.get(c).push(o)}
    const selected=select.value;select.replaceChildren();
    for(const label of ORDER){const items=groups.get(label);if(!items?.length)continue;const g=document.createElement('optgroup');g.label=label;for(const item of items.sort((a,b)=>a.text.localeCompare(b.text))){const o=document.createElement('option');o.value=item.value;o.textContent=item.text;o.disabled=item.disabled;g.appendChild(o)}select.appendChild(g)}
    if(selected)select.value=selected;select.dataset.bodyPartGroups='1';
  }
  function enhance(){document.querySelectorAll('select[id^="addExercise"]').forEach(groupSelect)}
  let queued=false;const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;enhance()})};
  const app=document.getElementById('app');if(app)new MutationObserver(schedule).observe(app,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance,{once:true});else enhance();
})();
