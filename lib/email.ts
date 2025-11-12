import { google } from 'googleapis';

const OAuth2 = google.auth.OAuth2;

export async function sendEmail(options: {
  to: string;
  cc?: string[];
  subject: string;
  html: string;
}) {
  const { to, cc, subject, html } = options;

  const oauth2Client = new OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
  });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const message = [
    `To: ${to}`,
    cc && cc.length > 0 ? `Cc: ${cc.join(', ')}` : '',
    `Subject: ${subject}`,
    'Content-Type: text/html; charset=utf-8',
    '',
    html,
  ]
    .filter(Boolean)
    .join('\n');

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

  return res.data;
}

