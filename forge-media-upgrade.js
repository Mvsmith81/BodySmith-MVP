const FORGE_MEDIA_API='https://uuzctytbguqjumwpczfh.supabase.co/functions/v1/bodysmith-forge';
const FORGE_MEDIA_KEY='sb_publishable_ibEVVafS4THz-16p4euMfg_qjG2WeU2';
const FORGE_MEDIA_TOKEN='bodysmith-token-v2';

async function forgeMediaCall(action,payload={},options={}){
  const token=localStorage.getItem(FORGE_MEDIA_TOKEN)||'';
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),options.timeout||45000);
  try{
    const response=await fetch(FORGE_MEDIA_API,{method:'POST',headers:{'Content-Type':'application/json','apikey':FORGE_MEDIA_KEY},body:JSON.stringify({action,...payload,token}),signal:controller.signal});
    const data=await response.json().catch(()=>({error:'Invalid Forge response'}));
    if(!response.ok)throw new Error(data.error||`Forge request failed (${response.status})`);
    return data;
  }finally{clearTimeout(timer)}
}

function forgeMediaToast(message,error=false){
  const el=document.getElementById('toast');
  if(!el)return;
  el.textContent=message;el.className=`show${error?' error':''}`;
  clearTimeout(el._forgeMediaTimer);el._forgeMediaTimer=setTimeout(()=>el.className='',3200);
}

function forgeFileDataUrl(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Could not read that file.'));reader.readAsDataURL(blob)})}
function forgeLoadImage(file){return new Promise((resolve,reject)=>{const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Could not open that image.'))};img.src=url})}

async function prepareForgeMedia(file){
  if(!/^image\/(jpeg|png|webp|gif)$/.test(file.type))throw Error('Use a JPEG, PNG, WebP, or GIF image.');
  if(file.size>5*1024*1024)throw Error('Each Forge image or GIF must be 5 MB or smaller.');
  const img=await forgeLoadImage(file),width=img.naturalWidth,height=img.naturalHeight;
  if(!width||!height||width>5000||height>5000)throw Error('That image has unsupported dimensions.');
  if(file.type==='image/gif')return{data:await forgeFileDataUrl(file),mime:'image/gif',width,height};
  const scale=Math.min(1,1600/Math.max(width,height)),w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale)),canvas=document.createElement('canvas');
  canvas.width=w;canvas.height=h;canvas.getContext('2d').drawImage(img,0,0,w,h);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.84));
  if(!blob||blob.size>5*1024*1024)throw Error('That image is too large after processing.');
  return{data:await forgeFileDataUrl(blob),mime:'image/jpeg',width:w,height:h};
}

function cleanForgeUrl(raw){return String(raw||'').replace(/[),.!?\]}]+$/,'')}
function youtubeIdFromForgeUrl(raw){
  try{
    const url=new URL(cleanForgeUrl(raw)),host=url.hostname.toLowerCase().replace(/^www\./,'').replace(/^m\./,'');
    let id='';
    if(host==='youtu.be')id=url.pathname.split('/').filter(Boolean)[0]||'';
    else if(host==='youtube.com'||host==='youtube-nocookie.com'){
      const parts=url.pathname.split('/').filter(Boolean);
      if(url.pathname==='/watch')id=url.searchParams.get('v')||'';
      else if(['shorts','embed','live'].includes(parts[0]))id=parts[1]||'';
    }
    return /^[A-Za-z0-9_-]{11}$/.test(id)?id:null;
  }catch{return null}
}
function youtubeIdFromForgeText(text){for(const match of String(text||'').match(/https?:\/\/[^\s<>"']+/g)||[]){const id=youtubeIdFromForgeUrl(match);if(id)return id}return null}

function decorateForgeYoutube(){
  document.querySelectorAll('.forge-post .forge-caption').forEach(caption=>{
    if(caption.dataset.youtubeChecked)return;
    caption.dataset.youtubeChecked='1';
    const id=youtubeIdFromForgeText(caption.textContent);if(!id)return;
    const wrap=document.createElement('div');wrap.className='forge-youtube';wrap.innerHTML=`<div class="forge-youtube-frame"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="YouTube video in The Forge" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div><a href="https://www.youtube.com/watch?v=${id}" target="_blank" rel="noopener noreferrer">Open on YouTube</a>`;
    caption.insertAdjacentElement('afterend',wrap);
  });
}

function upgradeForgeComposer(){
  const form=document.getElementById('forgeComposer');if(!form||form.dataset.mediaUpgrade==='1')return;
  form.dataset.mediaUpgrade='1';
  const field=form.querySelector('.forge-progress-field'),input=document.getElementById('forgePhotos');
  if(field){field.classList.add('forge-media-field');const text=[...field.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim());if(text)text.textContent='Add media ';const help=field.querySelector('.field-help');if(help)help.textContent='Optional for any post: up to 4 JPEG, PNG, WebP, or GIF files, 5 MB each. Static photos are privacy-processed before upload. Two files on a Progress post are labeled Before and After.'}
  if(input)input.accept='image/jpeg,image/png,image/webp,image/gif';
  const caption=document.getElementById('forgeCaption');if(caption&&!form.querySelector('.forge-youtube-help')){const help=document.createElement('span');help.className='field-help forge-youtube-help';help.textContent='Paste a YouTube, YouTube Shorts, or youtu.be link in your caption and it will play inside the Forge feed.';caption.insertAdjacentElement('afterend',help)}
}

async function submitForgeWithMedia(form){
  if(!navigator.onLine)throw Error('Connect to the internet to post media to The Forge.');
  const type=document.getElementById('forgePostType')?.value||'text',caption=document.getElementById('forgeCaption')?.value.trim()||'',input=document.getElementById('forgePhotos'),files=[...(input?.files||[])];
  if(!files.length)return false;
  if(files.length>4)throw Error('Choose up to four images or GIFs.');
  const button=form.querySelector('button[type=submit]');if(button){button.disabled=true;button.textContent='Uploading…'}
  const payload={postType:type,caption,visibility:'private'};
  if(type==='workout')payload.workoutSessionId=document.getElementById('forgeWorkout')?.value||'';
  let created;
  try{
    created=(await forgeMediaCall('create_post',payload)).post;
    for(let i=0;i<files.length;i++){
      const media=await prepareForgeMedia(files[i]),comparisonLabel=type==='progress'&&files.length===2?(i===0?'before':'after'):'single';
      await forgeMediaCall('upload_media',{postId:created.id,...media,comparisonLabel},{timeout:60000});
    }
    await forgeMediaCall('update_post',{postId:created.id,visibility:'public',caption});
    forgeMediaToast('Posted to The Forge');
    setTimeout(()=>location.reload(),450);
    return true;
  }catch(error){
    if(created?.id)try{await forgeMediaCall('delete_post',{postId:created.id})}catch{}
    if(button){button.disabled=false;button.textContent='Post to The Forge'}
    throw error;
  }
}

function upgradeForgeMediaUi(){upgradeForgeComposer();decorateForgeYoutube()}

document.addEventListener('submit',async event=>{
  const form=event.target.closest?.('#forgeComposer');if(!form)return;
  const files=[...(document.getElementById('forgePhotos')?.files||[])];if(!files.length)return;
  event.preventDefault();event.stopImmediatePropagation();
  try{await submitForgeWithMedia(form)}catch(error){forgeMediaToast(error.message||'Could not post that media.',true)}
},true);

const forgeMediaApp=document.getElementById('app');if(forgeMediaApp)new MutationObserver(upgradeForgeMediaUi).observe(forgeMediaApp,{childList:true,subtree:true});
upgradeForgeMediaUi();
