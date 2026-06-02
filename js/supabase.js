// =============================================
// SUPABASE CONFIG
// Reemplaza con tus credenciales de Supabase
// =============================================
const SUPABASE_URL = 'https://yumtuojuktcuqeajslrn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1bXR1b2p1a3RjdXFlYWpzbHJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0MTE3ODUsImV4cCI6MjA5NTk4Nzc4NX0.4_5AZGSDTMQo25xO_k-HbcV-f4uC4jiTvWhAo1GfmwM';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
