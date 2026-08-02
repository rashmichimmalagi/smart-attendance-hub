import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://uztlmhsfjdacnybxvbjq.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6dGxtaHNmamRhY255Ynh2YmpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNTM4ODAsImV4cCI6MjA5NTcyOTg4MH0.pE039OkbILhr76Tbi_-0CnsIXjuEZ3P-nMD6G4OuNLU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  console.log("=== REMOTE TABLES INSPECTION ===");
  const { data: ar, error: arErr } = await supabase
    .from('absence_requests')
    .select('*')
    .limit(5);
    
  if (arErr) {
    console.error("Error fetching absence_requests:", arErr);
  } else {
    console.log("Fetched absence_requests success, count:", ar?.length, "records:", ar);
  }

  const { data: att, error: attErr } = await supabase
    .from('attendance')
    .select('*')
    .limit(5);

  if (attErr) {
    console.error("Error fetching attendance:", attErr);
  } else {
    console.log("Fetched attendance success, count:", att?.length);
  }
}

main();
