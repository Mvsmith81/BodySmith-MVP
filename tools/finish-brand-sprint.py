from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)

app_path = Path('app.js')
app = app_path.read_text()
app = replace_once(app, '<span class="release">v2.4</span>', '<span class="release">v2.4.2</span>', 'release badge')
app = replace_once(
    app,
    "S.user?`<button class=\"avatar\" data-nav=\"profile\">${initials(S.user.display_name)}</button>`:'<span></span>'",
    "S.user?`<button class=\"avatar\" data-nav=\"profile\" aria-label=\"Profile\">${initials(S.user.display_name)}</button>`:'<span></span>'",
    'profile aria label',
)
old_nav = "function nav(){const items=[['plan','clipboard-list'],['exercises','barbell'],['workout','home-2'],['supplements','pill'],['progress','chart-bar'],['profile','user']];return `<nav class=\"bottom-nav\">${items.map(([n,i])=>`<button data-nav=\"${n}\" class=\"${S.screen===n?'active':''}\"><img class=\"ui-icon\" src=\"./brand/icons/${i}.svg\" width=\"23\" height=\"23\" alt=\"\"><small>${n==='workout'?'Home':n[0].toUpperCase()+n.slice(1)}</small></button>`).join('')}</nav>`}"
new_nav = "function nav(){const items=[['plan','clipboard-list'],['exercises','barbell'],['workout','home-2'],['supplements','pill'],['progress','chart-bar'],['profile','user']];return `<nav class=\"bottom-nav\" aria-label=\"Primary navigation\">${items.map(([n,i])=>`<button type=\"button\" data-nav=\"${n}\" class=\"${S.screen===n?'active':''}\" ${S.screen===n?'aria-current=\"page\"':''}><img class=\"ui-icon\" src=\"./brand/icons/${i}.svg\" width=\"23\" height=\"23\" alt=\"\"><small>${n==='workout'?'Home':n[0].toUpperCase()+n.slice(1)}</small></button>`).join('')}</nav>`}"
app = replace_once(app, old_nav, new_nav, 'primary navigation semantics')
app = replace_once(
    app,
    ".replace('<nav class=\"bottom-nav\">','<button class=\"secondary huge\" data-training=\"custom\">Start Custom Workout</button><nav class=\"bottom-nav\">')",
    ".replace('<nav class=\"bottom-nav\" aria-label=\"Primary navigation\">','<button class=\"secondary huge\" data-training=\"custom\">Start Custom Workout</button><nav class=\"bottom-nav\" aria-label=\"Primary navigation\">')",
    'custom workout insertion target',
)
app_path.write_text(app)

css_path = Path('styles.css')
css = css_path.read_text()
css = replace_once(css, 'padding: 0 20px 112px;', 'padding: 0 20px calc(112px + env(safe-area-inset-bottom));', 'screen safe area')
polish = '''\n\n/* BodySmith 2.4.2 finishing polish */\n.bottom-nav .ui-icon { opacity:.72; transition:opacity var(--ease), filter var(--ease), transform var(--ease); }\n.bottom-nav button.active .ui-icon { opacity:1; filter:brightness(0) saturate(100%) invert(63%) sepia(52%) saturate(3350%) hue-rotate(193deg) brightness(104%) contrast(104%); }\n.bottom-nav button:focus-visible,.iconbtn:focus-visible,.avatar:focus-visible { outline:2px solid var(--blue-light);outline-offset:2px;box-shadow:var(--focus); }\n@media (hover:hover) { .bottom-nav button:hover { color:var(--soft);background:#ffffff08; } .bottom-nav button.active:hover { color:var(--blue-light);background:#2563ff20; } }\n'''
if '/* BodySmith 2.4.2 finishing polish */' not in css:
    css += polish
css_path.write_text(css)

for name in ['package.json','package-lock.json']:
    p=Path(name); t=p.read_text(); t=t.replace('"version": "2.4.1"','"version": "2.4.2"'); p.write_text(t)

for name in ['index.html','sw.js','tests/mobile.html']:
    p=Path(name); t=p.read_text().replace('20260915-brand24b','20260915-brand24c').replace('bodysmith-release-2.4.1','bodysmith-release-2.4.2'); p.write_text(t)

for p in Path('tests/visual').glob('*.html'):
    p.write_text(p.read_text().replace('20260915-brand24b','20260915-brand24c').replace('v2.4</span>','v2.4.2</span>'))

brand_test = Path('tests/brand-smoke.cjs')
t = brand_test.read_text()
needle = "const app=fs.readFileSync('app.js','utf8');assert.ok(app.includes('brand/mark.png'));assert.ok(app.includes('wordmark-dark.webp'));assert.ok(app.includes('featured-plans'));assert.ok(!app.includes('BUILD A STRONGER YOU'));assert.ok(!app.includes(\"['exercises','🏋']\"));"
replacement = needle + "assert.ok(app.includes('aria-label=\\\"Primary navigation\\\"'));assert.ok(app.includes('aria-current=\\\"page\\\"'));assert.ok(app.includes('v2.4.2'));"
t = replace_once(t, needle, replacement, 'brand smoke nav assertions')
brand_test.write_text(t)

print('Applied BodySmith 2.4.2 finishing polish')
