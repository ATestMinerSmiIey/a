import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Admin fingerprint is read from a server-side env var — never hardcoded in source.
const ADMIN_FINGERPRINT = (Deno.env.get("ADMIN_PGP_FINGERPRINT") ?? "").toUpperCase().replace(/\s/g, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    let body: { fingerprint?: string; purpose?: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid request body" });
    }

    const { fingerprint, purpose } = body;
    if (!fingerprint || !["register", "login"].includes(purpose)) {
      return new Response(JSON.stringify({ error: "Invalid input" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fp = String(fingerprint).toUpperCase().replace(/\s/g, "");
    if (!/^[0-9A-F]{40}$/.test(fp)) {
      return new Response(JSON.stringify({ error: "Bad fingerprint format" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Rate limiting: allow max 5 challenge requests per fingerprint per 10 minutes
    const windowStart = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("pgp_challenges")
      .select("id", { count: "exact", head: true })
      .eq("fingerprint", fp)
      .gte("created_at", windowStart);
    if ((count ?? 0) >= 5) {
      return json({ error: "Too many requests. Please wait before trying again." });
    }

    // For login: treat an unknown key as a normal UI state.
    if (purpose === "login") {
      const { data: prof } = await supabase
        .from("profiles")
        .select("id")
        .eq("pgp_fingerprint", fp)
        .maybeSingle();
      if (!prof) {
        return new Response(
          JSON.stringify({ accountMissing: true, error: "No account exists for this key yet. Switch to Register first." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const challenge = `dahura-${purpose}-${crypto.randomUUID()}-${Date.now()}`;
    const { error } = await supabase.from("pgp_challenges").insert({
      fingerprint: fp,
      challenge,
      purpose,
    });
    if (error) throw error;

    // Never reveal admin status at the challenge stage.
    return json({ challenge });
  } catch (_e) {
    return json({ error: "An internal error occurred. Please try again." });
  }
});

function json(payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
