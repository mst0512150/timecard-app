import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const text = fs.readFileSync(".env.local", "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

const env = loadEnvLocal();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error("FAIL: NEXT_PUBLIC_SUPABASE_URL or ANON_KEY is missing in .env.local");
  process.exit(1);
}

const supabase = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const [staffRes, entriesRes] = await Promise.all([
  supabase.from("staff").select("id", { count: "exact", head: true }),
  supabase.from("time_entries").select("id", { count: "exact", head: true }),
]);

if (staffRes.error) {
  console.error("FAIL staff:", staffRes.error.message);
  process.exit(1);
}
if (entriesRes.error) {
  console.error("FAIL time_entries:", entriesRes.error.message);
  process.exit(1);
}

console.log("OK: Supabase connected (concept-app)");
console.log(`staff rows: ${staffRes.count ?? 0}`);
console.log(`time_entries rows: ${entriesRes.count ?? 0}`);
