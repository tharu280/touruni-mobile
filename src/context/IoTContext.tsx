import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Vibration } from 'react-native';
import { useAppSession } from './AppSessionContext';
import { listDevices, getFirebaseToken, logAlertEvent } from '../api/iotClient';
import { useFirebaseDevice } from '../hooks/useFirebaseDevice';
import { useAlertAudio } from '../hooks/useAlertAudio';
import { vibrateForTier } from '../utils/alertVibration';
import type {
  AlertEvent,
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
  /**
   * A Firebase token good for reading every device this user owns (any one
   * device's /devices/{id}/firebase-token call returns a user-scoped token,
   * not a device-scoped one — see firebase_admin_service.py). Fetched as
   * soon as the device list loads, independent of which device is active,
   * so the device LIST screen can show real per-device online status via
   * useDevicesOnlineStatus() without waiting for a device to be opened.
   */
  listFirebaseToken: string | null;

  // Active device
  activeDeviceId: string | null;
  setActiveDevice: (deviceId: string | null) => void;

  // Live Firebase data
  liveData: SafetyDataLive | null;
  deviceOnline: boolean;
  /** Age of the newest reading in ms — null before the first packet arrives. */
  dataAgeMs: number | null;
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

  // List-level Firebase token — independent of activeDeviceId, see
  // listFirebaseToken's doc comment on IoTContextValue.
  const [listFirebaseToken, setListFirebaseToken] = useState<string | null>(null);
  const listTokenExpiryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const { liveData, deviceOnline, dataAgeMs, firebaseConnected, error: firebaseError } =
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

  // ── List-level Firebase token — fetched once the list is non-empty ─────────
  // Any one owned device's /firebase-token response covers every device the
  // user owns (see the doc comment above), so this doesn't need to run per
  // device — just once, using whichever device happens to be first.

  const fetchListToken = useCallback(
    async (seedDeviceId: string) => {
      if (!accessToken) return;
      try {
        const res = await getFirebaseToken(accessToken, seedDeviceId);
        setListFirebaseToken(res.firebase_token);

        if (listTokenExpiryRef.current) clearTimeout(listTokenExpiryRef.current);
        const refreshInMs = (res.expires_in - 300) * 1000;
        listTokenExpiryRef.current = setTimeout(() => {
          fetchListToken(seedDeviceId);
        }, Math.max(refreshInMs, 10_000));
      } catch {
        setListFirebaseToken(null);
      }
    },
    [accessToken]
  );

  useEffect(() => {
    if (devices.length > 0 && !listFirebaseToken) {
      fetchListToken(devices[0].device_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices, listFirebaseToken]);

  useEffect(() => {
    return () => {
      if (listTokenExpiryRef.current) clearTimeout(listTokenExpiryRef.current);
    };
  }, []);

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

    const { alertTier, riskScore, gps } = liveData;
    const previousTier = lastAlertTierRef.current;

    // New alert: tier increased into 1+
    if (alertTier > 0 && alertTier > previousTier) {
      // Speak voice prompt (Tier 2+)
      speakIfNeeded(alertTier as AlertTier);
      vibrateForTier(alertTier as AlertTier);

      const newAlert: AlertEvent = {
        event_id: `local-${liveData.timestampMs}-${alertTier}`,
        device_id: activeDeviceId,
        alert_tier: alertTier as AlertTier,
        risk_score: riskScore,
        triggered_at: new Date(liveData.timestampMs).toISOString(),
        gps: { latitude: gps.latitude, longitude: gps.longitude },
      };
      setRecentAlerts((prev) => [newAlert, ...prev].slice(0, 20));

      // Durable persistence used to be the BACKEND's job: /iot/telemetry
      // wrote an alert event server-side on every tier increase, so posting
      // from here too produced two rows per alert. Now that the Main Hub
      // writes telemetry directly to Firebase RTDB and no longer calls
      // /iot/telemetry at all, nothing else logs this — so this IS the only
      // place an alert event gets persisted. Best-effort: a missed POST here
      // (app backgrounded, no network) just means one gap in history, not a
      // crash — the live tier/TTS/dashboard experience doesn't depend on it.
      logAlertEvent(accessToken, {
        device_id: activeDeviceId,
        alert_tier: alertTier as AlertTier,
        risk_score: riskScore,
        triggered_at: new Date(liveData.timestampMs).toISOString(),
        gps: { latitude: gps.latitude, longitude: gps.longitude, speed_kmh: gps.speedKmh },
        driver_data: {
          drowsy_level: liveData.driver.drowsyLevel,
          confidence: liveData.driver.confidence,
          eye_status: liveData.driver.eyeStatus,
          yawning_status: liveData.driver.yawningStatus,
        },
      }).catch(() => {
        // Non-fatal — see comment above.
      });
    } else if (previousTier === 3 && alertTier < 3) {
      // Tier 3's pattern uses repeat:true and never stops on its own.
      Vibration.cancel();
    }

    lastAlertTierRef.current = alertTier as AlertTier;
  }, [liveData?.alertTier, liveData?.timestampMs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stop any in-progress repeat:true vibration if the provider unmounts
  // mid-alert (app close, navigation reset) rather than a normal tier drop.
  useEffect(() => {
    return () => {
      Vibration.cancel();
    };
  }, []);

  // ── Context value ──────────────────────────────────────────────────────────

  const value = useMemo<IoTContextValue>(
    () => ({
      devices,
      devicesLoading,
      refreshDevices,
      listFirebaseToken,
      activeDeviceId,
      setActiveDevice,
      liveData,
      deviceOnline,
      dataAgeMs,
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
      listFirebaseToken,
      activeDeviceId,
      setActiveDevice,
      liveData,
      deviceOnline,
      dataAgeMs,
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
