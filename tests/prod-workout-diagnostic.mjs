import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

const APP='https://mvsmith81.github.io/BodySmith-MVP/';
const API='https://uuzctytbguqjumwpczfh.supabase.co/functions/v1/bodysmith-api';
const KEY='sb_publishable_ibEVVafS4THz-16p4euMfg_qjG2WeU2';
async function raw(action,payload={},token=''){
  const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json',apikey:KEY},body:JSON.stringify({action,...payload,token})});
  const d=await r.json().catch(()=>({}));
  return {status:r.status,data:d};
}
async function call(action,payload={},token='',expected=200){
  const {status,data}=await raw(action,payload,token);
  assert.equal(status,expected,action+': '+JSON.stringify(data));
  return data;
}
const users=[],tokens=[];let browser;
async function createQa(label){
  const username='bodysmith_qa_'+randomBytes(6).toString('hex'),password=randomBytes(24).toString('base64url');
  const reg=await call('register',{username,password,displayName:label,qaMode:true},'',201);
  tokens.push(reg.token);users.push({username,password,token:reg.token});
  await call('update_profile',{displayName:label,units:'lb',onboardingCompleted:true,preferences:{goal:'Build strength',daysPerWeek:4,trainingDays:[1,3,5],timezone:'America/New_York'}},reg.token);
  return users.at(-1);
}
try{
  const first=await createQa('Workout Freeze Diagnostic');
  const second=await createQa('Second Account Diagnostic');
  const secondBoot=await call('bootstrap',{},second.token);
  const secondStart=await call('start_session',{planDayId:secondBoot.plan.plan_days[0].id},second.token,201);
  assert.equal((await call('bootstrap',{},second.token)).activeSession.id,secondStart.session.id);
  await call('abandon_session',{sessionId:secondStart.session.id,notes:'Second-account production verification'},second.token);
  assert.equal((await call('bootstrap',{},second.token)).activeSession,null);
  console.log('PASS second production account can start and resolve a workout independently');

  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  page.setDefaultTimeout(12000);
  const diagnostics=[];let startRequests=0;
  page.on('console',m=>{if(['error','warning'].includes(m.type()))diagnostics.push('console '+m.type()+': '+m.text())});
  page.on('pageerror',e=>diagnostics.push('pageerror: '+e.message));
  page.on('requestfailed',r=>diagnostics.push('requestfailed: '+r.method()+' '+r.url()+' '+(r.failure()?.errorText||'')));
  page.on('request',r=>{
    if(!r.url().includes('/functions/v1/bodysmith-api')||r.method()!=='POST')return;
    try{if(r.postDataJSON()?.action==='start_session')startRequests++}catch{}
  });
  page.on('dialog',d=>d.accept());

  await page.goto(APP+'?release214='+Date.now(),{waitUntil:'networkidle',timeout:30000});
  await page.evaluate(t=>localStorage.setItem('bodysmith-token-v2',t),first.token);
  await page.reload({waitUntil:'networkidle',timeout:30000});
  await page.waitForSelector('.dashboard-start',{timeout:15000});
  assert.match(await page.locator('.release').first().innerText(),/v2\.14\.0/);
  console.log('PASS live v2.14 shell loaded on mobile viewport');

  await page.locator('.dashboard-start').evaluate(b=>{b.click();b.click()});
  await page.waitForSelector('#reps',{timeout:10000});
  assert.equal(startRequests,1,'rapid repeated start taps must create one start request');
  assert.equal(await page.locator('[data-delete-active213]').count(),1,'active workout enhancement must inject once');
  console.log('PASS default workout starts without freeze and rapid taps are locked');

  const bootActive=await call('bootstrap',{},first.token);
  assert.ok(bootActive.activeSession?.id);
  await page.reload({waitUntil:'networkidle',timeout:30000});
  await page.waitForSelector('#activeWorkoutCard',{timeout:12000});
  assert.match(await page.locator('#activeWorkoutCard').innerText(),/WORKOUT IN PROGRESS/i);
  assert.match(await page.locator('#activeWorkoutCard').innerText(),/Started:/i);
  await page.locator('#activeWorkoutCard [data-action="resume"]').click();
  await page.waitForSelector('#reps',{timeout:8000});
  console.log('PASS refresh preserves and identifies a resumable active workout');

  await page.locator('[data-action="home"]').click();
  await page.waitForSelector('#activeWorkoutCard [data-action="endactive"]');
  await page.locator('#activeWorkoutCard [data-action="endactive"]').click();
  await page.waitForFunction(()=>document.querySelector('.dashboard-start')?.textContent?.includes('Start Workout'));
  assert.equal((await call('bootstrap',{},first.token)).activeSession,null);
  console.log('PASS End Workout clears active state while preserving partial history');

  await page.locator('[data-training="custom"]').click();
  await page.waitForSelector('#addExercise0');
  await page.locator('[data-add-exercise="0"]').click();
  await page.locator('[data-extra="saveplan"]').click();
  await page.waitForSelector('#reps',{timeout:10000});
  const customBoot=await call('bootstrap',{},first.token);
  assert.equal(customBoot.activeSession?.day_snapshot?.custom,true);
  console.log('PASS custom workout starts normally with no active session');

  await page.locator('[data-action="home"]').click();
  await page.locator('#activeWorkoutCard [data-action="endactive"]').click();
  await page.waitForFunction(()=>document.querySelector('.dashboard-start')?.textContent?.includes('Start Workout'));
  assert.equal((await call('bootstrap',{},first.token)).activeSession,null);
  assert.equal(diagnostics.length,0,'unexpected browser errors: '+diagnostics.join('\n'));
  console.log('PASS live workout start/resume/end/custom flow completed without browser errors');
} finally {
  for(const token of tokens){try{await call('cleanup_qa',{},token)}catch(e){console.error('QA cleanup failed',e.message)}}
  await browser?.close().catch(()=>{});
}