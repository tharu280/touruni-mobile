# TripMind (touruni-mobile)

Expo / React Native frontend for TripMind — an AI-powered Sri Lanka travel
planner. Talks to the FastAPI backend in `../backend/clean_run`.

See `AGENTS.md` before writing code: this project runs Expo SDK 57, and its
behavior can differ from older SDK docs you may already know.

See `../LOCAL_DEV_SETUP.md` for the full backend + frontend + emulator setup
guide. Quick version:

## Setup

```bash
npm install
```

Create `.env` (see `.env.example`):

```env
EXPO_PUBLIC_BACKEND_URL=http://<your-mac-LAN-IP>:7860
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=      # native Android Maps builds only

# Optional — IoT live-data feature. App runs fine without these; Firebase
# init is skipped and IoT screens show a "not configured" state instead
# of crashing. See src/firebase/firebaseConfig.ts.
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_DATABASE_URL=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
```

Use your Mac's real LAN IP (`ipconfig getifaddr en0`), not `localhost` —
physical devices and most emulator network configs can't reach the host via
`localhost`.

## Run

```bash
npx expo start --lan --port 8082
```

(`--port 8082` only needed if something else already owns 8081 on your
machine.)

Android emulator:

```bash
npx expo start --lan --port 8082 --android
```

`--android` opens the project on whatever emulator/device `adb` sees as
connected, auto-installing Expo Go there on first run.

Web preview:

```bash
npm run web
```

## Gotchas

- If Metro reports `Unable to resolve "<package>"` for something that
  genuinely is in `package.json` and `node_modules`, the install is likely
  corrupted (silently incomplete package, e.g. missing a `src/` directory)
  rather than actually missing. Fix with `rm -rf node_modules && npm ci`,
  then restart Expo with `--clear`.
- After `npx expo install <new-native-package>`, restart Metro with
  `--clear` once so it doesn't serve a stale module map.
- `IoTProvider` wraps the entire app in `App.tsx`. Anything that eagerly
  throws during its module's import chain (like an unconfigured Firebase
  client used to) takes down every screen, not just IoT ones — keep new
  IoT-side integrations lazy/guarded for the same reason.
