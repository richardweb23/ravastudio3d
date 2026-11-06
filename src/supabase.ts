import type { Database } from "./database.types";
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const browserKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  url &&
    browserKey &&
    !url.includes("seu-projeto") &&
    !browserKey.includes("sua-chave"),
);

export const supabase = isSupabaseConfigured
  ? createClient<Database>(url, browserKey, {
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

export function requireSupabase() {
  if (!supabase) throw new Error("Supabase não configurado.");
  return supabase;
}
