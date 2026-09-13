import webpush from 'npm:web-push@3.6.7';
async function config(db:any,name:string){let last:any;for(let i=0;i<3;i++){const r=await db.from('notification_config').select('value').eq('name',name).maybeSingle();if(!r.error)return r.data;last=r.error;await new Promise(r=>setTimeout(r,150*(i+1)));}throw last;}
export async function vapid(db:any){let data=await config(db,'vapid');if(!data){const keys=webpush.generateVAPIDKeys();const r=await db.from('notification_config').upsert({name:'vapid',value:keys},{onConflict:'name',ignoreDuplicates:true});if(r.error)throw r.error;data=await config(db,'vapid');}if(!data?.value?.publicKey||!data?.value?.privateKey)throw Error('Push configuration unavailable');return data.value;}
export async function deliver(db:any,req:Request){
 const secret=await config(db,'scheduler');
 if(!secret||req.headers.get('x-scheduler-secret')!==secret.value.secret)return new Response(JSON.stringify({error:'Unauthorized'}),{status:401});
 const keys=await vapid(db);webpush.setVapidDetails('https://mvsmith81.github.io/BodySmith-MVP/',keys.publicKey,keys.privateKey);
 const {data:subs,error}=await db.from('push_subscriptions').select('*');if(error)throw error;
 const userIds=[...new Set((subs||[]).map((s:any)=>s.user_id))];let sent=0,failed=0;
 for(const uid of userIds){
  const {data:u}=await db.from('app_users').select('preferences').eq('id',uid).single();const p=u?.preferences||{};
  const tz=p.timezone||'UTC',now=new Date(),parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',weekday:'short'}).formatToParts(now).map(x=>[x.type,x.value]));
  const date=`${parts.year}-${parts.month}-${parts.day}`,time=`${parts.hour}:${parts.minute}`,weekday=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(parts.weekday);
  const due:any[]=[],minutes=(t:string)=>+t.slice(0,2)*60 + +t.slice(3,5),isDue=(t:string)=>/^\d{2}:\d{2}$/.test(t)&&minutes(time)-minutes(t)>=0&&minutes(time)-minutes(t)<5;
  if(p.workoutReminders&&p.trainingDays?.includes(weekday)&&isDue(p.workoutTime||''))due.push({key:`workout:${date}`,title:'BodySmith · Workout reminder',body:'Your planned workout is ready. Open BodySmith to begin.',category:'workout'});
  if(p.supplementReminders){const {data:sups}=await db.from('supplements').select('*').eq('user_id',uid).eq('active',true).eq('reminders',true);const {data:logs}=await db.from('supplement_logs').select('*').eq('user_id',uid).eq('scheduled_date',date);
   for(const s of sups||[])if(s.schedule_days.includes(weekday))for(const t of s.times){const l=logs?.find((l:any)=>l.supplement_id===s.id&&l.scheduled_time===t);if(l&&l.status!=='snoozed')continue;
    const snooze=l?.snoozed_until,ready=snooze?new Date(snooze)<=now&&now.getTime()-new Date(snooze).getTime()<300000:isDue(t);
    if(ready)due.push({key:`supp:${s.id}:${date}:${t}:${snooze||''}`,title:'BodySmith · Supplement reminder',body:'A scheduled supplement is due. Open your checklist to review it.',category:'supplements'});
   }
  }
  for(const n of due){const {error:claimed}=await db.from('notification_deliveries').insert({user_id:uid,delivery_key:n.key});if(claimed){if(claimed.code==='23505')continue;throw claimed}let delivered=false;
   for(const sub of subs.filter((s:any)=>s.user_id===uid)){try{await webpush.sendNotification(sub.subscription,JSON.stringify(n),{TTL:3600,timeout:10000});sent++;delivered=true}catch(e){failed++;if([404,410].includes(e.statusCode))await db.from('push_subscriptions').delete().eq('id',sub.id).eq('user_id',uid);}}
   if(!delivered)await db.from('notification_deliveries').delete().eq('user_id',uid).eq('delivery_key',n.key);
  }
 }
 return new Response(JSON.stringify({ok:true,sent,failed}),{headers:{'Content-Type':'application/json'}});
}

export async function testPush(db:any,userId:string){const keys=await vapid(db);webpush.setVapidDetails('https://mvsmith81.github.io/BodySmith-MVP/',keys.publicKey,keys.privateKey);const {data:subs,error}=await db.from('push_subscriptions').select('*').eq('user_id',userId);if(error)throw error;let sent=0,failed=0;for(const sub of subs||[]){try{await webpush.sendNotification(sub.subscription,JSON.stringify({title:'BodySmith · Test notification',body:'Notifications are working on this device.',key:'bodysmith-test'}),{TTL:60,timeout:10000});sent++}catch(e){failed++;if([404,410].includes(e.statusCode))await db.from('push_subscriptions').delete().eq('id',sub.id).eq('user_id',userId);}}return {sent,failed};}
