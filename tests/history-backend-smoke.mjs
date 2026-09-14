import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
const KEY='sb_publishable_ibEVVafS4THz-16p4euMfg_qjG2WeU2';
const MAIN='https://uuzctytbguqjumwpczfh.supabase.co/functions/v1/bodysmith-api';
const HISTORY='https://uuzctytbguqjumwpczfh.supabase.co/functions/v1/bodysmith-history';
async function call(url,action,payload={},token='',status=200){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',apikey:KEY},body:JSON.stringify({action,...payload,token})});const d=await r.json();assert.equal(r.status,status,`${action}: ${JSON.stringify(d)}`);return d}
let token='';
try{
  assert.equal((await call(HISTORY,'health')).ok,true);
  const password=randomBytes(24).toString('base64url');
  const reg=await call(MAIN,'register',{username:'bodysmith_qa_'+randomBytes(6).toString('hex'),password,displayName:'History QA',qaMode:true},'',201);
  token=reg.token;
  const boot=await call(MAIN,'bootstrap',{},token);
  const day=boot.plan.plan_days[0],slot=day.plan_day_exercises[0],when=new Date(Date.now()-48*3600000);when.setSeconds(0,0);
  const saved=await call(HISTORY,'log_past_workout',{performedAt:when.toISOString(),durationMinutes:45,planDayId:day.id,day:{name:day.name,focus:day.focus,plan_day_exercises:[{...slot,exercise_id:slot.exercises.id,exercises:{id:slot.exercises.id},target_sets:1}]},sets:[{exerciseId:slot.exercises.id,setNumber:1,weight:45,reps:10,rpe:7,elbowPain:0,units:'lb',loadBasis:'total',loadMultiplier:1}],notes:'QA historical workout'},token,201);
  assert.equal(saved.session.status,'completed');
  assert.equal(saved.session.day_snapshot.manual_history,true);
  assert.equal(saved.session.sets.length,1);
  const history=await call(MAIN,'history',{limit:10},token);
  const found=history.history.find(x=>x.id===saved.session.id);
  assert.ok(found);
  assert.equal(found.sets[0].reps,10);
  assert.ok(Math.abs(new Date(found.started_at)-when)<1000);
  console.log('PASS historical workout timestamp, snapshot and set persistence');
}finally{if(token)try{await call(MAIN,'cleanup_qa',{},token)}catch{}}
