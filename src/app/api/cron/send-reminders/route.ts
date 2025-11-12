import { NextResponse } from 'next/server';
import dayjs from 'dayjs';
import { supabase } from '@/lib/supabaseServer';
import { sendEmailRaw } from '@/lib/email';

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
    .select('id, customer_id, scheduled_at, status, customers!inner(primary_email, cc_emails, company_name, contact_name, renew_link, expires_on, paused)')
    .lte('scheduled_at', nowIso)
    .eq('status', 'pending');

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const work = (due || []).filter((r: any) => !(r.customers?.paused));
  if (!work.length) return NextResponse.json({ ok: true, sent: 0, dryRun: dry });

  let sent = 0, failed = 0;

  for (const r of work as any[]) {
    const c = r.customers;
    const to = c.primary_email as string;
    const cc = (c.cc_emails ?? undefined) as string[] | undefined;
    const subject = `Renewal reminder — expires ${dayjs(c.expires_on).format('YYYY-MM-DD')}`;
    const body = [
      `Hi ${c.contact_name ?? 'there'},`,
      '',
      `Your subscription for ${c.company_name ?? 'your account'} will expire on ${dayjs(c.expires_on).format('YYYY-MM-DD')}.`,
      'Please renew before the date to avoid interruption.',
      c.renew_link ? `Renew here: ${c.renew_link}` : undefined,
      '',
      'Thank you!',
    ].filter(Boolean).join('\n');

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
