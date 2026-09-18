import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

const APP='https://mvsmith81.github.io/BodySmith-MVP/';
const API='https://uuzctytbguqjumwpczfh.supabase.co/functions/v1/bodysmith-api';
const KEY='sb_publishable_ibEVVafS4THz-16p4euMfg_qjG2WeU2';
async function call(action,payload={},token='',expected){
  const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json',apikey:KEY},body:JSON.stringify({action,...payload,token})});
  const d=await r.json().catch(()=>({}));
  if(expected!=null) assert.equal(r.status,expected,action+': '+JSON.stringify(d));
  if(!r.ok) throw Object.assign(new Error(d.error||action+' failed'),{status:r.status,data:d});
  return d;
}
const username='bodysmith_qa_'+randomBytes(6).toString('hex');
const password=randomBytes(24).toString('base64url');
let token='',browser;
try{
  const reg=await call('register',{username,password,displayName:'Workout Freeze Diagnostic',qaMode:true},'',201);
  token=reg.token;
  await call('update_profile',{displayName:'Workout Freeze Diagnostic',units:'lb',onboardingCompleted:true,preferences:{goal:'Build strength',daysPerWeek:4,trainingDays:[1,3,5],timezone:'America/New_York'}},token,200);
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  page.setDefaultTimeout(10000);
  const diagnostics=[];
  page.on('console',m=>diagnostics.push('console '+m.type()+': '+m.text()));
  page.on('pageerror',e=>diagnostics.push('pageerror: '+e.message));
  page.on('requestfailed',r=>diagnostics.push('requestfailed: '+r.method()+' '+r.url()+' '+(r.failure()?.errorText||'')));
  page.on('response',r=>{if(r.url().includes('/functions/v1/'))diagnostics.push('response '+r.status()+': '+r.url())});
  await page.goto(APP+'?diagnostic='+Date.now(),{waitUntil:'networkidle',timeout:30000});
  await page.evaluate(t=>localStorage.setItem('bodysmith-token-v2',t),token);
  await page.reload({waitUntil:'networkidle',timeout:30000});
  await page.waitForSelector('.dashboard-start',{timeout:15000});
  console.log('HOME READY',await page.locator('body').innerText().then(x=>x.slice(0,1200)));
  const start=page.locator('.dashboard-start');
  console.log('START LABEL',await start.innerText());
  await start.click();
  let active=false;
  try{await page.waitForSelector('#reps',{timeout:8000});active=true}catch(e){console.log('START WAIT FAILED',e.message)}
  console.log('ACTIVE RENDERED',active);
  try{console.log('POST START BODY',await page.locator('body').innerText({timeout:3000}).then(x=>x.slice(0,1600)))}catch(e){console.log('BODY READ FAILED',e.message)}
  console.log('DIAGNOSTICS\n'+diagnostics.join('\n'));
  const boot=await call('bootstrap',{},token,200);
  console.log('BACKEND ACTIVE',JSON.stringify(boot.activeSession&&{id:boot.activeSession.id,status:boot.activeSession.status,name:boot.activeSession.day_snapshot?.name,sets:boot.activeSession.sets?.length,plan_day_id:boot.activeSession.plan_day_id}));
  if(boot.activeSession) await call('abandon_session',{sessionId:boot.activeSession.id,notes:'Production workout freeze diagnostic cleanup'},token,200);
  if(!active)process.exitCode=2;
} finally {
  try{if(token)await call('cleanup_qa',{},token,200)}catch(e){console.error('cleanup failed',e.message)}
  await browser?.close().catch(()=>{});
}
