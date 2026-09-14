const fs=require('node:fs'),assert=require('node:assert/strict');
const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
for(const icon of manifest.icons)assert.ok(fs.existsSync(icon.src),icon.src);
const sw=fs.readFileSync('sw.js','utf8'),shell=JSON.parse(sw.match(/const SHELL=(.*);/)[1]);
for(const path of shell)if(path!=='./')assert.ok(fs.existsSync(path.split('?')[0]),path);
for(const path of ['app.js','styles.css','auth-fix.js','training.js'])assert.ok(shell.some(x=>x.includes(path)&&fs.readFileSync('index.html','utf8').includes(x)),path+' cache version');
assert.ok(!shell.some(x=>x.includes('/media/')),'No eager media download');
const catalog=require('../data/exercises.json');assert.ok(catalog.filter(x=>!x.is_legacy).length>=120);
for(const e of catalog){for(const key of ['image_url','thumbnail_url','motion_url']){assert.ok(fs.existsSync(e[key]),e.slug+' '+key);const b=fs.readFileSync(e[key]);assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WEBP');if(key==='thumbnail_url')assert.ok(b.length<40000,e.slug+' thumbnail size');}assert.ok(e.setup_instructions&&e.movement_instructions&&e.substitution_group&&e.aliases.length,e.slug+' metadata');}
console.log('PASS manifest, versioned shell, lazy media, catalog completeness and WebP assets');
