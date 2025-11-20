import { Client } from 'pg';
import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dayjs from 'dayjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configuration ---
const DB_CONFIG = {
    user: 'postgres',
    host: 'localhost',
    database: 'renewal_reminders',
    password: 'N@kivo123',
    port: 5432,
};

// Load env
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            let value = match[2].trim();
            // Remove quotes
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            if (!process.env[key]) {
                process.env[key] = value;
            }
        }
    });
}

console.log('Loaded Gmail config:', {
    sender: process.env.GMAIL_SENDER,
    hasClientId: !!process.env.GMAIL_CLIENT_ID,
    hasClientSecret: !!process.env.GMAIL_CLIENT_SECRET,
    hasRefreshToken: !!process.env.GMAIL_REFRESH_TOKEN
});

// --- Gmail Helper ---
const OAuth2 = google.auth.OAuth2;
function getOAuth2Client() {
    const oauth2Client = new OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        'https://developers.google.com/oauthplayground'
    );
    oauth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
    return oauth2Client;
}

async function sendEmail(to: string, subject: string, body: string, cc: string[] = []) {
    try {
        const oauth2Client = getOAuth2Client();
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        const messageParts = [
            `From: ${process.env.GMAIL_SENDER || 'me'}`,
            `To: ${to}`,
            cc.length > 0 ? `Cc: ${cc.join(', ')}` : '',
            `Subject: ${subject}`,
            'Content-Type: text/html; charset=utf-8',
            '',
            body
        ].filter(Boolean);

        const message = messageParts.join('\r\n');
        const encodedMessage = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

        const res = await gmail.users.messages.send({
            userId: 'me',
            requestBody: { raw: encodedMessage },
        });
        return res.data.id;
    } catch (error: any) {
        console.error(`Failed to send to ${to}:`, error.message);
        throw error;
    }
}

// --- Template Helper ---
function getStageName(offset: number): string {
    if (offset === 999) return '1st';
    if (offset === -30) return '2nd';
    if (offset === -7) return '3rd';
    if (offset === 0) return '4th';
    if (offset === 7) return '5th';
    return 'Unknown';
}

function getTemplateContent(role: string, stage: string): string {
    const filename = `${stage}_${role}_reminder.eml`;
    const filePath = path.join(__dirname, '..', 'Email Templates', filename);
    if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf-8');
    }
    return '';
}

function parseEml(content: string): { subject: string, body: string } {
    // Simple EML parser for our templates
    // Assumes Subject is on one line and body starts after first blank line
    // Or if multipart, we try to find the HTML part.
    // For generated templates (text/plain), body is after headers.

    const lines = content.split('\n');
    let subject = '';
    let bodyStart = 0;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('Subject: ')) {
            subject = lines[i].substring(9).trim();
        }
        if (lines[i].trim() === '') {
            bodyStart = i + 1;
            break;
        }
    }

    // If it's a complex EML (like the 1st ones from Gmail), extracting body is hard.
    // We might need a simpler approach: just use the text content if possible.
    // For the 1st reminders provided by user, they are multipart.
    // Let's try to extract the HTML part if it exists, otherwise text.

    const body = lines.slice(bodyStart).join('\n');
    return { subject, body };
}

function replacePlaceholders(text: string, customer: any): string {
    let result = text;
    const fields = [
        'end_user_company_name', 'end_user_contact_name', 'end_user_primary_email',
        'reseller_company_name', 'reseller_contact_name', 'reseller_primary_email',
        'distributor_name', 'distributor_contact_name', 'distributor_primary_email',
        'plan_name', 'renew_link', 'expires_on'
    ];

    fields.forEach(field => {
        const val = customer[field] || '';
        const regex = new RegExp(`\\[${field}\\]`, 'gi');
        result = result.replace(regex, val);
    });

    return result;
}

// --- Main ---
async function main() {
    const args = process.argv.slice(2);
    const force = args.includes('--force');
    const targetEmail = args.find((arg, i) => args[i - 1] === '--customer');
    const targetStageArg = args.find((arg, i) => args[i - 1] === '--stage');
    const targetStage = targetStageArg ? parseInt(targetStageArg) : null;

    console.log('🚀 Starting Reminder Service...');
    if (force) console.log('⚠️ FORCE MODE: Ignoring schedule checks');
    if (targetEmail) console.log(`🎯 Target Customer: ${targetEmail}`);
    if (targetStage) console.log(`🎯 Target Stage: ${targetStage}`);

    const client = new Client(DB_CONFIG);
    await client.connect();

    try {
        // Query reminders
        let query = `
            SELECT r.id as reminder_id, r.offset_days, r.status, r.scheduled_at,
                   c.* 
            FROM reminders r
            JOIN customers c ON r.customer_id = c.id
            WHERE r.status = 'pending'
        `;

        const params: any[] = [];

        if (!force) {
            query += ` AND r.scheduled_at <= NOW()`;
        }

        if (targetEmail) {
            query += ` AND c.primary_email = $${params.length + 1}`;
            params.push(targetEmail);
        }

        // If target stage is specified, we need to filter by offset
        // 1=999, 2=-30, 3=-7, 4=0, 5=7
        if (targetStage) {
            let offset = null;
            if (targetStage === 1) offset = 999;
            if (targetStage === 2) offset = -30;
            if (targetStage === 3) offset = -7;
            if (targetStage === 4) offset = 0;
            if (targetStage === 5) offset = 7;

            if (offset !== null) {
                query += ` AND r.offset_days = $${params.length + 1}`;
                params.push(offset);
            }
        }

        const res = await client.query(query, params);
        console.log(`Found ${res.rowCount} pending reminders.`);

        for (const row of res.rows) {
            const stageName = getStageName(row.offset_days);
            console.log(`\nProcessing Reminder #${row.reminder_id} for ${row.primary_email} (Stage: ${stageName})`);

            const roles = ['end_user', 'reseller', 'distributor'];
            let sentCount = 0;

            for (const role of roles) {
                const emailField = `${role}_primary_email`;
                const ccField = `${role}_cc_emails`;
                const toEmail = row[emailField];

                if (!toEmail) {
                    console.log(`  - Skipping ${role}: No email address`);
                    continue;
                }

                // Get Template
                const rawTemplate = getTemplateContent(role, stageName);
                if (!rawTemplate) {
                    console.error(`  - Error: Template not found for ${stageName}_${role}_reminder.eml`);
                    continue;
                }

                // Parse & Replace
                const { subject, body } = parseEml(rawTemplate);
                const finalSubject = replacePlaceholders(subject, row);
                const finalBody = replacePlaceholders(body, row);
                const ccList = row[ccField] || [];

                // Send
                try {
                    console.log(`  - Sending to ${role} (${toEmail})...`);
                    await sendEmail(toEmail, finalSubject, finalBody, ccList);
                    sentCount++;

                    // Log to send_logs
                    await client.query(
                        `INSERT INTO send_logs (reminder_id, customer_id, status, sent_at) VALUES ($1, $2, $3, NOW())`,
                        [row.reminder_id, row.id, `sent_${role}`]
                    );

                } catch (err: any) {
                    console.error(`  - Failed to send to ${role}: ${err.message}`);
                    await client.query(
                        `INSERT INTO send_logs (reminder_id, customer_id, status, error, sent_at) VALUES ($1, $2, 'error', $3, NOW())`,
                        [row.reminder_id, row.id, err.message]
                    );
                }
            }

            // Update reminder status
            if (sentCount > 0) {
                await client.query(`UPDATE reminders SET status = 'sent', sent_at = NOW() WHERE id = $1`, [row.reminder_id]);
                console.log(`  ✓ Reminder marked as sent.`);
            } else {
                console.log(`  ⚠️ No emails sent for this reminder.`);
            }
        }

    } catch (e) {
        console.error('Script failed:', e);
    } finally {
        await client.end();
    }
}

main().catch(console.error);
