import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://uztlmhsfjdacnybxvbjq.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testColumn(tableName: string, columnName: string) {
  const { error } = await supabase.from(tableName).select(columnName).limit(1);
  if (error) {
    if (error.code === '42703') {
      return { exists: false, error: error.message };
    }
    return { exists: null, error: error.message };
  }
  return { exists: true, error: null };
}

async function main() {
  console.log("=== DETAILED SCHEMA AUDIT ===");
  
  const tablesAndColumns = {
    profiles: ['id', 'full_name', 'email', 'usn', 'admin_id', 'department', 'account_status', 'authentication_code', 'created_at'],
    assignments: [
      'id', 'session_id', 'title', 'description', 'resources', 'attached_files', 'attached_links', 'deadline', 
      'created_at', 'updated_at', 'created_by', 'created_by_user_id', 'created_by_name', 
      'last_modified_by', 'last_modified_by_name'
    ],
    assignment_submissions: [
      'id', 'assignment_id', 'student_id', 'student_name', 'student_usn', 'submitted_at', 'last_updated_at', 'version',
      'attached_files', 'attached_links'
    ]
  };

  for (const [table, columns] of Object.entries(tablesAndColumns)) {
    console.log(`\nTable: ${table}`);
    for (const col of columns) {
      const res = await testColumn(table, col);
      if (res.exists === true) {
        console.log(`  ✓ ${col}`);
      } else if (res.exists === false) {
        console.log(`  ✗ ${col} (MISSING - Column not found)`);
      } else {
        console.log(`  ? ${col} (Error: ${res.error})`);
      }
    }
  }
}

main();
