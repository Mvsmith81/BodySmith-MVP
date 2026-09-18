const {JSDOM}=require('jsdom'),fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
  const dom=new JSDOM('<main id="app"><div class="screen"><h1 class="active-title">QA Workout</h1><div class="swap-panel"></div><span class="release">v2.14.0</span></div></main><div id="toast"></div>',{url:'https://mvsmith81.github.io/BodySmith-MVP/',runScripts:'outside-only'});
  const w=dom.window;w.requestAnimationFrame=cb=>w.setTimeout(cb,0);w.confirm=()=>true;w.fetch=async()=>{throw Error('unexpected network')};
  const token='bs_'+('a'.repeat(64));w.localStorage.setItem('bodysmith-token-v2',token);w.localStorage.setItem('bodysmith-cache-v3-'+token.slice(-24),JSON.stringify({active:{id:'session-freeze-regression',status:'in_progress'}}));
  vm.runInContext(fs.readFileSync('release-213.js','utf8'),dom.getInternalVMContext());
  for(let i=0;i<30;i++){const n=w.document.createElement('span');n.textContent='mutation';w.document.body.appendChild(n);n.remove();await new Promise(r=>w.setTimeout(r,2))}
  await new Promise(r=>w.setTimeout(r,30));
  assert.equal(w.document.querySelectorAll('[data-delete-active213]').length,1,'active delete control must be injected once');
  assert.equal([...w.document.querySelectorAll('button')].filter(b=>/Delete this workout/.test(b.textContent)).length,1,'no recursive delete-button injection');
  console.log('PASS v2.13 freeze regression: active-workout enhancement remains idempotent under repeated DOM mutations');
  dom.window.close();
})().catch(e=>{console.error(e);process.exitCode=1});