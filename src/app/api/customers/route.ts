import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/supabaseServer';
import dayjs from 'dayjs';

const customerSchema = z.object({
  company_name: z.string().min(1),
  contact_name: z.string().min(1),
  primary_email: z.string().email(),
  cc_emails: z.array(z.string().email()).optional().default([]),
  plan_name: z.string().min(1),
  renew_link: z.string().url(),
  expires_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = customerSchema.parse(body);

    const expiresDate = dayjs(data.expires_on);
    if (!expiresDate.isValid()) {
      return NextResponse.json(
        { error: 'Invalid expires_on date format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    const { data: customer, error } = await supabase
      .from('customers')
      .upsert(
        {
          company_name: data.company_name,
          contact_name: data.contact_name,
          primary_email: data.primary_email,
          cc_emails: data.cc_emails || [],
          plan_name: data.plan_name,
          renew_link: data.renew_link,
          expires_on: data.expires_on,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'primary_email',
        }
      )
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ customer }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { data: customers, error } = await supabase
      .from('customers')
      .select('*')
      .order('expires_on', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ customers });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

