import { Vibration } from 'react-native';
import type { AlertTier } from '../types/iot';

// Loosely mirrors the physical hub's own buzzer/vibration timing per tier
// (see updateAlertPattern() in the firmware) — a phone in a pocket won't
// feel the vehicle-mounted motor, so this reinforces it independently.
// Tier 3 is continuous on the hub too; `repeat: true` here needs an explicit
// Vibration.cancel() when the tier drops back below 3 or on unmount, since
// it never stops on its own.
const VIBRATION_PATTERNS: Record<AlertTier, number[] | null> = {
  0: null,
  1: [0, 100],
  2: [0, 150, 100, 150],
  3: [0, 200, 100, 200, 100, 200],
};

export function vibrateForTier(tier: AlertTier): void {
  const pattern = VIBRATION_PATTERNS[tier];
  if (!pattern) return;
  Vibration.vibrate(pattern, tier === 3);
}

// One-shot pattern for speed/proximity warnings — distinct from the tiered
// drowsiness patterns above, and never repeats (these clear themselves once
// the underlying condition drops, via the hysteresis band in
// useSpeedProximityAlerts, so there's no need for a continuous buzz).
const WARNING_VIBRATION_PATTERN = [0, 150, 100, 150];

export function vibrateForWarning(): void {
  Vibration.vibrate(WARNING_VIBRATION_PATTERN, false);
}
