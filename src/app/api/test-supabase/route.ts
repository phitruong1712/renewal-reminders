import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseServer';

export async function GET() {
  try {
    // Test 1: Check environment variables
    const hasUrl = !!process.env.SUPABASE_URL;
    const hasKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.SUPABASE_URL || 'NOT SET';
    
    if (!hasUrl || !hasKey) {
      return NextResponse.json({
        ok: false,
        error: 'Missing environment variables',
        hasUrl,
        hasKey,
      }, { status: 500 });
    }

    // Test 2: Try DNS resolution (basic check)
    let dnsCheck = 'Not tested';
    try {
      const url = new URL(supabaseUrl);
      dnsCheck = `Domain: ${url.hostname}`;
    } catch (e) {
      dnsCheck = `Invalid URL: ${supabaseUrl}`;
    }

    // Test 3: Try a simple query with detailed error
    let data: any = null;
    let error: any = null;
    let fetchError: any = null;

    try {
      const result = await supabase
        .from('customers')
        .select('id')
        .limit(1);
      data = result.data;
      error = result.error;
    } catch (e: any) {
      fetchError = {
        message: e.message,
        name: e.name,
        code: e.code,
        cause: e.cause?.message,
      };
    }

    if (fetchError) {
      return NextResponse.json({
        ok: false,
        error: 'Network/DNS error',
        details: {
          message: fetchError.message,
          type: fetchError.name,
          code: fetchError.code,
          cause: fetchError.cause,
          suggestion: 'Cannot resolve Supabase domain. Check: 1) Project is active, 2) URL is correct, 3) Network/DNS settings',
        },
        supabaseUrl,
        dnsCheck,
      }, { status: 500 });
    }

    if (error) {
      return NextResponse.json({
        ok: false,
        error: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        supabaseUrl,
        dnsCheck,
      }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: 'Supabase connection successful',
      dataCount: data?.length || 0,
      supabaseUrl,
      dnsCheck,
    });
  } catch (error: any) {
    console.error('Test error:', error);
    return NextResponse.json({
      ok: false,
      error: error.message || 'Unknown error',
      type: error.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    }, { status: 500 });
  }
}
