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
async function sha256(text: string) { return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(text)))); }
async function auth(body: any) {
  const token = String(body?.token || "");
  if (!token.startsWith("bs_") || token.length < 40) return null;
  const tokenHash = await sha256(token);
  const { data, error } = await db.from("app_sessions").select("user_id,expires_at").eq("token_hash", tokenHash).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (error || !data) return null;
  return data.user_id as string;
}
const validDate = (value: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
const num = (value: unknown, min: number, max: number) => {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error("Nutrition values are outside the supported range.");
  return Math.round(n * 10) / 10;
};
function totals(entries: any[]) {
  return entries.reduce((a, x) => ({
    calories: a.calories + Number(x.calories || 0),
    protein: a.protein + Number(x.protein_grams || 0),
    carbs: a.carbs + Number(x.carbs_grams || 0),
    fat: a.fat + Number(x.fat_grams || 0),
    water: a.water + Number(x.water_oz || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0, water: 0 });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return out(req, { error: "POST required" }, 405);
  let body: any = {};
  try { body = await req.json(); } catch { return out(req, { error: "Invalid JSON" }, 400); }
  const action = String(body.action || "");
  try {
    if (action === "health") return out(req, { ok: true, service: "BodySmith Nutrition", version: "1.0.0" });
    const userId = await auth(body);
    if (!userId) return out(req, { error: "Please sign in again." }, 401);

    if (action === "day") {
      const date = String(body.date || new Date().toISOString().slice(0, 10));
      if (!validDate(date)) return out(req, { error: "Invalid date." }, 400);
      const { data, error } = await db.from("nutrition_entries").select("*").eq("user_id", userId).eq("log_date", date).order("created_at", { ascending: true });
      if (error) throw error;
      return out(req, { date, entries: data || [], totals: totals(data || []) });
    }

    if (action === "week") {
      const end = String(body.endDate || new Date().toISOString().slice(0, 10));
      if (!validDate(end)) return out(req, { error: "Invalid date." }, 400);
      const d = new Date(end + "T12:00:00Z");
      d.setUTCDate(d.getUTCDate() - 6);
      const start = d.toISOString().slice(0, 10);
      const { data, error } = await db.from("nutrition_entries").select("log_date,calories,protein_grams,carbs_grams,fat_grams,water_oz").eq("user_id", userId).gte("log_date", start).lte("log_date", end).order("log_date");
      if (error) throw error;
      const days: Record<string, any[]> = {};
      for (const row of data || []) (days[row.log_date] ||= []).push(row);
      const summaries = Object.entries(days).map(([date, rows]) => ({ date, ...totals(rows) }));
      return out(req, { startDate: start, endDate: end, days: summaries, totals: totals(data || []) });
    }

    if (action === "log_entry") {
      const date = String(body.date || new Date().toISOString().slice(0, 10));
      const meal = String(body.meal || "snack").toLowerCase();
      const foodName = String(body.foodName || "").trim().slice(0, 160);
      if (!validDate(date)) return out(req, { error: "Invalid date." }, 400);
      if (!["breakfast","lunch","dinner","snack","water","other"].includes(meal)) return out(req, { error: "Invalid meal type." }, 400);
      const row = {
        user_id: userId,
        log_date: date,
        meal,
        food_name: foodName || (meal === "water" ? "Water" : "Food entry"),
        calories: Math.round(num(body.calories, 0, 5000)),
        protein_grams: num(body.protein, 0, 500),
        carbs_grams: num(body.carbs, 0, 1000),
        fat_grams: num(body.fat, 0, 500),
        water_oz: num(body.water, 0, 256),
        notes: String(body.notes || "").trim().slice(0, 500),
        updated_at: new Date().toISOString(),
      };
      if (!row.calories && !row.protein_grams && !row.carbs_grams && !row.fat_grams && !row.water_oz) return out(req, { error: "Enter at least one nutrition value." }, 400);
      const { data, error } = await db.from("nutrition_entries").insert(row).select("*").single();
      if (error) throw error;
      return out(req, { entry: data }, 201);
    }

    if (action === "delete_entry") {
      const id = String(body.id || "");
      const { data, error } = await db.from("nutrition_entries").delete().eq("id", id).eq("user_id", userId).select("id").maybeSingle();
      if (error) throw error;
      if (!data) return out(req, { error: "Nutrition entry not found." }, 404);
      return out(req, { ok: true });
    }

    return out(req, { error: "Unknown action" }, 400);
  } catch (e) {
    console.error(e);
    return out(req, { error: e instanceof Error ? e.message : "Nutrition request failed." }, 500);
  }
});
