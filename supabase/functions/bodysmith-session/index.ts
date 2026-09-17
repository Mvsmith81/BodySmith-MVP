import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const url=Deno.env.get("SUPABASE_URL")!;
const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
const allowed=new Set(["https://mvsmith81.github.io","http://localhost:8000","http://127.0.0.1:8000","null"]);
function cors(req:Request){const origin=req.headers.get("origin")||"";return {"Access-Control-Allow-Origin":allowed.has(origin)?origin:"https://mvsmith81.github.io","Access-Control-Allow-Headers":"content-type, apikey, authorization","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"}}
function out(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors(req),"Content-Type":"application/json","Cache-Control":"no-store"}})}
async function sha256(value:string){const bytes=new TextEncoder().encode(value);const digest=await crypto.subtle.digest("SHA-256",bytes);return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("")}
async function authenticate(token:string){if(!token||!token.startsWith("bs_")||token.length<20)return null;const hash=await sha256(token);const {data,error}=await db.from("app_sessions").select("user_id,expires_at").eq("token_hash",hash).gt("expires_at",new Date().toISOString()).maybeSingle();if(error)throw error;return data?.user_id||null}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(req)});
  if(req.method!=="POST")return out(req,{error:"Method not allowed."},405);
  try{
    const body=await req.json().catch(()=>({}));
    if(body.action==="health")return out(req,{ok:true,service:"BodySmith Session",version:"1.0.0"});
    const userId=await authenticate(String(body.token||""));
    if(!userId)return out(req,{error:"Your session expired. Sign in again."},401);
    if(body.action!=="delete_session")return out(req,{error:"Unknown action."},400);
    const sessionId=String(body.sessionId||"").trim();
    if(!sessionId)return out(req,{error:"Workout session is required."},400);
    const {data:session,error:findError}=await db.from("workout_sessions").select("id,status").eq("id",sessionId).eq("user_id",userId).maybeSingle();
    if(findError)throw findError;
    if(!session)return out(req,{error:"Workout not found."},404);
    const {error}=await db.from("workout_sessions").delete().eq("id",sessionId).eq("user_id",userId);
    if(error)throw error;
    return out(req,{ok:true,sessionId,status:session.status});
  }catch(error){console.error(error);return out(req,{error:"Could not update workout history."},500)}
});