# Trip Map: Black Screen + "Guide Like Google Maps" Feasibility

This is a findings/recommendation document only — nothing here has been
implemented. It covers two related but separate reports: the map rendering
as a black area after starting a trip, and whether turn-by-turn navigation
("guide the road like Google Maps") is realistic to build.

## 1. Why the map shows a black area

`TripMonitorScreen.tsx` and `IoTDashboardScreen.tsx` both render a
`react-native-maps` `<MapView>` with no explicit `provider` prop, so on
Android it defaults to Google Maps — and Google Maps tiles render as a flat
black surface (not a placeholder, not an error message) when the API key is
missing, invalid, or not actually wired into the build the app is running.
There are two distinct, platform-specific causes here, not one:

### Android — the likely cause

- `app.config.js` wires `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` into
  `android.config.googleMaps.apiKey` **only**. This value is baked in at
  **native prebuild time** (EAS Build or `expo prebuild` / dev client) — it
  has no effect at all in Expo Go, because Expo Go is a pre-built generic
  container that can't embed a per-project native config. If testing has
  been happening via Expo Go (the default `npx expo start` flow this
  project's own `LOCAL_DEV_SETUP.md` documents), the key was never going to
  take effect regardless of whether it's set correctly in `.env` — that
  alone would fully explain a consistently black map on Android.
- Separately, `config/maps.ts` computes `hasNativeGoogleMapsKey` (a boolean
  check for whether the env var is set) but nothing in the app ever reads
  it — it's imported in `features/dashboard/DashboardSections.tsx` and
  otherwise unused, and never imported at all in `IoTDashboardScreen.tsx` or
  `TripMonitorScreen.tsx`. So even when the key genuinely is missing, there's
  no fallback UI (a message, a static image, anything) — the screen just
  silently renders black with no signal to the user or the developer about
  why.

### iOS — investigate as a likely separate bug

- `app.json` has **no** Google Maps key wiring at all for iOS. This isn't
  necessarily broken by itself — `react-native-maps` on iOS defaults to
  Apple Maps, which needs no API key — but it means an iOS black-map report
  is probably not the same root cause as Android's, and should be diagnosed
  independently rather than assumed to be "the same missing key" issue.

### Fix shape (not implemented here)

1. Confirm whether testing has been via Expo Go or a native/dev-client
   build. If Expo Go, that alone explains the Android symptom — a real fix
   needs `expo prebuild` / a dev client / EAS build, not just setting the
   env var.
2. Add an explicit `provider={PROVIDER_GOOGLE}` (or deliberately omit it if
   Apple/default maps are acceptable on iOS) so the provider choice is a
   decision, not a default nobody looked at.
3. Gate rendering on `hasNativeGoogleMapsKey` (already computed, just
   unused) — show a clear "Map unavailable — missing configuration" state
   instead of a silent black rectangle, matching how
   `features/dashboard/DashboardMap.tsx` already handles its own loading/
   error states for its Leaflet-in-WebView map.

## 2. The route-drawing gap (distinct from the black-screen bug)

Even with the map rendering correctly, `TripMonitorScreen.tsx` currently
draws **only a raw GPS breadcrumb trail** — it pushes each new
`gps.latitude/longitude` reading onto a `Polyline` as the vehicle reports
it. There is no call to any routing API from this screen, and no road
snapping — the "route" is just wherever the vehicle happened to have GPS
fixes, which looks jagged/noisy compared to a real road-following line.

This is notable because **the backend already has a working, real routing
integration** it just isn't reused here:

- `integrations/google_routes_client.py` calls the **Google Routes API v2**
  (`computeRoutes`), including route-sanity filtering (rejects unreasonably
  long or off-corridor routes).
- `routes/polyline.py` decodes the returned encoded polyline into
  drawable points.
- This is currently wired into the **trip-planning** flow only
  (`POST /plan` → `RouteGenerationService` → the dashboard's trip-overview
  map), not into the **live IoT trip-monitor** screen.

So "draw the actual computed route on the live trip map, not just a
breadcrumb trail" is a comparatively small, cheap win: it reuses existing,
already-working backend code — it does not require a new integration.

## 3. Is full turn-by-turn navigation ("like Google Maps") realistic?

Yes, but the effort/cost varies enormously depending on how literally
"like Google Maps" is meant. Three tiers, by increasing effort:

### Tier 1 — Draw the real route (cheap, reuses existing backend code)

Fetch/pass through the already-computed Google Routes API route for the
current trip and render its decoded polyline on `TripMonitorScreen`'s map
as a second line, alongside (or instead of) the raw breadcrumb trail. No
new integration, no new dependency, no new cost — the hard part
(calling the API, decoding the polyline, sanity-filtering the result) is
already built and tested for the trip-planning flow.

**Not included at this tier**: turn-by-turn voice prompts, live rerouting,
lane guidance, ETA recalculation. This tier only makes the drawn line look
like a real road-following route instead of a noisy breadcrumb trail.

### Tier 2 — Basic step-by-step guidance (moderate, custom-built)

The Google Routes API response already includes maneuver-level step data
(turn instructions, distances, road names) when requested. A moderate
custom build could:
- Show the next upcoming instruction as text ("Turn left onto X Road in
  200m") derived from the existing route response.
- Optionally speak it via the same `expo-speech` mechanism already used
  for drowsiness voice alerts (`hooks/useAlertAudio.ts`).
- Advance to the next step by comparing live GPS position against each
  step's end point.

This is real engineering (maneuver-advance logic, distance-remaining
calculation, handling GPS noise near turns) but stays within this
project's existing stack — no new SDK, no new vendor relationship, no
recurring navigation-specific cost beyond the Routes API calls already
budgeted for trip planning.

**Not included at this tier**: automatic rerouting when the driver leaves
the planned route, lane-level guidance, live traffic-aware ETA updates
mid-trip.

### Tier 3 — Full commercial-grade navigation (high effort/cost)

Real maneuver detection with rerouting, lane guidance, live traffic, and
polished voice prompts is what dedicated navigation SDKs exist to solve —
building it from scratch is a multi-week-to-multi-month undertaking with
significant edge-case surface (GPS drift, tunnel loss, off-route
detection thresholds, re-route debouncing). The realistic paths here are:

- **Google Maps Navigation SDK** (Android/iOS) — the same navigation
  engine Google Maps itself uses, but it does not have an official,
  first-party React Native wrapper; using it from this Expo/RN app would
  mean either a third-party bridging library (maintenance/reliability risk)
  or writing a native module. Also a distinct commercial license/pricing
  tier from the Maps/Routes APIs already in use.
- **Mapbox Navigation SDK** — has better-maintained community React Native
  wrappers, but adopting it means switching map/tile providers (or running
  two map stacks side by side) and a separate Mapbox account and pricing
  structure.
- **Heavy custom engineering** — technically possible by extending Tier 2
  (rerouting = re-calling Routes API when off-route past a threshold;
  lane guidance would need a data source this project doesn't currently
  have access to at all) — but this is realistically a dedicated project
  in its own right, not an incremental feature.

### Recommendation

Ship **Tier 1 now** — it's nearly free given the existing backend code and
directly fixes "the route doesn't look like a real road." Consider **Tier
2** as a real, scoped follow-up if spoken step-by-step guidance is a
priority — it's a genuine feature build but stays inside the current stack
and budget. Treat **Tier 3** as a distinct, separately-scoped
initiative (likely with its own budget/timeline decision) rather than
something to fold into incremental IoT app work — the SDK/vendor decision
alone (Google vs. Mapbox vs. custom) deserves its own evaluation before any
implementation starts.
