const fs=require('fs'),assert=require('assert/strict');
const js=fs.readFileSync('flex-profile.js','utf8'),html=fs.readFileSync('index.html','utf8'),sw=fs.readFileSync('sw.js','utf8');
for(const text of ["Choose today's workout",'BodySmith will never lock you into a weekday','These are workout options, not assigned weekdays','Lose fat','Improve endurance','Current body weight','startingWeight','Goal body weight','Body-weight trend','Training profile'])assert.ok(js.includes(text),text);
assert.ok(js.includes("height.required=true"));
assert.ok(js.includes("weight.required=true"));
assert.ok(js.includes("bodysmith-cache-v3-"));
assert.ok(html.includes('flex-profile.js?v=20260915-flex262'));
assert.ok(sw.includes('flex-profile.js?v=20260915-flex262'));
console.log('PASS flexible workout selection guidance, required onboarding baseline metrics and progress/profile trend wiring');
