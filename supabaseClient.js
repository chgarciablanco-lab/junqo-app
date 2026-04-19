// supabaseClient.js
// Debe estar junto a index.html y cargarse ANTES de app.js.

const SUPABASE_URL = "https://ccwaysefralvvcanfyck.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_CkQMEYmO3PMnHS8NbtDd9A_En8pvV6W";

window.supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
