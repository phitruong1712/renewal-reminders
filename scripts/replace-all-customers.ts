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
  return val
    .split(',')
    .map((e) => normalizeEmail(e.trim().replace(/^"|"$/g, '')))
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

async function recreateReminders(customerId: number, expiresOn: string) {
  const offsetsStr = process.env.REMINDER_OFFSETS || '-30,-7,-3,-1,1';
  const offsets = offsetsStr
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));
  
  await supabase
    .from('reminders')
    .delete()
    .eq('customer_id', customerId)
    .eq('status', 'pending');

  const reminderInserts = offsets.map((offsetDays) => ({
    customer_id: customerId,
    scheduled_at: dayjs(expiresOn).add(offsetDays, 'day').toISOString(),
    status: 'pending',
  }));

  const { error } = await supabase.from('reminders').insert(reminderInserts);
  if (error) throw error;

  return reminderInserts.length;
}

async function replaceAllCustomers(csvPath: string) {
  console.log('🔄 REPLACING ALL CUSTOMERS WITH CSV DATA\n');
  
  // Step 1: Delete all existing customers (this will cascade delete reminders)
  console.log('Step 1: Deleting all existing customers...');
  const { error: deleteError } = await supabase
    .from('customers')
    .delete()
    .neq('id', 0); // Delete all (id is always > 0)
  
  if (deleteError) {
    console.error('Error deleting existing customers:', deleteError);
    process.exit(1);
  }
  console.log('✓ All existing customers deleted\n');

  // Step 2: Read and parse CSV
  console.log(`Step 2: Reading CSV file: ${csvPath}`);
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').filter((line) => line.trim());
  
  if (lines.length < 2) {
    console.error('Error: CSV file must have at least a header row and one data row');
    return;
  }

  const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
  console.log('✓ CSV headers parsed\n');

  // Step 3: Import new customers
  console.log('Step 3: Importing new customers...');
  let inserted = 0;
  let errors = 0;
  let totalReminders = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const values = parseCSVLine(line);
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });

      // Skip if no expires_on
      const expiresOn = convertDateFormat(row.expires_on);
      if (!expiresOn) {
        console.log(`⚠️  Row ${i + 1}: Skipping (no valid expires_on date)`);
        continue;
      }

      // Determine primary email
      let primaryEmail: string;
      if (row.distributor_primary_email && !isNotApplicable(row.distributor_primary_email)) {
        primaryEmail = row.distributor_primary_email;
      } else if (row.reseller_primary_email && !isNotApplicable(row.reseller_primary_email)) {
        primaryEmail = row.reseller_primary_email;
      } else if (row.end_user_primary_email && !isNotApplicable(row.end_user_primary_email)) {
        primaryEmail = row.end_user_primary_email;
      } else {
        console.log(`⚠️  Row ${i + 1}: Skipping (no valid email)`);
        errors++;
        continue;
      }

      const normalizedEmail = normalizeEmail(primaryEmail);

      // Prepare customer data
      const customerData: any = {
        company_name: row.end_user_company_name || null,
        contact_name: row.end_user_contact_name || null,
        primary_email: normalizedEmail,
        cc_emails: parseCcEmails(row.end_user_cc_emails || ''),
        plan_name: row.edition || null,
        renew_link: null,
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
        expires_on: expiresOn,
        paused: row.paused === 'true' || row.paused === '1' || false,
      };

      // Insert customer
      const { data: insertedCustomer, error: insertError } = await supabase
        .from('customers')
        .insert(customerData)
        .select('id')
        .single();

      if (insertError) {
        console.error(`❌ Row ${i + 1}: Failed - ${insertError.message}`);
        errors++;
        continue;
      }

      // Create reminders
      const reminderCount = await recreateReminders(insertedCustomer.id, expiresOn);
      totalReminders += reminderCount;
      inserted++;
      console.log(`✓ Row ${i + 1}: ${normalizedEmail} (${reminderCount} reminders)`);
    } catch (error: any) {
      console.error(`❌ Row ${i + 1}: Error - ${error.message}`);
      errors++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ IMPORT COMPLETE');
  console.log('='.repeat(50));
  console.log(`Inserted: ${inserted} customers`);
  console.log(`Reminders created: ${totalReminders}`);
  console.log(`Errors: ${errors}`);
  console.log('\n🎉 Your Supabase database has been updated!');
  console.log('   Vercel will automatically reflect these changes.');
}

// Run the import
const csvPath = path.join(__dirname, '..', 'New_Updates', 'customers_rows.csv');
replaceAllCustomers(csvPath).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

