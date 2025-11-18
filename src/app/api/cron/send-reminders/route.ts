import { NextResponse } from 'next/server';
import dayjs from 'dayjs';
import { supabase } from '@/lib/supabaseServer';
import { sendEmailRaw } from '@/lib/email';
import { getRecipientInfo } from '@/lib/types';

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const x = req.headers.get('x-cron-secret');
  if (x && x === secret) return true;

  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (auth && auth === `Bearer ${secret}`) return true;

  return false;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const dry = new URL(req.url).searchParams.get('dry') === '1';

  // Find due reminders (pending, scheduled_at <= now, and customer not paused)
  const nowIso = new Date().toISOString();
  const { data: due, error } = await supabase
    .from('reminders')
    .select('id, customer_id, scheduled_at, status, customers!inner(*)')
    .lte('scheduled_at', nowIso)
    .eq('status', 'pending');

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const work = (due || []).filter((r: any) => !(r.customers?.paused));
  if (!work.length) return NextResponse.json({ ok: true, sent: 0, dryRun: dry });

  let sent = 0, failed = 0;

  for (const r of work as any[]) {
    const c = r.customers;
    const recipient = getRecipientInfo(c);
    const to = recipient.email;
    const cc = recipient.cc ?? undefined;
    const expiresDate = c.expires_on ? dayjs(c.expires_on).format('YYYY-MM-DD') : 'Unknown date';
    const daysLeft = c.expires_on ? dayjs(c.expires_on).diff(dayjs(), 'day') : 0;
    
    // Build subject based on relationship
    let subject = `Renewal reminder — expires ${expiresDate}`;
    if (daysLeft > 0) {
      subject += ` (in ${daysLeft} day${daysLeft !== 1 ? 's' : ''})`;
    } else if (daysLeft === 0) {
      subject += ' (today)';
    } else {
      subject += ` (expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''} ago)`;
    }
    
    // Build body based on relationship
    const contactName = recipient.name || 'there';
    const companyName = recipient.company || 'your account';
    const planName = c.edition || c.plan_name || 'your plan';
    const licensing = c.licensing ? ` (${c.licensing})` : '';
    
    let body = `Hi ${contactName},\n\n`;
    
    if (recipient.relationship === 'distributor') {
      body += `Your distributor agreement for ${companyName} will expire on ${expiresDate}.\n`;
      body += `This affects the reseller and end-user relationships in your distribution chain.\n`;
    } else if (recipient.relationship === 'reseller') {
      body += `Your reseller agreement for ${companyName} will expire on ${expiresDate}.\n`;
      body += `This affects the end-user customers you serve.\n`;
    } else {
      body += `Your subscription for ${companyName} (${planName}${licensing}) will expire on ${expiresDate}.\n`;
    }
    
    body += `\n${daysLeft > 0 ? `That's in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}!` : daysLeft === 0 ? 'That\'s today!' : 'This has expired.'}\n`;
    body += `\nPlease renew before the date to avoid interruption.\n`;
    if (c.renew_link) {
      body += `Renew here: ${c.renew_link}\n`;
    }
    body += `\nThank you!`;

    try {
      let msgId: string | undefined = undefined;
      if (!dry) {
        const result = await sendEmailRaw(to, subject, body, cc);
        msgId = result.id;
      }

      // mark sent
      await supabase.from('reminders')
        .update({ status: dry ? 'pending' : 'sent', sent_at: dry ? null : new Date().toISOString(), provider_message_id: dry ? null : msgId })
        .eq('id', r.id);
      await supabase.from('customers')
        .update({ last_reminder_status: dry ? 'dry-run' : 'sent', last_reminder_sent_at: dry ? null : new Date().toISOString() })
        .eq('id', r.customer_id);
      await supabase.from('send_logs')
        .insert({ reminder_id: r.id, customer_id: r.customer_id, status: dry ? 'dry-run' : 'sent', error: null });

      sent++;
    } catch (e: any) {
      await supabase.from('send_logs')
        .insert({ reminder_id: r.id, customer_id: r.customer_id, status: 'failed', error: String(e?.message ?? e) });
      await supabase.from('reminders').update({ status: 'failed' }).eq('id', r.id);
      failed++;
    }
  }

  return NextResponse.json({ ok: true, sent, failed, dryRun: dry });
}
