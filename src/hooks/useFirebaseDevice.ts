import { useEffect, useRef, useState } from 'react';
import { ref, onValue, off, DatabaseReference } from 'firebase/database';
import { signInWithCustomToken } from 'firebase/auth';
import { rtdb, firebaseAuth } from '../firebase/firebaseConfig';
import type { SafetyDataLive, DeviceStatus } from '../types/iot';

export interface FirebaseDeviceState {
  liveData: SafetyDataLive | null;
  deviceOnline: boolean;
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
  const [deviceOnline, setDeviceOnline] = useState(false);
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
      setDeviceOnline(false);
      return;
    }

    let cancelled = false;

    const attach = async () => {
      try {
        // Authenticate with Firebase using the short-lived custom token
        await signInWithCustomToken(firebaseAuth, firebaseToken);

        if (cancelled) return;

        // ── Listener 1: live safety data ──────────────────────────────────
        const live = ref(rtdb, `/devices/${deviceId}/safetyData/live`);
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
        const status = ref(rtdb, `/devices/${deviceId}/status/online`);
        statusRef.current = status;
        onValue(status, (snapshot) => {
          if (!cancelled) setDeviceOnline(snapshot.val() === true);
        });

        // ── Listener 3: Firebase connection state ──────────────────────────
        const conn = ref(rtdb, '.info/connected');
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

  return { liveData, deviceOnline, firebaseConnected, error };
}
