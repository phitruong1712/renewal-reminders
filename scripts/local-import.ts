import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dayjs from 'dayjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const DB_CONFIG = {
    user: 'postgres',
    host: 'localhost',
    database: 'renewal_reminders',
    password: 'N@kivo123',
    port: 5432,
};

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

function parseCcEmails(val: string): string[] | null {
    if (!val || isNotApplicable(val)) return null;
    return val
        .split(',')
        .map((e) => normalizeEmail(e.trim().replace(/^"|"$/g, '')))
        .filter(Boolean);
}

async function importCSV(filePath: string) {
    console.log(`Reading CSV file: ${filePath}`);
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter((line) => line.trim());

    if (lines.length < 2) {
        console.error('Error: CSV file must have at least a header row and one data row');
        return;
    }

    const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
    console.log('Headers:', headers);

    const client = new Client(DB_CONFIG);
    await client.connect();
    console.log('Connected to local database.');

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

            const expiresOn = convertDateFormat(row.expires_on);
            if (!expiresOn) {
                console.error(`Row ${i + 1}: Invalid or missing expires_on date`);
                errors++;
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
                console.error(`Row ${i + 1}: No valid email found`);
                errors++;
                continue;
            }

            const normalizedEmail = normalizeEmail(primaryEmail);

            // Check existing
            const res = await client.query('SELECT id FROM customers WHERE primary_email = $1', [normalizedEmail]);
            const existing = res.rows[0];

            let customerId: number;

            // Prepare values for query
            const customerValues = [
                row.end_user_company_name || row.company_name || null, // company_name
                row.end_user_contact_name || row.contact_name || null, // contact_name
                normalizedEmail, // primary_email
                parseCcEmails(row.end_user_cc_emails || row.cc_emails || ''), // cc_emails
                row.edition || row.plan_name || null, // plan_name
                row.renew_link || null, // renew_link
                isNotApplicable(row.distributor_name) ? null : (row.distributor_name || null),
                isNotApplicable(row.distributor_contact_name) ? null : (row.distributor_contact_name || null),
                isNotApplicable(row.distributor_primary_email) ? null : (row.distributor_primary_email ? normalizeEmail(row.distributor_primary_email) : null),
                parseCcEmails(row.distributor_cc_emails || ''), // distributor_cc_emails
                isNotApplicable(row.reseller_name) ? null : (row.reseller_name || null),
                isNotApplicable(row.reseller_contact_name) ? null : (row.reseller_contact_name || null),
                isNotApplicable(row.reseller_primary_email) ? null : (row.reseller_primary_email ? normalizeEmail(row.reseller_primary_email) : null),
                parseCcEmails(row.reseller_cc_emails || ''),
                row.end_user_company_name || null,
                row.end_user_contact_name || null,
                row.end_user_primary_email ? normalizeEmail(row.end_user_primary_email) : null,
                parseCcEmails(row.end_user_cc_emails || ''),
                row.edition || null,
                row.licensing || null,
                expiresOn,
                row.paused === 'true' || row.paused === '1' || false
            ];

            if (existing) {
                // Update
                await client.query(`
                    UPDATE customers SET
                        company_name = $1, contact_name = $2, primary_email = $3, cc_emails = $4::text[], plan_name = $5, renew_link = $6,
                        distributor_name = $7, distributor_contact_name = $8, distributor_primary_email = $9, distributor_cc_emails = $10::text[],
                        reseller_name = $11, reseller_contact_name = $12, reseller_primary_email = $13, reseller_cc_emails = $14::text[],
                        end_user_company_name = $15, end_user_contact_name = $16, end_user_primary_email = $17, end_user_cc_emails = $18::text[],
                        edition = $19, licensing = $20, expires_on = $21, paused = $22
                    WHERE id = $23
                `, [...customerValues, existing.id]);
                customerId = existing.id;
                updated++;
                console.log(`✓ Updated: ${normalizedEmail}`);
            } else {
                // Insert
                const insertRes = await client.query(`
                    INSERT INTO customers (
                        company_name, contact_name, primary_email, cc_emails, plan_name, renew_link,
                        distributor_name, distributor_contact_name, distributor_primary_email, distributor_cc_emails,
                        reseller_name, reseller_contact_name, reseller_primary_email, reseller_cc_emails,
                        end_user_company_name, end_user_contact_name, end_user_primary_email, end_user_cc_emails,
                        edition, licensing, expires_on, paused, last_reminder_status, last_reminder_sent_at
                    ) VALUES (
                        $1, $2, $3, $4::text[], $5, $6, $7, $8, $9, $10::text[], $11, $12, $13, $14::text[], $15, $16, $17, $18::text[], $19, $20, $21, $22, NULL, NULL
                    ) RETURNING id
                `, customerValues);
                customerId = insertRes.rows[0].id;
                inserted++;
                console.log(`✓ Inserted: ${normalizedEmail}`);
            }

            // Recreate future reminders (based on expiration)
            // Offsets: 30 days before, 7 days before, on expiration, 7 days after
            const offsets = [-30, -7, 0, 7];

            // Delete pending reminders (except immediate ones which might be processed separately)
            await client.query(
                "DELETE FROM reminders WHERE customer_id = $1 AND status = 'pending' AND offset_days IS NOT NULL",
                [customerId]
            );

            for (const offset of offsets) {
                const scheduledAt = dayjs(expiresOn).add(offset, 'day').toISOString();
                // Only add if it's in the future (or today)
                if (dayjs(scheduledAt).isAfter(dayjs().subtract(1, 'day'))) {
                    await client.query(
                        "INSERT INTO reminders (customer_id, scheduled_at, status, offset_days) VALUES ($1, $2, 'pending', $3)",
                        [customerId, scheduledAt, offset]
                    );
                    totalReminders++;
                }
            }

            // Add "Immediate" reminder ONLY if it's a new insertion
            if (!existing) {
                await client.query(
                    "INSERT INTO reminders (customer_id, scheduled_at, status, offset_days) VALUES ($1, NOW(), 'pending', 999)",
                    [customerId]
                );
                totalReminders++;
                console.log(`   + Scheduled immediate reminder`);
            }

        } catch (err: any) {
            console.error(`Row ${i + 1}: Error: ${err.message}`);
            errors++;
        }
    }

    await client.end();

    console.log('\n=== Import Summary ===');
    console.log(`Inserted: ${inserted}`);
    console.log(`Updated: ${updated}`);
    console.log(`Errors: ${errors}`);
    console.log(`Total reminders created: ${totalReminders}`);
}

// Run
const csvPath = path.join(__dirname, '..', 'New_Updates', 'customers_rows.csv');
importCSV(csvPath).catch(console.error);
