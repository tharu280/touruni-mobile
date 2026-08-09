import type {
  ChatSessionState,
  FlightOption,
  FlightSearchResponse,
  PlanPayload,
} from '../types';

export type RootStackParamList = {
  // ── Existing screens (do not modify) ──────────────────────────────────────
  GetStarted: undefined;
  Auth: { mode?: 'login' | 'signup' } | undefined;
  Account: undefined;
  FlightIntake: undefined;
  FlightOptions: {
    flightPlan: FlightSearchResponse;
    session: ChatSessionState;
  };
  TripIntake: {
    selectedFlight: FlightOption | null;
    flightPlan: FlightSearchResponse | null;
    session: ChatSessionState;
    initialAssistantReply: string;
  };
  PlanResult: {
    plan?: PlanPayload;
    sessionId?: string;
  };

  // ── IoT screens (new) ─────────────────────────────────────────────────────
  IoTDevices: undefined;
  IoTRegisterDevice: undefined;
  IoTDashboard: { deviceId: string };
  IoTTripMonitor: { deviceId: string; tripId: string };
  IoTAlertHistory: { deviceId: string };
};
