import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function escapeCsvField(field: any): string {
    if (field === null || field === undefined) return '';
    const stringField = String(field);
    if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
        return `"${stringField.replace(/"/g, '""')}"`;
    }
    return stringField;
}

async function main() {
    console.log('🔄 Exporting customers from Supabase to CSV...');

    const { data: customers, error } = await supabase
        .from('customers')
        .select('*')
        .order('id', { ascending: true });

    if (error) {
        console.error('Error fetching customers:', error);
        process.exit(1);
    }

    console.log(`Found ${customers.length} customers.`);

    // Define headers matching the import file format
    const headers = [
        'id',
        'distributor_name',
        'distributor_contact_name',
        'distributor_primary_email',
        'reseller_name',
        'reseller_contact_name',
        'reseller_primary_email',
        'reseller_cc_emails',
        'end_user_company_name',
        'end_user_contact_name',
        'end_user_primary_email',
        'end_user_cc_emails',
        'edition',
        'licensing',
        'expires_on',
        'paused',
        'last_reminder_status',
        'last_reminder_sent_at',
        'updated_at'
    ];

    const csvRows = [headers.join(',')];

    for (const customer of customers) {
        const row = headers.map(header => {
            let value = customer[header];

            // Handle arrays (like cc_emails)
            if (Array.isArray(value)) {
                value = value.join(',');
            }

            return escapeCsvField(value);
        });
        csvRows.push(row.join(','));
    }

    const csvContent = csvRows.join('\n');
    const targetDir = path.join(__dirname, '..', 'New_Updates');
    const targetFile = path.join(targetDir, 'customers_rows.csv');
    const backupFile = path.join(targetDir, `customers_rows.backup.${Date.now()}.csv`);

    // Create backup
    if (fs.existsSync(targetFile)) {
        console.log(`📦 Creating backup at ${backupFile}...`);
        fs.copyFileSync(targetFile, backupFile);
    }

    // Write new file
    console.log(`💾 Writing to ${targetFile}...`);
    fs.writeFileSync(targetFile, csvContent);

    console.log('✅ Export complete!');
}

main().catch(console.error);
