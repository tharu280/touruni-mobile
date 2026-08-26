import React, { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIoT } from '../context/IoTContext';
import { useAppSession } from '../context/AppSessionContext';
import { endTrip } from '../api/iotClient';
import { useSessionDashboard } from '../hooks/useSessionDashboard';
import { useSpeedProximityAlerts } from '../hooks/useSpeedProximityAlerts';
import { DeviceStatusLegend } from '../components/DeviceStatusLegend';
import { hasNativeGoogleMapsKey } from '../config/maps';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme/colors';
import { ALERT_TIER_COLORS, ALERT_TIER_LABELS, type AlertTier } from '../types/iot';

// Trigger the phone-GPS fallback once the hub's GPS has gone quiet for this
// long, in addition to "never had a fix" — a live trip can lose signal
// mid-drive (tunnel, dead zone), not just at the start.
const GPS_FALLBACK_STALE_MS = 30_000;

type Props = NativeStackScreenProps<RootStackParamList, 'IoTTripMonitor'>;

interface LatLng { latitude: number; longitude: number; }

// Trip elapsed time formatter
function formatElapsed(startIso: string): string {
  const diffMs = Date.now() - new Date(startIso).getTime();
  const totalSec = Math.floor(diffMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h > 0
    ? `${h}h ${m.toString().padStart(2, '0')}m`
    : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export const TripMonitorScreen = ({ navigation, route }: Props) => {
  const { deviceId, tripId, sessionId } = route.params;
  const { accessToken } = useAppSession();
  // Only set when this trip was started from an already-planned, already-
  // routed itinerary (PlanResultScreen's device-picker flow) — an ad-hoc
  // trip (started directly from DeviceListScreen) has no sessionId and
  // simply gets no planned-route overlay, unchanged from before.
  const { model: planModel } = useSessionDashboard(sessionId, accessToken);
  const routeCoordinates = planModel?.routeCoordinates ?? [];
  const hasFitRouteRef = useRef(false);
  const {
    liveData,
    firebaseConnected,
    deviceOnline,
    dataAgeMs,
    recentAlerts,
    setActiveTripId,
  } = useIoT();

  const [tripStart] = useState(new Date().toISOString());
  const [ending, setEnding] = useState(false);

  // GPS trail (ring buffer, max 500 points — no state, no re-render on push)
  const trailRef = useRef<LatLng[]>([]);
  const [trail, setTrail] = useState<LatLng[]>([]);
  const mapRef = useRef<MapView | null>(null);

  const gps = liveData?.gps;
  const tier = (liveData?.alertTier ?? 0) as AlertTier;
  const tierColor = ALERT_TIER_COLORS[tier];
  const { speeding, tooClose } = useSpeedProximityAlerts(liveData ?? null);

  // Update trail when GPS changes
  React.useEffect(() => {
    if (!gps?.fixed) return;
    const pt = { latitude: gps.latitude, longitude: gps.longitude };
    trailRef.current.push(pt);
    if (trailRef.current.length > 500) trailRef.current.shift();
    setTrail([...trailRef.current]);

    // Animate camera to follow vehicle
    mapRef.current?.animateCamera({ center: pt, zoom: 16 }, { duration: 800 });
  }, [gps?.latitude, gps?.longitude]);

  // Frame the planned route once, when it first loads — a ref guard (not
  // state) so this never re-renders or re-fires, and deliberately doesn't
  // coordinate with the live-follow effect above: once real GPS starts
  // ticking, animateCamera naturally takes over on every subsequent update.
  React.useEffect(() => {
    if (!routeCoordinates.length || hasFitRouteRef.current) return;
    hasFitRouteRef.current = true;
    const timer = setTimeout(() => {
      mapRef.current?.fitToCoordinates(routeCoordinates, {
        animated: true,
        edgePadding: { top: 120, right: 44, bottom: 260, left: 44 },
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [routeCoordinates]);

  // ── Phone-location fallback ─────────────────────────────────────────────
  // Unlike IoTDashboardScreen's one-shot pre-trip snapshot, this is a live
  // trip: hub GPS can go stale mid-drive (tunnel, dead zone), not just be
  // missing at the start, so this watches continuously and reverts the
  // instant real vehicle GPS resumes.
  const [phoneLocation, setPhoneLocation] = useState<LatLng | null>(null);
  const gpsStale = !gps?.fixed || (dataAgeMs !== null && dataAgeMs > GPS_FALLBACK_STALE_MS);

  React.useEffect(() => {
    if (!gpsStale) {
      setPhoneLocation(null);
      return;
    }
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 3000, distanceInterval: 10 },
        (position) => {
          if (cancelled) return;
          const pt = { latitude: position.coords.latitude, longitude: position.coords.longitude };
          setPhoneLocation(pt);
          mapRef.current?.animateCamera({ center: pt, zoom: 16 }, { duration: 800 });
        }
      );
    })();
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [gpsStale]);

  const usingPhoneFallback = gpsStale && !!phoneLocation;
  const mapCoordinate = usingPhoneFallback
    ? phoneLocation!
    : gps?.fixed
      ? { latitude: gps.latitude, longitude: gps.longitude }
      : (planModel?.originCoordinate ?? routeCoordinates[0] ?? null);

  // Google Maps renders as a flat black surface (no error, no placeholder)
  // when the API key isn't actually wired into the running build — show a
  // real "unavailable" state instead of a silent black rectangle. Only
  // relevant on Android (this only ever takes effect in a native
  // prebuild/dev-client/EAS build, never Expo Go); iOS defaults to Apple
  // Maps, which needs no key.
  const mapUnavailable = Platform.OS === 'android' && !hasNativeGoogleMapsKey;

  // ── End trip ───────────────────────────────────────────────────────────────
  const handleEndTrip = useCallback(() => {
    Alert.alert('End Trip', 'Are you sure you want to end this trip?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Trip',
        style: 'destructive',
        onPress: async () => {
          if (!accessToken) return;
          setEnding(true);
          try {
            await endTrip(accessToken, tripId);
          } catch {
            // non-fatal if backend unreachable — still clear local state
          } finally {
            setActiveTripId(null);
            navigation.goBack();
          }
        },
      },
    ]);
  }, [accessToken, tripId, navigation, setActiveTripId]);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Full-screen map. Stays on native react-native-maps (unlike
          features/dashboard/DashboardMap.tsx's Leaflet-in-WebView approach
          for the static trip-planning map) because this screen re-centers
          the camera on every ~3s live GPS tick — cheap on a native MapView,
          not on a WebView map. Don't "unify" the two implementations. */}
      {mapUnavailable ? (
        <View style={[StyleSheet.absoluteFill, styles.mapUnavailable]}>
          <Ionicons name="map-outline" size={32} color="#4A6258" />
          <Text style={styles.mapUnavailableText}>
            Map unavailable — missing configuration
          </Text>
        </View>
      ) : (
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          mapType="standard"
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={
            mapCoordinate
              ? { ...mapCoordinate, latitudeDelta: 0.01, longitudeDelta: 0.01 }
              : { latitude: 6.9, longitude: 79.97, latitudeDelta: 0.05, longitudeDelta: 0.05 }
          }
        >
          {routeCoordinates.length > 1 && (
            <Polyline
              coordinates={routeCoordinates}
              strokeColor="#4A90D9"
              strokeWidth={3}
              lineDashPattern={[8, 6]}
            />
          )}
          {planModel?.originCoordinate && (
            <Marker coordinate={planModel.originCoordinate} pinColor="#4A90D9" title="Start" />
          )}
          {planModel?.destinationCoordinate && (
            <Marker coordinate={planModel.destinationCoordinate} pinColor="#4A90D9" title="Destination" />
          )}

          {!usingPhoneFallback && trail.length > 1 && (
            <Polyline coordinates={trail} strokeColor="#27B987" strokeWidth={3} />
          )}
          {!usingPhoneFallback && gps?.fixed && (
            <Marker coordinate={{ latitude: gps.latitude, longitude: gps.longitude }} pinColor="#27B987" />
          )}
          {usingPhoneFallback && (
            <Marker
              coordinate={phoneLocation!}
              title="Approximate · Your Location"
              pinColor="#4A90D9"
            />
          )}
        </MapView>
      )}

      {/* ── Top overlay ──────────────────────────────────────────────────── */}
      <View style={styles.topOverlay}>
        {/* Tier badge */}
        <View style={[styles.tierBadge, { borderColor: tierColor }]}>
          <Text style={[styles.tierText, { color: tierColor }]}>{ALERT_TIER_LABELS[tier]}</Text>
          {liveData && (
            <Text style={styles.riskPct}>{(liveData.riskScore * 100).toFixed(0)}%</Text>
          )}
        </View>

        {/* Elapsed time */}
        <View style={styles.elapsedBadge}>
          <Ionicons name="time-outline" size={14} color="#27B987" />
          <Text style={styles.elapsedText}>{formatElapsed(tripStart)}</Text>
        </View>
      </View>

      {/* ── Bottom panel ─────────────────────────────────────────────────── */}
      <View style={styles.bottomPanel}>
        {/* Live metrics row */}
        <View style={styles.metricsRow}>
          <View style={styles.metric}>
            <Text style={styles.metricVal}>
              {gps?.speedKmh?.toFixed(0) ?? '—'}
            </Text>
            <Text style={styles.metricLbl}>km/h</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricVal}>
              {liveData?.vehicle?.distanceCm != null
                ? `${(liveData.vehicle.distanceCm / 100).toFixed(1)}m`
                : '—'}
            </Text>
            <Text style={styles.metricLbl}>Distance</Text>
          </View>
          <View style={styles.metric}>
            <Text style={[
              styles.metricVal,
              { color: (liveData?.driver?.drowsyLevel ?? 0) >= 3 ? '#E8441A' : '#FFFFFF' },
            ]}>
              {liveData?.driver?.drowsyLevel ?? '—'}
            </Text>
            <Text style={styles.metricLbl}>Drowsy Lvl</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricVal}>{recentAlerts.length}</Text>
            <Text style={styles.metricLbl}>Alerts</Text>
          </View>
        </View>

        {/* Recent alert pills */}
        {recentAlerts.length > 0 && (
          <View style={styles.alertsRow}>
            {recentAlerts.slice(0, 3).map((a) => (
              <View
                key={a.event_id}
                style={[styles.alertPill, { borderColor: ALERT_TIER_COLORS[a.alert_tier] }]}
              >
                <Text style={[styles.alertPillText, { color: ALERT_TIER_COLORS[a.alert_tier] }]}>
                  Tier {a.alert_tier} · {new Date(a.triggered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Speed / following-distance warnings — client-computed, independent
            of the device-fused drowsiness alertTier above. Placed above the
            connectivity/mode banners since these represent an active,
            actionable safety condition. */}
        {speeding && (
          <View style={styles.speedBanner}>
            <Ionicons name="speedometer-outline" size={14} color="#E8441A" />
            <Text style={styles.speedBannerText}>
              Speeding — {gps?.speedKmh?.toFixed(0) ?? '—'} km/h
            </Text>
          </View>
        )}
        {tooClose && (
          <View style={styles.proximityBanner}>
            <Ionicons name="warning-outline" size={14} color="#E8441A" />
            <Text style={styles.proximityBannerText}>Vehicle ahead too close</Text>
          </View>
        )}

        {/* Connection state */}
        {!firebaseConnected && (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline-outline" size={14} color="#F5A623" />
            <Text style={styles.offlineText}>No connection — showing cached data</Text>
          </View>
        )}

        {/* Demo Mode transparency badge — device is substituting simulated
            GPS/speed (real distance + drowsiness), toggled from IoTDashboardScreen */}
        {liveData?.demoMode && (
          <View style={styles.demoModeBanner}>
            <Ionicons name="film-outline" size={14} color="#C9A0DC" />
            <Text style={styles.demoModeText}>Demo Mode · simulated GPS</Text>
          </View>
        )}

        {/* Phone-GPS fallback state */}
        {usingPhoneFallback && (
          <View style={styles.phoneGpsBanner}>
            <Ionicons name="phone-portrait-outline" size={14} color="#4A90D9" />
            <Text style={styles.phoneGpsText}>
              Vehicle GPS signal lost — showing your phone's approximate location
            </Text>
          </View>
        )}

        {/* Device status legend */}
        <DeviceStatusLegend
          alertTier={tier}
          deviceOnline={deviceOnline}
          driverVisible={liveData?.driver?.driverVisible ?? false}
          gpsFixed={gps?.fixed ?? false}
        />

        {/* End trip button */}
        <Pressable
          style={({ pressed }) => [styles.endBtn, pressed && styles.pressed, ending && styles.disabled]}
          onPress={handleEndTrip}
          disabled={ending}
        >
          <Ionicons name="stop-circle-outline" size={20} color="#E8441A" />
          <Text style={styles.endBtnText}>End Trip</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  mapUnavailable: {
    backgroundColor: '#0A1F16',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  mapUnavailableText: { color: '#4A6258', fontFamily: fonts.body, fontSize: 13 },
  topOverlay: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    zIndex: 10,
  },
  tierBadge: {
    backgroundColor: 'rgba(8,28,20,0.88)',
    borderRadius: 16,
    borderWidth: 1.5,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  tierText: { fontFamily: fonts.bodySemibold, fontSize: 14, fontWeight: '700' },
  riskPct: { color: '#9FBAAD', fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  elapsedBadge: {
    backgroundColor: 'rgba(8,28,20,0.88)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(39,185,135,0.3)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  elapsedText: { color: '#FFFFFF', fontFamily: fonts.bodySemibold, fontSize: 14, fontWeight: '700' },
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(8,28,20,0.95)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: 'rgba(39,185,135,0.2)',
    padding: 20,
    gap: 14,
  },
  metricsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  metric: { alignItems: 'center', gap: 3 },
  metricVal: { color: '#FFFFFF', fontFamily: fonts.displayBold, fontSize: 20 },
  metricLbl: { color: '#7C9B8C', fontFamily: fonts.body, fontSize: 12 },
  alertsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  alertPill: {
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: 'transparent',
  },
  alertPillText: { fontFamily: fonts.body, fontSize: 11 },
  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(245,166,35,0.1)',
    borderRadius: 10, padding: 10,
  },
  offlineText: { color: '#F5A623', fontFamily: fonts.body, fontSize: 12 },
  speedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(232,68,26,0.12)',
    borderRadius: 10, padding: 10,
  },
  speedBannerText: { color: '#E8441A', fontFamily: fonts.bodySemibold, fontSize: 12, fontWeight: '700' },
  proximityBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(232,68,26,0.12)',
    borderRadius: 10, padding: 10,
  },
  proximityBannerText: { color: '#E8441A', fontFamily: fonts.bodySemibold, fontSize: 12, fontWeight: '700' },
  demoModeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(201,160,220,0.12)',
    borderRadius: 10, padding: 10,
  },
  demoModeText: { color: '#C9A0DC', fontFamily: fonts.body, fontSize: 12 },
  phoneGpsBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(74,144,217,0.1)',
    borderRadius: 10, padding: 10,
  },
  phoneGpsText: { color: '#4A90D9', fontFamily: fonts.body, fontSize: 12, flex: 1 },
  endBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 28, minHeight: 54,
    backgroundColor: 'rgba(232,68,26,0.12)',
    borderWidth: 1, borderColor: 'rgba(232,68,26,0.4)',
  },
  endBtnText: { color: '#E8441A', fontFamily: fonts.bodySemibold, fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.5 },
});
