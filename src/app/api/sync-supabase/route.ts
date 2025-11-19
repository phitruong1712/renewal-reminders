import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseServer';
import * as fs from 'fs';
import * as path from 'path';
import { normalizeEmail, convertDateFormat, isNotApplicable } from '@/lib/helpers';

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

function parseCcEmails(val: string): string[] | null {
  if (!val || val.trim() === '') return null;
  let cleaned = val.trim();
  if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
    cleaned = cleaned.slice(1, -1);
  }
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1);
  }
  return cleaned
    .split(',')
    .map((e) => normalizeEmail(e.trim()))
    .filter(Boolean);
}

export async function POST(request: NextRequest) {
  try {
    const supabaseDir = path.join(process.cwd(), 'Supabase');
    const customersPath = path.join(supabaseDir, 'customers_rows.csv');

    if (!fs.existsSync(customersPath)) {
      return NextResponse.json(
        { error: 'customers_rows.csv not found in Supabase folder' },
        { status: 404 }
      );
    }

    // Read and parse CSV
    const content = fs.readFileSync(customersPath, 'utf-8');
    const lines = content.split('\n').filter((line) => line.trim());
    
    if (lines.length < 2) {
      return NextResponse.json({ error: 'No data in CSV' }, { status: 400 });
    }

    const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
    let inserted = 0;
    let updated = 0;
    let errors = 0;

    // Clear existing data
    await supabase.from('send_logs').delete().neq('id', 0);
    await supabase.from('reminders').delete().neq('id', 0);
    await supabase.from('customers').delete().neq('id', 0);

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const values = parseCSVLine(line);
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });

        if (!row.primary_email || row.primary_email.trim() === '') {
          continue;
        }

        const normalizedEmail = normalizeEmail(row.primary_email);

        const customerData: any = {
          company_name: row.end_user_company_name || row.company_name || null,
          contact_name: row.end_user_contact_name || row.contact_name || null,
          primary_email: normalizedEmail,
          cc_emails: parseCcEmails(row.end_user_cc_emails || row.cc_emails || ''),
          plan_name: row.edition || row.plan_name || null,
          renew_link: row.renew_link || null,
          distributor_name: isNotApplicable(row.distributor_name) ? null : (row.distributor_name || null),
          distributor_contact_name: isNotApplicable(row.distributor_contact_name) ? null : (row.distributor_contact_name || null),
          distributor_primary_email: isNotApplicable(row.distributor_primary_email) ? null : (row.distributor_primary_email ? normalizeEmail(row.distributor_primary_email) : null),
          reseller_name: isNotApplicable(row.reseller_name) ? null : (row.reseller_name || null),
          reseller_contact_name: isNotApplicable(row.reseller_contact_name) ? null : (row.reseller_contact_name || null),
          reseller_primary_email: isNotApplicable(row.reseller_primary_email) ? null : (row.reseller_primary_email ? normalizeEmail(row.reseller_primary_email) : null),
          reseller_cc_emails: parseCcEmails(row.reseller_cc_emails || ''),
          end_user_company_name: row.end_user_company_name || null,
          end_user_contact_name: row.end_user_contact_name || null,
          end_user_primary_email: row.end_user_primary_email ? normalizeEmail(row.end_user_primary_email) : null,
          end_user_cc_emails: parseCcEmails(row.end_user_cc_emails || ''),
          edition: row.edition || null,
          licensing: row.licensing || null,
          expires_on: row.expires_on ? convertDateFormat(row.expires_on) : null,
          paused: row.paused === 'true' || row.paused === '1' || row.paused === 't' || false,
        };

        // Check if exists
        const { data: existing } = await supabase
          .from('customers')
          .select('id')
          .eq('primary_email', normalizedEmail)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from('customers')
            .update(customerData)
            .eq('id', existing.id);
          if (error) throw error;
          updated++;
        } else {
          const { error } = await supabase
            .from('customers')
            .insert(customerData);
          if (error) throw error;
          inserted++;
        }
      } catch (error: any) {
        console.error(`Row ${i + 1} error:`, error.message);
        errors++;
      }
    }

    return NextResponse.json({
      ok: true,
      inserted,
      updated,
      errors,
      message: `Synced ${inserted + updated} customers from Supabase CSV`,
    });
  } catch (error: any) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync from Supabase CSV' },
      { status: 500 }
    );
  }
}

