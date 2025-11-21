import { createClient } from '@supabase/supabase-js';
import { postgres } from './postgresClient';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Check if we should use local database
const useLocalDb = process.env.USE_LOCAL_DB === 'true';

let supabaseClient: any;

if (useLocalDb) {
  console.log('Using local PostgreSQL database (simulating Supabase client)');
  // Use the local postgres client which mimics Supabase interface
  supabaseClient = postgres;
} else {
  // Use real Supabase client
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseServiceKey,
    });
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  // Create Supabase client with better error handling and fetch options
  supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: (url, options = {}) => {
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

export const supabase = supabaseClient;

