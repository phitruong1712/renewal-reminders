import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dayjs from 'dayjs';

// Load environment variables from .env.local if it exists
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) return;

    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
  console.log('Loaded environment variables from .env.local');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper functions (inlined to avoid import issues)
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

// Load environment variables
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing Supabase environment variables');
  console.error('Required: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY');
  console.error('\nAvailable environment variables:');
  Object.keys(process.env)
    .filter(key => key.includes('SUPABASE') || key.includes('supabase'))
    .forEach(key => console.error(`  ${key}=${process.env[key]?.substring(0, 20)}...`));
  process.exit(1);
}

console.log('✓ Supabase connection configured');

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Parse CSV line handling quoted values
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
  values.push(current.trim()); // Add last value
  return values;
}

// Parse CC emails
function parseCcEmails(val: string): string[] | null {
  if (!val || isNotApplicable(val)) return null;
  return val
    .split(',')
    .map((e) => normalizeEmail(e.trim().replace(/^"|"$/g, '')))
    .filter(Boolean);
}

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

async function importCSV(filePath: string) {
  console.log(`Reading CSV file: ${filePath}`);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter((line) => line.trim());

  if (lines.length < 2) {
    console.error('Error: CSV file must have at least a header row and one data row');
    return;
  }

  const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
  console.log('Headers:', headers);

  let inserted = 0;
  let updated = 0;
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

      // Convert date format
      const expiresOn = convertDateFormat(row.expires_on);
      if (!expiresOn) {
        console.error(`Row ${i + 1}: Invalid or missing expires_on date: ${row.expires_on}`);
        errors++;
        continue;
      }

      // Determine primary email based on relationship hierarchy
      let primaryEmail: string;
      if (
        row.distributor_primary_email &&
        !isNotApplicable(row.distributor_primary_email)
      ) {
        primaryEmail = row.distributor_primary_email;
      } else if (
        row.reseller_primary_email &&
        !isNotApplicable(row.reseller_primary_email)
      ) {
        primaryEmail = row.reseller_primary_email;
      } else if (
        row.end_user_primary_email &&
        !isNotApplicable(row.end_user_primary_email)
      ) {
        primaryEmail = row.end_user_primary_email;
      } else {
        console.error(`Row ${i + 1}: No valid email found`);
        errors++;
        continue;
      }

      const normalizedEmail = normalizeEmail(primaryEmail);

      // Prepare data
      const customerData: any = {
        // Legacy fields (for backward compatibility)
        company_name: row.end_user_company_name || row.company_name || null,
        contact_name: row.end_user_contact_name || row.contact_name || null,
        primary_email: normalizedEmail,
        cc_emails: parseCcEmails(row.end_user_cc_emails || row.cc_emails || ''),
        plan_name: row.edition || row.plan_name || null,
        renew_link: row.renew_link || null,
        // New fields
        distributor_name: isNotApplicable(row.distributor_name) ? null : (row.distributor_name || null),
        distributor_contact_name: isNotApplicable(row.distributor_contact_name) ? null : (row.distributor_contact_name || null),
        distributor_primary_email: isNotApplicable(row.distributor_primary_email) ? null : (row.distributor_primary_email ? normalizeEmail(row.distributor_primary_email) : null),
        distributor_cc_emails: parseCcEmails(row.distributor_cc_emails || ''),
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

      // Check if customer exists
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('primary_email', normalizedEmail)
        .maybeSingle();

      let customerId: number;

      if (existing) {
        // Update existing customer
        const { error: updateError, data: updatedData } = await supabase
          .from('customers')
          .update(customerData)
          .eq('id', existing.id)
          .select('id')
          .single();

        if (updateError) {
          console.error(`Row ${i + 1}: Failed to update customer ${normalizedEmail}:`, updateError.message);
          errors++;
          continue;
        }
        customerId = updatedData.id;
        updated++;
        console.log(`✓ Updated: ${normalizedEmail}`);
      } else {
        // Insert new customer
        const { error: insertError, data: insertedData } = await supabase
          .from('customers')
          .insert(customerData)
          .select('id')
          .single();

        if (insertError) {
          console.error(`Row ${i + 1}: Failed to insert customer ${normalizedEmail}:`, insertError);
          console.error('Full error details:', JSON.stringify(insertError, null, 2));
          errors++;
          continue;
        }
        customerId = insertedData.id;
        inserted++;
        console.log(`✓ Inserted: ${normalizedEmail}`);
      }

      // Recreate reminders
      const reminderCount = await recreateReminders(customerId, expiresOn);
      totalReminders += reminderCount;
    } catch (error: any) {
      console.error(`Row ${i + 1}: Error processing row:`, error.message);
      errors++;
    }
  }

  console.log('\n=== Import Summary ===');
  console.log(`Inserted: ${inserted}`);
  console.log(`Updated: ${updated}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total reminders created: ${totalReminders}`);
}

// Run the import
const csvPath = path.join(__dirname, '..', 'New_Updates', 'customers_rows.csv');
importCSV(csvPath).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

