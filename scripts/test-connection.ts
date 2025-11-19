import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing credentials');
  process.exit(1);
}

console.log('Testing Supabase connection...');
console.log('URL:', supabaseUrl.substring(0, 30) + '...');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Test connection by checking if customers table exists and has the new columns
async function testConnection() {
  try {
    // Try a simple query to see if table exists
    const { data, error } = await supabase
      .from('customers')
      .select('id')
      .limit(1);
    
    if (error) {
      console.error('Connection error:', error);
      if (error.message.includes('column') || error.code === 'PGRST116') {
        console.error('\n⚠️  The new columns may not exist yet!');
        console.error('Please run the migration SQL first: supabase-add-distributor-reseller-fields.sql');
      }
      return;
    }
    
    console.log('✓ Connection successful!');
    console.log('✓ Customers table exists');
    
    // Check if new columns exist by trying to select one
    const { error: columnError } = await supabase
      .from('customers')
      .select('distributor_name')
      .limit(1);
    
    if (columnError) {
      console.error('\n⚠️  New columns not found:', columnError.message);
      console.error('Please run the migration SQL: supabase-add-distributor-reseller-fields.sql');
    } else {
      console.log('✓ New columns exist - ready to import!');
    }
  } catch (err: any) {
    console.error('Connection failed:', err.message);
    console.error('This might be a network issue or incorrect URL');
  }
}

testConnection();





