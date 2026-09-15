(()=>{
  const API_URL='https://uuzctytbguqjumwpczfh.supabase.co/functions/v1/bodysmith-api';
  const SUPABASE_URL='https://uuzctytbguqjumwpczfh.supabase.co';
  const API_KEY='sb_publishable_ibEVVafS4THz-16p4euMfg_qjG2WeU2';
  const TOKEN_KEY='bodysmith-token-v2';
  const RELEASE='2.8.0';
  let googleReady=false;
  let googleChecked=false;

  const cleanEmail=v=>String(v||'').trim().toLowerCase();
  const validEmail=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail(v))&&cleanEmail(v).length<=254;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const token=()=>localStorage.getItem(TOKEN_KEY)||'';

  async function api(action,payload={},includeToken=true){
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),20000);
    try{
      const body={action,...payload};if(includeToken&&token())body.token=token();
      const res=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'application/json','apikey':API_KEY},body:JSON.stringify(body),signal:controller.signal});
      const data=await res.json().catch(()=>({error:'Invalid server response'}));
      if(!res.ok)throw new Error(data.error||`Request failed (${res.status})`);
      return data;
    }finally{clearTimeout(timer)}
  }

  function currentCacheKey(){const t=token();return t?`bodysmith-cache-v3-${t.slice(-24)}`:''}
  function currentCache(){const key=currentCacheKey();if(!key)return null;try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
  function saveCachedUser(user){const key=currentCacheKey(),c=currentCache();if(!key||!c)return;c.user={...(c.user||{}),...user};localStorage.setItem(key,JSON.stringify(c))}
  function restorePendingForUser(userId,newToken){
    let entries={};try{entries=JSON.parse(localStorage.getItem('bodysmith-recovery-v3')||'{}')}catch{}
    const old=entries[userId];if(!old)return;
    try{
      const c=localStorage.getItem(old.cacheKey),q=localStorage.getItem(old.queueKey),newCache=`bodysmith-cache-v3-${newToken.slice(-24)}`,newQueue=`bodysmith-queue-v3-${newToken.slice(-24)}`;
      if(c&&JSON.parse(c)?.user?.id===userId)localStorage.setItem(newCache,c);
      if(q)localStorage.setItem(newQueue,q);
    }catch{}
    delete entries[userId];localStorage.setItem('bodysmith-recovery-v3',JSON.stringify(entries));
  }

  function addStyles(){if(document.getElementById('authUpgradeStyles'))return;const s=document.createElement('style');s.id='authUpgradeStyles';s.textContent=`
    .auth-divider{display:flex;align-items:center;gap:10px;margin:16px 0;color:var(--muted,#94a3b8);font-size:12px}.auth-divider:before,.auth-divider:after{content:'';height:1px;flex:1;background:var(--border,rgba(148,163,184,.2))}
    .google-auth{width:100%;display:flex;align-items:center;justify-content:center;gap:10px}.google-auth svg{width:18px;height:18px}.google-auth[disabled]{opacity:.5;cursor:not-allowed}
    .auth-inline{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:6px}.auth-link{background:none;border:0;padding:4px 0;color:var(--blue-bright,#60a5fa);font:inherit;font-size:12px;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
    .auth-provider-note{margin:7px 0 0;text-align:center}.account-auth-card .auth-status{margin:8px 0 14px;padding:10px 12px;border:1px solid var(--border,rgba(148,163,184,.2));border-radius:12px;background:rgba(37,99,255,.07)}
    .account-auth-card .account-actions{display:grid;gap:10px}.account-auth-card .account-message{min-height:18px;margin:8px 0 0}.recovery-overlay{position:fixed;inset:0;z-index:9999;background:rgba(3,6,12,.9);display:grid;place-items:center;padding:20px}.recovery-card{width:min(460px,100%);background:var(--surface,#111827);border:1px solid var(--border,rgba(148,163,184,.2));border-radius:18px;padding:22px;box-shadow:0 28px 80px rgba(0,0,0,.5)}
  `;document.head.appendChild(s)}

  function googleIcon(){return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.3 3-7.3Z"/><path fill="currentColor" opacity=".82" d="M12 22c2.7 0 5-.9 6.6-2.4L15.4 17c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z"/><path fill="currentColor" opacity=".65" d="M6.4 13.9A6 6 0 0 1 6.1 12c0-.7.1-1.3.3-1.9V7.5H3.1A10 10 0 0 0 2 12c0 1.6.4 3.1 1.1 4.5l3.3-2.6Z"/><path fill="currentColor" opacity=".9" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.8A9.7 9.7 0 0 0 12 2a10 10 0 0 0-8.9 5.5l3.3 2.6A6 6 0 0 1 12 6Z"/></svg>`}

  async function checkGoogle(){if(googleChecked)return googleReady;googleChecked=true;try{const r=await fetch(`${SUPABASE_URL}/auth/v1/settings`,{headers:{apikey:API_KEY}});const d=await r.json();googleReady=Boolean(d?.external?.google??d?.external_google_enabled??d?.providers?.google?.enabled);}catch{googleReady=false}return googleReady}
  function oauthRedirect(){return `${location.origin}${location.pathname}`}
  function startGoogle(){if(!googleReady)return;const u=new URL(`${SUPABASE_URL}/auth/v1/authorize`);u.searchParams.set('provider','google');u.searchParams.set('redirect_to',oauthRedirect());location.assign(u.toString())}

  function showFormError(form,msg){let el=form.closest('.auth-card')?.querySelector('.form-error');if(!el){el=document.createElement('div');el.className='form-error';form.insertAdjacentElement('beforebegin',el)}el.style.display='block';el.textContent=msg}
  function clearFormError(form){const el=form.closest('.auth-card')?.querySelector('.form-error');if(el){el.textContent='';el.style.display='none'}}

  async function requestReset(form){const input=form.querySelector('[name="email"], [data-auth-identity]');const email=cleanEmail(input?.value);if(!validEmail(email)){showFormError(form,'Enter your email address first.');input?.focus();return}try{await api('request_password_reset',{email},false);showFormError(form,'If that email is linked to BodySmith, a password-reset email is on the way.')}catch{showFormError(form,'Could not request a reset right now. Try again in a moment.')}}

  function enhanceAuth(){const form=document.getElementById('authForm');if(!form||form.dataset.emailUpgrade==='1')return;form.dataset.emailUpgrade='1';const reg=!!form.querySelector('[name="displayName"]');const userInput=form.querySelector('[name="username"]');const userLabel=userInput?.closest('label.field');if(!userInput||!userLabel)return;
    if(reg){
      const emailLabel=document.createElement('label');emailLabel.className='field';emailLabel.innerHTML='Email<input name="email" type="email" autocomplete="email" inputmode="email" maxlength="254" placeholder="you@example.com" required><small class="field-help">Used for sign-in and account recovery.</small>';userLabel.insertAdjacentElement('beforebegin',emailLabel);
      const text=[...userLabel.childNodes].find(n=>n.nodeType===Node.TEXT_NODE);if(text)text.textContent='Community username';userInput.placeholder='Choose a public username';
    }else{
      const text=[...userLabel.childNodes].find(n=>n.nodeType===Node.TEXT_NODE);if(text)text.textContent='Email';userInput.name='email';userInput.dataset.authIdentity='1';userInput.type='email';userInput.inputMode='email';userInput.autocomplete='email';userInput.removeAttribute('pattern');userInput.removeAttribute('minlength');userInput.maxLength=254;userInput.placeholder='you@example.com';
      const row=document.createElement('div');row.className='auth-inline';row.innerHTML='<span class="muted tiny">Use the email attached to your BodySmith account.</span><button type="button" class="auth-link" data-legacy-login>Use legacy username</button>';userLabel.insertAdjacentElement('afterend',row);
      row.querySelector('[data-legacy-login]').onclick=()=>{const legacy=userInput.type==='text';if(legacy){userInput.type='email';userInput.inputMode='email';userInput.placeholder='you@example.com';text.textContent='Email';row.querySelector('button').textContent='Use legacy username';}else{userInput.type='text';userInput.inputMode='text';userInput.placeholder='Existing username';text.textContent='Legacy username';row.querySelector('button').textContent='Use email instead';}userInput.value='';userInput.focus()};
      const pw=form.querySelector('[name="password"]');const pwLabel=pw?.closest('label.field');if(pwLabel){const forgot=document.createElement('button');forgot.type='button';forgot.className='auth-link';forgot.textContent='Forgot password?';forgot.onclick=()=>requestReset(form);pwLabel.insertAdjacentElement('afterend',forgot)}
    }
    const card=form.closest('.auth-card');if(card&&!card.querySelector('[data-google-auth]')){const foot=card.querySelector('.auth-footnote');const wrap=document.createElement('div');wrap.innerHTML=`<div class="auth-divider"><span>or</span></div><button type="button" class="secondary google-auth" data-google-auth disabled>${googleIcon()}<span>Continue with Google</span></button><p class="muted tiny auth-provider-note" data-google-note>Checking Google sign-in…</p>`;foot?.insertAdjacentElement('beforebegin',wrap);const btn=wrap.querySelector('[data-google-auth]'),note=wrap.querySelector('[data-google-note]');btn.onclick=startGoogle;checkGoogle().then(ok=>{btn.disabled=!ok;note.textContent=ok?'Google sign-in is available.':'Google sign-in is prepared but the Google provider still needs to be connected.'})}
  }

  async function submitUpgradedAuth(event){const form=event.target;if(!(form instanceof HTMLFormElement)||form.id!=='authForm')return;event.preventDefault();event.stopImmediatePropagation();clearFormError(form);const fd=new FormData(form),reg=!!form.querySelector('[name="displayName"]'),password=String(fd.get('password')||'');
    try{
      let data;
      if(reg){const email=cleanEmail(fd.get('email'));if(!validEmail(email))throw new Error('Enter a valid email address.');data=await api('register',{email,username:fd.get('username'),displayName:fd.get('displayName'),password},false)}
      else{const identity=String(fd.get('email')||fd.get('username')||'').trim();if(form.querySelector('[data-auth-identity]')?.type==='email'&&!validEmail(identity))throw new Error('Enter a valid email address.');data=await api('login',{identity,password},false)}
      if(!data?.token||!data?.user?.id)throw new Error('Sign-in did not complete.');localStorage.setItem(TOKEN_KEY,data.token);restorePendingForUser(data.user.id,data.token);location.reload();
    }catch(e){showFormError(form,e.message||'Sign-in failed.')}
  }

  function injectAccountPanel(){const title=[...document.querySelectorAll('.section-title h1')].find(h=>h.textContent.trim()==='Profile');if(!title||document.querySelector('.account-auth-card'))return;const c=currentCache(),u=c?.user||{};const card=document.createElement('section');card.className='panel account-auth-card';card.innerHTML=`<h3>Account & sign-in</h3><p class="muted tiny">Add an email and password so you can sign in on any device. This does not erase your workout history.</p><div class="auth-status"><span class="muted tiny">Sign-in email</span><strong>${esc(u.email||'Not set yet')}</strong></div><div class="account-actions"><label class="field">Email<input type="email" data-account-email autocomplete="email" value="${esc(u.email||'')}" placeholder="you@example.com"></label><label class="field">New password<input type="password" data-account-password autocomplete="new-password" minlength="6" maxlength="72" placeholder="6–72 characters"></label><label class="field">Confirm password<input type="password" data-account-confirm autocomplete="new-password" minlength="6" maxlength="72"></label><button class="primary" type="button" data-save-signin>Save email & password</button></div><p class="muted tiny account-message" data-account-message></p><p class="muted tiny" data-account-google>Checking Google sign-in…</p>`;
    const anchor=title.closest('.section-title');anchor?.insertAdjacentElement('afterend',card);const msg=card.querySelector('[data-account-message]');card.querySelector('[data-save-signin]').onclick=async()=>{const email=cleanEmail(card.querySelector('[data-account-email]').value),pw=card.querySelector('[data-account-password]').value,confirm=card.querySelector('[data-account-confirm]').value;if(!validEmail(email)){msg.textContent='Enter a valid email address.';return}if(pw.length<6||pw.length>72){msg.textContent='Password must be 6–72 characters.';return}if(pw!==confirm){msg.textContent='Passwords do not match.';return}const btn=card.querySelector('[data-save-signin]');btn.disabled=true;msg.textContent='Saving…';try{const data=await api('set_email_password',{email,password:pw});saveCachedUser(data.user);card.querySelector('.auth-status strong').textContent=data.user.email||email;card.querySelector('[data-account-password]').value='';card.querySelector('[data-account-confirm]').value='';msg.textContent='Saved. You can now use this email and password on the BodySmith website or another device.'}catch(e){msg.textContent=e.message||'Could not update sign-in.'}finally{btn.disabled=false}};checkGoogle().then(ok=>{card.querySelector('[data-account-google]').textContent=ok?'Google sign-in is available for linked email accounts.':'Google sign-in code is ready; the Google provider still needs its OAuth credentials connected.'})
  }

  async function handleCallback(){const params=new URLSearchParams(location.hash.replace(/^#/,''));const accessToken=params.get('access_token');if(!accessToken)return false;const type=params.get('type');if(type==='recovery'){showRecovery(accessToken);return true}try{const data=await api('auth_exchange',{accessToken},false);if(data?.token&&data?.user?.id){localStorage.setItem(TOKEN_KEY,data.token);restorePendingForUser(data.user.id,data.token);history.replaceState({},'',location.pathname+location.search);location.reload();return true}}catch(e){console.error('BodySmith OAuth exchange failed',e)}return false}

  function showRecovery(accessToken){if(document.querySelector('.recovery-overlay'))return;const o=document.createElement('div');o.className='recovery-overlay';o.innerHTML=`<section class="recovery-card"><h2>Set a new BodySmith password</h2><p class="muted">Choose a new password, then BodySmith will sign you in.</p><label class="field">New password<input type="password" data-recovery-password minlength="6" maxlength="72" autocomplete="new-password"></label><label class="field">Confirm password<input type="password" data-recovery-confirm minlength="6" maxlength="72" autocomplete="new-password"></label><button class="primary huge" type="button" data-recovery-save>Update password</button><p class="muted tiny" data-recovery-message></p></section>`;document.body.appendChild(o);const msg=o.querySelector('[data-recovery-message]');o.querySelector('[data-recovery-save]').onclick=async()=>{const pw=o.querySelector('[data-recovery-password]').value,cf=o.querySelector('[data-recovery-confirm]').value;if(pw.length<6||pw.length>72){msg.textContent='Password must be 6–72 characters.';return}if(pw!==cf){msg.textContent='Passwords do not match.';return}msg.textContent='Updating…';try{const r=await fetch(`${SUPABASE_URL}/auth/v1/user`,{method:'PUT',headers:{'Content-Type':'application/json','apikey':API_KEY,'Authorization':`Bearer ${accessToken}`},body:JSON.stringify({password:pw})});if(!r.ok)throw new Error('Password update failed.');const data=await api('auth_exchange',{accessToken},false);localStorage.setItem(TOKEN_KEY,data.token);history.replaceState({},'',location.pathname);location.reload()}catch(e){msg.textContent=e.message||'Could not update password.'}}}

  function enhance(){addStyles();enhanceAuth();injectAccountPanel()}
  document.addEventListener('submit',submitUpgradedAuth,true);
  let queued=false;const schedule=()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;enhance()})};
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{enhance();handleCallback()},{once:true});else{enhance();handleCallback()}
  window.BodySmithAuthUpgrade={release:RELEASE,checkGoogle};
})();
