// IoT types — Smart Driver & Vehicle Safety System
// These are NEW types. Do not modify existing types.ts in src/types/

export type AlertTier = 0 | 1 | 2 | 3;

export interface GpsData {
  latitude: number;
  longitude: number;
  speedKmh: number;
  satellites: number;
  fixed: boolean;
}

export interface DriverData {
  drowsyLevel: number;       // 0–4
  confidence: number;        // 0.0–1.0
  eyeStatus: 'open' | 'closed' | 'unknown';
  yawningStatus: 'normal' | 'yawning';
  earScore: number;
}

export interface VehicleData {
  distanceCm: number;
  ttcSeconds: number;
}

export interface SafetyDataLive {
  riskScore: number;         // 0.0–1.0
  alertTier: AlertTier;
  driver: DriverData;
  vehicle: VehicleData;
  gps: GpsData;
  timestampMs: number;
  sequenceNum: number;
}

export interface DeviceStatus {
  online: boolean;
  wifiRssi?: number;
  uptime_s?: number;
}

export interface DeviceSummary {
  device_id: string;
  label: string;
  registered_at: string;
  last_seen: string | null;
  online: boolean;
}

export interface DeviceRegistrationResponse {
  device_id: string;
  label: string;
  owner_user_id: string;
  registered_at: string;
  firebase_token: string;
}

export interface AlertEventPayload {
  device_id: string;
  alert_tier: AlertTier;
  risk_score: number;
  triggered_at: string;
  gps: {
    latitude: number;
    longitude: number;
    speed_kmh: number;
  };
  driver_data: {
    drowsy_level: number;
    confidence: number;
    eye_status: string;
    yawning_status: string;
  };
}

export interface AlertEvent {
  event_id: string;
  device_id: string;
  alert_tier: AlertTier;
  risk_score: number;
  triggered_at: string;
  gps: { latitude: number; longitude: number };
  driver_data?: {
    drowsy_level: number;
    confidence: number;
    eye_status: string;
    yawning_status: string;
  };
}

export interface AlertHistoryResponse {
  events: AlertEvent[];
  total: number;
  has_more: boolean;
}

export interface TripSummary {
  trip_id: string;
  device_id: string;
  started_at: string;
  ended_at?: string;
  duration_minutes?: number;
  total_alerts?: number;
  max_risk_score?: number;
  planning_session_id?: string | null;
}

// Pending alert to flush when offline
export interface QueuedAlert {
  payload: AlertEventPayload;
  queued_at: number;
}

// Alert tier color tokens
export const ALERT_TIER_COLORS: Record<AlertTier, string> = {
  0: '#27B987', // mint — normal
  1: '#F5A623', // amber — moderate
  2: '#E8441A', // orange-red — high
  3: '#CC0000', // red — critical
};

export const ALERT_TIER_LABELS: Record<AlertTier, string> = {
  0: 'Normal',
  1: 'Moderate Risk',
  2: 'High Risk',
  3: 'Critical Risk',
};

export function computeAlertTier(riskScore: number, drowsyLevel: number): AlertTier {
  if (riskScore >= 0.85 || drowsyLevel >= 4) return 3;
  if (riskScore >= 0.70 || drowsyLevel >= 3) return 2;
  if (riskScore >= 0.50 || drowsyLevel >= 2) return 1;
  return 0;
}
