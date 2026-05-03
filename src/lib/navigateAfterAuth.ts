import type { NavigateFunction } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * After sign-in / sign-up, route admins to the dashboard.
 * Pass `session` from `signInWithPassword` / `signUp` when available so we don’t race `getUser()`
 * before the client finishes persisting the session (common right after login).
 */
export async function navigateAfterAuth(navigate: NavigateFunction, session?: Session | null) {
  if (session?.access_token && session.refresh_token) {
    const { error: setErr } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    if (setErr) console.warn("setSession after login:", setErr);
  }
  const userId =
    session?.user?.id ??
    (await supabase.auth.getUser()).data.user?.id ??
    (await supabase.auth.getSession()).data.session?.user?.id;
  if (!userId) {
    navigate("/shop", { replace: true });
    return;
  }
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) {
    console.warn("user_roles check failed", error);
  }
  navigate(data ? "/dashboard" : "/shop", { replace: true });
}
