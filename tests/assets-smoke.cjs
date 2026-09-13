const fs=require('node:fs'),assert=require('node:assert/strict');
const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
for(const icon of manifest.icons)assert.ok(fs.existsSync(icon.src),icon.src);
const sw=fs.readFileSync('sw.js','utf8'),shell=JSON.parse(sw.match(/const SHELL=(.*);/)[1]);
for(const path of shell)if(path!=='./')assert.ok(fs.existsSync(path.split('?')[0]),path);
for(const path of ['app.js','styles.css','auth-fix.js'])assert.ok(shell.some(x=>x.includes(path)&&fs.readFileSync('index.html','utf8').includes(x)),path+' cache version');
assert.ok(sw.includes("addEventListener('push'"));assert.equal(fs.readdirSync('media').filter(p=>p.endsWith('.webp')).length,29);
console.log('PASS manifest, versioned shell, 29 media assets, push handler');
