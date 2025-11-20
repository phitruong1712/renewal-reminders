import { postgres } from './postgresClient';
import { createClient } from '@supabase/supabase-js';

// Use local PostgreSQL if DATABASE_HOST is set, otherwise use Supabase
const useLocalPostgres = !!(
  process.env.DATABASE_HOST ||
  process.env.POSTGRES_HOST ||
  process.env.USE_LOCAL_DB === 'true'
);

let supabaseInstance: any;

if (useLocalPostgres) {
  // Use local PostgreSQL adapter
  console.log('Using local PostgreSQL database');
  
  // Create a Supabase-compatible interface
  supabaseInstance = {
    from: (table: string) => postgres.from(table),
  };
} else {
  // Use Supabase client
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseServiceKey,
    });
    console.warn('To use local PostgreSQL, set DATABASE_HOST or USE_LOCAL_DB=true');
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  // Create Supabase client with better error handling and fetch options
  supabaseInstance = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: (url: string | URL | Request, options: RequestInit = {}) => {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        return fetch(url, {
          ...options,
          signal: controller.signal,
        })
          .then((response) => {
            clearTimeout(timeoutId);
            return response;
          })
          .catch((error) => {
            clearTimeout(timeoutId);
            console.error('Supabase fetch error:', {
              url: typeof url === 'string' ? url : url.toString(),
              error: error.message,
              type: error.name,
              code: (error as any).code,
            });
            throw error;
          });
      },
    },
  });
}

export const supabase = supabaseInstance;

