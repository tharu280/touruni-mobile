import * as Speech from 'expo-speech';
import { useRef } from 'react';
import type { AlertTier } from '../types/iot';

const VOICE_PROMPTS: Partial<Record<AlertTier, string>> = {
  2: 'You appear fatigued. Please consider taking a rest stop.',
  3: 'Critical risk detected. Please stop the vehicle safely immediately.',
};

const COOLDOWN_MS = 30_000; // 30 seconds between repeated prompts of the same tier

export function useAlertAudio() {
  const lastSpokenTier = useRef<AlertTier>(0);
  const lastSpokenAt = useRef<number>(0);

  const speakIfNeeded = (tier: AlertTier) => {
    const prompt = VOICE_PROMPTS[tier];
    if (!prompt) return;

    const now = Date.now();
    const sameAsCooldown =
      tier === lastSpokenTier.current && now - lastSpokenAt.current < COOLDOWN_MS;

    if (sameAsCooldown) return;

    lastSpokenTier.current = tier;
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
