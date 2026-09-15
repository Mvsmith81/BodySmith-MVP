(()=>{
  const ENDPOINT='https://uuzctytbguqjumwpczfh.supabase.co/functions/v1/bodysmith-testers';
  const API_KEY='sb_publishable_ibEVVafS4THz-16p4euMfg_qjG2WeU2';
  const dialog=document.getElementById('signupDialog');
  const form=document.getElementById('testerForm');
  const success=document.getElementById('signupSuccess');
  const error=document.getElementById('formError');
  const device=document.getElementById('deviceField');

  function detectDevice(){
    const ua=navigator.userAgent||'';
    const platform=navigator.userAgentData?.platform||navigator.platform||'';
    let d='Desktop / laptop';
    if(/iPhone/i.test(ua))d='iPhone';
    else if(/iPad/i.test(ua)||(/Mac/i.test(platform)&&navigator.maxTouchPoints>1))d='iPad';
    else if(/Android/i.test(ua))d=/Mobile/i.test(ua)?'Android phone':'Android tablet';
    else if(/Windows/i.test(platform)||/Windows/i.test(ua))d='Windows computer';
    else if(/Mac/i.test(platform)||/Macintosh/i.test(ua))d='Mac';
    else if(/Linux/i.test(platform)||/Linux/i.test(ua))d='Linux computer';
    let browser='Browser';
    if(/Edg\//.test(ua))browser='Edge';
    else if(/Chrome\//.test(ua)&&!/Edg\//.test(ua))browser='Chrome';
    else if(/Safari\//.test(ua)&&!/Chrome\//.test(ua))browser='Safari';
    else if(/Firefox\//.test(ua))browser='Firefox';
    return `${d} · ${browser}`;
  }

  device.value=detectDevice();

  function openSignup(){
    form.hidden=false;
    success.hidden=true;
    error.textContent='';
    if(typeof dialog.showModal==='function')dialog.showModal();
    else dialog.setAttribute('open','');
    setTimeout(()=>form.querySelector('input[name="name"]')?.focus(),60);
  }
  function closeSignup(){
    if(typeof dialog.close==='function')dialog.close();
    else dialog.removeAttribute('open');
  }

  document.querySelectorAll('[data-open-signup]').forEach(b=>b.addEventListener('click',openSignup));
  document.querySelectorAll('[data-close-signup]').forEach(b=>b.addEventListener('click',closeSignup));
  dialog.addEventListener('click',e=>{if(e.target===dialog)closeSignup();});

  form.addEventListener('submit',async e=>{
    e.preventDefault();
    error.textContent='';
    const submit=form.querySelector('button[type="submit"]');
    const fd=new FormData(form);
    const payload={
      action:'signup',
      name:String(fd.get('name')||'').trim(),
      email:String(fd.get('email')||'').trim(),
      device:String(fd.get('device')||'').trim(),
      company:String(fd.get('company')||''),
      consent:fd.get('consent')==='on',
      source:'beta_landing'
    };
    submit.disabled=true;
    submit.textContent='Saving your spot…';
    try{
      const res=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json','apikey':API_KEY},body:JSON.stringify(payload)});
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(data.error||'We could not save your signup. Please try again.');
      try{localStorage.setItem('bodysmith-beta-tester',JSON.stringify({email:payload.email,date:new Date().toISOString()}));}catch{}
      form.hidden=true;
      success.hidden=false;
    }catch(err){
      error.textContent=err.message||'We could not save your signup. Please try again.';
    }finally{
      submit.disabled=false;
      submit.textContent='Get Beta Access';
    }
  });
})();
