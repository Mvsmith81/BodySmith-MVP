const fs=require('fs'),assert=require('assert/strict');
const js=fs.readFileSync('workout-experience.js','utf8');
const version=fs.readFileSync('release-version.js','utf8');
const css=fs.readFileSync('release-212.css','utf8');
const html=fs.readFileSync('index.html','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
for(const term of ['AudioContext','Rest timer sound','Test bell','Quick Workout','start_custom_session','calendar-day','openCalendarDay','PREVIOUS SESSION','Use last first set','Keep one add-on progression at a time','Push + Pull Progression'])assert.ok(js.includes(term),term);
for(const term of ['calendar-day-detail','performance-baseline','quick-workout-launch'])assert.ok(css.includes(term),term);
for(const term of ["VERSION='v2.14.0'",'requestAnimationFrame'])assert.ok(version.includes(term),term);
for(const asset of ['workout-experience.js?v=20260918-release214','release-212.css?v=20260916-release212']){assert.ok(html.includes(asset),asset);assert.ok(sw.includes(asset),asset)}
assert.ok(html.includes('release-version.js?v=20260918-release214'));
assert.ok(sw.includes('release-version.js?v=20260917-release213'));
assert.equal(pkg.version,'2.14.0');
console.log('PASS v2.12 workout experience features remain wired inside the v2.14 shell');