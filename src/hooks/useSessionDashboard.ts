import { useEffect, useState } from 'react';
import { getSessionDashboard } from '../api/client';
import { buildDashboardViewModel, type DashboardViewModel } from '../features/dashboard/model';

// Factors out the fetch+viewmodel pattern PlanResultScreen.tsx already does
// inline, so a second screen needing route/plan data (e.g. TripMonitorScreen
// drawing the planned route on a live trip) doesn't duplicate it.
export function useSessionDashboard(
  sessionId: string | undefined,
  accessToken: string | null
): { model: DashboardViewModel | null; loading: boolean } {
  const [model, setModel] = useState<DashboardViewModel | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sessionId || !accessToken) {
      setModel(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getSessionDashboard(sessionId, accessToken)
      .then((dashboard) => {
        if (!cancelled) setModel(buildDashboardViewModel(dashboard));
      })
      .catch(() => {
        // Non-fatal — the screen just shows no planned route.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, accessToken]);

  return { model, loading };
}
