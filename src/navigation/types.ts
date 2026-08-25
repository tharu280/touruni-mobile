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
  // AdminDashboard reads its token from AdminSessionContext (see AuthScreen's
  // admin-login branch), not from route params — same as every other admin screen.
  AdminDashboard: undefined;

  // ── IoT screens (new) ─────────────────────────────────────────────────────
  IoTDevices: undefined;
  IoTRegisterDevice: undefined;
  IoTDashboard: { deviceId: string; sessionId?: string };
  IoTTripMonitor: { deviceId: string; tripId: string; sessionId?: string };
  IoTAlertHistory: { deviceId: string };

  // ── Admin IoT management (new) ────────────────────────────────────────────
  AdminIoTDevices: undefined;
  AdminIoTProvision: undefined;
  AdminIoTAlerts: undefined;
  AdminIoTRecords: undefined;
  AdminIoTLocations: undefined;
};
