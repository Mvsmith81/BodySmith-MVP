import { vapid, deliver, testPush } from "./notifications.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const enc = new TextEncoder();
const allowedOrigins = new Set([
  "https://mvsmith81.github.io",
  "http://localhost:8000",
  "http://localhost:3000",
  "http://127.0.0.1:8000",
]);

function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://mvsmith81.github.io",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Vary": "Origin",
  };
}
function out(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: cors(req) });
}
function hex(bytes: Uint8Array) { return [...bytes].map(b => b.toString(16).padStart(2, "0")).join(""); }
function randomHex(bytes = 32) { const a = new Uint8Array(bytes); crypto.getRandomValues(a); return hex(a); }
async function sha256(text: string) { return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(text)))); }
async function passwordHash(password: string, saltHex: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: Uint8Array.from(saltHex.match(/.{1,2}/g)!.map(x => parseInt(x,16))), iterations: 180000 }, key, 256);
  return hex(new Uint8Array(bits));
}
async function createSession(userId: string) {
  const token = "bs_" + randomHex(32);
  const tokenHash = await sha256(token);
  const expires = new Date(Date.now() + 30 * 86400000).toISOString();
  await db.from("app_sessions").delete().eq("user_id", userId).lt("expires_at", new Date().toISOString());
  const { error } = await db.from("app_sessions").insert({ user_id: userId, token_hash: tokenHash, expires_at: expires });
  if (error) throw error;
  return { token, expires_at: expires };
}
async function auth(body: any) {
  const token = String(body?.token || "");
  if (!token.startsWith("bs_") || token.length < 40) return null;
  const tokenHash = await sha256(token);
  const { data, error } = await db.from("app_sessions").select("id,user_id,expires_at").eq("token_hash", tokenHash).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (error || !data) return null;
  db.from("app_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", data.id).then(() => {});
  return data.user_id as string;
}
async function getUser(userId: string) {
  const { data, error } = await db.from("app_users").select("id,username,display_name,units,active_plan_id,created_at,preferences,onboarding_completed").eq("id", userId).single();
  if (error) throw error;
  return data;
}
async function getPlan(planId?: string | null) {
  let id = planId;
  if (!id) {
    const { data } = await db.from("workout_plans").select("id").eq("is_template", true).order("created_at", { ascending: true }).limit(1).maybeSingle();
    id = data?.id;
  }
  if (!id) return null;
  const { data, error } = await db.from("workout_plans").select(`
    id,name,goal,days_per_week,is_template,owner_id,
    plan_days(id,day_key,name,focus,sort_order,
      plan_day_exercises(id,sort_order,target_sets,min_reps,max_reps,target_rpe,rest_seconds,duration_minutes,progression_rule,pain_rule,
        exercises(*)
      )
    )
  `).eq("id", id).single();
  if (error) throw error;
  data.plan_days?.sort((a:any,b:any)=>a.sort_order-b.sort_order);
  for (const d of data.plan_days || []) d.plan_day_exercises?.sort((a:any,b:any)=>a.sort_order-b.sort_order);
  return data;
}
async function history(userId: string, limit = 25) {
  const { data: sessions, error } = await db.from("workout_sessions").select("id,plan_day_id,status,started_at,completed_at,duration_seconds,workout_notes,day_snapshot,updated_at").eq("user_id", userId).order("started_at", { ascending: false }).limit(limit);
  if (error) throw error;
  if (!sessions?.length) return [];
  const ids = sessions.map((s:any)=>s.id);
  const { data: sets, error: e2 } = await db.from("workout_sets").select("id,session_id,exercise_id,set_number,weight,reps,rpe,elbow_pain,completion_status,notes,logged_at,duration_seconds,units,updated_at,load_basis,load_multiplier").in("session_id", ids).order("set_number");
  if (e2) throw e2;
  const dayIds = [...new Set(sessions.map((s:any)=>s.plan_day_id).filter(Boolean))];
  const { data: days } = dayIds.length ? await db.from("plan_days").select("id,name,focus,day_key,sort_order").in("id", dayIds) : { data: [] } as any;
  const dmap = Object.fromEntries((days || []).map((d:any)=>[d.id,d]));
  return sessions.map((s:any)=>({ ...s, day:dmap[s.plan_day_id] || null, sets:(sets||[]).filter((x:any)=>x.session_id===s.id) }));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return out(req, { error: "POST required" }, 405);
  let body: any = {};
  try { body = await req.json(); } catch { return out(req, { error: "Invalid JSON" }, 400); }
  const action = String(body.action || "");
  try {
    if(action === "dispatch_reminders")return await deliver(db,req);
    if (action === "health") return out(req, { ok: true, service: "BodySmith API", version: "2.2.0" });

    if (action === "register") {
      const username = String(body.username || "").trim().toLowerCase();
      const displayName = String(body.displayName || "").trim();
      const password = String(body.password || "");
      if (!/^[a-z0-9_.-]{3,30}$/.test(username)) return out(req, { error: "Username must be 3–30 letters, numbers, dots, underscores, or dashes." }, 400);
      if (displayName.length < 2 || displayName.length > 50) return out(req, { error: "Enter a display name." }, 400);
      if (password.length < 6 || password.length > 72) return out(req, { error: "Password must be at least 6 characters." }, 400);
      const salt = randomHex(16);
      const hash = await passwordHash(password, salt);
      const plan = await getPlan(null);
      const { data, error } = await db.from("app_users").insert({ is_qa:body.qaMode===true&&/^bodysmith_qa_[a-f0-9]{12}$/.test(username), username, display_name: displayName, password_salt: salt, password_hash: hash, active_plan_id: plan?.id || null }).select("id,username,display_name,units,active_plan_id,created_at,preferences,onboarding_completed").single();
      if (error) {
        if (error.code === "23505") return out(req, { error: "That username is already taken." }, 409);
        throw error;
      }
      const session = await createSession(data.id);
      return out(req, { user: data, ...session }, 201);
    }

    if (action === "login") {
      const username = String(body.username || "").trim().toLowerCase();
      const password = String(body.password || "");
      const { data } = await db.from("app_users").select("id,username,display_name,units,active_plan_id,created_at,preferences,onboarding_completed,password_salt,password_hash").eq("username", username).maybeSingle();
      if (!data) return out(req, { error: "Invalid username or password." }, 401);
      const hash = await passwordHash(password, data.password_salt);
      if (hash !== data.password_hash) return out(req, { error: "Invalid username or password." }, 401);
      const session = await createSession(data.id);
      delete data.password_salt; delete data.password_hash;
      return out(req, { user: data, ...session });
    }

    const userId = await auth(body);
    if (!userId) return out(req, { error: "Please sign in again." }, 401);

    if(action === "cleanup_qa") {
      const {error}=await db.rpc("cleanup_bodysmith_qa",{p_user:userId});
      if(error)return out(req,{error:"Only designated temporary QA accounts can be cleaned up."},403);
      return out(req,{ok:true});
    }
    if(action === "set_targets") {
      const n=Number(body.targetSets);if(!Number.isInteger(n)||n<1||n>20)return out(req,{error:"Use 1–20 sets."},400);
      const {data:s}=await db.from("workout_sessions").select("id,day_snapshot").eq("id",String(body.sessionId)).eq("user_id",userId).eq("status","in_progress").maybeSingle();
      const slot=s?.day_snapshot?.plan_day_exercises?.find((x:any)=>x.id===body.slotId);if(!s||!slot)return out(req,{error:"Active slot not found."},404);
      slot.programmed_sets??=slot.target_sets;slot.target_sets=n;
      const {error}=await db.from("workout_sessions").update({day_snapshot:s.day_snapshot,updated_at:new Date().toISOString()}).eq("id",s.id).eq("user_id",userId);if(error)throw error;return out(req,{ok:true});
    }
    if(action === "delete_set") {
      const {data:session}=await db.from("workout_sessions").select("id,status").eq("id",String(body.sessionId)).eq("user_id",userId).maybeSingle();
      if(!session||!['completed','in_progress'].includes(session.status))return out(req,{error:"Editable workout not found."},404);
      const {error}=await db.from("workout_sets").delete().eq("session_id",session.id).eq("user_id",userId).eq("exercise_id",String(body.exerciseId)).eq("set_number",Number(body.setNumber));if(error)throw error;
      await db.from("workout_sessions").update({updated_at:new Date().toISOString()}).eq("id",session.id).eq("user_id",userId);
      return out(req,{ok:true});
    }
    if(action === "session_notes") {
      const {data,error}=await db.from("workout_sessions").update({workout_notes:String(body.notes||'').slice(0,1000),updated_at:new Date().toISOString()}).eq("id",String(body.sessionId)).eq("user_id",userId).select("id").maybeSingle();
      if(error)throw error;if(!data)return out(req,{error:"Workout not found."},404);return out(req,{ok:true});
    }
    if(action === "start_custom_session") {
      const day=body.day;
      if(!day||!String(day.name||'').trim()||!Array.isArray(day.plan_day_exercises)||!day.plan_day_exercises.length||day.plan_day_exercises.length>30)return out(req,{error:"Choose 1–30 exercises."},400);
      if((await history(userId,100)).some((s:any)=>s.status==='in_progress'))return out(req,{error:"Finish or change your active workout first."},409);
      const {data:catalog,error:ce}=await db.from("exercises").select("*").or(`owner_id.is.null,owner_id.eq.${userId}`);if(ce)throw ce;
      const seen=new Set();const slots=[];
      for(const [i,x] of day.plan_day_exercises.entries()){
        const ex=catalog.find((e:any)=>e.id===(x.exercises?.id||x.exercise_id));
        if(!ex||seen.has(ex.id)||!Number.isInteger(+x.target_sets)||x.target_sets<1||x.target_sets>20||!Number.isInteger(+x.rest_seconds)||x.rest_seconds<0||x.rest_seconds>3600||!Number.isInteger(+x.min_reps)||x.min_reps<0||!Number.isInteger(+x.max_reps)||x.max_reps<x.min_reps||x.max_reps>1000||!Number.isInteger(+(x.duration_minutes||0))||+(x.duration_minutes||0)<0||+(x.duration_minutes||0)>240)return out(req,{error:"Check exercise targets."},400);
        seen.add(ex.id);slots.push({...x,id:crypto.randomUUID(),sort_order:i,exercises:ex,exercise_id:ex.id});
      }
      const {data,error}=await db.rpc("start_bodysmith_session",{p_user:userId,p_day:null,p_snapshot:{name:String(day.name).slice(0,100),plan_day_exercises:slots,custom:true}});if(error)throw error;
      return out(req,{session:{...data,sets:[]}},201);
    }
    if (action === "logout") {
      const tokenHash = await sha256(String(body.token));
      await db.from("app_sessions").delete().eq("token_hash", tokenHash);
      return out(req, { ok: true });
    }

    if (action === "select_plan" || action === "get_plan") {
      const {data:p}=await db.from("workout_plans").select("id,owner_id,is_template").eq("id",String(body.planId)).maybeSingle();
      if(!p || (!p.is_template && p.owner_id!==userId)) return out(req,{error:"Plan not available."},404);
      if(action==="select_plan") {
        if((await history(userId,100)).some((s:any)=>s.status==="in_progress")) return out(req,{error:"Finish your active workout before changing plans."},409);
        const {error}=await db.from("app_users").update({active_plan_id:p.id}).eq("id",userId); if(error) throw error;
      }
      return out(req,{plan:await getPlan(p.id)});
    }
    if(action === "save_plan") {
      if((await history(userId,100)).some((s:any)=>s.status==="in_progress")) return out(req,{error:"Finish your active workout before changing plans."},409);
      const p=body.plan;
      if(!p || !String(p.name||'').trim() || !Array.isArray(p.plan_days) || p.plan_days.length<1 || p.plan_days.length>7) return out(req,{error:"A plan needs a name and 1–7 days."},400);
      const {data:available,error:ee}=await db.from("exercises").select("id").or(`owner_id.is.null,owner_id.eq.${userId}`); if(ee)throw ee;
      const ids=new Set(available.map((x:any)=>x.id));
      for(const d of p.plan_days){
        if(!String(d.name||'').trim()||!Array.isArray(d.plan_day_exercises)||!d.plan_day_exercises.length||d.plan_day_exercises.length>30) return out(req,{error:"Each day needs a name and 1–30 exercises."},400);
        const seen=new Set();
        for(const x of d.plan_day_exercises){
          const id=x.exercises?.id||x.exercise_id;
          if(!ids.has(id)||seen.has(id))return out(req,{error:"Choose available exercises once per day."},400);seen.add(id);
          if(!Number.isInteger(+x.target_sets)||+x.target_sets<1||+x.target_sets>20||!Number.isInteger(+x.rest_seconds)||+x.rest_seconds<0||+x.rest_seconds>3600||!Number.isInteger(+x.min_reps)||+x.min_reps<0||!Number.isInteger(+x.max_reps)||+x.max_reps<+x.min_reps||+x.max_reps>1000||!Number.isInteger(+(x.duration_minutes||0))||+(x.duration_minutes||0)<0||+(x.duration_minutes||0)>240||!/^(([1-9]|10)(\s*[-–]\s*([1-9]|10))?|Easy)$/.test(String(x.target_rpe)))return out(req,{error:"Check sets, reps, RPE, duration, and rest targets."},400);
        }
      }
      // Atomic creation via server-only transaction. Every save is a fresh user-owned revision; historical day IDs stay intact.
      const {data:id,error}=await db.rpc("save_bodysmith_plan",{p_user:userId,p_plan:p}); if(error)throw error;
      return out(req,{plan:await getPlan(id)},201);
    }
    if(action === "custom_exercise") {
      const name=String(body.name||'').trim().slice(0,100);if(!name)return out(req,{error:"Enter an exercise name."},400);
      const {data,error}=await db.from("exercises").insert({owner_id:userId,slug:`custom-${crypto.randomUUID()}`,name,primary_muscle:String(body.muscle||'').slice(0,80),movement_type:String(body.movement||'').slice(0,80),equipment:String(body.equipment||'').slice(0,100),cue:String(body.cue||'').slice(0,1000)}).select("*").single();if(error)throw error;
      return out(req,{exercise:data},201);
    }
    if(action === "swap_exercise") {
      const {data:s}=await db.from("workout_sessions").select("id,day_snapshot,plan_day_id").eq("id",String(body.sessionId)).eq("user_id",userId).eq("status","in_progress").maybeSingle();
      const {data:e}=await db.from("exercises").select("*").eq("id",String(body.exerciseId)).maybeSingle();
      if(!s||!e||(e.owner_id&&e.owner_id!==userId))return out(req,{error:"Session or exercise unavailable."},404);
      let snapshot=s.day_snapshot;
      if(!snapshot){const u=await getUser(userId);snapshot=(await getPlan(u.active_plan_id))?.plan_days.find((d:any)=>d.id===s.plan_day_id);}
      const slot=snapshot?.plan_day_exercises?.find((x:any)=>x.id===body.slotId);
      if(!slot)return out(req,{error:"Workout slot unavailable."},404);
      if(snapshot.plan_day_exercises.some((x:any)=>x.id!==slot.id&&x.exercises.id===e.id))return out(req,{error:"That exercise is already in this workout."},400);
      const {count}=await db.from("workout_sets").select("id",{count:"exact",head:true}).eq("session_id",s.id).eq("exercise_id",slot.exercises.id);
      if(count)return out(req,{error:"Substitute before logging sets for this exercise."},409);
      slot.exercises=e;slot.exercise_id=e.id;
      const {error}=await db.from("workout_sessions").update({day_snapshot:snapshot}).eq("id",s.id).eq("user_id",userId);if(error)throw error;
      return out(req,{day:snapshot});
    }
    if(action === "save_supplement") {
      const v=body.supplement||{}; const name=String(v.name||'').trim().slice(0,100);
      const times=[...new Set(v.times||['09:00'])]; const days=[...new Set(v.schedule_days||[0,1,2,3,4,5,6])];
      if(!name||!times.length||times.length>12||!times.every((t:any)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t))||!days.length||!days.every((d:any)=>Number.isInteger(d)&&d>=0&&d<=6))return out(req,{error:"Enter a name, valid times, and scheduled days."},400);
      const row={name,user_id:userId,dose:String(v.dose||'').slice(0,80),unit:String(v.unit||'').slice(0,40),schedule_days:days,times,with_food:String(v.with_food||'').slice(0,200),notes:String(v.notes||'').slice(0,1000),active:v.active!==false,reminders:v.reminders===true,updated_at:new Date().toISOString()};
      const q=v.id?db.from("supplements").update(row).eq("id",v.id).eq("user_id",userId):db.from("supplements").insert(row);
      const {data,error}=await q.select("*").maybeSingle();if(error)throw error;if(!data)return out(req,{error:"Supplement unavailable."},404);
      return out(req,{supplement:data},v.id?200:201);
    }
    if(action === "log_supplement") {
      const {data:s}=await db.from("supplements").select("id,times").eq("id",String(body.supplementId)).eq("user_id",userId).maybeSingle();
      if(!s)return out(req,{error:"Supplement unavailable."},404);
      if(!['taken','skipped','snoozed'].includes(body.status)||!/^\d{4}-\d{2}-\d{2}$/.test(body.date)||!s.times.includes(body.time))return out(req,{error:"Invalid supplement entry."},400);
      const row={user_id:userId,supplement_id:s.id,scheduled_date:body.date,scheduled_time:body.time,status:body.status,snoozed_until:body.status==='snoozed'?new Date(Date.now()+15*60000).toISOString():null,logged_at:new Date().toISOString()};
      const {data,error}=await db.from("supplement_logs").upsert(row,{onConflict:"user_id,supplement_id,scheduled_date,scheduled_time"}).select("*").single();if(error)throw error;
      return out(req,{log:data});
    }
    if(action === "test_push")return out(req,await testPush(db,userId));
    if(action === "notification_config") {
      const keys=await vapid(db);
      return out(req,{publicKey:keys.publicKey,configured:true});
    }
    if(action === "subscribe_push") {
      const s=body.subscription;let url;
      try{url=new URL(s?.endpoint)}catch{return out(req,{error:"Invalid push subscription."},400)}
      const allowed=["fcm.googleapis.com","updates.push.services.mozilla.com","web.push.apple.com","wns.windows.com"];
      if(url.protocol!=="https:"||!allowed.some(h=>url.hostname===h||url.hostname.endsWith('.'+h))||!s.keys?.auth||!s.keys?.p256dh||JSON.stringify(s).length>5000)return out(req,{error:"Unsupported push service."},400);
      const {data:old}=await db.from("push_subscriptions").select("id,user_id").eq("endpoint",s.endpoint).maybeSingle();
      if(old&&old.user_id!==userId)return out(req,{error:"Disable reminders in the previous account on this device first."},409);
      const {error}=await db.from("push_subscriptions").upsert({user_id:userId,endpoint:s.endpoint,subscription:s},{onConflict:"endpoint"});if(error)throw error;
      return out(req,{ok:true});
    }
    if(action === "unsubscribe_push") {
      const {error}=await db.from("push_subscriptions").delete().eq("user_id",userId).eq("endpoint",String(body.endpoint));if(error)throw error;
      return out(req,{ok:true});
    }

    if (action === "bootstrap") {
      const user = await getUser(userId);
      const plan = await getPlan(user.active_plan_id);
      const hist = await history(userId, 40);
      const active = hist.find((x:any)=>x.status === "in_progress") || null;
      const [exercises,plans,supplements,logs,checkins] = await Promise.all([
 db.from("exercises").select("*").or(`owner_id.is.null,owner_id.eq.${userId}`).order("name"),
 db.from("workout_plans").select("id,name,goal,days_per_week,is_template").or(`is_template.eq.true,owner_id.eq.${userId}`).order("created_at"),
 db.from("supplements").select("*").eq("user_id",userId).order("created_at"),
 db.from("supplement_logs").select("*").eq("user_id",userId).gte("scheduled_date",new Date(Date.now()-90*86400000).toISOString().slice(0,10)),
 db.from("daily_checkins").select("*").eq("user_id",userId).order("checkin_date",{ascending:false}).limit(90)
]);
for (const result of [exercises,plans,supplements,logs,checkins]) if(result.error) throw result.error;
return out(req, { user, plan, history: hist, activeSession: active, exercises:exercises.data, plans:plans.data, supplements:supplements.data, supplementLogs:logs.data, checkins:checkins.data, version:"2.0.0" });
    }

    if (action === "update_profile") {
      const patch: any = { updated_at: new Date().toISOString() };
      if (typeof body.displayName === "string" && body.displayName.trim().length >= 2) patch.display_name = body.displayName.trim().slice(0,50);
      if (["lb","kg"].includes(body.units)) patch.units = body.units;
      if(body.preferences && typeof body.preferences === "object") {
        if(JSON.stringify(body.preferences).length>10000) return out(req,{error:"Profile is too large."},400);
        try { new Intl.DateTimeFormat("en",{timeZone:body.preferences.timezone||"UTC"}).format(); } catch { return out(req,{error:"Invalid timezone."},400); }
        patch.preferences=body.preferences;
      }
      if(body.onboardingCompleted===true) patch.onboarding_completed=true;
      const { data, error } = await db.from("app_users").update(patch).eq("id", userId).select("id,username,display_name,units,active_plan_id,created_at,preferences,onboarding_completed").single();
      if (error) throw error;
      return out(req, { user: data });
    }

    if (action === "start_session") {
      const planDayId = String(body.planDayId || "");
      const { data: day } = await db.from("plan_days").select("id,plan_id").eq("id", planDayId).maybeSingle();
      const user = await getUser(userId);
      if (!day || (user.active_plan_id && day.plan_id !== user.active_plan_id)) return out(req, { error: "Workout day not available." }, 400);
      const existing=(await history(userId,100)).find((s:any)=>s.status==="in_progress");
      if(existing) return out(req,{error:"Resume or finish your active workout first.",session:existing},409);
      const plan=await getPlan(user.active_plan_id);
      const snapshot=plan?.plan_days?.find((d:any)=>d.id===planDayId);
      const { data, error } = await db.rpc("start_bodysmith_session",{p_user:userId,p_day:planDayId,p_snapshot:snapshot});
      if (error) throw error;
      return out(req, { session: { ...data, sets: [] } }, 201);
    }

    if (action === "save_set") {
      const sessionId = String(body.sessionId || "");
      const exerciseId = String(body.exerciseId || "");
      const setNumber = Number(body.setNumber);
      const { data: s } = await db.from("workout_sessions").select("id,status").eq("id", sessionId).eq("user_id", userId).maybeSingle();
      if (!s || !["in_progress","completed"].includes(s.status)) return out(req, { error: "Editable session not found." }, 404);
      if (!Number.isInteger(setNumber) || setNumber < 1 || setNumber > 20) return out(req, { error: "Invalid set number." }, 400);
      const row = {
        session_id: sessionId, user_id: userId, exercise_id: exerciseId, set_number: setNumber,
        weight: body.weight === "" || body.weight == null ? null : Number(body.weight),
        reps: body.reps === "" || body.reps == null ? null : Number(body.reps),
        rpe: body.rpe === "" || body.rpe == null ? null : Number(body.rpe),
        elbow_pain: body.elbowPain === "" || body.elbowPain == null ? 0 : Number(body.elbowPain),
        completion_status: ["completed","skipped"].includes(body.completionStatus) ? body.completionStatus : "completed",
        duration_seconds: body.durationSeconds == null ? null : Number(body.durationSeconds), units: ["lb","kg"].includes(body.units)?body.units:(await getUser(userId)).units, notes: String(body.notes || "").slice(0,500), updated_at: new Date().toISOString(), load_basis:["total","per_dumbbell","per_side"].includes(body.loadBasis)?body.loadBasis:"total", load_multiplier:body.loadMultiplier===2?2:1
      };
      if ((row.weight!=null && (!Number.isFinite(row.weight)||row.weight<0||row.weight>10000)) || (row.reps!=null && (!Number.isInteger(row.reps)||row.reps<0||row.reps>10000)) || (row.duration_seconds!=null && (!Number.isInteger(row.duration_seconds)||row.duration_seconds<0||row.duration_seconds>86400))) return out(req,{error:"Invalid weight, reps, or duration."},400);
      const {data: exercise}=await db.from("exercises").select("id,owner_id").eq("id",exerciseId).maybeSingle();
      if(!exercise || (exercise.owner_id && exercise.owner_id!==userId)) return out(req,{error:"Exercise unavailable."},404);
      if (row.rpe != null && (!Number.isFinite(row.rpe) || row.rpe < 1 || row.rpe > 10)) return out(req, { error: "RPE must be 1–10." }, 400);
      if (row.elbow_pain != null && (!Number.isFinite(row.elbow_pain) || row.elbow_pain < 0 || row.elbow_pain > 10)) return out(req, { error: "Pain must be 0–10." }, 400);
      const { data, error } = await db.from("workout_sets").upsert(row, { onConflict: "session_id,exercise_id,set_number" }).select("*").single();
      if (error) throw error;
      await db.from("workout_sessions").update({updated_at:new Date().toISOString()}).eq("id",sessionId).eq("user_id",userId);
      return out(req, { set: data });
    }

    if (action === "complete_session" || action === "abandon_session") {
      const sessionId = String(body.sessionId || "");
      const { data: current } = await db.from("workout_sessions").select("id,started_at,status").eq("id", sessionId).eq("user_id", userId).maybeSingle();
      if (!current) return out(req, { error: "Session not found." }, 404);
      if(current.status!=="in_progress")return out(req,{session:current,history:await history(userId,40)});
      const requested=new Date(body.completedAt||Date.now());
      const now = Number.isFinite(requested.getTime())&&requested.getTime()>=new Date(current.started_at).getTime()&&requested.getTime()<=Date.now()?requested:new Date();
      const durationSeconds = Math.max(0, Math.round((now.getTime() - new Date(current.started_at).getTime()) / 1000));
      const status = action === "complete_session" ? "completed" : "abandoned";
      const { data, error } = await db.from("workout_sessions").update({ status, completed_at: now.toISOString(), duration_seconds: durationSeconds, workout_notes: String(body.notes || "").slice(0,1000) }).eq("id", sessionId).eq("user_id", userId).select("*").single();
      if (error) throw error;
      return out(req, { session: data, history: await history(userId, 40) });
    }

    if (action === "history") return out(req, { history: await history(userId, Math.min(100, Math.max(1, Number(body.limit)||40))) });

    if (action === "daily_checkin") {
      const row = { user_id: userId, checkin_date: String(body.date || new Date().toISOString().slice(0,10)), body_weight: body.weight == null || body.weight === "" ? null : Number(body.weight), calories: body.calories == null || body.calories === "" ? null : Number(body.calories), protein_grams: body.protein == null || body.protein === "" ? null : Number(body.protein), steps: body.steps == null || body.steps === "" ? null : Number(body.steps), elbow_pain: body.elbowPain == null || body.elbowPain === "" ? null : Number(body.elbowPain), notes: String(body.notes || "").slice(0,500) };
      const { data: existing } = await db.from("daily_checkins").select("id").eq("user_id",userId).eq("checkin_date",row.checkin_date).maybeSingle();
      const q = existing ? db.from("daily_checkins").update(row).eq("id",existing.id) : db.from("daily_checkins").insert(row);
      const { data, error } = await q.select("*").single();
      if (error) throw error;
      return out(req, { checkin: data });
    }

    return out(req, { error: "Unknown action" }, 404);
  } catch (e) {
    console.error(e);
    return out(req, { error: "Server error. Please try again." }, 500);
  }
});

