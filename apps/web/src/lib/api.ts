import { getApiUrl } from '@/config/api';
const API_URL = getApiUrl();

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  return fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}
