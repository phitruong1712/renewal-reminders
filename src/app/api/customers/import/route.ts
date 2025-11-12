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
  cc_emails: z.union([z.array(z.string().email()), z.string()]).optional(),
  plan_name: z.string().optional(),
  renew_link: z.string().url().optional(),
  expires_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paused: z.boolean().optional(),
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rows } = z.object({ rows: z.array(customerInputSchema) }).parse(body);

    let inserted = 0;
    let updated = 0;
    let totalReminders = 0;

    for (const row of rows) {
      try {
        // Normalize email
        const normalizedEmail = normalizeEmail(row.primary_email);

        // Normalize cc_emails
        let ccEmails: string[] | null = null;
        if (row.cc_emails) {
          if (typeof row.cc_emails === 'string') {
            ccEmails = row.cc_emails
              .split(',')
              .map((e) => normalizeEmail(e.trim()))
              .filter(Boolean);
          } else {
            ccEmails = row.cc_emails.map((e) => normalizeEmail(e)).filter(Boolean);
          }
        }

        // Check if customer exists
        const { data: existing } = await supabase
          .from('customers')
          .select('id')
          .eq('primary_email', normalizedEmail)
          .single();

        const isUpdate = !!existing;

        // Upsert customer
        const { data: customer, error: upsertError } = await supabase
          .from('customers')
          .upsert(
            {
              company_name: row.company_name || null,
              contact_name: row.contact_name || null,
              primary_email: normalizedEmail,
              cc_emails: ccEmails,
              plan_name: row.plan_name || null,
              renew_link: row.renew_link || null,
              expires_on: row.expires_on,
              paused: row.paused || false,
            },
            {
              onConflict: 'primary_email',
            }
          )
          .select()
          .single();

        if (upsertError || !customer) {
          console.error('Failed to upsert customer:', normalizedEmail, upsertError);
          continue;
        }

        if (isUpdate) {
          updated++;
        } else {
          inserted++;
        }

        // Recreate reminders
        const reminderCount = await recreateReminders(customer.id, row.expires_on);
        totalReminders += reminderCount;
      } catch (error) {
        console.error('Error processing row:', row, error);
        continue;
      }
    }

    return NextResponse.json({
      inserted,
      updated,
      reminders: totalReminders,
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

