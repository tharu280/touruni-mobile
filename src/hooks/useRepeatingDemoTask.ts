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
      foreground = state === 'active';
      deadline = Date.now() + intervalMs;
      setSecondsRemaining(intervalSeconds);
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
