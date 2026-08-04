import type {
  Coordinate,
  DailyAttraction,
  DailyBriefing,
  DashboardPayload,
  PlanPayload,
  RoadIncident,
  RouteSegment,
} from '../../types';

type UnknownRecord = Record<string, unknown>;

export type DashboardTab = 'route' | 'crowd' | 'weather' | 'roads' | 'tips';

export type DayMapMarker = {
  day: number;
  label: string;
  coordinate: Coordinate;
};

export type MapRiskPoint = {
  id: string;
  name: string;
  day: number;
  level: string;
  score: number | null;
  coordinate: Coordinate;
};

export type BudgetRow = {
  label: string;
  amount: number;
};

export type DashboardViewModel = {
  sessionId: string;
  originName: string;
  destinationName: string;
  durationLabel: string;
  dateLabel: string;
  days: DailyBriefing[];
  routeCoordinates: Coordinate[];
  originCoordinate: Coordinate | null;
  destinationCoordinate: Coordinate | null;
  dayMarkers: DayMapMarker[];
  crowdPoints: MapRiskPoint[];
  weatherPoints: MapRiskPoint[];
  roadIncidents: Array<RoadIncident & { coordinate: Coordinate }>;
  budgetRows: BudgetRow[];
  totalBudget: number | null;
  actualSpend: number;
  remainingBudget: number | null;
  crowdRisk: string;
  crowdScore: number | null;
  crowdSummary: string;
};

export const asRecord = (value: unknown): UnknownRecord => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : {}
);

export const asList = <T = unknown>(value: unknown): T[] => (
  Array.isArray(value) ? value as T[] : []
);

export const asText = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
};

export const asNumber = (...values: unknown[]): number | null => {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const parsed = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const isValidCoordinate = (latitude: number, longitude: number) => (
  Number.isFinite(latitude)
  && Number.isFinite(longitude)
  && latitude >= -90
  && latitude <= 90
  && longitude >= -180
  && longitude <= 180
  && !(latitude === 0 && longitude === 0)
);

export const toCoordinate = (value: unknown): Coordinate | null => {
  if (Array.isArray(value) && value.length >= 2) {
    const latitude = asNumber(value[0]);
    const longitude = asNumber(value[1]);
    return latitude !== null && longitude !== null && isValidCoordinate(latitude, longitude)
      ? { latitude, longitude }
      : null;
  }

  const item = asRecord(value);
  const nested = asRecord(item.location);
  const latitude = asNumber(item.latitude, item.lat, nested.latitude, nested.lat);
  const longitude = asNumber(item.longitude, item.lng, item.lon, nested.longitude, nested.lng, nested.lon);
  return latitude !== null && longitude !== null && isValidCoordinate(latitude, longitude)
    ? { latitude, longitude }
    : null;
};

export const decodeGooglePolyline = (encoded: string): Coordinate[] => {
  const coordinates: Coordinate[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    latitude += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    longitude += result & 1 ? ~(result >> 1) : result >> 1;

    const coordinate = { latitude: latitude / 1e5, longitude: longitude / 1e5 };
    if (isValidCoordinate(coordinate.latitude, coordinate.longitude)) coordinates.push(coordinate);
  }

  return coordinates;
};

const uniqueCoordinates = (coordinates: Coordinate[]) => {
  const seen = new Set<string>();
  return coordinates.filter(coordinate => {
    const key = `${coordinate.latitude.toFixed(5)}:${coordinate.longitude.toFixed(5)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const routeCoordinatesFromDashboard = (dashboard: DashboardPayload): Coordinate[] => {
  const recommendedRoute = dashboard.route?.recommended_route;
  const encoded = asText(recommendedRoute?.polyline);
  if (encoded) {
    const decoded = decodeGooglePolyline(encoded);
    if (decoded.length > 1) return decoded;
  }

  const segmentCoordinates = asList<RouteSegment>(recommendedRoute?.segments)
    .flatMap(segment => asList(segment.segment_path_points).map(toCoordinate).filter(Boolean) as Coordinate[]);
  if (segmentCoordinates.length > 1) return uniqueCoordinates(segmentCoordinates);

  const sampledCoordinates = asList(recommendedRoute?.sampled_points)
    .map(toCoordinate)
    .filter(Boolean) as Coordinate[];
  return sampledCoordinates.length > 1 ? uniqueCoordinates(sampledCoordinates) : [];
};

const placeName = (value: unknown, fallback: string) => {
  const place = asRecord(value);
  return asText(place.name, place.formatted_address, place.address) || fallback;
};

const formatDateRange = (dates: string[]) => {
  if (!dates.length) return '';
  const format = (raw: string) => {
    const date = new Date(`${raw}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? raw
      : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };
  return dates.length === 1 ? format(dates[0]) : `${format(dates[0])} - ${format(dates[dates.length - 1])}`;
};

const firstCoordinate = (...values: unknown[]) => {
  for (const value of values) {
    const coordinate = toCoordinate(value);
    if (coordinate) return coordinate;
  }
  return null;
};

const dayCoordinate = (briefing: DailyBriefing, routeSegment: unknown): Coordinate | null => {
  const segment = asRecord(routeSegment);
  const firstAttraction = asList(briefing.attractions).find(attraction => toCoordinate(attraction));
  return firstCoordinate(
    segment.end_point,
    briefing.route?.end_point,
    firstAttraction,
    segment.mid_point,
    segment.start_point,
    briefing.route?.start_point,
  );
};

const normalizedPlaceKeys = (value: unknown): string[] => {
  const item = asRecord(value);
  return [...new Set(
    [item.place_id, item.id, item.name, item.display_name]
      .filter((candidate): candidate is string => typeof candidate === 'string')
      .map(candidate => candidate.trim().toLowerCase())
      .filter(Boolean),
  )];
};

const routeAttractionLookup = (segments: RouteSegment[]) => {
  const lookup = new Map<string, DailyAttraction>();
  for (const segment of segments) {
    const rawSegment = asRecord(segment);
    const attractions = [
      ...asList<DailyAttraction>(segment.selected_attractions),
      ...asList<DailyAttraction>(rawSegment.gemini_selected_attractions),
      ...asList<DailyAttraction>(rawSegment.top_attractions),
      ...asList<DailyAttraction>(rawSegment.ranked_places),
    ];
    for (const attraction of attractions) {
      if (!toCoordinate(attraction)) continue;
      for (const key of [attraction.place_id, attraction.name]) {
        const normalized = typeof key === 'string' ? key.trim().toLowerCase() : '';
        if (normalized && !lookup.has(normalized)) lookup.set(normalized, attraction);
      }
    }
  }
  return lookup;
};

const crowdMapPoints = (
  dashboard: DashboardPayload,
  days: DailyBriefing[],
  routeSegments: RouteSegment[],
): MapRiskPoint[] => {
  const routeLookup = routeAttractionLookup(routeSegments);
  const crowd = asRecord(dashboard.crowd);
  const pressureItems = asList<UnknownRecord>(crowd.attraction_pressure);
  const pressureLookup = new Map<string, UnknownRecord>();

  for (const pressure of pressureItems) {
    for (const key of [pressure.place_id, pressure.name]) {
      const normalized = typeof key === 'string' ? key.trim().toLowerCase() : '';
      if (normalized && !pressureLookup.has(normalized)) pressureLookup.set(normalized, pressure);
    }
  }

  const points: MapRiskPoint[] = [];
  const seen = new Set<string>();
  const addPoint = (
    attraction: DailyAttraction | UnknownRecord,
    dayNumber: number,
    fallbackLevel: string,
    index: number,
  ) => {
    const keys = normalizedPlaceKeys(attraction);
    const pressure = keys.map(key => pressureLookup.get(key)).find(Boolean);
    const routeAttraction = [
      ...keys,
      ...normalizedPlaceKeys(pressure),
    ].map(key => routeLookup.get(key)).find(Boolean) || null;
    const coordinate = toCoordinate(attraction) || toCoordinate(routeAttraction);
    if (!coordinate) return;

    const item = asRecord(attraction);
    const itemCrowd = asRecord(item.crowd);
    const resolvedDay = asNumber(pressure?.day, item.day, dayNumber) || dayNumber;
    const id = asText(item.place_id, pressure?.place_id, routeAttraction?.place_id)
      || `${resolvedDay}-${keys[0] || index}`;
    if (seen.has(id)) return;
    seen.add(id);

    points.push({
      id,
      name: asText(item.name, pressure?.name, routeAttraction?.name) || 'Attraction',
      day: resolvedDay,
      level: asText(
        itemCrowd.level,
        pressure?.pressure_level,
        asRecord(pressure?.combined_pressure).level,
        fallbackLevel,
      ) || 'unknown',
      score: asNumber(itemCrowd.score, pressure?.pressure_score, pressure?.combined_score),
      coordinate,
    });
  };

  days.forEach((day, dayIndex) => {
    const dayNumber = day.day || dayIndex + 1;
    const dailyAttractions = asList<DailyAttraction>(day.attractions);
    const segmentAttractions = asList<DailyAttraction>(routeSegments[dayIndex]?.selected_attractions);
    const candidates = dailyAttractions.length ? dailyAttractions : segmentAttractions;
    candidates.forEach((attraction, index) => addPoint(
      attraction,
      dayNumber,
      day.crowd?.risk_level || 'unknown',
      index,
    ));
  });

  pressureItems.forEach((pressure, index) => addPoint(
    pressure,
    asNumber(pressure.day) || 1,
    asText(pressure.pressure_level) || 'unknown',
    index,
  ));

  return points;
};

const sum = (values: Array<number | null>) => values.reduce<number>((total, value) => total + (value || 0), 0);

const actualBudget = (dashboard: DashboardPayload, days: DailyBriefing[]) => {
  const budget = asRecord(dashboard.budget);
  const flight = asRecord(dashboard.flight);
  const transport = asRecord(dashboard.transport_cost);
  const flightAmount = asNumber(
    budget.flight_cost_lkr,
    budget.flights_lkr,
    flight.selected_flight_budget_lkr_estimated,
    flight.price_lkr,
    asRecord(flight.budget_handoff).selected_flight_budget_lkr_estimated,
  ) || 0;
  const accommodationAmount = sum(days.map(day => asNumber(
    day.costs?.accommodation_lkr,
    day.accommodation?.price_lkr,
  )));
  const transportAmount = asNumber(
    budget.transport_cost_lkr,
    budget.transport_lkr,
    transport.total_cost_lkr,
    transport.estimated_total_lkr,
    transport.total_lkr,
  ) || sum(days.map(day => asNumber(day.costs?.estimated_transport_lkr)));

  const rows = [
    { label: 'Flights', amount: flightAmount },
    { label: 'Accommodation', amount: accommodationAmount },
    { label: 'Estimated bus fare', amount: transportAmount },
  ].filter(row => row.amount > 0);
  const actualSpend = sum(rows.map(row => row.amount));
  const totalBudget = asNumber(
    dashboard.trip_requirements?.total_budget_lkr,
    budget.total_budget_lkr,
    budget.user_total_budget_lkr,
  );

  return {
    rows,
    actualSpend,
    totalBudget,
    remainingBudget: totalBudget === null ? null : totalBudget - actualSpend,
  };
};

export const dashboardFromPlan = (plan: PlanPayload): DashboardPayload => ({
  session_id: asText(plan.session_id) || '',
  trip_requirements: {},
  plan_overview: {
    trip_days: plan.trip_days,
    trip_dates: plan.trip_dates,
    duration_text: plan.duration_text,
  },
  route: {
    origin_resolved: plan.origin_resolved,
    destination_resolved: plan.destination_resolved,
    route_data: plan.route_data,
    recommended_route: plan.recommended_route,
  },
  budget: asRecord(plan.budget_summary),
  daily_briefings: asList<DailyBriefing>(plan.daily_briefings),
  crowd: asRecord(plan.crowd_signals),
  flight: asRecord(plan.flight_plan),
  transport_cost: asRecord(plan.transport_cost),
  itinerary: {
    guidance: plan.itinerary_guidance,
    markdown: plan.itinerary_markdown,
  },
});

export const buildDashboardViewModel = (dashboard: DashboardPayload): DashboardViewModel => {
  const recommendedRoute = dashboard.route?.recommended_route;
  const routeSegments = asList<RouteSegment>(recommendedRoute?.segments);
  const days = asList<DailyBriefing>(dashboard.daily_briefings)
    .slice()
    .sort((left, right) => (left.day || 0) - (right.day || 0));
  const originCoordinate = toCoordinate(dashboard.route?.origin_resolved);
  const destinationCoordinate = toCoordinate(dashboard.route?.destination_resolved);
  const routeCoordinates = routeCoordinatesFromDashboard(dashboard);
  const dayMarkers = days.flatMap((day, index) => {
    const coordinate = dayCoordinate(day, routeSegments[index]);
    return coordinate ? [{
      day: day.day || index + 1,
      label: day.location_label || day.title || `Day ${day.day || index + 1}`,
      coordinate,
    }] : [];
  });

  const crowdPoints = crowdMapPoints(dashboard, days, routeSegments);

  const weatherPoints = days.flatMap((day, index) => {
    const coordinate = dayCoordinate(day, routeSegments[index]);
    if (!coordinate) return [];
    return [{
      id: `weather-${day.day || index + 1}`,
      name: day.weather?.condition || day.location_label || `Day ${day.day || index + 1}`,
      day: day.day || index + 1,
      level: day.weather?.risk_level || day.weather?.status || 'unknown',
      score: asNumber(day.weather?.risk_score, day.weather?.rain_probability_pct),
      coordinate,
    }];
  });

  const routeWideAlerts = asList<RoadIncident>(recommendedRoute?.road_alerts);
  const dailyAlerts = days.flatMap(day => asList<RoadIncident>(day.roads?.incidents));
  const roadIncidents = [...routeWideAlerts, ...dailyAlerts].flatMap((incident, index) => {
    const coordinate = toCoordinate(incident);
    if (!coordinate) return [];
    const id = incident.report_number || `${coordinate.latitude}:${coordinate.longitude}:${index}`;
    return [{ ...incident, report_number: id, coordinate }];
  }).filter((incident, index, all) => all.findIndex(item => item.report_number === incident.report_number) === index);

  const crowd = asRecord(dashboard.crowd);
  const budget = actualBudget(dashboard, days);
  const dates = asList<string>(dashboard.plan_overview?.trip_dates);

  return {
    sessionId: dashboard.session_id,
    originName: placeName(dashboard.route?.origin_resolved, dashboard.trip_requirements?.origin || 'Trip start'),
    destinationName: placeName(dashboard.route?.destination_resolved, dashboard.trip_requirements?.destination || 'Trip destination'),
    durationLabel: dashboard.plan_overview?.duration_text || `${dashboard.plan_overview?.trip_days || days.length} days`,
    dateLabel: formatDateRange(dates),
    days,
    routeCoordinates,
    originCoordinate,
    destinationCoordinate,
    dayMarkers,
    crowdPoints,
    weatherPoints,
    roadIncidents,
    budgetRows: budget.rows,
    totalBudget: budget.totalBudget,
    actualSpend: budget.actualSpend,
    remainingBudget: budget.remainingBudget,
    crowdRisk: asText(crowd.risk_level, crowd.level) || 'unknown',
    crowdScore: asNumber(crowd.signal_score, crowd.score),
    crowdSummary: asText(crowd.helper_summary, crowd.summary) || 'Crowd conditions are evaluated from available trip signals.',
  };
};
