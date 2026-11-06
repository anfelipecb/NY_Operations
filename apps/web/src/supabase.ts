import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && key ? createClient(url, key) : null;

export function missingEnv(): string | null {
  if (!url || !key) {
    return "Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to apps/web/.env, then restart the dev server.";
  }
  return null;
}
