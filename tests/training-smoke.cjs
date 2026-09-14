const assert=require('node:assert/strict'),{plateLoads,recommend}=require('../training.js');
const lb=[45,35,25,10,5,2.5],kg=[25,20,15,10,5,2.5,1.25];
assert.deepEqual(plateLoads(90,45,lb).exact.plates,[10,10,2.5]);
for(const total of [45,95,135,185,225,275,315]){const p=plateLoads(total,45,lb).exact;assert.equal(p.bar+2*p.plates.reduce((a,b)=>a+b,0),total)}
for(const total of [20,40,60,100,140])assert.equal(plateLoads(total,20,kg).exact.total,total);
assert.equal(plateLoads(193,45,lb).lower.total,190);assert.equal(plateLoads(193,45,lb).higher.total,195);
assert.equal(plateLoads(90,35,lb).exact.total,90);assert.equal(plateLoads(50,0,lb).exact.total,50);assert.equal(plateLoads(65,15,lb).exact.total,65);
assert.equal(plateLoads(135,45,[{weight:45,pairs:1}]).exact.total,135);assert.equal(plateLoads(225,45,[{weight:45,pairs:1}]).exact,null);
const args={slot:{min_reps:8,max_reps:12,target_rpe:'7–8',target_sets:3},exercise:{exercise_type:'weighted'},increment:5};
const s=(weight,reps,rpe)=>({weight,reps,rpe,completion_status:'completed'});
assert.equal(recommend({...args,sets:[s(45,12,6)]}).weight,50);
assert.ok(recommend({...args,sets:[s(45,8,9.5)]}).weight<=45);
assert.equal(recommend({...args,sets:[s(45,12,6)]}).weight,50);assert.ok(recommend({...args,sets:[s(45,7,9.5)]}).weight<45);
assert.equal(recommend({...args,slot:{...args.slot,max_reps:10},previous:[s(185,10,8),s(185,10,8),s(185,10,8)]}).weight,190);
assert.equal(recommend({...args,entered:30}).weight,30);assert.equal(recommend({...args,exercise:{exercise_type:'cardio'}}),null);
console.log('PASS plate totals, balanced inventory, nearest loads, metric/custom/Smith/machine bases, progression A/B/C, history and first set');
