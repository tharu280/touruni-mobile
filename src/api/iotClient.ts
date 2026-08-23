// IoT API client — extends the existing API pattern from client.ts
// Uses the same EXPO_PUBLIC_BACKEND_URL and Bearer token convention.

import { refreshAccessTokenOnce } from './authRefresh';
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

  const sendRequest = async (bearerToken: string) => {
    const headers = new Headers(options.headers as HeadersInit);
    headers.set('Authorization', `Bearer ${bearerToken}`);
    if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    return globalThis.fetch(`${BACKEND_URL}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });
  };

  let response = await sendRequest(token);
  if (response.status === 401) {
    // The session JWT is short-lived (15 min) and IoT flows (scan a QR, walk
    // to the vehicle, type a label) can easily outlast it — retry once with a
    // refreshed token instead of surfacing a raw "invalid or expired" error.
    const refreshedToken = await refreshAccessTokenOnce();
    if (refreshedToken) response = await sendRequest(refreshedToken);
  }

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

// Live-toggles Demo Mode on the real physical device (see the firmware's
// checkDemoModeCommand()/applyDemoModeOverride()) — the device polls
// /devices/{id}/commands/demoMode in Firebase RTDB roughly every telemetry
// cycle, so this takes a few seconds to visibly take effect, not instant.
export const setDemoMode = (token: string, deviceId: string, enabled: boolean) =>
  iotRequest<void>(`/devices/${encodeURIComponent(deviceId)}/demo-mode`, token, {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  });

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
  payload: { device_id: string; biometric_verified: boolean; planning_session_id?: string }
) =>
  iotRequest<{ trip_id: string; device_id: string; started_at: string; planning_session_id?: string | null }>(
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
