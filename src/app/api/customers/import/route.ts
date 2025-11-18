import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/supabaseServer';
import { normalizeEmail, parseOffsets, convertDateFormat, isNotApplicable } from '@/lib/helpers';
import dayjs from 'dayjs';
import type { CustomerInput } from '@/lib/types';

const customerInputSchema = z.object({
  // Legacy fields
  company_name: z.string().optional(),
  contact_name: z.string().optional(),
  primary_email: z.string().email().optional(),
  cc_emails: z.union([z.array(z.string().email()), z.string()]).optional(),
  plan_name: z.string().optional(),
  renew_link: z.string().url().optional(),
  // New fields
  distributor_name: z.string().optional(),
  distributor_contact_name: z.string().optional(),
  distributor_primary_email: z.string().email().optional(),
  reseller_name: z.string().optional(),
  reseller_contact_name: z.string().optional(),
  reseller_primary_email: z.string().email().optional(),
  reseller_cc_emails: z.union([z.array(z.string().email()), z.string()]).optional(),
  end_user_company_name: z.string().optional(),
  end_user_contact_name: z.string().optional(),
  end_user_primary_email: z.string().email().optional(),
  end_user_cc_emails: z.union([z.array(z.string().email()), z.string()]).optional(),
  edition: z.string().optional(),
  licensing: z.string().optional(),
  expires_on: z.string(),
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
        // Convert date format from DD-MM-YY to YYYY-MM-DD
        const expiresOn = convertDateFormat(row.expires_on);
        if (!expiresOn) {
          console.error('Invalid or missing expires_on date:', row.expires_on);
          continue;
        }

        // Determine primary email based on relationship hierarchy
        // Priority: distributor > reseller > end_user
        let primaryEmail: string;
        let normalizedEmail: string;
        
        if (
          row.distributor_primary_email &&
          !isNotApplicable(row.distributor_primary_email)
        ) {
          primaryEmail = row.distributor_primary_email;
        } else if (
          row.reseller_primary_email &&
          !isNotApplicable(row.reseller_primary_email)
        ) {
          primaryEmail = row.reseller_primary_email;
        } else if (
          row.end_user_primary_email &&
          !isNotApplicable(row.end_user_primary_email)
        ) {
          primaryEmail = row.end_user_primary_email;
        } else if (row.primary_email) {
          primaryEmail = row.primary_email; // Fallback to legacy field
        } else {
          console.error('No valid email found for row:', row);
          continue;
        }

        normalizedEmail = normalizeEmail(primaryEmail);

        // Normalize cc_emails for reseller and end_user
        const normalizeCcEmails = (emails: string | string[] | undefined): string[] | null => {
          if (!emails) return null;
          if (typeof emails === 'string') {
            if (isNotApplicable(emails)) return null;
            return emails
              .split(',')
              .map((e) => normalizeEmail(e.trim()))
              .filter(Boolean);
          }
          return emails.map((e) => normalizeEmail(e)).filter(Boolean);
        };

        const resellerCcEmails = normalizeCcEmails(row.reseller_cc_emails);
        const endUserCcEmails = normalizeCcEmails(row.end_user_cc_emails);
        const legacyCcEmails = normalizeCcEmails(row.cc_emails);

        // Check if customer exists (by primary_email)
        const { data: existing } = await supabase
          .from('customers')
          .select('id')
          .eq('primary_email', normalizedEmail)
          .maybeSingle();

        let customer;
        if (existing) {
          // Update existing customer
          const updateData: any = {
            // Legacy fields (for backward compatibility)
            company_name: row.end_user_company_name || row.company_name || null,
            contact_name: row.end_user_contact_name || row.contact_name || null,
            cc_emails: endUserCcEmails || legacyCcEmails,
            plan_name: row.edition || row.plan_name || null,
            renew_link: row.renew_link || null,
            // New fields
            distributor_name: isNotApplicable(row.distributor_name) ? null : (row.distributor_name || null),
            distributor_contact_name: isNotApplicable(row.distributor_contact_name) ? null : (row.distributor_contact_name || null),
            distributor_primary_email: isNotApplicable(row.distributor_primary_email) ? null : (row.distributor_primary_email ? normalizeEmail(row.distributor_primary_email) : null),
            reseller_name: isNotApplicable(row.reseller_name) ? null : (row.reseller_name || null),
            reseller_contact_name: isNotApplicable(row.reseller_contact_name) ? null : (row.reseller_contact_name || null),
            reseller_primary_email: isNotApplicable(row.reseller_primary_email) ? null : (row.reseller_primary_email ? normalizeEmail(row.reseller_primary_email) : null),
            reseller_cc_emails: resellerCcEmails,
            end_user_company_name: row.end_user_company_name || null,
            end_user_contact_name: row.end_user_contact_name || null,
            end_user_primary_email: row.end_user_primary_email ? normalizeEmail(row.end_user_primary_email) : null,
            end_user_cc_emails: endUserCcEmails,
            edition: row.edition || null,
            licensing: row.licensing || null,
            expires_on: expiresOn,
            paused: row.paused || false,
            primary_email: normalizedEmail, // Update primary_email if it changed
          };

          const { error: updateError } = await supabase
            .from('customers')
            .update(updateData)
            .eq('id', existing.id);

          if (updateError) {
            console.error('Failed to update customer:', normalizedEmail, updateError);
            continue;
          }

          // Fetch updated customer
          const { data: updatedCustomer, error: fetchError } = await supabase
            .from('customers')
            .select('id')
            .eq('id', existing.id)
            .single();

          if (fetchError || !updatedCustomer) {
            console.error('Failed to fetch updated customer:', normalizedEmail, fetchError);
            continue;
          }
          customer = updatedCustomer;
          updated++;
        } else {
          // Insert new customer
          const insertData: any = {
            // Legacy fields (for backward compatibility)
            company_name: row.end_user_company_name || row.company_name || null,
            contact_name: row.end_user_contact_name || row.contact_name || null,
            primary_email: normalizedEmail,
            cc_emails: endUserCcEmails || legacyCcEmails,
            plan_name: row.edition || row.plan_name || null,
            renew_link: row.renew_link || null,
            // New fields
            distributor_name: isNotApplicable(row.distributor_name) ? null : (row.distributor_name || null),
            distributor_contact_name: isNotApplicable(row.distributor_contact_name) ? null : (row.distributor_contact_name || null),
            distributor_primary_email: isNotApplicable(row.distributor_primary_email) ? null : (row.distributor_primary_email ? normalizeEmail(row.distributor_primary_email) : null),
            reseller_name: isNotApplicable(row.reseller_name) ? null : (row.reseller_name || null),
            reseller_contact_name: isNotApplicable(row.reseller_contact_name) ? null : (row.reseller_contact_name || null),
            reseller_primary_email: isNotApplicable(row.reseller_primary_email) ? null : (row.reseller_primary_email ? normalizeEmail(row.reseller_primary_email) : null),
            reseller_cc_emails: resellerCcEmails,
            end_user_company_name: row.end_user_company_name || null,
            end_user_contact_name: row.end_user_contact_name || null,
            end_user_primary_email: row.end_user_primary_email ? normalizeEmail(row.end_user_primary_email) : null,
            end_user_cc_emails: endUserCcEmails,
            edition: row.edition || null,
            licensing: row.licensing || null,
            expires_on: expiresOn,
            paused: row.paused || false,
          };

          const { data: insertedCustomer, error: insertError } = await supabase
            .from('customers')
            .insert(insertData)
            .select('id')
            .single();

          if (insertError || !insertedCustomer) {
            console.error('Failed to insert customer:', normalizedEmail, insertError);
            continue;
          }
          customer = insertedCustomer;
          inserted++;
        }

        // Recreate reminders
        const reminderCount = await recreateReminders(customer.id, expiresOn);
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

