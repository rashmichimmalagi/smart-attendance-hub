import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://uztlmhsfjdacnybxvbjq.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6dGxtaHNmamRhY255Ynh2YmpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNTM4ODAsImV4cCI6MjA5NTcyOTg4MH0.pE039OkbILhr76Tbi_-0CnsIXjuEZ3P-nMD6G4OuNLU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  console.log("=== SCHEMA COLUMNS INSPECTION ===");
  const { data, error } = await supabase
    .from('assignment_submissions')
    .select()
    .limit(1);

  if (error) {
    console.log("Submissions load error code:", error.code, "message:", error.message);
  } else {
    console.log("Submissions data:", data);
  }
}

main();
