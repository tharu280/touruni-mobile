// Admin IoT fleet-management types — mirrors backend/clean_run/iot/admin_iot_router.py's
// Pydantic response models 1:1. Kept separate from types/iot.ts since these shapes only
// ever come from the /admin/iot/* endpoints, never from the per-user IoT flow.

import type { AlertTier } from './iot';

export interface AdminDeviceSummary {
  device_id: string;
  label: string;
  registered: boolean;
  owner_user_id: string | null;
  owner_name: string | null;
  registered_at: string | null;
  last_seen: string | null;
  created_at: string;
}

export interface AdminDeviceListResponse {
  devices: AdminDeviceSummary[];
  total: number;
}

export interface AdminProvisionDeviceResponse {
  device_id: string;
  label: string;
  registration_secret: string;
  device_secret: string;
  qr_payload: string;
  created_at: string;
}

export interface AdminAlertEvent {
  event_id: string;
  device_id: string;
  device_label: string | null;
  owner_name: string | null;
  alert_tier: AlertTier;
  risk_score: number;
  triggered_at: string;
  gps: { latitude: number; longitude: number; speed_kmh: number };
  driver_data: {
    drowsy_level: number;
    confidence: number;
    eye_status: string;
    yawning_status: string;
  };
}

export interface AdminAlertListResponse {
  events: AdminAlertEvent[];
  total: number;
  has_more: boolean;
}

export interface AdminTripRecord {
  trip_id: string;
  device_id: string;
  device_label: string | null;
  owner_name: string | null;
  started_at: string;
  ended_at: string | null;
  status: string;
  duration_minutes: number | null;
  total_alerts: number;
  max_risk_score: number | null;
}

export interface AdminTripListResponse {
  trips: AdminTripRecord[];
  total: number;
  has_more: boolean;
}

export interface AdminDeviceLiveLocation {
  latitude: number;
  longitude: number;
  speed_kmh: number;
  alert_tier: AlertTier;
  risk_score: number;
  timestamp_ms: number;
}

export interface AdminDeviceLocation {
  device_id: string;
  label: string;
  owner_name: string | null;
  online: boolean;
  last_seen: string | null;
  live: AdminDeviceLiveLocation | null;
}

export interface AdminLocationsResponse {
  devices: AdminDeviceLocation[];
}
