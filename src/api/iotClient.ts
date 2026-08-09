// IoT API client — extends the existing API pattern from client.ts
// Uses the same EXPO_PUBLIC_BACKEND_URL and Bearer token convention.
// This file is NEW — do not modify client.ts.

import type {
  AlertEventPayload,
  AlertHistoryResponse,
  DeviceRegistrationResponse,
  DeviceSummary,
  TripSummary,
} from '../types/iot';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

async function iotRequest<T>(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  if (!BACKEND_URL) throw new Error('EXPO_PUBLIC_BACKEND_URL is not configured.');

  const headers = new Headers(options.headers as HeadersInit);
  headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await globalThis.fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { detail?: string };
    throw new Error(payload.detail ?? `HTTP ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

// ── Device management ────────────────────────────────────────────────────────

export const listDevices = (token: string) =>
  iotRequest<{ devices: DeviceSummary[] }>('/devices', token);

export const registerDevice = (
  token: string,
  payload: { device_id: string; label: string; registration_secret: string }
) =>
  iotRequest<DeviceRegistrationResponse>('/devices/register', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const deleteDevice = (token: string, deviceId: string) =>
  iotRequest<void>(`/devices/${encodeURIComponent(deviceId)}`, token, { method: 'DELETE' });

export const getFirebaseToken = (token: string, deviceId: string) =>
  iotRequest<{ firebase_token: string; expires_in: number }>(
    `/devices/${encodeURIComponent(deviceId)}/firebase-token`,
    token
  );

// ── Alert events ─────────────────────────────────────────────────────────────

export const logAlertEvent = (token: string, payload: AlertEventPayload) =>
  iotRequest<{ event_id: string; owner_notified: boolean }>(
    '/iot/alert-events',
    token,
    { method: 'POST', body: JSON.stringify(payload) }
  );

export const getAlertHistory = (
  token: string,
  deviceId: string,
  limit = 50,
  offset = 0
) =>
  iotRequest<AlertHistoryResponse>(
    `/iot/alert-events?device_id=${encodeURIComponent(deviceId)}&limit=${limit}&offset=${offset}`,
    token
  );

// ── Trip sessions ─────────────────────────────────────────────────────────────

export const startTrip = (
  token: string,
  payload: { device_id: string; biometric_verified: boolean }
) =>
  iotRequest<{ trip_id: string; device_id: string; started_at: string }>(
    '/iot/trips/start',
    token,
    { method: 'POST', body: JSON.stringify(payload) }
  );

export const endTrip = (token: string, tripId: string) =>
  iotRequest<TripSummary>(
    `/iot/trips/${encodeURIComponent(tripId)}/end`,
    token,
    { method: 'POST' }
  );

// ── Push notifications ────────────────────────────────────────────────────────

export const registerFCMToken = (
  token: string,
  fcmToken: string,
  platform: 'ios' | 'android' = 'ios'
) =>
  iotRequest<{ registered: boolean }>('/notifications/register', token, {
    method: 'POST',
    body: JSON.stringify({ fcm_token: fcmToken, platform }),
  });
