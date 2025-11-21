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
    // Check Supabase client
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase client not initialized. Check environment variables.' },
        { status: 500 }
      );
    }

    // Try multiple possible paths
    const possiblePaths = [
      path.join(process.cwd(), 'Supabase', 'customers_rows.csv'),
      path.join(process.cwd(), '..', 'Supabase', 'customers_rows.csv'),
      path.resolve(process.cwd(), 'Supabase', 'customers_rows.csv'),
    ];

    let customersPath: string | null = null;
    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        customersPath = testPath;
        break;
      }
    }

    if (!customersPath) {
      console.error('CSV file not found. Tried paths:', possiblePaths);
      console.error('Current working directory:', process.cwd());
      return NextResponse.json(
        {
          error: 'customers_rows.csv not found in Supabase folder',
          triedPaths: possiblePaths,
          cwd: process.cwd()
        },
        { status: 404 }
      );
    }

    console.log('Reading CSV from:', customersPath);

    // Read and parse CSV
    let content: string;
    try {
      content = fs.readFileSync(customersPath, 'utf-8');
    } catch (readError: any) {
      console.error('Failed to read CSV file:', readError);
      return NextResponse.json(
        { error: `Failed to read CSV file: ${readError.message}` },
        { status: 500 }
      );
    }

    const lines = content.split('\n').filter((line) => line.trim());

    if (lines.length < 2) {
      return NextResponse.json({ error: 'No data in CSV' }, { status: 400 });
    }

    const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
    console.log(`Found ${lines.length - 1} rows to process`);

    let inserted = 0;
    let updated = 0;
    let errors = 0;

    // Test Supabase connection first with better error handling
    let testError: any = null;
    try {
      const { error, data } = await supabase.from('customers').select('id').limit(1);
      testError = error;
      if (error) {
        console.error('Supabase connection error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
      } else {
        console.log('Supabase connection successful');
      }
    } catch (fetchError: any) {
      console.error('Supabase fetch failed:', {
        message: fetchError.message,
        name: fetchError.name,
        cause: fetchError.cause,
      });
      return NextResponse.json(
        {
          error: `Supabase connection failed: ${fetchError.message || 'Network error'}`,
          details: process.env.NODE_ENV === 'development' ? {
            type: fetchError.name,
            message: fetchError.message,
          } : undefined,
        },
        { status: 500 }
      );
    }

    if (testError) {
      return NextResponse.json(
        {
          error: `Supabase connection failed: ${testError.message}`,
          details: testError.details || testError.hint,
        },
        { status: 500 }
      );
    }

    // Clear existing data
    console.log('Clearing existing data...');
    await supabase.from('send_logs').delete().neq('id', 0);
    await supabase.from('reminders').delete().neq('id', 0);
    await supabase.from('customers').delete().neq('id', 0);
    console.log('Existing data cleared');

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

        // Check if exists (by end_user_primary_email)
        const { data: existing } = await supabase
          .from('customers')
          .select('id')
          .eq('end_user_primary_email', row.end_user_primary_email ? normalizeEmail(row.end_user_primary_email) : normalizedEmail) // Fallback to normalizedEmail if end_user not present, but ideally should be present
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from('customers')
            .update(customerData)
            .eq('id', existing.id);
          if (error) {
            console.error(`Update error for row ${i + 1}:`, error);
            throw error;
          }
          updated++;
        } else {
          const { error } = await supabase
            .from('customers')
            .insert(customerData);
          if (error) {
            console.error(`Insert error for row ${i + 1}:`, error);
            throw error;
          }
          inserted++;
        }
      } catch (error: any) {
        console.error(`Row ${i + 1} error:`, error.message || error);
        errors++;
        // Continue processing other rows
      }
    }

    console.log(`Import complete: ${inserted} inserted, ${updated} updated, ${errors} errors`);

    return NextResponse.json({
      ok: true,
      inserted,
      updated,
      errors,
      message: `Synced ${inserted + updated} customers from Supabase CSV`,
    });
  } catch (error: any) {
    console.error('Sync error:', error);
    const errorMessage = error?.message || error?.toString() || 'Failed to sync from Supabase CSV';
    const errorStack = error?.stack;

    return NextResponse.json(
      {
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    );
  }
}

