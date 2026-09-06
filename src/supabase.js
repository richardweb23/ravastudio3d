import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(
  url &&
    publishableKey &&
    !url.includes("seu-projeto") &&
    !publishableKey.includes("sua-chave"),
);

export const supabase = isSupabaseConfigured
  ? createClient(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function managementUrl() {
  return `${window.location.origin}${window.location.pathname.replace(/\/?$/, "/")}`;
}
