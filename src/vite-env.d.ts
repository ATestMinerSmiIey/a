/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PROJECT_ID: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  /** Synthetic email domain for username → email mapping (Supabase Auth). */
  readonly VITE_AUTH_EMAIL_DOMAIN?: string;
  /** Show raw PostgREST errors in toasts (local debugging only). */
  readonly VITE_VERBOSE_API_ERRORS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
