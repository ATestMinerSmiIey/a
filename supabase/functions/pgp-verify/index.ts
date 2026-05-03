import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import * as openpgp from "https://esm.sh/openpgp@5.11.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Admin fingerprint is read from a server-side env var — never hardcoded in source.
const ADMIN_FINGERPRINT = (Deno.env.get("ADMIN_PGP_FINGERPRINT") ?? "").toUpperCase().replace(/\s/g, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { signedMessage, publicKeyArmored, purpose, displayName } = await req.json();
    if (!signedMessage || !publicKeyArmored || !["register", "login"].includes(purpose)) {
      return jsonErr("Invalid input", 400);
    }
    // Size caps to prevent DoS via huge payloads
    if (String(publicKeyArmored).length > 51200) {
      return jsonErr("Public key exceeds maximum size.", 400);
    }
    if (String(signedMessage).length > 10240) {
      return jsonErr("Signed message exceeds maximum size.", 400);
    }
    if (String(publicKeyArmored).includes("-----BEGIN PGP PRIVATE KEY BLOCK-----")) {
      return jsonErr("Paste only the public key. Never submit a private key.", 400);
    }
    if (String(signedMessage).includes("-----BEGIN PGP MESSAGE-----")) {
      return jsonErr("That is an encrypted PGP message. Sign the challenge and paste the clearsigned message instead.", 400);
    }
    if (!String(signedMessage).includes("-----BEGIN PGP SIGNED MESSAGE-----")) {
      return jsonErr("Paste a clearsigned message that starts with -----BEGIN PGP SIGNED MESSAGE-----.", 400);
    }

    // Validate displayName if provided
    if (displayName !== undefined && displayName !== null) {
      const dn = String(displayName);
      if (dn.length > 64) return jsonErr("Display name must be 64 characters or fewer.", 400);
      if (!/^[\p{L}\p{N}\p{Zs}_\-. ]*$/u.test(dn)) return jsonErr("Display name contains invalid characters.", 400);
    }

    // Rate limiting: max 10 verify attempts per fingerprint per 10 minutes
    const pubKeyForRateLimit = await openpgp.readKey({ armoredKey: publicKeyArmored });
    const fpForRateLimit = pubKeyForRateLimit.getFingerprint().toUpperCase();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const windowStart = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count: verifyCount } = await supabase
      .from("pgp_challenges")
      .select("id", { count: "exact", head: true })
      .eq("fingerprint", fpForRateLimit)
      .eq("consumed", true)
      .gte("created_at", windowStart);
    if ((verifyCount ?? 0) >= 10) {
      return jsonErr("Too many verification attempts. Please wait before trying again.", 429);
    }

    // Parse and verify signature
    const pubKey = pubKeyForRateLimit;
    const fp = fpForRateLimit;

    // Trim leading whitespace; openpgp is strict about the armor header being first
    const cleanedSigned = String(signedMessage).replace(/^\s+/, "");

    let cleartext;
    try {
      cleartext = await openpgp.readCleartextMessage({ cleartextMessage: cleanedSigned });
    } catch (_e) {
      return jsonErr("Could not parse signed message. Ensure you signed (not encrypted) the challenge.", 400);
    }

    const verification = await openpgp.verify({
      message: cleartext,
      verificationKeys: pubKey,
    });
    let sigOk = false;
    try {
      sigOk = await verification.signatures[0].verified;
    } catch (_e) {
      // intentionally not forwarding internal error details
    }
    if (!sigOk) return jsonErr("Signature verification failed.", 401);

    const signedText = (verification.data as string).trim();

    // Find matching unconsumed, unexpired challenge
    const { data: challenge } = await supabase
      .from("pgp_challenges")
      .select("*")
      .eq("challenge", signedText)
      .eq("fingerprint", fp)
      .eq("purpose", purpose)
      .eq("consumed", false)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!challenge) return jsonErr("Challenge invalid, expired, or fingerprint mismatch.", 401);

    await supabase.from("pgp_challenges").update({ consumed: true }).eq("id", challenge.id);

    // Synthesize a deterministic email for Supabase auth
    const email = `${fp.toLowerCase()}@pgp.dahura.local`;
    // Random strong password — user never uses it; only PGP signature lets them log in
    const password = crypto.randomUUID() + crypto.randomUUID();

    let userId: string;

    if (purpose === "register") {
      const { data: existing } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("pgp_fingerprint", fp)
        .maybeSingle();
      if (existing) return jsonErr("This key is already registered. Use Sign in.", 409);

      const { data: created, error: createErr } =
        await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { pgp_fingerprint: fp },
        });
      if (createErr || !created.user) return jsonErr("Could not create user.", 500);
      userId = created.user.id;

      await supabase.from("profiles").insert({
        user_id: userId,
        pgp_fingerprint: fp,
        pgp_public_key: publicKeyArmored,
        display_name: displayName ? String(displayName).slice(0, 64) : null,
      });

      // Assign roles
      const role = ADMIN_FINGERPRINT && fp === ADMIN_FINGERPRINT ? "admin" : "user";
      await supabase.from("user_roles").insert({ user_id: userId, role });
    } else {
      // login
      const { data: prof } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("pgp_fingerprint", fp)
        .maybeSingle();
      if (!prof) return jsonErr("No account found.", 404);
      userId = prof.user_id;

      // Reset password to a fresh random so we can sign in
      const { error: updErr } = await supabase.auth.admin.updateUserById(userId, { password });
      if (updErr) return jsonErr("Authentication error.", 500);

      // Ensure admin role if this is the configured admin key
      if (ADMIN_FINGERPRINT && fp === ADMIN_FINGERPRINT) {
        await supabase
          .from("user_roles")
          .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
      }
    }

    // Create a session by signing in with the freshly-set password
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: signIn, error: signInErr } = await anonClient.auth.signInWithPassword({
      email,
      password,
    });
    if (signInErr || !signIn.session) return jsonErr("Sign-in failed.", 500);

    // Return session only — do not expose isAdmin or fingerprint to the client.
    // The client determines admin status by querying user_roles after session is set.
    return new Response(
      JSON.stringify({ session: signIn.session }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (_e) {
    return jsonErr("An internal error occurred. Please try again.", 500);
  }
});

function jsonErr(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
