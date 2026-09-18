const fs=require('fs');
const assert=require('assert');
const index=fs.readFileSync('index.html','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const planner=fs.readFileSync('planner-runtime.js','utf8');
const profile=fs.readFileSync('profile-details.js','utf8');
const nutrition=fs.readFileSync('nutrition-v2.js','utf8');
for(const file of ['planner-runtime.js','profile-details.js','nutrition-v2.js','planner.css']){
  assert(index.includes(file+'?v=20260915-release211'),`index missing ${file}`);
  assert(sw.includes(file+'?v=20260915-release211'),`service worker missing ${file}`);
}
assert(!index.includes('./nutrition.js?'), 'legacy nutrition runtime should not be loaded');
assert(planner.includes('enroll_program'),'planner progression missing');
assert(planner.includes('reorder_active'),'active workout reorder missing');
assert(planner.includes('Push-Up Progression'),'push-up progression UI missing');
assert(planner.includes('Push + Pull Progression'),'combo progression UI missing');
assert(profile.includes('bodyWeight'),'editable body weight missing');
assert(profile.includes('heightCm'),'editable height missing');
assert(profile.includes('activityLevel'),'activity profile missing');
assert(nutrition.includes('macroSuggestion'),'profile-based macro suggestions missing');
assert(nutrition.includes('Use suggested macros'),'macro apply action missing');
assert(sw.includes("bodysmith-release-2.14.0-release214"),'current release cache missing');
console.log('BodySmith release 2.11 planner/profile/nutrition smoke passed inside current shell');
