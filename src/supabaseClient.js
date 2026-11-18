import { createClient } from "@supabase/supabase-js";

// Paste your Supabase Project URL (without /rest/v1/) and Public Key below:
const SUPABASE_URL = "https://ozpgkvagnaalzjvtqkbf.supabase.co";
const SUPABASE_PUBLIC_KEY = "sb_publishable_EiyTjLTH9UA_Sd7Q76kvAg_Y7XPV3Dj";

export const supabase = createClient(
  SUPABASE_URL.replace(/\/rest\/v1\/?$/, ""),
  SUPABASE_PUBLIC_KEY
);
