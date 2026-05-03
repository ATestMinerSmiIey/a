/**
 * Username-only auth UX: Supabase still stores an email per user, but we derive it as
 * `<normalized-username>@<VITE_AUTH_EMAIL_DOMAIN>` so no real inbox is required.
 * Use a domain that passes Supabase/Lovable validation (e.g. example.com); `.internal` is often rejected.
 * Passwords are hashed only inside Supabase Auth — never put credentials in client code or git.
 */

const USERNAME_RE = /^[a-z0-9_]{3,30}$/;

const MIN_PASSWORD_LEN = 8;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

/** If the user pastes `admin@something`, only the local part is used for login. */
export function loginIdentifierToUsername(raw: string): string {
  const t = normalizeUsername(raw);
  const at = t.indexOf("@");
  return at === -1 ? t : t.slice(0, at);
}

export function isValidUsername(raw: string): boolean {
  return USERNAME_RE.test(loginIdentifierToUsername(raw));
}

export function usernameValidationMessage(): string {
  return "Use 3–30 characters: a–z, 0–9, or _. If you paste name@something, only the part before @ is used.";
}

export function minPasswordLength(): number {
  return MIN_PASSWORD_LEN;
}

/** Maps username to the synthetic email used with Supabase Auth. */
export function usernameToAuthEmail(username: string): string {
  const u = loginIdentifierToUsername(username);
  if (!USERNAME_RE.test(u)) {
    throw new Error("INVALID_USERNAME");
  }
  const domain = import.meta.env.VITE_AUTH_EMAIL_DOMAIN?.trim();
  if (!domain) {
    throw new Error("MISSING_AUTH_DOMAIN");
  }
  return `${u}@${domain}`;
}

/** Generic copy so failed login does not reveal whether the username exists. */
export const AUTH_INVALID_CREDENTIALS = "Invalid username or password.";

/** Opt-in only: maintainer checklist on auth pages (`VITE_SHOW_AUTH_SETUP_HELP=true`). Never on by default in dev. */
export function showAuthSetupHelp(): boolean {
  return import.meta.env.VITE_SHOW_AUTH_SETUP_HELP === "true";
}

/** After sign-up when the session is not returned (e.g. confirmation pending). */
export function authEmailConfirmHelpMessage(): string {
  return "Your account is not active yet. Try again in a moment, or contact support if sign-in still fails.";
}

function authErrCode(err: unknown): string {
  if (typeof err === "object" && err !== null && "code" in err) {
    const c = (err as { code?: string }).code;
    return typeof c === "string" ? c : "";
  }
  return "";
}

function authErrMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    const m = (err as { message?: string }).message;
    return typeof m === "string" ? m : "";
  }
  return String(err ?? "");
}

export function mapSignInError(err: unknown): string {
  const code = authErrCode(err);
  const msg = authErrMessage(err).toLowerCase();
  if (code === "email_not_confirmed" || msg.includes("email not confirmed")) {
    return authEmailConfirmHelpMessage();
  }
  if (code === "invalid_credentials" || msg.includes("invalid login credentials")) {
    return AUTH_INVALID_CREDENTIALS;
  }
  return AUTH_INVALID_CREDENTIALS;
}

export function mapAuthError(_err: unknown): string {
  return AUTH_INVALID_CREDENTIALS;
}

export function mapSignUpError(err: unknown): string {
  const raw = authErrMessage(err);
  const lower = raw.toLowerCase();
  const code = authErrCode(err);
  if (lower.includes("already registered") || lower.includes("user already")) {
    return "That username is already taken. Try signing in instead.";
  }
  if (lower.includes("signup") && lower.includes("disabled")) {
    return "New sign-ups are currently disabled.";
  }
  if (lower.includes("rate limit") || code === "over_request_rate_limit") {
    return "Too many attempts. Please wait a few minutes and try again.";
  }
  if (lower.includes("password")) {
    return `Password must meet the minimum strength requirements (at least ${MIN_PASSWORD_LEN} characters).`;
  }
  if (lower.includes("email") && lower.includes("invalid")) {
    return "Unable to complete sign up. Please try again.";
  }
  return "Unable to complete sign up. Please try again.";
}
