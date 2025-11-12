import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/supabaseServer';
import { normalizeEmail, parseOffsets } from '@/lib/helpers';
import dayjs from 'dayjs';
import type { CustomerInput } from '@/lib/types';

const customerInputSchema = z.object({
  company_name: z.string().optional(),
  contact_name: z.string().optional(),
  primary_email: z.string().email(),
  cc_emails: z.array(z.string().email()).optional(),
  plan_name: z.string().optional(),
  renew_link: z.string().url().optional(),
  expires_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paused: z.boolean().optional(),
});

async function recreateReminders(customerId: number, expiresOn: string) {
  const offsets = parseOffsets();
  
  // Delete existing pending reminders
  await supabase
    .from('reminders')
    .delete()
    .eq('customer_id', customerId)
    .eq('status', 'pending');

  // Create new reminders
  const reminderInserts = offsets.map((offsetDays) => ({
    customer_id: customerId,
    scheduled_at: dayjs(expiresOn).add(offsetDays, 'day').toISOString(),
    status: 'pending',
  }));

  const { error } = await supabase.from('reminders').insert(reminderInserts);
  if (error) throw error;

  return reminderInserts.length;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get('q') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const offset = (page - 1) * pageSize;

    let query = supabase
      .from('customers')
      .select('*', { count: 'exact' })
      .order('expires_on', { ascending: true })
      .order('company_name', { ascending: true });

    if (q) {
      query = query.or(
        `company_name.ilike.%${q}%,contact_name.ilike.%${q}%,primary_email.ilike.%${q}%`
      );
    }

    const { data, error, count } = await query.range(offset, offset + pageSize - 1);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      rows: data || [],
      total: count || 0,
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = customerInputSchema.parse(body);

    const normalizedEmail = normalizeEmail(data.primary_email);

    // Upsert customer
    const { data: customer, error: upsertError } = await supabase
      .from('customers')
      .upsert(
        {
          company_name: data.company_name || null,
          contact_name: data.contact_name || null,
          primary_email: normalizedEmail,
          cc_emails: data.cc_emails || null,
          plan_name: data.plan_name || null,
          renew_link: data.renew_link || null,
          expires_on: data.expires_on,
          paused: data.paused || false,
        },
        {
          onConflict: 'primary_email',
        }
      )
      .select()
      .single();

    if (upsertError) {
      console.error('Supabase error:', upsertError);
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    if (!customer) {
      return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 });
    }

    // Recreate reminders
    const reminderCount = await recreateReminders(customer.id, data.expires_on);

    return NextResponse.json({
      ok: true,
      customer_id: customer.id,
      reminders: reminderCount,
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
