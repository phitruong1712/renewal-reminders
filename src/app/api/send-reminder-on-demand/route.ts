import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'pg';
import { sendEmailRaw } from '@/lib/email';
import * as fs from 'fs';
import * as path from 'path';

const DB_CONFIG = {
    user: process.env.DATABASE_USER || 'postgres',
    host: process.env.DATABASE_HOST || 'localhost',
    database: process.env.DATABASE_NAME || 'renewal_reminders',
    password: process.env.DATABASE_PASSWORD || 'N@kivo123',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
};

function getStageName(stage: number): string {
    const stageMap: Record<number, string> = {
        1: '1st',
        2: '2nd',
        3: '3rd',
        4: '4th',
        5: '5th',
    };
    return stageMap[stage] || '1st';
}

function getTemplateContent(role: string, stage: string): string {
    const filename = `${stage}_${role}_reminder.eml`;
    const filePath = path.join(process.cwd(), 'Email Templates', filename);
    if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf-8');
    }
    return '';
}

function parseEml(content: string): { subject: string; body: string } {
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

    const body = lines.slice(bodyStart).join('\n');
    return { subject, body };
}

function replacePlaceholders(text: string, customer: any): string {
    let result = text;
    const fields = [
        'end_user_company_name',
        'end_user_contact_name',
        'end_user_primary_email',
        'reseller_name',
        'reseller_contact_name',
        'reseller_primary_email',
        'distributor_name',
        'distributor_contact_name',
        'distributor_primary_email',
        'plan_name',
        'renew_link',
        'expires_on',
    ];

    fields.forEach((field) => {
        const val = customer[field] || '';
        const regex = new RegExp(`\\[${field}\\]`, 'gi');
        result = result.replace(regex, val);
    });

    return result;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { customer_id, stage = 1, parties = ['end_user', 'reseller', 'distributor'] } = body;

        if (!customer_id) {
            return NextResponse.json({ error: 'customer_id is required' }, { status: 400 });
        }

        const client = new Client(DB_CONFIG);
        await client.connect();

        try {
            // Get customer
            const customerRes = await client.query('SELECT * FROM customers WHERE id = $1', [customer_id]);
            if (customerRes.rows.length === 0) {
                return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
            }

            const customer = customerRes.rows[0];
            const stageName = getStageName(stage);
            const allRoles = ['end_user', 'reseller', 'distributor'];
            // Filter roles based on selected parties
            const roles = allRoles.filter(role => parties.includes(role));
            const results = [];

            for (const role of roles) {
                const emailField = `${role}_primary_email`;
                const ccField = `${role}_cc_emails`;
                const toEmail = customer[emailField];

                if (!toEmail || toEmail.toLowerCase() === 'not applicable' || !toEmail.trim()) {
                    continue;
                }

                // Get Template
                const rawTemplate = getTemplateContent(role, stageName);
                if (!rawTemplate) {
                    console.error(`Template not found for ${stageName}_${role}_reminder.eml`);
                    continue;
                }

                // Parse & Replace
                const { subject, body } = parseEml(rawTemplate);
                const finalSubject = replacePlaceholders(subject, customer);
                const finalBody = replacePlaceholders(body, customer);
                const ccList = customer[ccField] || [];

                // Send
                try {
                    const result = await sendEmailRaw(toEmail, finalSubject, finalBody, ccList);
                    results.push({
                        role,
                        to: toEmail,
                        cc: ccList,
                        subject: finalSubject,
                        messageId: result.id,
                        success: true,
                    });

                    // Log to send_logs
                    await client.query(
                        `INSERT INTO send_logs (customer_id, status, sent_at) VALUES ($1, $2, NOW())`,
                        [customer_id, `manual_${role}_stage_${stage}`]
                    );
                } catch (err: any) {
                    results.push({
                        role,
                        to: toEmail,
                        error: err.message,
                        success: false,
                    });

                    await client.query(
                        `INSERT INTO send_logs (customer_id, status, error, sent_at) VALUES ($1, $2, $3, NOW())`,
                        [customer_id, 'error', err.message]
                    );
                }
            }

            await client.end();

            if (results.length === 0) {
                return NextResponse.json({ error: 'No emails to send (no valid email addresses found)' }, { status: 400 });
            }

            return NextResponse.json({
                ok: true,
                message: `Sent ${results.filter((r) => r.success).length} of ${results.length} emails`,
                results,
            });
        } catch (error) {
            await client.end();
            throw error;
        }
    } catch (error: any) {
        console.error('Error sending reminder:', error);
        return NextResponse.json({ error: error.message || 'Failed to send reminder' }, { status: 500 });
    }
}
