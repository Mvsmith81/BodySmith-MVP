from pathlib import Path
import re


def once(text, old, new, label):
    count=text.count(old)
    if count!=1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    return text.replace(old,new,1)

p=Path('app.js');app=p.read_text()
app=once(app,'<span class="release">v2.5</span>','<span class="release">v2.5.1</span>','release badge')

# Add a direct Progress -> Forge photo path.
needle='<div class="section-title"><h1>Progress</h1><span class="muted">Last 30 days</span></div><div class="stats-grid">'
app=once(app,needle,'<div class="section-title"><h1>Progress</h1><span class="muted">Last 30 days</span></div><button class="secondary huge" data-forge-progress>Share progress photos to The Forge</button><div class="stats-grid">','progress forge shortcut')

# Own comments can be edited or deleted.
pattern=r"function forgeComment\(c\)\{.*?\}\nfunction forgePostCard"
replacement='''function forgeComment(c){const mine=c.user_id===S.user.id,edited=c.updated_at&&c.updated_at!==c.created_at;return `<div class="forge-comment"><div><strong>${esc(c.author?.display_name||'Athlete')}</strong> <span class="muted tiny">@${esc(c.author?.username||'athlete')} · ${forgeTime(c.created_at)}${edited?' · edited':''}</span></div><p>${esc(c.body)}</p>${mine?`<div class="forge-inline-actions"><button class="linkbtn" data-forge-edit-comment="${c.id}">Edit</button><button class="linkbtn danger-text" data-forge-delete-comment="${c.id}">Delete</button></div>`:''}</div>`}
function forgePostCard'''
app,n=re.subn(pattern,replacement,app,count=1,flags=re.S)
if n!=1:raise SystemExit(f'forgeComment replace: {n}')

# Own posts can be edited or deleted; show edited state.
pattern=r"function forgePostCard\(p\)\{.*?\}\nfunction forgeComposerView"
replacement='''function forgePostCard(p){const mine=p.is_mine,react=p.my_reaction,edited=p.updated_at&&p.updated_at!==p.created_at;return `<article class="forge-post card"><header class="forge-author"><div class="profile-avatar small">${initials(p.author?.display_name)}</div><div><strong>${esc(p.author?.display_name||'BodySmith athlete')}</strong><div class="muted tiny">@${esc(p.author?.username||'athlete')} · ${forgeTime(p.created_at)}${edited?' · edited':''}</div></div>${mine?'<span class="pill">Your post</span>':''}</header>${p.caption?`<p class="forge-caption">${esc(p.caption)}</p>`:''}${forgeWorkoutCard(p.workout_summary)}${forgeMedia(p.media)}<div class="forge-reactions"><button class="reaction ${react==='like'?'active':''}" data-forge-react="${p.id}|like" aria-pressed="${react==='like'}">♡ ${p.reactions?.like||0}</button><button class="reaction ${react==='strong'?'active':''}" data-forge-react="${p.id}|strong" aria-pressed="${react==='strong'}">💪 ${p.reactions?.strong||0}</button><button class="reaction ${react==='fire'?'active':''}" data-forge-react="${p.id}|fire" aria-pressed="${react==='fire'}">🔥 ${p.reactions?.fire||0}</button></div><div class="forge-comments">${(p.comments||[]).map(forgeComment).join('')}<form class="forge-comment-form" data-forge-comment="${p.id}"><input name="comment" maxlength="800" placeholder="Encourage them…" aria-label="Comment"><button class="secondary">Post</button></form></div>${mine?`<div class="forge-owner-actions"><button class="linkbtn" data-forge-edit="${p.id}">Edit post</button><button class="linkbtn danger-text" data-forge-delete="${p.id}">Delete post</button></div>`:`<details class="forge-safety"><summary>Post options</summary><label class="field">Report reason<select data-forge-report-reason="${p.id}"><option value="spam">Spam</option><option value="harassment">Harassment</option><option value="sexual_content">Sexual content</option><option value="hate">Hate</option><option value="dangerous_content">Dangerous content</option><option value="impersonation">Impersonation</option><option value="other">Other</option></select></label><div class="row-actions"><button class="secondary" data-forge-report="${p.id}">Report</button><button class="dangerbtn" data-forge-block="${p.user_id}">Block user</button></div></details>`}</article>`}
function forgeComposerView'''
app,n=re.subn(pattern,replacement,app,count=1,flags=re.S)
if n!=1:raise SystemExit(f'forgePostCard replace: {n}')

# Profile section lists only posts the user actually published.
pattern=r"function forgeProfileSection\(\)\{.*?\}\nfunction fileDataUrl"
replacement='''function forgeProfileSection(){const posts=S.forgeMine.filter(p=>p.visibility==='public');return `<section class="panel"><div class="mini-row"><div><h3 style="margin:0">The Forge</h3><p class="muted tiny" style="margin:4px 0 0">Your public community posts</p></div><button class="secondary" data-open-forge>Open Forge</button></div>${posts.length?posts.slice(0,3).map(p=>`<div class="mini-row"><div><strong>${p.post_type==='workout'?esc(p.workout_summary?.workoutName||'Workout'):p.post_type==='progress'?'Progress update':'Community post'}</strong><div class="muted tiny">${forgeTime(p.created_at)} · ${esc((p.caption||'').slice(0,90))}</div></div></div>`).join(''):'<p class="muted">No public Forge posts yet.</p>'}</section>`}
function fileDataUrl'''
app,n=re.subn(pattern,replacement,app,count=1,flags=re.S)
if n!=1:raise SystemExit(f'forgeProfileSection replace: {n}')

# Add edit operations and progress shortcut to Forge bindings.
old="one('[data-forge-new]',()=>{S.forgeComposer={type:'text'};render()});one('[data-forge-cancel]',()=>{S.forgeComposer=null;render()});one('[data-forge-more]',()=>loadForge(false));one('[data-open-forge]',async()=>{S.screen='forge';render();await loadForge(true)});"
new="one('[data-forge-new]',()=>{S.forgeComposer={type:'text'};render()});one('[data-forge-progress]',async()=>{S.screen='forge';S.forgeComposer={type:'progress'};render();await loadForge(true)});one('[data-forge-cancel]',()=>{S.forgeComposer=null;render()});one('[data-forge-more]',()=>loadForge(false));one('[data-open-forge]',async()=>{S.screen='forge';render();await loadForge(true)});"
app=once(app,old,new,'progress shortcut binding')
old="one('[data-forge-delete]',async el=>{if(!confirm('Delete this Forge post?'))return;await forgeApi('delete_post',{postId:el.dataset.forgeDelete});await loadForge(true)});\n one('[data-forge-delete-comment]',async el=>{await forgeApi('delete_comment',{commentId:el.dataset.forgeDeleteComment});await loadForge(true)});"
new="one('[data-forge-edit]',async el=>{const post=S.forgePosts.find(p=>p.id===el.dataset.forgeEdit);if(!post)return;const caption=prompt('Edit your Forge caption',post.caption||'');if(caption===null)return;await forgeApi('update_post',{postId:post.id,caption});await loadForge(true);toast('Post updated')});\n one('[data-forge-delete]',async el=>{if(!confirm('Delete this Forge post?'))return;await forgeApi('delete_post',{postId:el.dataset.forgeDelete});await loadForge(true)});\n one('[data-forge-edit-comment]',async el=>{const comment=S.forgePosts.flatMap(p=>p.comments||[]).find(c=>c.id===el.dataset.forgeEditComment);if(!comment)return;const body=prompt('Edit your comment',comment.body||'');if(body===null||!body.trim())return;await forgeApi('update_comment',{commentId:comment.id,body:body.trim()});await loadForge(true);toast('Comment updated')});\n one('[data-forge-delete-comment]',async el=>{await forgeApi('delete_comment',{commentId:el.dataset.forgeDeleteComment});await loadForge(true)});"
app=once(app,old,new,'edit bindings')
p.write_text(app)

# Small action-row styling.
cssp=Path('styles.css');css=cssp.read_text()
if '/* Forge 2.5.1 ownership controls */' not in css:
    css+='''\n\n/* Forge 2.5.1 ownership controls */\n.forge-owner-actions,.forge-inline-actions{display:flex;gap:14px;align-items:center;flex-wrap:wrap}.forge-owner-actions{padding-top:8px}.forge-inline-actions .linkbtn{font-size:12px}.forge-caption{overflow-wrap:anywhere}\n'''
cssp.write_text(css)

# Release/cache bump.
for name in ['package.json','package-lock.json']:
    q=Path(name);t=q.read_text().replace('"version": "2.5.0"','"version": "2.5.1"');q.write_text(t)
q=Path('index.html');q.write_text(q.read_text().replace('20260914-forge25','20260914-forge251'))
q=Path('sw.js');q.write_text(q.read_text().replace('bodysmith-release-2.5.0','bodysmith-release-2.5.1').replace('20260914-forge25','20260914-forge251'))
for q in list(Path('tests').glob('*.html'))+list(Path('tests/visual').glob('*.html')):
    q.write_text(q.read_text().replace('20260914-forge25','20260914-forge251').replace('v2.5</span>','v2.5.1</span>'))

# Strengthen Forge UI smoke assertions.
q=Path('tests/forge-ui-smoke.cjs');t=q.read_text();t=once(t,"'data-forge-block','data-forge-report'","'data-forge-block','data-forge-report','data-forge-edit','data-forge-edit-comment','data-forge-progress','update_comment'",'forge ui assertions');q.write_text(t)

# Strengthen live backend smoke test for forced-private progress, edit-comment, and metadata rejection.
q=Path('tests/forge-backend-smoke.mjs');t=q.read_text()
t=once(t,"await call(FORGE,'comment',{postId:workout.id,body:'Strong work'},b.token,201);","const comment=(await call(FORGE,'comment',{postId:workout.id,body:'Strong work'},b.token,201)).comment;await call(FORGE,'update_comment',{commentId:comment.id,body:'Strong work — edited'},b.token);",'edit comment smoke')
t=once(t,"assert.ok(seen.comments.some(c=>c.body==='Strong work'));","assert.ok(seen.comments.some(c=>c.body==='Strong work — edited'));",'edited comment assertion')
t=once(t,"{postType:'progress',caption:'Private upload test',visibility:'private'}","{postType:'progress',caption:'Private upload test',visibility:'public'}",'force private input')
t=once(t,"const privatePost=(await call(FORGE,'create_post'","const privatePost=(await call(FORGE,'create_post'",'private post marker')
# Insert assertion and EXIF rejection immediately before valid JPEG upload.
needle=".post;const jpeg='data:image/jpeg;base64,"
replacement=".post;assert.equal(privatePost.visibility,'private');const exif='data:image/jpeg;base64,/9j/RXhpZgAA';await call(FORGE,'upload_media',{postId:privatePost.id,data:exif,mime:'image/jpeg',width:1,height:1,comparisonLabel:'single'},a.token,400);const jpeg='data:image/jpeg;base64,"
t=once(t,needle,replacement,'privacy and exif smoke')
q.write_text(t)

print('Applied BodySmith Forge 2.5.1 polish')
