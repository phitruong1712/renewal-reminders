import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/supabaseServer';
import { parseOffsets } from '@/lib/helpers';
import dayjs from 'dayjs';

const renewSchema = z.object({
  term: z.enum(['+1y', '+12m', '+24m', '+6m']).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).refine((data) => data.term || data.date, {
  message: 'Either term or date must be provided',
});

async function recreateReminders(customerId: number, expiresOn: string) {
  const offsets = parseOffsets();
  
  await supabase
    .from('reminders')
    .delete()
    .eq('customer_id', customerId)
    .eq('status', 'pending');

  const reminderInserts = offsets.map((offsetDays) => ({
    customer_id: customerId,
    scheduled_at: dayjs(expiresOn).add(offsetDays, 'day').toISOString(),
    status: 'pending',
  }));

  const { error } = await supabase.from('reminders').insert(reminderInserts);
  if (error) throw error;

  return reminderInserts.length;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customerId = parseInt(params.id, 10);
    if (isNaN(customerId)) {
      return NextResponse.json({ error: 'Invalid customer ID' }, { status: 400 });
    }

    const body = await request.json();
    const data = renewSchema.parse(body);

    // Get current customer
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('expires_on')
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Calculate new expires_on
    let newExpiresOn: string;
    if (data.date) {
      newExpiresOn = data.date;
    } else if (data.term) {
      const currentDate = customer.expires_on
        ? dayjs(customer.expires_on)
        : dayjs();
      
      if (data.term === '+1y' || data.term === '+12m') {
        newExpiresOn = currentDate.add(12, 'month').format('YYYY-MM-DD');
      } else if (data.term === '+24m') {
        newExpiresOn = currentDate.add(24, 'month').format('YYYY-MM-DD');
      } else if (data.term === '+6m') {
        newExpiresOn = currentDate.add(6, 'month').format('YYYY-MM-DD');
      } else {
        return NextResponse.json({ error: 'Invalid term' }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: 'Either term or date must be provided' }, { status: 400 });
    }

    // Update customer
    const { error: updateError } = await supabase
      .from('customers')
      .update({ expires_on: newExpiresOn })
      .eq('id', customerId);

    if (updateError) {
      console.error('Supabase error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Recreate reminders
    const reminderCount = await recreateReminders(customerId, newExpiresOn);

    // Insert send_logs record
    await supabase.from('send_logs').insert({
      customer_id: customerId,
      status: 'renewed',
      sent_at: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      new_expires_on: newExpiresOn,
      created: reminderCount,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

