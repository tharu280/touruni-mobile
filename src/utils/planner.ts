import type {
  ChatSessionState,
  FlightOption,
  FlightSearchResponse,
  PlanRequest,
} from '../types';

const estimateFlightCostLkr = (flight: FlightOption | null): number => {
  if (!flight || flight.price === undefined || flight.price === null) return 0;
  const price = Number(flight.price);
  if (!Number.isFinite(price)) return 0;

  const currency = (flight.currency || 'USD').toUpperCase();
  if (currency === 'LKR') return price;
  if (currency === 'AED') return price * 82;
  return price * 300;
};

export const buildPlanRequest = (
  session: ChatSessionState,
  selectedFlight: FlightOption | null,
  flightPlan: FlightSearchResponse | null
): PlanRequest => {
  const requirements = session.trip_requirements;
  if (!requirements.origin || !requirements.destination || !requirements.duration) {
    throw new Error('Trip origin, destination, and duration are required before planning.');
  }

  const totalBudget = requirements.total_budget_lkr ?? null;
  const flightCost = estimateFlightCostLkr(selectedFlight);
  const remainingBudget =
    totalBudget === null ? requirements.accommodation_budget_lkr ?? null : Math.max(0, totalBudget - flightCost);

  return {
    origin: requirements.origin,
    destination: requirements.destination,
    duration: requirements.duration,
    start_date: requirements.flight_departure_date || new Date().toISOString().slice(0, 10),
    departure_time: '08:00',
    total_budget_lkr: totalBudget,
    accommodation_budget_lkr: remainingBudget,
    selected_flight: selectedFlight,
    flight_plan: flightPlan
      ? {
          ...flightPlan,
          selected_result: selectedFlight || flightPlan.cheapest_result || null,
        }
      : null,
    include_gemini: true,
    include_roadlk: true,
    include_weather: true,
    include_crowd: true,
    response_mode: 'slim',
  };
};

export const getSessionId = (plan: Record<string, unknown>): string | undefined => {
  if (typeof plan.session_id === 'string') return plan.session_id;
  const storage = plan.session_storage;
  if (storage && typeof storage === 'object' && 'session_id' in storage) {
    const value = (storage as { session_id?: unknown }).session_id;
    return typeof value === 'string' ? value : undefined;
  }
  return undefined;
};
