import { getToken } from '../authClient';

/**
 * Helper to execute fetch requests automatically injecting local JWT Bearer token into Authorization header
 */
export async function fetchWithAuth(url, options = {}) {
  const token = getToken();

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
