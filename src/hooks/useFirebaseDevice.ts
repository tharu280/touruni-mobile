import { useEffect, useRef, useState } from 'react';
import { ref, onValue, off, DatabaseReference } from 'firebase/database';
import { signInWithCustomToken } from 'firebase/auth';
import { rtdb, firebaseAuth } from '../firebase/firebaseConfig';
import type { SafetyDataLive, DeviceStatus } from '../types/iot';

/**
 * How long a live reading stays trustworthy.
 *
 * The ESP32 uplinks over 4G to the backend, which relays to RTDB — it holds no
 * Firebase connection of its own, so RTDB's onDisconnect() is unavailable and
 * `status/online` can only ever be written true. Left alone it latches on
 * forever and a dead device looks healthy. Freshness of the data itself is the
 * only honest signal available. Five telemetry cycles (3s each) of silence is a
 * real outage rather than one dropped packet.
 */
const STALE_AFTER_MS = 15_000;
const STALENESS_POLL_MS = 3_000;

export interface FirebaseDeviceState {
  liveData: SafetyDataLive | null;
  /** Backend has seen the device AND its newest reading is under 15s old. */
  deviceOnline: boolean;
  /** Age of the newest reading in ms, or null if none has arrived yet. */
  dataAgeMs: number | null;
  firebaseConnected: boolean;
  error: string | null;
}

/**
 * Attaches Firebase RTDB listeners for a specific device.
 * Requires a Firebase Custom Token issued by the backend.
 * Handles: sign-in, connection state, cleanup on unmount/device change.
 */
export function useFirebaseDevice(
  deviceId: string | null,
  firebaseToken: string | null
): FirebaseDeviceState {
  const [liveData, setLiveData] = useState<SafetyDataLive | null>(null);
  const [statusOnline, setStatusOnline] = useState(false);
  // Re-render on a timer so staleness is re-evaluated even when no new data
  // arrives — which is precisely the case we are trying to detect.
  const [now, setNow] = useState(() => Date.now());
  const [firebaseConnected, setFirebaseConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const liveRef = useRef<DatabaseReference | null>(null);
  const statusRef = useRef<DatabaseReference | null>(null);
  const connRef = useRef<DatabaseReference | null>(null);

  // Detach all listeners
  const detach = () => {
    if (liveRef.current) { off(liveRef.current); liveRef.current = null; }
    if (statusRef.current) { off(statusRef.current); statusRef.current = null; }
    if (connRef.current) { off(connRef.current); connRef.current = null; }
  };

  useEffect(() => {
    if (!deviceId || !firebaseToken) {
      detach();
      setLiveData(null);
      setStatusOnline(false);
      return;
    }

    if (!rtdb || !firebaseAuth) {
      setError('Firebase is not configured.');
      return;
    }

    const db = rtdb;
    const auth = firebaseAuth;

    let cancelled = false;

    const attach = async () => {
      try {
        // Authenticate with Firebase using the short-lived custom token
        await signInWithCustomToken(auth, firebaseToken);

        if (cancelled) return;

        // ── Listener 1: live safety data ──────────────────────────────────
        const live = ref(db, `/devices/${deviceId}/safetyData/live`);
        liveRef.current = live;
        onValue(live, (snapshot) => {
          if (cancelled) return;
          const data = snapshot.val() as SafetyDataLive | null;
          setLiveData(data);
          setError(null);
        }, (err) => {
          if (!cancelled) setError(err.message);
        });

        // ── Listener 2: device online status ──────────────────────────────
        const status = ref(db, `/devices/${deviceId}/status/online`);
        statusRef.current = status;
        onValue(status, (snapshot) => {
          if (!cancelled) setStatusOnline(snapshot.val() === true);
        });

        // ── Listener 3: Firebase connection state ──────────────────────────
        const conn = ref(db, '.info/connected');
        connRef.current = conn;
        onValue(conn, (snapshot) => {
          if (!cancelled) setFirebaseConnected(snapshot.val() === true);
        });

      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Firebase authentication failed.');
        }
      }
    };

    attach();

    return () => {
      cancelled = true;
      detach();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, firebaseToken]);

  // Tick only while a device is selected — no timer running on other screens.
  useEffect(() => {
    if (!deviceId) return;
    const id = setInterval(() => setNow(Date.now()), STALENESS_POLL_MS);
    return () => clearInterval(id);
  }, [deviceId]);

  // Online means: the backend has seen this device, AND the newest reading is
  // recent enough to still describe the vehicle. Both have to hold.
  const dataAgeMs = liveData ? now - liveData.timestampMs : null;
  const deviceOnline =
    statusOnline && dataAgeMs !== null && dataAgeMs < STALE_AFTER_MS;

  return { liveData, deviceOnline, dataAgeMs, firebaseConnected, error };
}
