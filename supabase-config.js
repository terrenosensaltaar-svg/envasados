// Estas credenciales son públicas y están pensadas para uso en el navegador.
// La seguridad de los pedidos se aplica en la base de datos mediante RLS.
const SUPABASE_URL = "https://fotttmvhpxtvzgykwvly.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvdHR0bXZocHh0dnpneWt3dmx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4NTY5NzYsImV4cCI6MjEwNzQzMjk3Nn0.Wb0FOIHMeVrDGACFdL8OkVNtgOu0Hr5WJrNlj_-GDyY";

window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

window.initSupabaseClient = function () {
    if (window.supabaseClient) return window.supabaseClient;
    if (window.supabase && typeof window.supabase.createClient === "function") {
        window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return window.supabaseClient;
    }
    return null;
};

window.initSupabaseClient();

