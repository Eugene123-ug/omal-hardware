import { saveOfflineSale, getPendingOfflineSales, markOfflineSalesSynced } from '../db/offlineDb';

const API_BASE = '/api';

export function getToken() {
  return localStorage.getItem('omal_pos_token');
}

export function setToken(token) {
  if (token) {
    localStorage.setItem('omal_pos_token', token);
  } else {
    localStorage.removeItem('omal_pos_token');
  }
}

export async function apiRequest(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers
  };

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    if (response.status === 401) {
      // Token expired
      localStorage.removeItem('omal_pos_token');
      localStorage.removeItem('omal_pos_user');
      window.dispatchEvent(new Event('auth_expired'));
      throw new Error('Session expired. Please log in again.');
    }

    const data = await response.json();

    if (!response.ok) {
      const errMsg = (data && data.error && (data.error.message || data.error.type)) || data.message || 'Server request failed';
      const err = new Error(errMsg);
      err.response = data;
      err.status = response.status;
      throw err;
    }

    if (data && typeof data === 'object' && 'data' in data && data.success) {
      const result = data.data;
      if (data.pagination && result && typeof result === 'object') {
        result.pagination = data.pagination;
      }
      return result;
    }

    return data;
  } catch (err) {
    // If network error (offline), re-throw network error
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      err.isOffline = true;
    }
    throw err;
  }
}

// Sync pending offline sales to server
export async function syncOfflineSalesToServer() {
  const pending = await getPendingOfflineSales();
  if (pending.length === 0) return { syncedCount: 0 };

  try {
    const response = await apiRequest('/sales/sync-offline', {
      method: 'POST',
      body: JSON.stringify({ sales: pending })
    });

    if (response.success) {
      const syncedIds = pending.map(p => p.offline_client_id);
      await markOfflineSalesSynced(syncedIds);
      return { syncedCount: syncedIds.length, results: response.results };
    }
  } catch (err) {
    console.warn('[Sync] Offline sync failed, will retry when network stabilizes:', err);
    throw err;
  }
}
