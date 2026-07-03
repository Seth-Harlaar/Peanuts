import { createClient } from "@supabase/supabase-js";

// The publishable key is safe to expose to the browser — Row Level Security,
// not secrecy, is what protects writes (see supabase/migrations/0001_init.sql).
const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Placeholders keep createClient from throwing when the app runs in static
// mode with no Supabase env configured; auth/repository are only used when
// VITE_REPOSITORY=supabase (see src/ui/services.ts).
export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  publishableKey || "placeholder-key",
);

// Synchronous auth snapshot, kept current by the auth listener below. Used for
// capability checks (MutationService.canWrite) that can't await a Promise.
let authed = false;
void supabase.auth.getSession().then(({ data }) => {
  authed = !!data.session;
});
supabase.auth.onAuthStateChange((_event, session) => {
  authed = !!session;
});

export const isAuthenticated = (): boolean => authed;
