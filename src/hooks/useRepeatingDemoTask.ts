import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

type RepeatingDemoTaskOptions = {
  enabled: boolean;
  onTick: () => void | Promise<void>;
  intervalMs?: number;
  runImmediately?: boolean;
};

export const useRepeatingDemoTask = ({
  enabled,
  onTick,
  intervalMs = 30_000,
  runImmediately = false,
}: RepeatingDemoTaskOptions) => {
  const intervalSeconds = Math.max(1, Math.ceil(intervalMs / 1000));
  const [secondsRemaining, setSecondsRemaining] = useState(intervalSeconds);
  const [running, setRunning] = useState(false);
  const taskRef = useRef(onTick);
  const runningRef = useRef(false);

  useEffect(() => {
    taskRef.current = onTick;
  }, [onTick]);

  const triggerNow = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    try {
      await taskRef.current();
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    setSecondsRemaining(intervalSeconds);
    if (!enabled) return;

    let foreground = AppState.currentState === 'active';
    let deadline = Date.now() + intervalMs;

    if (runImmediately && foreground) void triggerNow();

    const appStateSubscription = AppState.addEventListener('change', state => {
      const wasForeground = foreground;
      foreground = state === 'active';

      // Only act on a resume (background/inactive -> active). A transition
      // INTO background must NOT touch the deadline — the interval tick
      // below already no-ops while backgrounded, so there's nothing to
      // reset, and resetting here was the bug: any brief interruption
      // (notification, app switcher, lock screen) pushed the next refresh
      // a full interval further out, so the countdown effectively never
      // completed on a real device.
      if (!foreground || wasForeground) return;

      if (Date.now() >= deadline) {
        // A full interval or more elapsed while backgrounded — don't leave
        // a resumed session showing stale data until a fresh interval
        // completes; catch up with exactly one immediate refresh.
        deadline = Date.now() + intervalMs;
        setSecondsRemaining(intervalSeconds);
        void triggerNow();
      } else {
        // Still time left on the existing deadline — just resync the
        // displayed countdown to real elapsed time, don't reset it.
        setSecondsRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
      }
    });

    const timer = setInterval(() => {
      if (!foreground) return;
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsRemaining(remaining);
      if (remaining > 0) return;

      deadline = Date.now() + intervalMs;
      setSecondsRemaining(intervalSeconds);
      void triggerNow();
    }, 1000);

    return () => {
      clearInterval(timer);
      appStateSubscription.remove();
    };
  }, [enabled, intervalMs, intervalSeconds, runImmediately, triggerNow]);

  return { running, secondsRemaining, triggerNow };
};
