import { useEffect, useRef, useState } from 'react';
import { ref, onValue, off, DatabaseReference } from 'firebase/database';
import { rtdb } from '../firebase/firebaseConfig';
import type { DeviceSummary } from '../types/iot';
import { STALE_AFTER_MS } from './useFirebaseDevice';

/**
 * Lightweight per-device online status for the device LIST screen.
 *
 * devices_router.py's list_devices() hardcodes online=False on every device
 * ("mobile resolves online state via Firebase RTDB") — but until this hook,
 * nothing on the list screen actually did that; only the single *active*
 * device got a real Firebase listener, via useFirebaseDevice. Every device
 * in the list looked offline regardless of reality.
 *
 * issue_user_firebase_token() (backend/clean_run/iot/firebase_admin_service.py)
 * deliberately does NOT scope the token to one device — "one token covers
 * every device the user owns" — so a single sign-in (done once, in
 * IoTContext, as soon as the device list loads) is enough to read every
 * device's status here, not just the active one.
 *
 * Deliberately reads only status/online + safetyData/live/timestampMs per
 * device, not the full live object — this is a list of dots, not a dashboard.
 */
export interface DeviceOnlineInfo {
  online: boolean;
  lastSeenMs: number | null;
}

export function useDevicesOnlineStatus(
  devices: DeviceSummary[],
  firebaseToken: string | null
): Record<string, DeviceOnlineInfo> {
  const [statusByDevice, setStatusByDevice] = useState<Record<string, DeviceOnlineInfo>>({});
  const [now, setNow] = useState(() => Date.now());
  const refsRef = useRef<DatabaseReference[]>([]);
  const rawRef = useRef<Record<string, { online: boolean; timestampMs: number | null }>>({});

  const deviceIds = devices.map((d) => d.device_id).join(',');

  useEffect(() => {
    // Detach whatever was attached for the previous device set.
    refsRef.current.forEach((r) => off(r));
    refsRef.current = [];
    rawRef.current = {};

    if (!firebaseToken || !rtdb || devices.length === 0) {
      setStatusByDevice({});
      return;
    }

    const db = rtdb;

    devices.forEach((device) => {
      const id = device.device_id;
      rawRef.current[id] = { online: false, timestampMs: null };

      const onlineRef = ref(db, `/devices/${id}/status/online`);
      onValue(onlineRef, (snapshot) => {
        rawRef.current[id] = { ...rawRef.current[id], online: snapshot.val() === true };
      });
      refsRef.current.push(onlineRef);

      const tsRef = ref(db, `/devices/${id}/safetyData/live/timestampMs`);
      onValue(tsRef, (snapshot) => {
        const val = snapshot.val();
        rawRef.current[id] = {
          ...rawRef.current[id],
          timestampMs: typeof val === 'number' ? val : null,
        };
      });
      refsRef.current.push(tsRef);
    });

    return () => {
      refsRef.current.forEach((r) => off(r));
      refsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceIds, firebaseToken]);

  // Re-derive on a timer too, same reasoning as useFirebaseDevice: staleness
  // has to be re-evaluated even when nothing new arrives.
  useEffect(() => {
    if (devices.length === 0) return;
    const id = setInterval(() => setNow(Date.now()), 3_000);
    return () => clearInterval(id);
  }, [devices.length]);

  useEffect(() => {
    const next: Record<string, DeviceOnlineInfo> = {};
    for (const device of devices) {
      const raw = rawRef.current[device.device_id];
      if (!raw) {
        next[device.device_id] = { online: false, lastSeenMs: null };
        continue;
      }
      const dataAgeMs = raw.timestampMs !== null ? now - raw.timestampMs : null;
      next[device.device_id] = {
        online: raw.online && dataAgeMs !== null && dataAgeMs < STALE_AFTER_MS,
        lastSeenMs: raw.timestampMs,
      };
    }
    setStatusByDevice(next);
    // now ticks every 3s and deviceIds captures membership changes; that's what should re-derive this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, deviceIds]);

  return statusByDevice;
}
