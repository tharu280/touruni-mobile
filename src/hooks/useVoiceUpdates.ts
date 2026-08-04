import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as Speech from 'expo-speech';
import { AppState } from 'react-native';
import type { ConditionNotification } from '../types';

const MAX_STORED_IDS = 200;

const notificationId = (notification: ConditionNotification): string => (
  String(notification.notification_id || notification.id || '')
);

const newestNotification = (notifications: ConditionNotification[]) => (
  [...notifications].sort((left, right) => {
    const leftTime = Date.parse(left.created_at || '') || 0;
    const rightTime = Date.parse(right.created_at || '') || 0;
    return rightTime - leftTime;
  })[0]
);

const speechText = (notification: ConditionNotification): string => {
  if (notification.speech_text?.trim()) return notification.speech_text.trim();

  const recommendation = notification.recommendation?.action?.trim();
  const update = notification.message?.trim() || notification.title?.trim();
  if (update && recommendation) {
    return `${update} Recommended action: ${recommendation}`;
  }
  return update || recommendation || 'You have a new TripMind travel update.';
};

export const useVoiceUpdates = (
  notifications: ConditionNotification[],
  enabled: boolean,
  sessionId: string,
  notificationsLoaded: boolean,
) => {
  const storageKey = useMemo(
    () => `spoken_condition_notifications_${sessionId || 'none'}`,
    [sessionId],
  );
  const spokenIdsRef = useRef<Set<string>>(new Set());
  const lastSnapshotRef = useRef('');
  const [hydrated, setHydrated] = useState(false);
  const [isAppActive, setIsAppActive] = useState(AppState.currentState === 'active');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentNotification, setCurrentNotification] = useState<ConditionNotification | null>(null);
  const [bestVoice, setBestVoice] = useState<Speech.Voice | null>(null);

  useEffect(() => {
    Speech.getAvailableVoicesAsync().then(voices => {
      // Look for a high-quality English voice
      const englishVoices = voices.filter(v => v.language.startsWith('en'));
      
      // Prefer network voices (Android) or Enhanced quality (iOS)
      let preferred = englishVoices.find(v => 
        v.identifier.toLowerCase().includes('network') || 
        v.quality === 'Enhanced'
      );
      
      // Fallback to any UK/US voice
      if (!preferred) {
        preferred = englishVoices.find(v => v.language === 'en-US' || v.language === 'en-GB') || englishVoices[0];
      }
      
      setBestVoice(preferred || null);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setHydrated(false);
    lastSnapshotRef.current = '';
    spokenIdsRef.current = new Set();

    SecureStore.getItemAsync(storageKey)
      .then(value => {
        if (cancelled) return;
        try {
          const parsed = value ? JSON.parse(value) : [];
          spokenIdsRef.current = new Set(Array.isArray(parsed) ? parsed.map(String) : []);
        } catch {
          spokenIdsRef.current = new Set();
        }
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });

    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      const active = nextState === 'active';
      setIsAppActive(active);
      if (!active) {
        void Speech.stop();
        setIsPlaying(false);
      }
    });
    return () => subscription.remove();
  }, []);

  const persistSpokenIds = useCallback((ids: Set<string>) => {
    const boundedIds = Array.from(ids).slice(-MAX_STORED_IDS);
    spokenIdsRef.current = new Set(boundedIds);
    void SecureStore.setItemAsync(storageKey, JSON.stringify(boundedIds));
  }, [storageKey]);

  const stop = useCallback(async () => {
    if (await Speech.isSpeakingAsync()) await Speech.stop();
    setIsPlaying(false);
  }, []);

  const play = useCallback(async (notification: ConditionNotification) => {
    await stop();
    setCurrentNotification(notification);
    setIsPlaying(true);
    Speech.speak(speechText(notification), {
      voice: bestVoice ? bestVoice.identifier : undefined,
      language: 'en-US',
      pitch: 1.05,
      rate: 0.95,
      onDone: () => setIsPlaying(false),
      onStopped: () => setIsPlaying(false),
      onError: () => setIsPlaying(false),
    });
  }, [stop, bestVoice]);

  useEffect(() => {
    if (!enabled || !hydrated || !notificationsLoaded || !isAppActive || !sessionId) return;

    const snapshot = notifications
      .map(item => `${notificationId(item)}:${item.read ? 'read' : 'unread'}`)
      .filter(Boolean)
      .join('|');
    if (snapshot === lastSnapshotRef.current) return;
    lastSnapshotRef.current = snapshot;

    const unseenUnread = notifications.filter(item => {
      const id = notificationId(item);
      return Boolean(id && !item.read && !spokenIdsRef.current.has(id));
    });
    if (!unseenUnread.length) return;

    // A refresh can create several related records. Remember the whole batch but
    // speak only its newest actionable summary instead of rapidly draining it.
    const nextIds = new Set(spokenIdsRef.current);
    unseenUnread.forEach(item => nextIds.add(notificationId(item)));
    persistSpokenIds(nextIds);
    void play(newestNotification(unseenUnread));
  }, [
    enabled,
    hydrated,
    isAppActive,
    notifications,
    notificationsLoaded,
    persistSpokenIds,
    play,
    sessionId,
  ]);

  useEffect(() => () => {
    void Speech.stop();
  }, []);

  return { isPlaying, currentNotification, play, stop };
};
