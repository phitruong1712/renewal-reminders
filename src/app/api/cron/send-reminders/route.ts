import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseServer';
import { sendEmailRaw, renderReminder } from '@/lib/email';
import dayjs from 'dayjs';
import type { CustomerRow } from '@/lib/types';

export async function GET(request: NextRequest) {
  const cronSecret = request.headers.get('x-cron-secret');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret || cronSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const dryRun = searchParams.get('dry') === '1';

  try {
    const now = dayjs().toISOString();

    // First, get all non-paused customer IDs
    const { data: activeCustomers, error: customersError } = await supabase
      .from('customers')
      .select('id')
      .eq('paused', false);

    if (customersError) {
      console.error('Supabase error:', customersError);
      return NextResponse.json({ error: customersError.message }, { status: 500 });
    }

    const activeCustomerIds = activeCustomers?.map((c) => c.id) || [];

    if (activeCustomerIds.length === 0) {
      return NextResponse.json({
        ok: true,
        sent: 0,
        failed: 0,
        dryRun,
      });
    }

    // Find due reminders for non-paused customers
    const { data: reminders, error: remindersError } = await supabase
      .from('reminders')
      .select(`
        *,
        customers:customer_id (
          *
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_at', now)
      .in('customer_id', activeCustomerIds);

    if (remindersError) {
      console.error('Supabase error:', remindersError);
      return NextResponse.json({ error: remindersError.message }, { status: 500 });
    }

    if (!reminders || reminders.length === 0) {
      return NextResponse.json({
        ok: true,
        sent: 0,
        failed: 0,
        dryRun,
      });
    }

    let sent = 0;
    let failed = 0;

    for (const reminder of reminders) {
      const customer = reminder.customers as unknown as CustomerRow;
      
      if (!customer || customer.paused) {
        continue;
      }

      try {
        if (!dryRun) {
          // Render email
          const { subject, body } = renderReminder(customer);

          // Send email
          const emailResult = await sendEmailRaw(
            customer.primary_email,
            subject,
            body,
            customer.cc_emails || undefined
          );

          // Update reminder
          await supabase
            .from('reminders')
            .update({
              status: 'sent',
              sent_at: now,
              provider_message_id: emailResult.id,
            })
            .eq('id', reminder.id);

          // Update customer
          await supabase
            .from('customers')
            .update({
              last_reminder_status: 'sent',
              last_reminder_sent_at: now,
            })
            .eq('id', customer.id);

          // Insert send_logs
          await supabase.from('send_logs').insert({
            reminder_id: reminder.id,
            customer_id: customer.id,
            status: 'sent',
            error: null,
          });
        }

        sent++;
      } catch (error) {
        console.error('Failed to send reminder:', reminder.id, error);

        // Update reminder status
        await supabase
          .from('reminders')
          .update({
            status: 'failed',
            sent_at: now,
          })
          .eq('id', reminder.id);

        // Insert send_logs with error
        await supabase.from('send_logs').insert({
          reminder_id: reminder.id,
          customer_id: customer.id,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        failed++;
      }
    }

    return NextResponse.json({
      ok: true,
      sent,
      failed,
      dryRun,
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
