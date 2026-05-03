/**
 * One-time: create or reset username-based auth users in Supabase (admin API).
 * Passwords MUST come from environment — never commit them.
 *
 * Loads variables from `.env` in the project root if present (no extra deps).
 * Falls back: SUPABASE_URL → VITE_SUPABASE_URL, AUTH_EMAIL_DOMAIN → VITE_AUTH_EMAIL_DOMAIN.
 *
 * Usage: add SUPABASE_SERVICE_ROLE_KEY + SEED_* to `.env`, then:
 *   npm run seed:auth
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, "utf8").replace(/^\uFEFF/, "");
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1).replace(/\\n/g, "\n");
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

const url = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim();
const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const domain = process.env.AUTH_EMAIL_DOMAIN?.trim() || process.env.VITE_AUTH_EMAIL_DOMAIN?.trim();
const pwUser = process.env.SEED_USER_PASSWORD?.trim();
const pwAdmin = process.env.SEED_ADMIN_PASSWORD?.trim();

const missing = [];
if (!url) missing.push("VITE_SUPABASE_URL (or SUPABASE_URL)");
if (!domain) missing.push("VITE_AUTH_EMAIL_DOMAIN (or AUTH_EMAIL_DOMAIN)");
if (!service) {
  missing.push(
    "SUPABASE_SERVICE_ROLE_KEY — open Supabase Dashboard → Project Settings → API → copy the secret \"service_role\" key into .env on the line SUPABASE_SERVICE_ROLE_KEY=...",
  );
}
if (missing.length) {
  console.error("seed:auth is missing required values:\n\n  • " + missing.join("\n  • ") + "\n");
  process.exit(1);
}
if (!pwUser || !pwAdmin) {
  console.error(
    "Set SEED_USER_PASSWORD and SEED_ADMIN_PASSWORD in .env (passwords for usernames user and admin).\n",
  );
  process.exit(1);
}

const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

async function upsertAuthUser(email, password) {
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) throw listErr;
  const existing = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (error) throw error;
    return existing.id;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user.id;
}

async function ensureRole(userId, role) {
  const { data: row } = await admin.from("user_roles").select("id").eq("user_id", userId).eq("role", role).maybeSingle();
  if (row) return;
  const { error } = await admin.from("user_roles").insert({ user_id: userId, role });
  if (error) throw error;
}

try {
  const userEmail = `user@${domain}`;
  const adminEmail = `admin@${domain}`;
  const userId = await upsertAuthUser(userEmail, pwUser);
  const adminId = await upsertAuthUser(adminEmail, pwAdmin);
  await ensureRole(userId, "user");
  await ensureRole(adminId, "admin");
  console.log("OK: user / admin auth users and roles are set.");
  console.log("Sign in with usernames: user | admin (same domain in app env).");
} catch (e) {
  console.error(e);
  process.exit(1);
}
