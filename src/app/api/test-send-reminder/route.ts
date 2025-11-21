import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseServer';
import { sendEmailRaw } from '@/lib/email';
import { getRecipientInfo } from '@/lib/types';
import dayjs from 'dayjs';

// Simple test endpoint - sends a reminder for the first customer
export async function POST(request: NextRequest) {
  try {
    // Get the first customer (or you can pass customer_id in body)
    const body = await request.json().catch(() => ({}));
    const customerId = body.customer_id;

    let query = supabase
      .from('customers')
      .select('*')
      .eq('paused', false)
      .limit(1);

    if (customerId) {
      query = query.eq('id', customerId);
    }

    const { data: customers, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!customers || customers.length === 0) {
      return NextResponse.json({ error: 'No customers found' }, { status: 404 });
    }

    const customer = customers[0];
    const recipient = getRecipientInfo(customer);

    const to = recipient.email;
    const cc = recipient.cc ?? undefined;
    const expiresDate = customer.expires_on ? dayjs(customer.expires_on).format('YYYY-MM-DD') : 'Unknown date';
    const daysLeft = customer.expires_on ? dayjs(customer.expires_on).diff(dayjs(), 'day') : 0;

    // Build subject
    let subject = `[TEST] Renewal reminder — expires ${expiresDate}`;
    if (daysLeft > 0) {
      subject += ` (in ${daysLeft} day${daysLeft !== 1 ? 's' : ''})`;
    } else if (daysLeft === 0) {
      subject += ' (today)';
    } else {
      subject += ` (expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''} ago)`;
    }

    // Build body
    const contactName = recipient.name || 'there';
    const companyName = recipient.company || 'your account';
    const planName = customer.edition || customer.plan_name || 'your plan';
    const licensing = customer.licensing ? ` (${customer.licensing})` : '';

    let emailBody = `Hi ${contactName},\n\n`;
    emailBody += `[THIS IS A TEST EMAIL]\n\n`;

    if (recipient.relationship === 'distributor') {
      emailBody += `Your distributor agreement for ${companyName} will expire on ${expiresDate}.\n`;
      emailBody += `This affects the reseller and end-user relationships in your distribution chain.\n`;
    } else if (recipient.relationship === 'reseller') {
      emailBody += `Your reseller agreement for ${companyName} will expire on ${expiresDate}.\n`;
      emailBody += `This affects the end-user customers you serve.\n`;
    } else {
      emailBody += `Your subscription for ${companyName} (${planName}${licensing}) will expire on ${expiresDate}.\n`;
    }

    emailBody += `\n${daysLeft > 0 ? `That's in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}!` : daysLeft === 0 ? 'That\'s today!' : 'This has expired.'}\n`;
    emailBody += `\nPlease renew before the date to avoid interruption.\n`;
    if (customer.renew_link) {
      emailBody += `Renew here: ${customer.renew_link}\n`;
    }
    emailBody += `\nThank you!`;

    // Send email
    const result = await sendEmailRaw(to, subject, emailBody, cc);

    return NextResponse.json({
      ok: true,
      message: 'Test email sent successfully',
      to,
      cc: cc || null,
      subject,
      messageId: result.id,
      customer: {
        id: customer.id,
        company: companyName,
        relationship: recipient.relationship,
      },
    });
  } catch (error: any) {
    console.error('Test send error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send test email' },
      { status: 500 }
    );
  }
}



