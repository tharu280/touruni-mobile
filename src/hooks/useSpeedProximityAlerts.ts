import { useEffect, useRef, useState } from 'react';
import type { SafetyDataLive } from '../types/iot';
import { useAlertAudio } from './useAlertAudio';
import { vibrateForWarning } from '../utils/alertVibration';

// No per-road speed-limit data exists anywhere in this app (no route-level
// lookup, nothing from the firmware). This is a pragmatic single-threshold
// MVP: above Sri Lanka's general (non-expressway) limit for private/dual
// purpose vehicles (~70 km/h) with a margin for GPS noise, below expressway
// limits (100-120 km/h) — so it WILL false-positive on an expressway. Easy
// to make configurable/per-route later; not attempted here.
const SPEED_ON_KMH = 80;
const SPEED_OFF_KMH = 75; // hysteresis: must drop below this to clear, not just below SPEED_ON_KMH

// vehicle.ttcSeconds (time-to-collision) is already computed server-side
// from distanceCm/speedKmh (see normalizer.py) and flows into every
// liveData payload. Deliberately more conservative than the old dashboard
// tile's <2s cosmetic threshold — this drives an active audio+haptic
// warning on a live trip, not a passive number color.
const PROXIMITY_ON_S = 3.0;
const PROXIMITY_OFF_S = 4.0; // hysteresis: must rise above this to clear

export interface SpeedProximityAlerts {
  speeding: boolean;
  tooClose: boolean;
}

/**
 * Client-side speed and following-distance warnings, independent of the
 * device-fused drowsiness/risk `alertTier` system. Fires voice + a one-shot
 * vibration only on the false->true edge of each condition (a sustained
 * warning doesn't re-announce every ~1s telemetry tick), gated by hysteresis
 * bands so a value hovering near a threshold doesn't flicker.
 */
export function useSpeedProximityAlerts(liveData: SafetyDataLive | null): SpeedProximityAlerts {
  const { speakIfNeeded } = useAlertAudio();
  const [speeding, setSpeeding] = useState(false);
  const [tooClose, setTooClose] = useState(false);
  const speedingRef = useRef(false);
  const tooCloseRef = useRef(false);

  useEffect(() => {
    speedingRef.current = speeding;
  }, [speeding]);
  useEffect(() => {
    tooCloseRef.current = tooClose;
  }, [tooClose]);

  useEffect(() => {
    if (!liveData?.gps?.fixed) return;

    const speedKmh = liveData.gps.speedKmh;
    const ttcSeconds = liveData.vehicle?.ttcSeconds;

    if (!speedingRef.current && speedKmh > SPEED_ON_KMH) {
      setSpeeding(true);
      speakIfNeeded('speeding');
      vibrateForWarning();
    } else if (speedingRef.current && speedKmh < SPEED_OFF_KMH) {
      setSpeeding(false);
    }

    if (ttcSeconds != null) {
      if (!tooCloseRef.current && ttcSeconds < PROXIMITY_ON_S) {
        setTooClose(true);
        speakIfNeeded('proximity');
        vibrateForWarning();
      } else if (tooCloseRef.current && ttcSeconds > PROXIMITY_OFF_S) {
        setTooClose(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveData?.gps?.speedKmh, liveData?.gps?.fixed, liveData?.vehicle?.ttcSeconds]);

  return { speeding, tooClose };
}
