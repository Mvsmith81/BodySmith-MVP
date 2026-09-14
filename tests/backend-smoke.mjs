import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
const URL=process.env.BODYSMITH_API||'https://uuzctytbguqjumwpczfh.supabase.co/functions/v1/bodysmith-api';
async function call(action,payload={},token='',status=200){const r=await fetch(URL,{method:'POST',headers:{'Content-Type':'application/json',apikey:'sb_publishable_ibEVVafS4THz-16p4euMfg_qjG2WeU2'},body:JSON.stringify({action,...payload,token})});const data=await r.json();assert.equal(r.status,status,`${action}: ${JSON.stringify(data)}`);return data;}
const cleanup=[];
try {
let passed=0;const pass=name=>{console.log('PASS',name);passed++};
assert.equal((await call('health')).ok,true);pass('backend health');
const suffix=randomBytes(6).toString('hex'),username='bodysmith_qa_'+suffix,password=randomBytes(24).toString('base64url');
const a=await call('register',{username,password,displayName:'Release QA',qaMode:true},'',201);cleanup.push(a.token);assert.ok(a.token);assert.equal(a.user.onboarding_completed,false);pass('registration and independent onboarding');
const login=await call('login',{username,password});const token=login.token;assert.equal(login.user.id,a.user.id);pass('login');
await call('login',{username,password:'incorrect'},'',401);pass('invalid login rejected');
let b=await call('bootstrap',{},token);assert.equal(b.plan.plan_days.length,4);assert.ok(b.plans.length>=6);assert.equal(b.plan.name,'The Smith Method');assert.ok(b.plans.some(p=>p.name==='Cortez Compound'&&p.days_per_week===5));assert.equal(b.history.length,0);pass('Smith Method default, Cortez Compound and starter templates');
await call('update_profile',{displayName:'Release QA',units:'lb',onboardingCompleted:true,preferences:{goal:'Build strength',trainingDays:[1,3,5],daysPerWeek:3,timezone:'America/New_York'}},token);pass('onboarding saved');
const other=await call('register',{username:'bodysmith_qa_'+randomBytes(6).toString('hex'),password,displayName:'Isolation QA',qaMode:true},'',201);
cleanup.push(other.token);
const day=b.plan.plan_days[0],exercise=day.plan_day_exercises[0].exercises;
const start=await call('start_session',{planDayId:day.id},token,201);assert.ok(start.session.day_snapshot);pass('workout start and snapshot');
await call('start_session',{planDayId:b.plan.plan_days[1].id},token,409);pass('active workout abandonment protection');
await call('save_set',{sessionId:start.session.id,exerciseId:exercise.id,setNumber:1,reps:8,weight:30,rpe:7},other.token,404);pass('cross-user set write blocked');
await call('save_set',{sessionId:start.session.id,exerciseId:exercise.id,setNumber:1,reps:8,weight:-1,rpe:7},token,400);pass('invalid set rejected');
const payload={sessionId:start.session.id,exerciseId:exercise.id,setNumber:1,reps:8,weight:30,rpe:7};await call('save_set',payload,token);await call('save_set',payload,token);b=await call('bootstrap',{},token);assert.equal(b.activeSession.sets.length,1);pass('set save and idempotent retry');
const swapSlot=day.plan_day_exercises[1],alt=b.exercises.find(e=>e.slug==='incline-dumbbell-press');
const swap=await call('swap_exercise',{sessionId:start.session.id,slotId:swapSlot.id,exerciseId:alt.id},token);assert.ok(swap.day.plan_day_exercises.some(x=>x.exercises.id===alt.id));pass('persistent exercise substitution');
const finish=await call('complete_session',{sessionId:start.session.id},token);assert.equal(finish.session.status,'completed');assert.equal(finish.history[0].sets.length,1);pass('session completion and history');
const clone=structuredClone(b.plan);clone.name='QA private plan';const saved=await call('save_plan',{plan:clone},token,201);assert.notEqual(saved.plan.id,clone.id);assert.equal(saved.plan.is_template,false);await call('get_plan',{planId:saved.plan.id},other.token,404);pass('private plan clone and ownership');
const sup=await call('save_supplement',{supplement:{name:'QA supplement',dose:'user entered',unit:'capsule',times:['09:00'],schedule_days:[0,1,2,3,4,5,6],reminders:false}},token,201);
await call('save_supplement',{supplement:{id:sup.supplement.id,name:'Hacked'}},other.token,404);pass('supplement creation and cross-user edit protection');
for(const status of ['taken','skipped','snoozed']){const l=await call('log_supplement',{supplementId:sup.supplement.id,time:'09:00',date:new Date().toISOString().slice(0,10),status},token);assert.equal(l.log.status,status)}pass('supplement taken/skipped/snoozed logging');
await call('log_supplement',{supplementId:sup.supplement.id,time:'09:00',date:new Date().toISOString().slice(0,10),status:'taken'},other.token,404);pass('cross-user supplement logging blocked');
const config=await call('notification_config',{},token);assert.ok(config.publicKey);assert.ok(!config.privateKey);pass('push configured with public key only');
await call('dispatch_reminders',{},'',401);pass('scheduler authorization');
b=await call('bootstrap',{},other.token);assert.equal(b.history.length,0);assert.equal(b.supplements.length,0);assert.ok(!b.plans.some(p=>p.id===saved.plan.id));pass('independent account data isolation');
await call('logout',{},token);await call('bootstrap',{},token,401);pass('logout revokes sessions');
console.log(`${passed} backend smoke checks passed. Designated test accounts are cleaned up.`);

} finally {for(const token of cleanup){await call("cleanup_qa",{},token);console.log("PASS temporary account removed");}}
