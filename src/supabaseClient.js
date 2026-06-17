import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ekyrvvqlsffsmertenvd.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVreXJ2dnFsc2Zmc21lcnRlbnZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2NzQzMTksImV4cCI6MjA5NzI1MDMxOX0.MHHp_23iL8oJqaut7v3BP9cHP_2ExWM1XkqRf0k8TrI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
