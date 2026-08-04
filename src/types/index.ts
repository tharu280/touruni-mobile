export type ChatTurn = {
  role: 'user' | 'assistant';
  content: string;
};

export type FlightOption = {
  id?: string;
  airline?: string;
  price?: string | number | null;
  currency?: string;
  origin: string;
  destination: string;
  departure_time?: string;
  arrival_time?: string;
  departure_at?: string;
  return_at?: string;
  duration?: string;
  transfers?: number;
  passengers: number;
  booking_link?: string;
  generated_booking_link?: string;
  link?: string;
  is_best_value?: boolean;
};

export type Session = {
  id: string;
  created_at?: string;
  chat_history?: ChatTurn[];
};

export type TripRequirements = {
  needs_flights?: boolean;
  origin?: string | null;
  destination?: string | null;
  duration?: string | null;
  accommodation_budget_lkr?: number | null;
  total_budget_lkr?: number | null;
  flight_origin_input?: string | null;
  flight_origin?: string | null;
  flight_departure_date?: string | null;
  flight_search_mode?: 'single_day' | 'week' | null;
  flight_passengers?: number | null;
  flight_cabin_class?: string | null;
};

export type ChatSessionState = {
  trip_requirements: TripRequirements;
  history: ChatTurn[];
  active_phase?: 'flight' | 'flight_selection' | 'trip' | 'complete' | string;
  flight_confirmed?: boolean;
  selected_flight?: FlightOption | null;
  flight_budget_handoff?: {
    selected_flight_budget_lkr_estimated?: number | null;
    remaining_budget_lkr?: number | null;
  } | null;
};

export type ChatTurnResult = {
  assistant_reply: string;
  extracted_trip_requirements: TripRequirements;
  active_phase?: 'flight' | 'trip' | string;
  missing_fields?: string[];
  is_complete?: boolean;
};

export type ChatResponse = {
  session: ChatSessionState;
  turn: ChatTurnResult;
};

export type FlightSearchResponse = {
  origin: string;
  destination: string;
  departure_date: string;
  search_mode: string;
  requested_search_mode?: string;
  fallback_applied?: boolean;
  passengers: number;
  cabin_class: string;
  currency: string;
  total_budget_lkr?: number | null;
  results_count: number;
  results: FlightOption[];
  cheapest_result?: FlightOption | null;
  budget_handoff?: {
    selected_flight_budget_lkr_estimated?: number | null;
    remaining_budget_lkr?: number | null;
  };
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: AuthUser;
};

export type FlightConfirmResponse = ChatResponse;

export type PlanRequest = {
  origin: string;
  destination: string;
  duration: string;
  start_date: string;
  departure_time: string;
  accommodation_budget_lkr?: number | null;
  total_budget_lkr?: number | null;
  selected_flight?: FlightOption | null;
  flight_plan?: Record<string, unknown> | null;
  include_gemini: boolean;
  include_roadlk: boolean;
  include_weather: boolean;
  include_crowd: boolean;
  response_mode: 'slim';
};

export type PlanPayload = {
  session_id?: string;
  trip_days?: number;
  trip_dates?: string[];
  duration_text?: string;
  origin_resolved?: Record<string, unknown>;
  destination_resolved?: Record<string, unknown>;
  recommended_route?: Record<string, unknown>;
  route_data?: Record<string, unknown>;
  weather_data?: Record<string, unknown> | unknown[];
  road_alerts?: unknown[];
  crowd_signals?: Record<string, unknown>;
  budget_summary?: Record<string, unknown>;
  flight_plan?: Record<string, unknown>;
  itinerary_guidance?: Record<string, unknown>;
  [key: string]: unknown;
};

export type Coordinate = {
  latitude: number;
  longitude: number;
};

export type ResolvedPlace = Coordinate & {
  name?: string;
  formatted_address?: string;
  address?: string;
};

export type AttractionCrowd = {
  score?: number | null;
  level?: string | null;
  source?: string | null;
  reasons?: string[];
  best_visit_window?: string | null;
  wiki_interest?: number | null;
};

export type DailyAttraction = {
  place_id?: string | null;
  name?: string | null;
  district?: string | null;
  rating?: number | null;
  types?: string[];
  latitude?: number | null;
  longitude?: number | null;
  location?: Partial<Coordinate> | null;
  crowd?: AttractionCrowd | null;
  weather_suitability?: {
    level?: string | null;
    reason?: string | null;
  } | null;
  recommended_time?: string | null;
  action?: string | null;
};

export type WeatherBriefing = {
  status?: string | null;
  condition?: string | null;
  weather_code?: number | null;
  temperature_max_c?: number | null;
  temperature_min_c?: number | null;
  rain_probability_pct?: number | null;
  rainfall_mm?: number | null;
  wind_speed_kph?: number | null;
  risk_level?: string | null;
  risk_score?: number | null;
  reasons?: string[];
  guidance?: string | null;
};

export type RoadIncident = {
  report_number?: string | null;
  location?: string | null;
  district?: string | null;
  damage_type?: string | null;
  status?: string | null;
  passability?: string | null;
  distance_to_route_meters?: number | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type DailyBriefing = {
  day?: number;
  date?: string | null;
  title?: string | null;
  location_label?: string | null;
  overall_status?: string | null;
  summary?: string | null;
  route?: {
    distance_km?: number | null;
    duration_seconds?: number | null;
    start_point?: unknown;
    end_point?: unknown;
  } | null;
  weather?: WeatherBriefing | null;
  crowd?: {
    risk_level?: string | null;
    score?: number | null;
    preferred_visit_window?: string | null;
    reasons?: string[];
    components?: Record<string, unknown>;
  } | null;
  attractions?: DailyAttraction[];
  roads?: {
    risk_level?: string | null;
    route_alert_count?: number | null;
    critical_count?: number | null;
    route_wide_unlocated_count?: number | null;
    last_updated?: string | null;
    incidents?: RoadIncident[];
    guidance?: string | null;
  } | null;
  accommodation?: {
    place_id?: string | null;
    name?: string | null;
    location?: string | null;
    rating?: number | null;
    price_lkr?: number | null;
    price_label?: string | null;
  } | null;
  costs?: {
    accommodation_lkr?: number | null;
    estimated_transport_lkr?: number | null;
    tracked_total_lkr?: number | null;
    excludes?: string[];
  } | null;
  recommendations?: string[];
  fallback_plan?: string | null;
};

export type RouteSegment = {
  day?: number;
  day_label?: string | null;
  segment_distance_km?: number | null;
  segment_duration_seconds?: number | null;
  segment_path_points?: unknown[];
  start_point?: unknown;
  mid_point?: unknown;
  end_point?: unknown;
  selected_attractions?: DailyAttraction[];
};

export type RecommendedRoute = {
  route_id?: string | null;
  route_labels?: string[];
  distance_meters?: number | null;
  duration?: string | number | null;
  polyline?: string | null;
  geometry_point_count?: number | null;
  geometry_distance_m?: number | null;
  sampled_points?: unknown[];
  segment_count?: number | null;
  segments?: RouteSegment[];
  road_alerts?: RoadIncident[];
};

export type DashboardPayload = {
  session_id: string;
  trip_requirements?: TripRequirements;
  plan_overview?: {
    trip_days?: number;
    trip_dates?: string[];
    duration_text?: string;
    warnings?: string[];
    session_storage?: Record<string, unknown>;
  };
  budget?: Record<string, unknown>;
  package_explanation?: Record<string, unknown>;
  daily_briefings?: DailyBriefing[];
  transport_cost?: Record<string, unknown>;
  route?: {
    origin_resolved?: ResolvedPlace | Record<string, unknown>;
    destination_resolved?: ResolvedPlace | Record<string, unknown>;
    route_data?: Record<string, unknown>;
    recommended_route?: RecommendedRoute;
    travel_windows?: unknown[];
  };
  crowd?: Record<string, unknown>;
  weather_data?: Record<string, unknown> | unknown[];
  road_alerts?: unknown[];
  itinerary?: Record<string, unknown>;
  dashboard_cache?: {
    location_heatmap_points?: unknown[];
    time_heatmap_cells?: unknown[];
    [key: string]: unknown;
  };
  condition_updates?: Record<string, unknown>;
  emotion?: Record<string, unknown>;
  [key: string]: unknown;
};

export type ConditionChange = {
  signal?: 'weather' | 'crowd' | 'roads' | string;
  previous_level?: string;
  current_level?: string;
  previous_value?: number | string | null;
  current_value?: number | string | null;
  summary?: string;
};

export type ConditionRecommendation = {
  headline?: string;
  action?: string;
  alternative_search_recommended?: boolean;
  contextual_alternatives_request?: Record<string, unknown> | null;
};

export type ConditionNotification = {
  id?: string;
  notification_id?: string;
  title?: string;
  message?: string;
  speech_text?: string;
  severity?: string;
  category?: string;
  day?: number | null;
  location_label?: string;
  changes?: ConditionChange[];
  recommendation?: ConditionRecommendation;
  created_at?: string;
  read?: boolean;
  [key: string]: unknown;
};

export type ConditionNotificationsResponse = {
  session_id: string;
  items: ConditionNotification[];
  unread_count: number;
  total_count: number;
};

export type ContextualAlternative = {
  name?: string;
  category?: string;
  category_label?: string;
  distance_km?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  reason?: string;
  why_recommended?: string;
  interest_matches?: string[];
  score?: number | null;
  map_url?: string;
  [key: string]: unknown;
};

export type ContextualAlternativeGroup = {
  day?: number | null;
  date?: string | null;
  original_attraction?: {
    place_id?: string | null;
    name?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  };
  trigger?: Record<string, unknown>;
  alternatives?: ContextualAlternative[];
  status?: string;
  guidance?: string;
  error?: string | null;
};

export type ContextualAlternativesResponse = {
  alternatives?: ContextualAlternative[];
  items?: ContextualAlternative[];
  recommendation_groups?: ContextualAlternativeGroup[];
  message?: string;
  limitations?: string[];
  [key: string]: unknown;
};

export type NearbyMoodTip = {
  name?: string;
  category?: string;
  distance_km?: number | null;
  reason?: string;
  hobby_matches?: string[];
  interest_match?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  map_url?: string;
  score?: number | null;
  top_pick?: boolean;
  [key: string]: unknown;
};

export type NearbyMoodTips = {
  status?: string;
  location?: string;
  hobbies?: string[];
  summary?: string;
  headline?: string;
  recommendations?: NearbyMoodTip[];
  message?: string;
  disclaimer?: string;
  [key: string]: unknown;
};

export type EmotionCheckinResponse = {
  session_id: string;
  checkin?: Record<string, unknown>;
  recommendation?: Record<string, unknown>;
  emotion_summary?: Record<string, unknown>;
  nearby_tips?: NearbyMoodTips | NearbyMoodTip[];
  privacy?: Record<string, unknown>;
};

export type EmotionLabel = 'anger' | 'happy' | 'neutral' | 'sad' | 'surprise' | 'uncertain';

export type EmotionTarget = {
  attraction_id: string;
  attraction_name: string;
  day: number;
  day_label?: string;
  order?: number;
  district?: string;
  category?: string;
  latitude?: number | null;
  longitude?: number | null;
  checkin_radius_meters?: number;
  source?: string;
};

export type EmotionCheckinRecord = {
  checkin_id?: string;
  day?: number;
  attraction_id?: string;
  attraction_name?: string;
  emotion_label?: EmotionLabel | string;
  emotion_confidence?: number;
  timestamp?: string;
  user_location?: Partial<Coordinate> | null;
  hobbies?: string[];
};

export type EmotionTargetsResponse = {
  session_id: string;
  target_count: number;
  targets: EmotionTarget[];
  emotion_checkins?: EmotionCheckinRecord[];
  emotion_summary?: Record<string, unknown>;
  mobile_flow?: Record<string, unknown>;
};

export type LatestSessionResponse = {
  session_id: string;
  [key: string]: unknown;
};
