import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAppSession } from './AppSessionContext';
import {
  listDevices,
  getFirebaseToken,
  logAlertEvent,
} from '../api/iotClient';
import { useFirebaseDevice } from '../hooks/useFirebaseDevice';
import { useAlertAudio } from '../hooks/useAlertAudio';
import type {
  AlertEvent,
  AlertEventPayload,
  AlertTier,
  DeviceSummary,
  SafetyDataLive,
} from '../types/iot';

// ── Context value type ────────────────────────────────────────────────────────

interface IoTContextValue {
  // Device list
  devices: DeviceSummary[];
  devicesLoading: boolean;
  refreshDevices: () => Promise<void>;

  // Active device
  activeDeviceId: string | null;
  setActiveDevice: (deviceId: string | null) => void;

  // Live Firebase data
  liveData: SafetyDataLive | null;
  deviceOnline: boolean;
  firebaseConnected: boolean;
  firebaseError: string | null;

  // Trip session
  activeTripId: string | null;
  setActiveTripId: (tripId: string | null) => void;

  // Recent alerts (in-memory, last 20)
  recentAlerts: AlertEvent[];
}

const IoTContext = createContext<IoTContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export const IoTProvider = ({ children }: { children: React.ReactNode }) => {
  const { accessToken } = useAppSession();

  // Device list
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);

  // Active device + Firebase token for it
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [firebaseToken, setFirebaseToken] = useState<string | null>(null);
  const tokenExpiryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Trip
  const [activeTripId, setActiveTripId] = useState<string | null>(null);

  // Recent alerts
  const [recentAlerts, setRecentAlerts] = useState<AlertEvent[]>([]);

  // Alert audio
  const { speakIfNeeded } = useAlertAudio();

  // Firebase listener (driven by activeDeviceId + firebaseToken)
  const { liveData, deviceOnline, firebaseConnected, error: firebaseError } =
    useFirebaseDevice(activeDeviceId, firebaseToken);

  // ── Load devices ───────────────────────────────────────────────────────────

  const refreshDevices = useCallback(async () => {
    if (!accessToken) return;
    setDevicesLoading(true);
    try {
      const res = await listDevices(accessToken);
      setDevices(res.devices);
    } catch {
      // non-fatal: keep stale list
    } finally {
      setDevicesLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (accessToken) refreshDevices();
  }, [accessToken, refreshDevices]);

  // ── Set active device → fetch Firebase token ───────────────────────────────

  const fetchAndStoreToken = useCallback(
    async (deviceId: string) => {
      if (!accessToken) return;
      try {
        const res = await getFirebaseToken(accessToken, deviceId);
        setFirebaseToken(res.firebase_token);

        // Schedule token refresh 5 minutes before expiry
        if (tokenExpiryRef.current) clearTimeout(tokenExpiryRef.current);
        const refreshInMs = (res.expires_in - 300) * 1000;
        tokenExpiryRef.current = setTimeout(() => {
          fetchAndStoreToken(deviceId);
        }, Math.max(refreshInMs, 10_000));
      } catch {
        setFirebaseToken(null);
      }
    },
    [accessToken]
  );

  const setActiveDevice = useCallback(
    (deviceId: string | null) => {
      setActiveDeviceId(deviceId);
      setFirebaseToken(null);
      setActiveTripId(null);
      if (tokenExpiryRef.current) clearTimeout(tokenExpiryRef.current);
      if (deviceId) fetchAndStoreToken(deviceId);
    },
    [fetchAndStoreToken]
  );

  // Cleanup token refresh timer on unmount
  useEffect(() => {
    return () => {
      if (tokenExpiryRef.current) clearTimeout(tokenExpiryRef.current);
    };
  }, []);

  // ── Alert detection — watch liveData for tier transitions ──────────────────

  const lastAlertTierRef = useRef<AlertTier>(0);

  useEffect(() => {
    if (!liveData || !activeDeviceId || !accessToken) return;

    const { alertTier, riskScore, gps, driver } = liveData;

    // New alert: tier increased into 1+
    if (alertTier > 0 && alertTier > lastAlertTierRef.current) {
      // Speak voice prompt (Tier 2+)
      speakIfNeeded(alertTier as AlertTier);

      // Log to backend (fire-and-forget — don't await to avoid blocking render)
      const payload: AlertEventPayload = {
        device_id: activeDeviceId,
        alert_tier: alertTier as AlertTier,
        risk_score: riskScore,
        triggered_at: new Date(liveData.timestampMs).toISOString(),
        gps: {
          latitude: gps.latitude,
          longitude: gps.longitude,
          speed_kmh: gps.speedKmh,
        },
        driver_data: {
          drowsy_level: driver.drowsyLevel,
          confidence: driver.confidence,
          eye_status: driver.eyeStatus,
          yawning_status: driver.yawningStatus,
        },
      };

      logAlertEvent(accessToken, payload)
        .then((res) => {
          // Prepend to recent alerts list (keep last 20)
          const newAlert: AlertEvent = {
            event_id: res.event_id,
            device_id: activeDeviceId,
            alert_tier: alertTier as AlertTier,
            risk_score: riskScore,
            triggered_at: payload.triggered_at,
            gps: { latitude: gps.latitude, longitude: gps.longitude },
          };
          setRecentAlerts((prev) => [newAlert, ...prev].slice(0, 20));
        })
        .catch(() => {
          // TODO: queue for offline flush (see plan Section 16)
        });
    }

    lastAlertTierRef.current = alertTier as AlertTier;
  }, [liveData?.alertTier, liveData?.timestampMs]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Context value ──────────────────────────────────────────────────────────

  const value = useMemo<IoTContextValue>(
    () => ({
      devices,
      devicesLoading,
      refreshDevices,
      activeDeviceId,
      setActiveDevice,
      liveData,
      deviceOnline,
      firebaseConnected,
      firebaseError,
      activeTripId,
      setActiveTripId,
      recentAlerts,
    }),
    [
      devices,
      devicesLoading,
      refreshDevices,
      activeDeviceId,
      setActiveDevice,
      liveData,
      deviceOnline,
      firebaseConnected,
      firebaseError,
      activeTripId,
      recentAlerts,
    ]
  );

  return <IoTContext.Provider value={value}>{children}</IoTContext.Provider>;
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export const useIoT = (): IoTContextValue => {
  const ctx = useContext(IoTContext);
  if (!ctx) throw new Error('useIoT must be used inside <IoTProvider>');
  return ctx;
};
