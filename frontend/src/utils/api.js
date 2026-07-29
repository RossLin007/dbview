import { supabase } from '../supabaseClient';

/**
 * Helper to execute fetch requests automatically injecting Supabase JWT Bearer token into Authorization header
 */
export async function fetchWithAuth(url, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers = {
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(url, {
    ...options,
    headers,
  });
}
