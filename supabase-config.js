// Estas credenciales son públicas y están pensadas para uso en el navegador.
// La seguridad de los pedidos se aplica en la base de datos mediante RLS.
const SUPABASE_URL = "https://fotttmvhpxtvzgykwvly.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ttTv69g7EiuQxVE24r8rGg_Ia7Y7ASF";

window.supabaseClient = window.supabase?.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);
