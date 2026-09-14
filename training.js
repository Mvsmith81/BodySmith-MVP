/* Pure training rules. No account state, networking, or permanent plan changes. */
(function(root){
'use strict';
const round=n=>Math.round(n*100)/100;
function plateLoads(target,bar,inventory){
 if(!Number.isFinite(target)||target<0||!Number.isFinite(bar)||bar<0||!Array.isArray(inventory)||!inventory.length)throw Error('Enter a valid total, bar/base weight, and plate inventory.');
 const coins=inventory.map(p=>typeof p==='number'?{weight:p,pairs:8}:p).filter(p=>Number.isFinite(p.weight)&&p.weight>0&&Number.isInteger(p.pairs)&&p.pairs>0&&p.pairs<=20).sort((a,b)=>b.weight-a.weight);
 const cap=Math.min(250000,Math.max(0,Math.ceil((target-bar)/2*100))+Math.ceil((coins[0]?.weight||25)*100));
 let sums=new Map([[0,[]]]);
 for(const c of coins){const prior=[...sums];for(const [sum,plates] of prior)for(let n=1;n<=c.pairs;n++){const value=sum+Math.round(c.weight*100)*n;if(value>cap)break;const next=[...plates,...Array(n).fill(c.weight)];if(!sums.has(value)||sums.get(value).length>next.length)sums.set(value,next)}}
 const choices=[...sums].map(([n,plates])=>({total:round(bar+n/50),perSide:round(n/100),plates,bar})).sort((a,b)=>a.total-b.total);
 return {requested:target,exact:choices.find(x=>Math.abs(x.total-target)<0.005)||null,lower:choices.filter(x=>x.total<target).at(-1)||null,higher:choices.find(x=>x.total>target)||null};
}
function recommend({slot,exercise,sets=[],previous=[],entered=0,increment=5,plateConfig=null}){
 if(['cardio','timed','bodyweight'].includes(exercise.exercise_type)||slot.duration_minutes)return null;
 const valid=sets.filter(s=>s.completion_status==='completed'),last=valid.at(-1)||previous[0];
 const min=+slot.min_reps||8,max=+slot.max_reps||12,targets=String(slot.target_rpe||'7–8').match(/\d+(?:\.\d+)?/g)?.map(Number)||[7,8],lo=Math.min(...targets),hi=Math.max(...targets);
 let weight=Number(last?.weight??entered),reps=max,reason='Start with your entered load and the programmed rep range.';
 if(!Number.isFinite(weight)||weight<0)return null;
 const step=Number.isFinite(+increment)&&+increment>0?+increment:5;
 const current=valid.length>0,rpe=Number(last?.rpe),hasRpe=last?.rpe!=null&&Number.isFinite(rpe),actual=Number(last?.reps);
 const fatigue=valid.length>1&&actual<Number(valid[0].reps)*.75;
 if(last?.elbow_pain>=4)return {weight,minReps:min,maxReps:max,reason:'Pain was reported. Pause this movement or choose a comfortable substitute; do not increase load.',starting:!current};
 if(last){
  reason=current?'Stay at this load and aim for controlled reps.':'Suggested starting load from your last completed workout.';
  if((hasRpe&&rpe>hi)||actual<min||fatigue){
   reps=Math.max(min,Math.min(max,actual||min));
   if((hasRpe&&rpe>=hi+1.5)||actual<min||fatigue){weight=Math.max(0,weight-step);reason='Effort or fatigue was high. Reduce one increment and keep the reps controlled.'}else reason='Effort was above target. Keep the load and aim for fewer clean reps.';
  }else if((current&&actual>=max&&hasRpe&&rpe<lo&&valid.length<3)||(!current&&previous.length>=slot.target_sets&&previous.every(s=>s.reps>=max&&s.rpe!=null&&s.rpe<=hi))){
   if(step<=Math.max(weight*.125,2.5)){weight+=step;reps=Math.max(min,max-2);reason=current?'You reached the top of the range below target effort. Try one modest increment.':'All programmed sets reached the top of the range at acceptable effort. Try one increment.'}else reason='The next available increment is a large jump. Keep the load and build control.';
  }
 }
 if(plateConfig){const options=plateLoads(weight,plateConfig.bar,plateConfig.inventory);const fit=options.exact||options.lower;if(!fit)return null;if(fit.total!==weight)reason+=' Rounded down to an available balanced plate load.';weight=fit.total;}
 return {weight:round(weight),minReps:reps,maxReps:max,reason,starting:!current};
}
const api={plateLoads,recommend};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BodySmithTraining=api;
})(typeof window!=='undefined'?window:this);
