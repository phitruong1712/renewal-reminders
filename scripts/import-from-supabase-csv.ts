import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dayjs from 'dayjs';

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper functions
function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

function convertDateFormat(dateStr: string): string {
  if (!dateStr || dateStr.trim() === '' || dateStr.toLowerCase() === 'not applicable') {
    return '';
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    let year = parts[2].trim();
    if (year.length === 2) {
      const yearNum = parseInt(year, 10);
      year = yearNum < 50 ? `20${year}` : `19${year}`;
    }
    return `${year}-${month}-${day}`;
  }
  throw new Error(`Invalid date format: ${dateStr}`);
}

function isNotApplicable(value: string | null | undefined): boolean {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  return normalized === '' || normalized === 'not applicable' || normalized === 'n/a';
}

function parseCcEmails(val: string): string[] | null {
  if (!val || isNotApplicable(val)) return null;
  // Handle PostgreSQL array format: {email1,email2} or "email1,email2"
  let cleaned = val.trim();
  if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
    cleaned = cleaned.slice(1, -1);
  }
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1);
  }
  return cleaned
    .split(',')
    .map((e) => normalizeEmail(e.trim()))
    .filter(Boolean);
}

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

// Load Supabase credentials
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('Please set these in your .env.local file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function importCustomers(csvPath: string) {
  console.log('📥 Importing customers from:', csvPath);
  
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').filter((line) => line.trim());
  
  if (lines.length < 2) {
    console.log('⚠️  No data rows found');
    return { inserted: 0, updated: 0 };
  }

  const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
  console.log('Headers:', headers.length);

  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const values = parseCSVLine(line);
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });

      // Skip if no primary_email
      if (!row.primary_email || row.primary_email.trim() === '') {
        continue;
      }

      const normalizedEmail = normalizeEmail(row.primary_email);

      // Prepare customer data
      const customerData: any = {
        id: row.id ? parseInt(row.id, 10) : undefined, // Preserve ID if present
        company_name: row.end_user_company_name || row.company_name || null,
        contact_name: row.end_user_contact_name || row.contact_name || null,
        primary_email: normalizedEmail,
        cc_emails: parseCcEmails(row.end_user_cc_emails || row.cc_emails || ''),
        plan_name: row.edition || row.plan_name || null,
        renew_link: row.renew_link || null,
        distributor_name: isNotApplicable(row.distributor_name) ? null : (row.distributor_name || null),
        distributor_contact_name: isNotApplicable(row.distributor_contact_name) ? null : (row.distributor_contact_name || null),
        distributor_primary_email: isNotApplicable(row.distributor_primary_email) ? null : (row.distributor_primary_email ? normalizeEmail(row.distributor_primary_email) : null),
        reseller_name: isNotApplicable(row.reseller_name) ? null : (row.reseller_name || null),
        reseller_contact_name: isNotApplicable(row.reseller_contact_name) ? null : (row.reseller_contact_name || null),
        reseller_primary_email: isNotApplicable(row.reseller_primary_email) ? null : (row.reseller_primary_email ? normalizeEmail(row.reseller_primary_email) : null),
        reseller_cc_emails: parseCcEmails(row.reseller_cc_emails || ''),
        end_user_company_name: row.end_user_company_name || null,
        end_user_contact_name: row.end_user_contact_name || null,
        end_user_primary_email: row.end_user_primary_email ? normalizeEmail(row.end_user_primary_email) : null,
        end_user_cc_emails: parseCcEmails(row.end_user_cc_emails || ''),
        edition: row.edition || null,
        licensing: row.licensing || null,
        expires_on: row.expires_on ? convertDateFormat(row.expires_on) : null,
        paused: row.paused === 'true' || row.paused === '1' || row.paused === 't' || false,
        last_reminder_status: row.last_reminder_status || null,
        last_reminder_sent_at: row.last_reminder_sent_at || null,
      };

      // Check if customer exists by ID or email
      let existing: any = null;
      if (customerData.id) {
        const { data, error } = await supabase
          .from('customers')
          .select('id')
          .eq('id', customerData.id)
          .maybeSingle();
        if (error && error.code !== 'PGRST116') throw error;
        existing = data;
      }
      
      if (!existing) {
        const { data, error } = await supabase
          .from('customers')
          .select('id')
          .eq('primary_email', normalizedEmail)
          .maybeSingle();
        if (error && error.code !== 'PGRST116') throw error;
        existing = data;
      }

      // Remove id and updated_at from data (Supabase handles these)
      const { id, updated_at, ...dataToInsert } = customerData;

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('customers')
          .update(dataToInsert)
          .eq('id', existing.id);
        
        if (error) {
          console.error(`Update error for ${normalizedEmail}:`, error.message);
          throw error;
        }
        updated++;
        console.log(`✓ Updated: ${normalizedEmail} (ID: ${existing.id})`);
      } else {
        // Insert new (don't include ID - let Supabase generate it)
        const { error } = await supabase
          .from('customers')
          .insert(dataToInsert)
          .select('id')
          .single();
        
        if (error) {
          console.error(`Insert error for ${normalizedEmail}:`, error.message);
          throw error;
        }
        inserted++;
        console.log(`✓ Inserted: ${normalizedEmail}`);
      }
    } catch (error: any) {
      console.error(`❌ Row ${i + 1}: ${error.message}`);
      errors++;
    }
  }

  return { inserted, updated, errors };
}

async function importReminders(csvPath: string) {
  console.log('\n📥 Importing reminders from:', csvPath);
  
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').filter((line) => line.trim());
  
  if (lines.length < 2) {
    console.log('⚠️  No data rows found');
    return { inserted: 0 };
  }

  const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
  let inserted = 0;
  let errors = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const values = parseCSVLine(line);
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });

      if (!row.customer_id || !row.scheduled_at) continue;

      const reminderData: any = {
        id: row.id ? parseInt(row.id, 10) : undefined,
        customer_id: parseInt(row.customer_id, 10),
        scheduled_at: row.scheduled_at,
        status: row.status || 'pending',
        sent_at: row.sent_at || null,
        provider_message_id: row.provider_message_id || null,
      };

      const { id, ...dataToInsert } = reminderData;
      const insertData = reminderData.id ? reminderData : dataToInsert;

      const { error } = await supabase
        .from('reminders')
        .insert(insertData);
      
      if (error) throw error;
      inserted++;
    } catch (error: any) {
      console.error(`❌ Row ${i + 1}: ${error.message}`);
      errors++;
    }
  }

  return { inserted, errors };
}

async function importSendLogs(csvPath: string) {
  console.log('\n📥 Importing send logs from:', csvPath);
  
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').filter((line) => line.trim());
  
  if (lines.length < 2) {
    console.log('⚠️  No data rows found');
    return { inserted: 0 };
  }

  const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
  let inserted = 0;
  let errors = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const values = parseCSVLine(line);
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });

      if (!row.customer_id) continue;

      const logData: any = {
        id: row.id ? parseInt(row.id, 10) : undefined,
        reminder_id: row.reminder_id ? parseInt(row.reminder_id, 10) : null,
        customer_id: parseInt(row.customer_id, 10),
        status: row.status || 'sent',
        error: row.error || null,
        sent_at: row.sent_at || null,
      };

      const { id, ...dataToInsert } = logData;
      const insertData = logData.id ? logData : dataToInsert;

      const { error } = await supabase
        .from('send_logs')
        .insert(insertData);
      
      if (error) throw error;
      inserted++;
    } catch (error: any) {
      console.error(`❌ Row ${i + 1}: ${error.message}`);
      errors++;
    }
  }

  return { inserted, errors };
}

async function main() {
  console.log('🔄 Importing data from Supabase CSV files...\n');
  
  const supabaseDir = path.join(__dirname, '..', 'Supabase');
  
  // Step 1: Clear existing data (optional - comment out if you want to merge)
  console.log('⚠️  WARNING: This will replace all existing data!');
  console.log('   Clearing existing data...\n');
  
  await supabase.from('send_logs').delete().neq('id', 0);
  await supabase.from('reminders').delete().neq('id', 0);
  await supabase.from('customers').delete().neq('id', 0);
  
  console.log('✓ Cleared existing data\n');

  // Step 2: Import customers
  const customersPath = path.join(supabaseDir, 'customers_rows.csv');
  if (fs.existsSync(customersPath)) {
    const result = await importCustomers(customersPath);
    console.log(`\n✅ Customers: ${result.inserted} inserted, ${result.updated} updated, ${result.errors} errors`);
  } else {
    console.log('⚠️  customers_rows.csv not found');
  }

  // Step 3: Import reminders
  const remindersPath = path.join(supabaseDir, 'reminders_rows.csv');
  if (fs.existsSync(remindersPath)) {
    const result = await importReminders(remindersPath);
    console.log(`✅ Reminders: ${result.inserted} inserted, ${result.errors} errors`);
  } else {
    console.log('⚠️  reminders_rows.csv not found');
  }

  // Step 4: Import send logs
  const logsPath = path.join(supabaseDir, 'send_logs_rows.csv');
  if (fs.existsSync(logsPath)) {
    const result = await importSendLogs(logsPath);
    console.log(`✅ Send Logs: ${result.inserted} inserted, ${result.errors} errors`);
  } else {
    console.log('⚠️  send_logs_rows.csv not found');
  }

  console.log('\n🎉 Import complete!');
  console.log('   Your local database now matches Supabase/Vercel');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

