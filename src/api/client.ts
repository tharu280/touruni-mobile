import { fetch as expoFetch } from 'expo/fetch';
import { File } from 'expo-file-system';

import { refreshAccessTokenOnce } from './authRefresh';
import {
  AuthResponse,
  ChatResponse,
  ChatSessionState,
  ConditionNotificationsResponse,
  ContextualAlternativesResponse,
  DashboardPayload,
  EmotionCheckinResponse,
  EmotionLabel,
  EmotionTargetsResponse,
  FlightConfirmResponse,
  FlightOption,
  FlightSearchResponse,
  LatestSessionResponse,
  PlanPayload,
  PlanRequest,
} from '../types';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

if (!BACKEND_URL) {
  console.warn('EXPO_PUBLIC_BACKEND_URL is not defined in .env');
}

type RequestOptions = RequestInit & {
  token?: string | null;
  useExpoFetch?: boolean;
};

// Refresh-handler state moved to authRefresh.ts so iotClient.ts can share the
// same single-in-flight-refresh guard. Re-exported here so existing importers
// (AppSessionContext.tsx) don't need an import-path change.
export { setAuthRefreshHandler } from './authRefresh';

const apiRequest = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  if (!BACKEND_URL) {
    throw new Error('EXPO_PUBLIC_BACKEND_URL is not configured.');
  }

  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }

  const sendRequest = async (token?: string | null) => {
    const requestHeaders = new Headers(headers);
    if (token) requestHeaders.set('Authorization', `Bearer ${token}`);
    const {
      token: _requestToken,
      useExpoFetch = false,
      ...fetchOptions
    } = options;
    const request = useExpoFetch
      ? (expoFetch as unknown as typeof globalThis.fetch)
      : globalThis.fetch;
    return request(`${BACKEND_URL}${path}`, {
      ...fetchOptions,
      headers: requestHeaders,
      credentials: 'include',
    });
  };

  let response = await sendRequest(options.token);
  if (response.status === 401 && options.token) {
    const refreshedToken = await refreshAccessTokenOnce();
    if (refreshedToken) response = await sendRequest(refreshedToken);
  }

  const contentType = response.headers.get('content-type') || '';

  if (!response.ok) {
    if (contentType.includes('application/json')) {
      const payload = (await response.json()) as { detail?: unknown; message?: unknown };
      const detail = payload.detail ?? payload.message;
      if (typeof detail === 'string' && detail.trim()) {
        throw new Error(detail);
      }
    }

    throw new Error(`The TripMind service returned HTTP ${response.status}. Please try again.`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  if (!contentType.includes('application/json')) {
    throw new Error('The TripMind service returned an unexpected response. Please try again.');
  }

  return response.json() as Promise<T>;
};

export const checkHealth = async () => {
  return apiRequest<Record<string, unknown>>('/health');
};

export const chatWithBackend = async (
  message: string,
  session: ChatSessionState | null
): Promise<ChatResponse> => {
  return apiRequest<ChatResponse>('/chat', {
    method: 'POST',
    body: JSON.stringify({ message, session }),
  });
};

export const searchFlights = async (
  session: ChatSessionState
): Promise<FlightSearchResponse> => {
  const req = session.trip_requirements;
  if (!req.flight_origin || !req.flight_departure_date) {
    throw new Error('Flight search needs origin and departure date.');
  }

  return apiRequest<FlightSearchResponse>('/flights/search', {
    method: 'POST',
    body: JSON.stringify({
      origin: req.flight_origin,
      departure_date: req.flight_departure_date,
      search_mode: req.flight_search_mode || 'single_day',
      passengers: Number(req.flight_passengers || 1),
      cabin_class: req.flight_cabin_class || 'economy',
      total_budget_lkr: req.total_budget_lkr ?? null,
      currency: 'USD',
    }),
  });
};

export const confirmFlight = async (
  session: ChatSessionState,
  selectedFlight: FlightOption | null,
  continueWithoutLiveFare = false
): Promise<FlightConfirmResponse> => {
  return apiRequest<FlightConfirmResponse>('/flights/confirm', {
    method: 'POST',
    body: JSON.stringify({
      session,
      selected_flight: selectedFlight,
      continue_without_live_fare: continueWithoutLiveFare,
    }),
  });
};

export const generatePlan = async (
  request: PlanRequest,
  token?: string | null
): Promise<PlanPayload> => {
  return apiRequest<PlanPayload>('/plan', {
    method: 'POST',
    body: JSON.stringify(request),
    token,
  });
};

export const getSessionDashboard = async (
  sessionId: string,
  token?: string | null
): Promise<DashboardPayload> => {
  return apiRequest<DashboardPayload>(`/sessions/${encodeURIComponent(sessionId)}/dashboard`, {
    token,
  });
};

export const getLatestSession = async (token: string): Promise<LatestSessionResponse> => {
  return apiRequest<LatestSessionResponse>('/sessions/latest', { token });
};

export const refreshSessionIntelligence = async (
  sessionId: string,
  token?: string | null
): Promise<Record<string, unknown>> => {
  return apiRequest<Record<string, unknown>>(
    `/sessions/${encodeURIComponent(sessionId)}/refresh-intelligence`,
    {
      method: 'POST',
      token,
      body: JSON.stringify({
        departure_time: '08:00',
        include_gemini: false,
        include_weather: true,
        include_crowd: true,
        include_roadlk: true,
        response_mode: 'slim',
      }),
    }
  );
};

export const getConditionNotifications = async (
  sessionId: string,
  token?: string | null
): Promise<ConditionNotificationsResponse> => {
  return apiRequest<ConditionNotificationsResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/condition-notifications?unread_only=false&limit=50`,
    { token }
  );
};

export const markAllConditionNotificationsRead = async (
  sessionId: string,
  token?: string | null
): Promise<void> => {
  return apiRequest<void>(
    `/sessions/${encodeURIComponent(sessionId)}/condition-notifications/read-all`,
    { method: 'POST', token }
  );
};

export const markConditionNotificationRead = async (
  sessionId: string,
  notificationId: string,
  token?: string | null
): Promise<void> => {
  return apiRequest<void>(
    `/sessions/${encodeURIComponent(sessionId)}/condition-notifications/${encodeURIComponent(notificationId)}/read`,
    { method: 'POST', token }
  );
};

export const getContextualAlternatives = async (
  sessionId: string,
  payload: {
    day?: number;
    attraction_id?: string;
    interests?: string[];
    force?: boolean;
  },
  token?: string | null
): Promise<ContextualAlternativesResponse> => {
  return apiRequest<ContextualAlternativesResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/contextual-alternatives`,
    {
      method: 'POST',
      token,
      body: JSON.stringify({
        interests: [],
        radius_meters: 5000,
        limit_per_attraction: 3,
        max_attractions: 6,
        force: false,
        ...payload,
      }),
    }
  );
};

export const askAssistant = async (
  sessionId: string,
  payload: {
    message: string;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
  },
  token?: string | null
): Promise<{ answer: string }> => {
  return apiRequest<{ answer: string }>(
    `/sessions/${encodeURIComponent(sessionId)}/assistant`,
    {
      method: 'POST',
      token,
      body: JSON.stringify(payload),
    }
  );
};

export const addEmotionCheckin = async (
  sessionId: string,
  payload: {
    day: number;
    emotion_label: EmotionLabel;
    emotion_confidence: number;
    hobbies: string[];
    attraction_id?: string;
    attraction_name?: string;
    checkin_type?: 'start_of_day' | 'attraction';
    timestamp?: string;
    user_location?: { latitude: number; longitude: number };
  },
  token?: string | null
): Promise<EmotionCheckinResponse> => {
  return apiRequest<EmotionCheckinResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/emotion-checkins`,
    {
      method: 'POST',
      token,
      body: JSON.stringify({
        ...payload,
        checkin_type: payload.checkin_type || 'start_of_day',
        timestamp: payload.timestamp || new Date().toISOString(),
        top_predictions: [],
        model_version: 'manual_mood_selection',
        local_inference: true,
      }),
    }
  );
};

export const addEmotionCheckinImage = async (
  sessionId: string,
  payload: {
    image: {
      uri: string;
      name?: string | null;
      mimeType?: string | null;
    };
    day: number;
    hobbies: string[];
    attraction_id?: string;
    attraction_name?: string;
    checkin_type?: 'start_of_day' | 'attraction';
    user_location?: { latitude: number; longitude: number };
  },
  token?: string | null
): Promise<EmotionCheckinResponse> => {
  const formData = new FormData();
  const imageFile = new File(payload.image.uri);
  formData.append('image', imageFile as unknown as Blob);
  formData.append('day', String(payload.day));
  formData.append('checkin_type', payload.checkin_type || 'start_of_day');
  formData.append('hobbies', JSON.stringify(payload.hobbies));
  if (payload.attraction_id) formData.append('attraction_id', payload.attraction_id);
  if (payload.attraction_name) formData.append('attraction_name', payload.attraction_name);
  if (payload.user_location) {
    formData.append('latitude', String(payload.user_location.latitude));
    formData.append('longitude', String(payload.user_location.longitude));
  }

  return apiRequest<EmotionCheckinResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/emotion-checkins/image`,
    {
      method: 'POST',
      token,
      body: formData,
      useExpoFetch: true,
    }
  );
};

export const getEmotionTargets = async (
  sessionId: string,
  token?: string | null
): Promise<EmotionTargetsResponse> => {
  return apiRequest<EmotionTargetsResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/emotion-targets`,
    { token }
  );
};

export const signup = async (name: string, email: string, password: string): Promise<AuthResponse> => {
  return apiRequest<AuthResponse>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
};

export const login = async (email: string, password: string): Promise<AuthResponse> => {
  return apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
};

export const refreshAuth = async (): Promise<AuthResponse> => {
  return apiRequest<AuthResponse>('/auth/refresh', { method: 'POST' });
};

export const logout = async (): Promise<void> => {
  return apiRequest<void>('/auth/logout', { method: 'POST' });
};
