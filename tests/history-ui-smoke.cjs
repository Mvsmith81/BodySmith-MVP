const fs=require('fs'),assert=require('assert/strict');
const h=fs.readFileSync('history-log.js','utf8'),html=fs.readFileSync('index.html','utf8'),sw=fs.readFileSync('sw.js','utf8');
for(const t of ['Log a past workout','bodysmith-history','log_past_workout','historyDayChoice','historyAddExercise','Save past workout','Nothing is posted'])assert.ok(h.includes(t),t);
assert.ok(html.includes('history-log.js?v=20260914-history260'));
assert.ok(sw.includes('history-log.js?v=20260914-history260'));
assert.ok(h.includes("type=\"datetime-local\""));
assert.ok(h.includes('setTimeout(()=>location.reload(),650)'));
console.log('PASS past-workout launcher, dated entry form, exercise/set editing and cache wiring');
