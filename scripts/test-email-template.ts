import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dayjs from 'dayjs';

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

const OAuth2 = google.auth.OAuth2;

function getOAuth2Client() {
    const oauth2Client = new OAuth2(
        process.env.GMAIL_CLIENT_ID!,
        process.env.GMAIL_CLIENT_SECRET!,
        'https://developers.google.com/oauthplayground'
    );

    oauth2Client.setCredentials({
        refresh_token: process.env.GMAIL_REFRESH_TOKEN!,
    });

    return oauth2Client;
}

async function sendTestEmail() {
    console.log('📧 Preparing test email...');

    // 1. Read Template
    const templatePath = path.join(__dirname, '..', 'Email Templates', '1st_end_user_reminder.eml');
    if (!fs.existsSync(templatePath)) {
        console.error('Template not found:', templatePath);
        return;
    }
    let emailContent = fs.readFileSync(templatePath, 'utf-8');

    // 2. Replace Placeholders
    const testData = {
        end_user_contact_name: 'Test User',
        expires_on: dayjs().add(30, 'day').format('YYYY-MM-DD'),
    };

    emailContent = emailContent.replace(/\[end_user_contact_name\]/g, testData.end_user_contact_name);
    emailContent = emailContent.replace(/\[expires_on\]/g, testData.expires_on);

    // 3. Update Headers
    // We need to replace the To and From headers to ensure it sends correctly via API
    // The EML file has its own headers. We should probably strip them and construct a new message
    // OR just replace the specific lines.

    const toEmail = 'phitruong1712@gmail.com';
    const fromEmail = process.env.GMAIL_SENDER || 'me'; // 'me' uses the authenticated user

    // Regex to replace headers
    emailContent = emailContent.replace(/^To:.*$/m, `To: ${toEmail}`);
    // emailContent = emailContent.replace(/^From:.*$/m, `From: ${fromEmail}`); // Optional, Gmail API often overrides this
    emailContent = emailContent.replace(/^Subject:.*$/m, `Subject: TEST - NAKIVO - License Renewal Reminder`);

    // 4. Send
    const oauth2Client = getOAuth2Client();
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const encodedMessage = Buffer.from(emailContent)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    console.log(`Sending to ${toEmail}...`);

    try {
        const res = await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedMessage,
            },
        });
        console.log('✅ Email sent! ID:', res.data.id);
    } catch (error: any) {
        console.error('❌ Failed to send email:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

sendTestEmail().catch(console.error);
