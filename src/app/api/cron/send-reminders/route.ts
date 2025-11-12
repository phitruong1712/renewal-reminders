import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseServer';
import { sendEmail } from '@/lib/email';
import dayjs from 'dayjs';

export async function GET(request: NextRequest) {
  const cronSecret = request.headers.get('x-cron-secret');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret || cronSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const today = dayjs().format('YYYY-MM-DD');
    const daysUntilExpiry = [7, 3, 1, 0];
    const targetDates = daysUntilExpiry.map((days) =>
      dayjs().add(days, 'day').format('YYYY-MM-DD')
    );

    const { data: customers, error } = await supabase
      .from('customers')
      .select('*')
      .in('expires_on', targetDates);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!customers || customers.length === 0) {
      return NextResponse.json({ message: 'No customers to remind', sent: 0 });
    }

    let sentCount = 0;
    const errors: string[] = [];

    for (const customer of customers) {
      try {
        const expiresDate = dayjs(customer.expires_on);
        const daysLeft = expiresDate.diff(dayjs(), 'day');

        const subject = `Renewal Reminder: ${customer.plan_name} expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`;
        const html = `
          <h2>Renewal Reminder</h2>
          <p>Hello ${customer.contact_name},</p>
          <p>Your ${customer.plan_name} plan for <strong>${customer.company_name}</strong> expires on <strong>${expiresDate.format('MMMM D, YYYY')}</strong>.</p>
          <p>That's in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}!</p>
          <p><a href="${customer.renew_link}">Renew Now</a></p>
        `;

        await sendEmail({
          to: customer.primary_email,
          cc: customer.cc_emails || [],
          subject,
          html,
        });

        await supabase.from('send_logs').insert({
          customer_id: customer.id,
          sent_at: new Date().toISOString(),
          days_until_expiry: daysLeft,
        });

        sentCount++;
      } catch (error) {
        const errorMsg = `Failed to send to ${customer.primary_email}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    return NextResponse.json({
      message: 'Reminders processed',
      sent: sentCount,
      total: customers.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

