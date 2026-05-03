import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TRACK17_URL = "https://api.17track.net/track/v2.2/gettracklist";

/** Map common country names / aliases to ISO 3166-1 alpha-2 (17TRACK uses uppercase). */
const COUNTRY_ALIASES: Record<string, string> = {
  "united states": "US",
  usa: "US",
  us: "US",
  america: "US",
  "united kingdom": "GB",
  uk: "GB",
  gb: "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  germany: "DE",
  de: "DE",
  france: "FR",
  fr: "FR",
  canada: "CA",
  ca: "CA",
  australia: "AU",
  au: "AU",
  netherlands: "NL",
  nl: "NL",
  belgium: "BE",
  be: "BE",
  spain: "ES",
  es: "ES",
  italy: "IT",
  it: "IT",
  poland: "PL",
  pl: "PL",
  brazil: "BR",
  br: "BR",
  mexico: "MX",
  mx: "MX",
  japan: "JP",
  jp: "JP",
  china: "CN",
  cn: "CN",
  india: "IN",
  in: "IN",
  russia: "RU",
  ru: "RU",
  ireland: "IE",
  ie: "IE",
  switzerland: "CH",
  ch: "CH",
  austria: "AT",
  at: "AT",
  sweden: "SE",
  se: "SE",
  norway: "NO",
  no: "NO",
  denmark: "DK",
  dk: "DK",
  finland: "FI",
  fi: "FI",
  portugal: "PT",
  pt: "PT",
  "new zealand": "NZ",
  nz: "NZ",
  singapore: "SG",
  sg: "SG",
  "south korea": "KR",
  korea: "KR",
  kr: "KR",
  turkey: "TR",
  tr: "TR",
  ukraine: "UA",
  ua: "UA",
};

function normalizeCountryCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;
  const upper = t.toUpperCase();
  if (upper.length === 2 && /^[A-Z]{2}$/.test(upper)) return upper;
  const key = t.toLowerCase().replace(/\./g, "");
  return COUNTRY_ALIASES[key] ?? COUNTRY_ALIASES[t.toLowerCase().trim()] ?? null;
}

/** Prefer last segment after comma (often "City, Country"). */
function originFromShipsFrom(shipsFrom: string): string | null {
  const parts = shipsFrom.split(",").map((p) => p.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const c = normalizeCountryCode(parts[i]);
    if (c) return c;
  }
  return normalizeCountryCode(shipsFrom);
}

type TrackItem = {
  number?: string;
  carrier?: number;
  shipping_country?: string;
  recipient_country?: string;
  register_time?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const token17 = Deno.env.get("TRACK17_TOKEN")?.trim();
  if (!token17) {
    return json({ skipped: true, reason: "TRACK17_TOKEN not configured on project." }, 200);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const { data: adminRow } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRow) return json({ error: "Forbidden" }, 403);

    const { order_id } = await req.json();
    if (!order_id || typeof order_id !== "string") {
      return json({ error: "order_id required" }, 400);
    }

    const svc = createClient(supabaseUrl, service);
    const { data: order, error: orderErr } = await svc
      .from("orders")
      .select("id, ship_to_country, status, tracking_number")
      .eq("id", order_id)
      .single();
    if (orderErr || !order) return json({ error: "Order not found" }, 404);

    if (order.status !== "paid") {
      return json({ skipped: true, reason: "Confirm payment first; tracking is assigned after status is paid." }, 200);
    }
    if (order.tracking_number) {
      return json({ skipped: true, reason: "Order already has tracking.", tracking_number: order.tracking_number }, 200);
    }

    const { data: items } = await svc
      .from("order_items")
      .select("ships_from")
      .eq("order_id", order_id);
    const shipsFrom = (items?.[0] as { ships_from?: string } | undefined)?.ships_from ?? "";
    const origin = originFromShipsFrom(String(shipsFrom));
    const dest = normalizeCountryCode(String(order.ship_to_country ?? ""));
    if (!origin || !dest) {
      return json({
        skipped: true,
        reason: "Could not map ship-from or ship-to country to ISO codes. Use clearer country names.",
      }, 200);
    }

    const to = new Date();
    const from = new Date(to.getTime() - 14 * 24 * 60 * 60 * 1000);
    const body = {
      register_time_from: from.toISOString().slice(0, 10),
      register_time_to: to.toISOString().slice(0, 10),
      page_no: 1,
      order_by: "RegisterTimeDesc",
    };

    const tr = await fetch(TRACK17_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "17token": token17,
      },
      body: JSON.stringify(body),
    });
    const trJson = await tr.json().catch(() => null) as { code?: number; data?: { accepted?: TrackItem[] }; message?: string } | null;
    if (!trJson || trJson.code !== 0) {
      console.error("17TRACK gettracklist error", trJson);
      return json({
        skipped: true,
        reason: trJson?.message ?? "17TRACK API returned an error.",
      }, 200);
    }

    const accepted = trJson.data?.accepted ?? [];
    const matches = accepted.filter((t) => {
      const sc = (t.shipping_country ?? "").toUpperCase();
      const rc = (t.recipient_country ?? "").toUpperCase();
      return sc === origin && rc === dest && t.number;
    });

    const sorted = [...matches].sort((a, b) => {
      const ta = new Date(a.register_time ?? 0).getTime();
      const tb = new Date(b.register_time ?? 0).getTime();
      return tb - ta;
    });
    const best = sorted[0];
    if (!best?.number) {
      return json({
        skipped: true,
        reason: "No registered 17TRACK shipment matched this origin/destination in the last 14 days.",
      }, 200);
    }

    const now = new Date().toISOString();
    const { error: upErr } = await svc
      .from("orders")
      .update({
        tracking_number: best.number,
        tracking_carrier: best.carrier ?? null,
        tracking_synced_at: now,
      })
      .eq("id", order_id);
    if (upErr) {
      console.error(upErr);
      return json({ error: "Failed to save tracking on order." }, 500);
    }

    return json({
      ok: true,
      tracking_number: best.number,
      tracking_carrier: best.carrier ?? null,
    }, 200);
  } catch (e) {
    console.error(e);
    return json({ error: "Internal error" }, 500);
  }
});

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
