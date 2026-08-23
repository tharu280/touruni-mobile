import * as Speech from 'expo-speech';
import { useRef } from 'react';
import type { AlertTier } from '../types/iot';

// Drowsiness/risk tiers (device-fused) plus the two speed/proximity
// warnings (client-computed in useSpeedProximityAlerts) — a different kind
// of alert, but sharing the same cooldown-gated speech mechanism.
export type AlertKind = AlertTier | 'speeding' | 'proximity';

const VOICE_PROMPTS: Partial<Record<AlertKind, string>> = {
  2: 'You appear fatigued. Please consider taking a rest stop.',
  3: 'Critical risk detected. Please stop the vehicle safely immediately.',
  speeding: 'You are exceeding the speed limit. Please slow down.',
  proximity: 'You are following too closely. Please increase your following distance.',
};

const COOLDOWN_MS = 30_000; // 30 seconds between repeated prompts of the same kind

export function useAlertAudio() {
  const lastSpokenKind = useRef<AlertKind>(0);
  const lastSpokenAt = useRef<number>(0);

  const speakIfNeeded = (kind: AlertKind) => {
    const prompt = VOICE_PROMPTS[kind];
    if (!prompt) return;

    const now = Date.now();
    const sameAsCooldown =
      kind === lastSpokenKind.current && now - lastSpokenAt.current < COOLDOWN_MS;

    if (sameAsCooldown) return;

    lastSpokenKind.current = kind;
    lastSpokenAt.current = now;

    Speech.speak(prompt, {
      language: 'en-US',
      rate: 0.9,
      pitch: 1.0,
    });
  };

  const stopSpeaking = () => Speech.stop();

  return { speakIfNeeded, stopSpeaking };
}
