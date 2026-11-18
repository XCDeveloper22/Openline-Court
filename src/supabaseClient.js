import { createClient } from "@supabase/supabase-js";

// Paste your Supabase Project URL and Public Key below:
const SUPABASE_URL = "https://ozpgkvagnaalzjvtqkbf.supabase.co/rest/v1/";
const SUPABASE_PUBLIC_KEY = "sb_publishable_EiyTjLTH9UA_Sd7Q76kvAg_Y7XPV3Dj";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY);
