import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/supabaseServer';
import { normalizeEmail, parseOffsets, isNotApplicable } from '@/lib/helpers';
import dayjs from 'dayjs';
import type { CustomerInput } from '@/lib/types';

const customerInputSchema = z.object({
  // Legacy fields
  company_name: z.string().optional(),
  contact_name: z.string().optional(),
  primary_email: z.string().email().optional(),
  cc_emails: z.array(z.string().email()).optional(),
  plan_name: z.string().optional(),
  renew_link: z.string().url().optional(),
  // New fields
  distributor_name: z.string().optional(),
  distributor_contact_name: z.string().optional(),
  distributor_primary_email: z.string().email().optional(),
  distributor_cc_emails: z.array(z.string().email()).optional(),
  reseller_name: z.string().optional(),
  reseller_contact_name: z.string().optional(),
  reseller_primary_email: z.string().email().optional(),
  reseller_cc_emails: z.array(z.string().email()).optional(),
  end_user_company_name: z.string().optional(),
  end_user_contact_name: z.string().optional(),
  end_user_primary_email: z.string().email().optional(),
  end_user_cc_emails: z.array(z.string().email()).optional(),
  edition: z.string().optional(),
  licensing: z.string().optional(),
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
        `company_name.ilike.%${q}%,contact_name.ilike.%${q}%,primary_email.ilike.%${q}%,distributor_name.ilike.%${q}%,distributor_primary_email.ilike.%${q}%,reseller_name.ilike.%${q}%,reseller_primary_email.ilike.%${q}%,end_user_company_name.ilike.%${q}%,end_user_primary_email.ilike.%${q}%`
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

    // Determine primary email based on relationship hierarchy
    let primaryEmail: string;
    if (data.distributor_primary_email && !isNotApplicable(data.distributor_primary_email)) {
      primaryEmail = data.distributor_primary_email;
    } else if (data.reseller_primary_email && !isNotApplicable(data.reseller_primary_email)) {
      primaryEmail = data.reseller_primary_email;
    } else if (data.end_user_primary_email && !isNotApplicable(data.end_user_primary_email)) {
      primaryEmail = data.end_user_primary_email;
    } else if (data.primary_email) {
      primaryEmail = data.primary_email; // Fallback to legacy field
    } else {
      return NextResponse.json({ error: 'No valid email provided' }, { status: 400 });
    }

    const normalizedEmail = normalizeEmail(primaryEmail);

    // Check if customer exists
    const { data: existing } = await supabase
      .from('customers')
      .select('id')
      .eq('primary_email', normalizedEmail)
      .maybeSingle();

    // Normalize CC emails
    const normalizeCcEmails = (emails: string[] | undefined): string[] | null => {
      if (!emails || emails.length === 0) return null;
      return emails.map((e) => normalizeEmail(e)).filter(Boolean);
    };

    let customer;
    if (existing) {
      // Update existing customer
      const updateData: any = {
        // Legacy fields (for backward compatibility)
        company_name: data.end_user_company_name || data.company_name || null,
        contact_name: data.end_user_contact_name || data.contact_name || null,
        cc_emails: normalizeCcEmails(data.end_user_cc_emails) || normalizeCcEmails(data.cc_emails),
        plan_name: data.edition || data.plan_name || null,
        renew_link: data.renew_link || null,
        // New fields
        distributor_name: isNotApplicable(data.distributor_name) ? null : (data.distributor_name || null),
        distributor_contact_name: isNotApplicable(data.distributor_contact_name) ? null : (data.distributor_contact_name || null),
        distributor_primary_email: isNotApplicable(data.distributor_primary_email) ? null : (data.distributor_primary_email ? normalizeEmail(data.distributor_primary_email) : null),
        reseller_name: isNotApplicable(data.reseller_name) ? null : (data.reseller_name || null),
        reseller_contact_name: isNotApplicable(data.reseller_contact_name) ? null : (data.reseller_contact_name || null),
        reseller_primary_email: isNotApplicable(data.reseller_primary_email) ? null : (data.reseller_primary_email ? normalizeEmail(data.reseller_primary_email) : null),
        reseller_cc_emails: normalizeCcEmails(data.reseller_cc_emails),
        end_user_company_name: data.end_user_company_name || null,
        end_user_contact_name: data.end_user_contact_name || null,
        end_user_primary_email: data.end_user_primary_email ? normalizeEmail(data.end_user_primary_email) : null,
        end_user_cc_emails: normalizeCcEmails(data.end_user_cc_emails),
        edition: data.edition || null,
        licensing: data.licensing || null,
        expires_on: data.expires_on,
        paused: data.paused || false,
        primary_email: normalizedEmail, // Update primary_email if it changed
      };

      const { error: updateError } = await supabase
        .from('customers')
        .update(updateData)
        .eq('id', existing.id);

      if (updateError) {
        console.error('Supabase error:', updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      // Fetch updated customer
      const { data: updated, error: fetchError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', existing.id)
        .single();

      if (fetchError || !updated) {
        console.error('Supabase error:', fetchError);
        return NextResponse.json({ error: fetchError?.message || 'Failed to fetch updated customer' }, { status: 500 });
      }
      customer = updated;
    } else {
      // Insert new customer
      const insertData: any = {
        // Legacy fields (for backward compatibility)
        company_name: data.end_user_company_name || data.company_name || null,
        contact_name: data.end_user_contact_name || data.contact_name || null,
        primary_email: normalizedEmail,
        cc_emails: normalizeCcEmails(data.end_user_cc_emails) || normalizeCcEmails(data.cc_emails),
        plan_name: data.edition || data.plan_name || null,
        renew_link: data.renew_link || null,
        // New fields
        distributor_name: isNotApplicable(data.distributor_name) ? null : (data.distributor_name || null),
        distributor_contact_name: isNotApplicable(data.distributor_contact_name) ? null : (data.distributor_contact_name || null),
        distributor_primary_email: isNotApplicable(data.distributor_primary_email) ? null : (data.distributor_primary_email ? normalizeEmail(data.distributor_primary_email) : null),
        reseller_name: isNotApplicable(data.reseller_name) ? null : (data.reseller_name || null),
        reseller_contact_name: isNotApplicable(data.reseller_contact_name) ? null : (data.reseller_contact_name || null),
        reseller_primary_email: isNotApplicable(data.reseller_primary_email) ? null : (data.reseller_primary_email ? normalizeEmail(data.reseller_primary_email) : null),
        reseller_cc_emails: normalizeCcEmails(data.reseller_cc_emails),
        end_user_company_name: data.end_user_company_name || null,
        end_user_contact_name: data.end_user_contact_name || null,
        end_user_primary_email: data.end_user_primary_email ? normalizeEmail(data.end_user_primary_email) : null,
        end_user_cc_emails: normalizeCcEmails(data.end_user_cc_emails),
        edition: data.edition || null,
        licensing: data.licensing || null,
        expires_on: data.expires_on,
        paused: data.paused || false,
      };

      const { data: inserted, error: insertError } = await supabase
        .from('customers')
        .insert(insertData)
        .select('*')
        .single();

      if (insertError) {
        console.error('Supabase error:', insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
      customer = inserted;
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
