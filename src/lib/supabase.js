import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Custom fetch interceptor: injects the stored session token as a request header
// on every Supabase HTTP call. RLS policies read this header via
// current_setting('request.headers')::jsonb->>'x-user-token'
// This activates all RLS policies without changing any existing query.
const supabaseFetch = (url, options = {}) => {
  const token = localStorage.getItem('diaa-store_token') || '';
  if (token) {
    options.headers = {
      ...options.headers,
      'x-user-token': token,
    };
  }
  return fetch(url, options);
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: supabaseFetch,
  },
});
