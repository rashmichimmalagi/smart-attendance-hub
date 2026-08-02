import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://uztlmhsfjdacnybxvbjq.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTable(tableName: string) {
  console.log(`\n--- Table: ${tableName} ---`);
  
  // Try to select 1 row with *
  const { data, error } = await supabase.from(tableName).select('*').limit(1);
  if (error) {
    console.log(`Failed to select all columns:`, error.message, `(Code: ${error.code})`);
    
    // Attempt selective fetches to find out which columns exist or fail
    console.log("Analyzing columns individually or looking for specific ones...");
  } else {
    console.log(`Select * worked! Keys present:`, data && data.length > 0 ? Object.keys(data[0]) : "No rows found but statement compiled successfully.");
  }
}

async function main() {
  await checkTable('profiles');
  await checkTable('assignments');
  await checkTable('assignment_submissions');
}

main();
