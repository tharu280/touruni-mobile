// Admin fleet-wide IoT API client — mirrors iotClient.ts's iotRequest() shape
// (Bearer auth, JSON handling, 204-as-undefined) but WITHOUT the 401-retry:
// admin tokens aren't part of the user session refresh flow (/admin/login
// issues a bare 12h JWT with no refresh endpoint to pair with), so a 401/403
// here means "log in again", not "silently retry."

import type {
  AdminAlertListResponse,
  AdminDeviceListResponse,
  AdminLocationsResponse,
  AdminProvisionDeviceResponse,
  AdminTripListResponse,
} from '../types/adminIot';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export class AdminAuthError extends Error {}

async function adminRequest<T>(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  if (!BACKEND_URL) throw new Error('EXPO_PUBLIC_BACKEND_URL is not configured.');

  const headers = new Headers(options.headers as HeadersInit);
  headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await globalThis.fetch(`${BACKEND_URL}${path}`, { ...options, headers });

  if (response.status === 401 || response.status === 403) {
    const payload = await response.json().catch(() => ({})) as { detail?: string };
    throw new AdminAuthError(payload.detail ?? 'Admin session expired.');
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { detail?: string };
    throw new Error(payload.detail ?? `HTTP ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function toQuery(params: Record<string, string | number | boolean | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined);
  if (!entries.length) return '';
  return '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
}

// ── Device provisioning & management ────────────────────────────────────────

export const adminProvisionDevice = (
  token: string,
  payload: { label: string; mac_address?: string }
) =>
  adminRequest<AdminProvisionDeviceResponse>('/admin/iot/devices', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const adminListDevices = (
  token: string,
  opts: { skip?: number; limit?: number; registered?: boolean } = {}
) =>
  adminRequest<AdminDeviceListResponse>(
    `/admin/iot/devices${toQuery(opts)}`,
    token
  );

export const adminUnclaimDevice = (token: string, deviceId: string) =>
  adminRequest<void>(`/admin/iot/devices/${encodeURIComponent(deviceId)}/unclaim`, token, {
    method: 'POST',
  });

// ── Alerts ───────────────────────────────────────────────────────────────────

export const adminListAlerts = (
  token: string,
  opts: { limit?: number; offset?: number; device_id?: string; min_tier?: number } = {}
) =>
  adminRequest<AdminAlertListResponse>(`/admin/iot/alerts${toQuery(opts)}`, token);

// ── Trip records ─────────────────────────────────────────────────────────────

export const adminListTrips = (
  token: string,
  opts: { limit?: number; offset?: number; status?: string } = {}
) =>
  adminRequest<AdminTripListResponse>(`/admin/iot/trips${toQuery(opts)}`, token);

// ── Locations ─────────────────────────────────────────────────────────────────

export const adminListLocations = (token: string) =>
  adminRequest<AdminLocationsResponse>('/admin/iot/locations', token);
