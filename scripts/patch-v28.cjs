const fs=require('fs');

const backendFile='supabase/functions/bodysmith-api/index.ts';
let s=fs.readFileSync(backendFile,'utf8');
const must=(text,label)=>{if(!s.includes(text))throw new Error(`Missing patch marker: ${label}`)};
const replaceBetween=(start,end,replacement,label)=>{
  const a=s.indexOf(start),b=s.indexOf(end,a+start.length);
  if(a<0||b<0)throw new Error(`Missing block: ${label}`);
  s=s.slice(0,a)+replacement+s.slice(b);
};

const dbLine='const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });';
must(dbLine,'service client');
if(!s.includes('const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;')){
  s=s.replace(dbLine,[
    dbLine,
    'const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;',
    'const authClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });'
  ].join('\n'));
}

s=s.replace('version: "2.2.0"','version: "2.8.0"');
s=s.replace('version:"2.0.0"','version:"2.8.0"');
s=s.replace(
  '.select("id,username,display_name,units,active_plan_id,created_at,preferences,onboarding_completed").eq("id", userId).single()',
  '.select("id,username,display_name,units,active_plan_id,created_at,preferences,onboarding_completed,email,auth_user_id").eq("id", userId).single()'
);

if(!s.includes('async function appUserFromAuth')){
  const marker='\nDeno.serve(async (req: Request) => {';
  must(marker,'serve marker');
  const helpers=[
    '',
    'const USER_FIELDS = "id,username,display_name,units,active_plan_id,created_at,preferences,onboarding_completed,email,auth_user_id";',
    'function normalizeEmail(value: unknown) { return String(value || "").trim().toLowerCase(); }',
    'function validEmail(value: string) { return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value) && value.length <= 254; }',
    'async function findAuthUserByEmail(email: string) {',
    '  const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });',
    '  if (error) throw error;',
    '  return data.users.find((u:any)=>normalizeEmail(u.email)===email) || null;',
    '}',
    'async function uniqueUsername(seed: string) {',
    '  let base=String(seed||"member").toLowerCase().replace(/[^a-z0-9_.-]+/g,"_").replace(/^[_\\-.]+|[_\\-.]+$/g,"").slice(0,24);',
    '  if(base.length<3)base="member";',
    '  for(let i=0;i<100;i++){const name=i?base+"_"+i:base;const {data}=await db.from("app_users").select("id").eq("username",name).maybeSingle();if(!data)return name;}',
    '  return "member_"+randomHex(4);',
    '}',
    'async function appUserFromAuth(authUser:any) {',
    '  const email=normalizeEmail(authUser?.email);',
    '  let app:any=null;',
    '  if(authUser?.id){const r=await db.from("app_users").select(USER_FIELDS).eq("auth_user_id",authUser.id).maybeSingle();if(r.error)throw r.error;app=r.data;}',
    '  if(!app&&email){const r=await db.from("app_users").select(USER_FIELDS).eq("email",email).maybeSingle();if(r.error)throw r.error;app=r.data;}',
    '  if(app){if(authUser?.id&&app.auth_user_id!==authUser.id){const {data:other}=await db.from("app_users").select("id").eq("auth_user_id",authUser.id).neq("id",app.id).maybeSingle();if(other)throw new Error("That sign-in identity is already linked.");const {error}=await db.from("app_users").update({auth_user_id:authUser.id,email:email||app.email,updated_at:new Date().toISOString()}).eq("id",app.id);if(error)throw error;}return await getUser(app.id);}',
    '  const plan=await getPlan(null),salt=randomHex(16),hash=await passwordHash(randomHex(32),salt),username=await uniqueUsername(authUser?.user_metadata?.preferred_username||authUser?.user_metadata?.user_name||(email?email.split("@")[0]:"member"));',
    '  const displayName=String(authUser?.user_metadata?.full_name||authUser?.user_metadata?.name||(email?email.split("@")[0]:"BodySmith Member")).slice(0,50);',
    '  const {data,error}=await db.from("app_users").insert({username,display_name:displayName,password_salt:salt,password_hash:hash,email:email||null,auth_user_id:authUser.id,active_plan_id:plan?.id||null}).select(USER_FIELDS).single();if(error)throw error;return data;',
    '}',
    ''
  ].join('\n');
  s=s.replace(marker,helpers+marker);
}

const registerStart='    if (action === "register") {';
const loginStart='    if (action === "login") {';
const register=[
  registerStart,
  '      const username = String(body.username || "").trim().toLowerCase();',
  '      const displayName = String(body.displayName || "").trim();',
  '      const password = String(body.password || "");',
  '      const qa = body.qaMode === true && /^bodysmith_qa_[a-f0-9]{12}$/.test(username);',
  '      const email = normalizeEmail(body.email);',
  '      if (!/^[a-z0-9_.-]{3,30}$/.test(username)) return out(req, { error: "Username must be 3–30 letters, numbers, dots, underscores, or dashes." }, 400);',
  '      if (displayName.length < 2 || displayName.length > 50) return out(req, { error: "Enter a display name." }, 400);',
  '      if (password.length < 6 || password.length > 72) return out(req, { error: "Password must be 6–72 characters." }, 400);',
  '      if (!qa && !validEmail(email)) return out(req, { error: "Enter a valid email address." }, 400);',
  '      if (!qa) { const {data:existing}=await db.from("app_users").select("id").eq("email",email).maybeSingle(); if(existing) return out(req,{error:"That email is already registered."},409); }',
  '      let authUserId: string | null = null;',
  '      if (!qa) {',
  '        const { data: created, error: authError } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: displayName, username } });',
  '        if (authError || !created.user) return out(req, { error: /already|registered|exists/i.test(authError?.message||"") ? "That email is already registered." : "Could not create the email sign-in." }, authError ? 409 : 500);',
  '        authUserId = created.user.id;',
  '      }',
  '      const salt = randomHex(16), hash = await passwordHash(password, salt), plan = await getPlan(null);',
  '      const { data, error } = await db.from("app_users").insert({ is_qa: qa, username, display_name: displayName, password_salt: salt, password_hash: hash, email: qa ? null : email, auth_user_id: authUserId, active_plan_id: plan?.id || null }).select("id").single();',
  '      if (error) { if(authUserId) await db.auth.admin.deleteUser(authUserId).catch(()=>{}); if (error.code === "23505") return out(req, { error: "That username or email is already in use." }, 409); throw error; }',
  '      const session = await createSession(data.id);',
  '      return out(req, { user: await getUser(data.id), ...session }, 201);',
  '    }',
  '',
].join('\n');
replaceBetween(registerStart,loginStart,register,'register');

const authMarker='    const userId = await auth(body);';
const login=[
  loginStart,
  '      const identity = String(body.identity || body.email || body.username || "").trim().toLowerCase();',
  '      const password = String(body.password || "");',
  '      let user: any = null;',
  '      if (identity.includes("@")) {',
  '        const email=normalizeEmail(identity);',
  '        if(!validEmail(email)) return out(req,{error:"Invalid email or password."},401);',
  '        const signed=await authClient.auth.signInWithPassword({email,password});',
  '        if(!signed.error&&signed.data.user) user=await appUserFromAuth(signed.data.user);',
  '        if(!user){const {data:legacy}=await db.from("app_users").select("id,password_salt,password_hash").eq("email",email).maybeSingle();if(legacy){const hash=await passwordHash(password,legacy.password_salt);if(hash===legacy.password_hash)user=await getUser(legacy.id);}}',
  '      } else {',
  '        const {data:legacy}=await db.from("app_users").select("id,password_salt,password_hash").eq("username",identity).maybeSingle();',
  '        if(legacy){const hash=await passwordHash(password,legacy.password_salt);if(hash===legacy.password_hash)user=await getUser(legacy.id);}',
  '      }',
  '      if(!user) return out(req,{error:"Invalid email or password."},401);',
  '      const session=await createSession(user.id);return out(req,{user,...session});',
  '    }',
  '',
  '    if (action === "auth_exchange") {',
  '      const accessToken=String(body.accessToken||"");if(accessToken.length<40)return out(req,{error:"Sign-in token missing."},400);',
  '      const {data,error}=await authClient.auth.getUser(accessToken);if(error||!data.user)return out(req,{error:"Google/email sign-in could not be verified."},401);',
  '      const user=await appUserFromAuth(data.user),session=await createSession(user.id);return out(req,{user,...session});',
  '    }',
  '',
  '    if (action === "request_password_reset") {',
  '      const email=normalizeEmail(body.email);if(!validEmail(email))return out(req,{error:"Enter a valid email address."},400);',
  '      const {data:app}=await db.from("app_users").select("auth_user_id").eq("email",email).maybeSingle();',
  '      if(app?.auth_user_id){await authClient.auth.resetPasswordForEmail(email,{redirectTo:"https://mvsmith81.github.io/BodySmith-MVP/?recovery=1"}).catch(()=>{});}',
  '      return out(req,{ok:true,message:"If that email is linked to BodySmith, a reset message will be sent."});',
  '    }',
  '',
].join('\n');
replaceBetween(loginStart,authMarker,login,'login');

const fullAuthMarker='    const userId = await auth(body);\n    if (!userId) return out(req, { error: "Please sign in again." }, 401);';
must(fullAuthMarker,'authenticated action marker');
if(!s.includes('action === "set_email_password"')){
  const setCredentials=[
    fullAuthMarker,
    '',
    '    if (action === "set_email_password") {',
    '      const email=normalizeEmail(body.email),password=String(body.password||"");',
    '      if(!validEmail(email))return out(req,{error:"Enter a valid email address."},400);',
    '      if(password.length<6||password.length>72)return out(req,{error:"Password must be 6–72 characters."},400);',
    '      const {data:conflict}=await db.from("app_users").select("id").eq("email",email).neq("id",userId).maybeSingle();if(conflict)return out(req,{error:"That email is already attached to another BodySmith account."},409);',
    '      const current=await getUser(userId);let authId=current.auth_user_id as string|null;',
    '      if(!authId){const existing=await findAuthUserByEmail(email);if(existing){const {data:linked}=await db.from("app_users").select("id").eq("auth_user_id",existing.id).neq("id",userId).maybeSingle();if(linked)return out(req,{error:"That email sign-in is already linked to another account."},409);authId=existing.id;}}',
    '      if(authId){const {error}=await db.auth.admin.updateUserById(authId,{email,password,email_confirm:true,user_metadata:{display_name:current.display_name,username:current.username}});if(error)throw error;}',
    '      else{const {data,error}=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:current.display_name,username:current.username}});if(error||!data.user)throw error||new Error("Could not create email sign-in");authId=data.user.id;}',
    '      const salt=randomHex(16),hash=await passwordHash(password,salt);const {error}=await db.from("app_users").update({email,auth_user_id:authId,password_salt:salt,password_hash:hash,updated_at:new Date().toISOString()}).eq("id",userId);if(error)throw error;',
    '      return out(req,{user:await getUser(userId)});',
    '    }'
  ].join('\n');
  s=s.replace(fullAuthMarker,setCredentials);
}
fs.writeFileSync(backendFile,s);

let app=fs.readFileSync('app.js','utf8').replaceAll('v2.7.0','v2.8.0');
fs.writeFileSync('app.js',app);
let flexTest=fs.readFileSync('tests/flexible-profile-smoke.cjs','utf8').replaceAll('20260915-release270','20260915-release280');
fs.writeFileSync('tests/flexible-profile-smoke.cjs',flexTest);
let brandTest=fs.readFileSync('tests/brand-smoke.cjs','utf8');
brandTest=brandTest.replace('|7\\.0)/','|7\\.0|8\\.0)/');
fs.writeFileSync('tests/brand-smoke.cjs',brandTest);
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
pkg.version='2.8.0';
pkg.scripts.test=pkg.scripts.test.replace('node --check flex-profile.js && node --check sw.js','node --check flex-profile.js && node --check workout-flex.js && node --check auth-upgrade.js && node --check sw.js');
if(!pkg.scripts.test.includes('auth-flex-v28-smoke.cjs'))pkg.scripts.test+=' && node tests/auth-flex-v28-smoke.cjs';
fs.writeFileSync('package.json',JSON.stringify(pkg,null,2)+'\n');
const lock=JSON.parse(fs.readFileSync('package-lock.json','utf8'));
lock.version='2.8.0';if(lock.packages?.[''])lock.packages[''].version='2.8.0';
fs.writeFileSync('package-lock.json',JSON.stringify(lock,null,2)+'\n');
console.log('BodySmith v2.8 release patch prepared.');
