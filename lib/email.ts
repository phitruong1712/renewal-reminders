import { google } from 'googleapis';
import dayjs from 'dayjs';
import type { CustomerRow } from './types';

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

export async function sendEmailRaw(
  to: string,
  subject: string,
  body: string,
  cc?: string[]
): Promise<{ id: string }> {
  const oauth2Client = getOAuth2Client();
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const from = process.env.GMAIL_SENDER || 'Renewals <noreply@example.com>';

  const message = [
    `From: ${from}`,
    `To: ${to}`,
    cc && cc.length > 0 ? `Cc: ${cc.join(', ')}` : '',
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    body,
  ]
    .filter(Boolean)
    .join('\r\n');

  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
    },
  });

  return { id: res.data.id || '' };
}

export function renderReminder(customer: CustomerRow): { subject: string; body: string } {
  const expiresDate = customer.expires_on
    ? dayjs(customer.expires_on).format('MMMM D, YYYY')
    : 'Unknown date';
  const daysLeft = customer.expires_on
    ? dayjs(customer.expires_on).diff(dayjs(), 'day')
    : 0;

  const contactName = customer.contact_name || 'Customer';
  const companyName = customer.company_name || 'Your company';
  const planName = customer.plan_name || 'your plan';

  let subject = `Renewal Reminder: ${planName} expires`;
  if (daysLeft > 0) {
    subject += ` in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`;
  } else if (daysLeft === 0) {
    subject += ' today';
  } else {
    subject += ` (expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''} ago)`;
  }

  const body = `Hello ${contactName},

This is a reminder that your ${planName} plan for ${companyName} expires on ${expiresDate}.

${daysLeft > 0 ? `That's in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}!` : daysLeft === 0 ? 'That\'s today!' : 'This plan has expired.'}

${customer.renew_link ? `Please renew here: ${customer.renew_link}` : 'Please contact us to renew your plan.'}

Thank you,
Renewal Reminders Team`;

  return { subject, body };
}
