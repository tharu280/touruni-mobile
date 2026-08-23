import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIoT } from '../context/IoTContext';
import { useAppSession } from '../context/AppSessionContext';
import { startTrip, setDemoMode } from '../api/iotClient';
import { hasNativeGoogleMapsKey } from '../config/maps';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme/colors';
import { ALERT_TIER_COLORS, ALERT_TIER_LABELS, type AlertTier } from '../types/iot';

// Google Maps renders as a flat black surface (no error, no placeholder)
// when the API key isn't actually wired into the running build — show a
// real "unavailable" state instead. Only relevant on Android (this only
// ever takes effect in a native prebuild/dev-client/EAS build, never Expo
// Go); iOS defaults to Apple Maps, which needs no key.
const MAP_UNAVAILABLE = Platform.OS === 'android' && !hasNativeGoogleMapsKey;

type Props = NativeStackScreenProps<RootStackParamList, 'IoTDashboard'>;

export const IoTDashboardScreen = ({ navigation, route }: Props) => {
  const { deviceId } = route.params;
  const { accessToken } = useAppSession();
  const {
    liveData,
    deviceOnline,
    firebaseConnected,
    firebaseError,
    activeTripId,
    setActiveTripId,
  } = useIoT();

  const [startingTrip, setStartingTrip] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ── Demo Mode toggle — live-switches the REAL device's own GPS/speed
  // simulation (see checkDemoModeCommand() in the firmware). Local state is
  // optimistic (reflects the last command sent); liveData.demoMode confirms
  // once the device has actually picked it up on its next ~3s poll.
  const [demoModeOn, setDemoModeOn] = useState(false);
  const [togglingDemo, setTogglingDemo] = useState(false);

  const handleToggleDemoMode = async (value: boolean) => {
    if (!accessToken) return;
    setDemoModeOn(value);
    setTogglingDemo(true);
    try {
      await setDemoMode(accessToken, deviceId, value);
    } catch (e) {
      setDemoModeOn(!value); // revert the optimistic flip
      Alert.alert('Demo Mode', e instanceof Error ? e.message : 'Could not update demo mode.');
    } finally {
      setTogglingDemo(false);
    }
  };

  // Pulse animation for critical tier
  useEffect(() => {
    const tier = liveData?.alertTier ?? 0;
    if (tier >= 3) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.04, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [liveData?.alertTier]);

  // ── Start trip ────────────────────────────────────────────────────────────
  const handleStartTrip = async () => {
    setStartingTrip(true);
    try {
      if (!accessToken) return;
      const trip = await startTrip(accessToken, {
        device_id: deviceId,
        biometric_verified: true,
      });

      setActiveTripId(trip.trip_id);
      navigation.navigate('IoTTripMonitor', { deviceId, tripId: trip.trip_id });
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not start trip.');
    } finally {
      setStartingTrip(false);
    }
  };

  const hasData = !!liveData;
  const tier = (liveData?.alertTier ?? 0) as AlertTier;
  const tierColor = hasData ? ALERT_TIER_COLORS[tier] : '#7C9B8C';
  const tierLabel = hasData ? ALERT_TIER_LABELS[tier] : 'Waiting for Data';
  const gps = liveData?.gps;
  const driver = liveData?.driver;
  const vehicle = liveData?.vehicle;

  // ── Phone-location fallback — only while the hub hasn't reported a GPS fix.
  // One-shot read, not a live watch: this is a stand-in for the map, not a
  // tracking feature, and it's the phone's position, not the vehicle's.
  const [phoneLocation, setPhoneLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    if (gps?.fixed) return; // hub GPS is authoritative once it has a fix
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;
      try {
        const position = await Location.getCurrentPositionAsync({});
        if (!cancelled) {
          setPhoneLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        }
      } catch {
        // No fix available from the phone either — falls through to the placeholder.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gps?.fixed]);

  const usingPhoneFallback = !gps?.fixed && !!phoneLocation;

  // ── Connection status ────────────────────────────────────────────────────
  const connectionText = !firebaseConnected
    ? 'Reconnecting…'
    : deviceOnline
    ? `Connected · ${gps?.speedKmh?.toFixed(0) ?? '—'} km/h`
    : 'Device offline';
  const connectionColor = !firebaseConnected ? '#F5A623' : deviceOnline ? '#27B987' : '#4A6258';

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          onPress={navigation.goBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>IoT Monitor</Text>
          <View style={styles.connectionRow}>
            <View style={[styles.connectionDot, { backgroundColor: connectionColor }]} />
            <Text style={[styles.connectionBadge, { color: connectionColor }]}>{connectionText}</Text>
          </View>
        </View>
        <Pressable
          style={({ pressed }) => [styles.historyBtn, pressed && styles.pressed]}
          onPress={() => navigation.navigate('IoTAlertHistory', { deviceId })}
          accessibilityRole="button"
          accessibilityLabel="View alert history"
        >
          <Ionicons name="notifications-outline" size={22} color="#27B987" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Alert tier card — the one dominant status on this screen ───────── */}
        <Animated.View
          style={[
            styles.tierCard,
            { borderColor: hasData ? tierColor : 'rgba(255,255,255,0.08)' },
            { transform: [{ scale: pulseAnim }] },
          ]}
        >
          <View style={[styles.tierIconRing, { backgroundColor: `${tierColor}1A` }]}>
            <Ionicons
              name={!hasData ? 'radio-outline' : tier === 0 ? 'shield-checkmark' : tier === 1 ? 'warning' : 'alert-circle'}
              size={30}
              color={tierColor}
            />
          </View>
          <Text style={[styles.tierLabel, { color: tierColor }]}>{tierLabel}</Text>
          <Text style={styles.riskScore}>
            {hasData
              ? `Risk Score: ${(liveData!.riskScore * 100).toFixed(0)}%`
              : 'No telemetry received from this device yet'}
          </Text>
          <View style={[styles.liveBadge, { backgroundColor: `${tierColor}22` }]}>
            <View style={[styles.liveDot, { backgroundColor: tierColor }]} />
            <Text style={[styles.liveText, { color: tierColor }]}>
              {hasData ? 'Live Data' : 'No Data'}
            </Text>
          </View>
        </Animated.View>

        {/* Offline banner */}
        {!firebaseConnected && (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline-outline" size={16} color="#F5A623" />
            <Text style={styles.offlineText}>No connection — showing last known data</Text>
          </View>
        )}

        <View style={styles.detailGroup}>
          {/* ── GPS Map — vehicle GPS when the hub has a fix, otherwise the
              phone's own location as an approximate stand-in ────────────── */}
          {gps?.fixed || usingPhoneFallback ? (
            <View style={styles.mapCard}>
              {MAP_UNAVAILABLE ? (
                <View style={[StyleSheet.absoluteFill, styles.mapUnavailable]}>
                  <Ionicons name="map-outline" size={28} color="#4A6258" />
                  <Text style={styles.mapUnavailableText}>Map unavailable</Text>
                </View>
              ) : (
                <MapView
                  style={StyleSheet.absoluteFill}
                  provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                  region={{
                    latitude: gps?.fixed ? gps.latitude : phoneLocation!.latitude,
                    longitude: gps?.fixed ? gps.longitude : phoneLocation!.longitude,
                    latitudeDelta: 0.004,
                    longitudeDelta: 0.004,
                  }}
                  mapType="standard"
                >
                  {gps?.fixed ? (
                    <Marker
                      coordinate={{ latitude: gps.latitude, longitude: gps.longitude }}
                      title="Vehicle"
                      pinColor="#27B987"
                    />
                  ) : (
                    <Marker
                      coordinate={phoneLocation!}
                      title="Approximate · Your Location"
                      pinColor="#4A90D9"
                    />
                  )}
                </MapView>
              )}
              <View style={styles.gpsOverlay}>
                {gps?.fixed ? (
                  <>
                    <Text style={styles.gpsCoord}>
                      {gps.latitude.toFixed(5)} · {gps.longitude.toFixed(5)}
                    </Text>
                    <View style={styles.gpsRow}>
                      <Ionicons name="locate-outline" size={12} color="#27B987" />
                      <Text style={styles.gpsSub}>{gps.satellites} sats · ● Fix</Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.gpsRow}>
                    <Ionicons name="phone-portrait-outline" size={12} color="#4A90D9" />
                    <Text style={[styles.gpsSub, styles.gpsSubApprox]}>Approximate · Your Location</Text>
                  </View>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.mapPlaceholder}>
              <View style={styles.mapIconRing}>
                <Ionicons name="location-outline" size={26} color="#4A6258" />
              </View>
              <Text style={styles.mapPlaceholderText}>GPS not acquired</Text>
            </View>
          )}

          {/* ── Drowsiness panel ───────────────────────────────────────────── */}
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Drowsiness Detection</Text>
            <View style={styles.metricsRow}>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>{driver?.earScore?.toFixed(2) ?? '—'}</Text>
                <Text style={styles.metricLabel}>EAR</Text>
              </View>
              <View style={[styles.metric, styles.metricDivider]}>
                <Text style={styles.metricValue}>{driver?.drowsyLevel ?? '—'}</Text>
                <Text style={styles.metricLabel}>Drowsy Lvl</Text>
              </View>
              <View style={[styles.metric, styles.metricDivider]}>
                <Text style={[styles.metricValue, { color: driver?.eyeStatus === 'closed' ? '#E8441A' : '#27B987' }]}>
                  {driver?.eyeStatus ?? '—'}
                </Text>
                <Text style={styles.metricLabel}>Eyes</Text>
              </View>
              <View style={[styles.metric, styles.metricDivider]}>
                <Text style={styles.metricValue}>
                  {driver?.confidence != null ? `${(driver.confidence * 100).toFixed(0)}%` : '—'}
                </Text>
                <Text style={styles.metricLabel}>Confidence</Text>
              </View>
            </View>
          </View>

          {/* ── Vehicle panel ──────────────────────────────────────────────── */}
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Vehicle & Safety</Text>
            <View style={styles.metricsRow}>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>
                  {gps?.speedKmh != null ? `${gps.speedKmh.toFixed(0)}` : '—'}
                </Text>
                <Text style={styles.metricLabel}>km/h</Text>
              </View>
              <View style={[styles.metric, styles.metricDivider]}>
                <Text style={styles.metricValue}>
                  {vehicle?.distanceCm != null ? `${(vehicle.distanceCm / 100).toFixed(1)}m` : '—'}
                </Text>
                <Text style={styles.metricLabel}>Distance</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Start Trip / Trip in progress — the primary action ─────────── */}
        {activeTripId ? (
          <Pressable
            style={({ pressed }) => [styles.tripFrame, pressed && styles.pressed]}
            onPress={() => navigation.navigate('IoTTripMonitor', { deviceId, tripId: activeTripId })}
            accessibilityRole="button"
            accessibilityLabel="Trip in progress, view monitor"
          >
            <LinearGradient
              colors={['#27B987', '#169368']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.tripBtn}
            >
              <Ionicons name="pulse-outline" size={22} color="#FFFFFF" />
              <Text style={styles.tripBtnText}>Trip in Progress — View Monitor</Text>
            </LinearGradient>
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.tripFrame, pressed && styles.pressed, startingTrip && styles.disabled]}
            onPress={handleStartTrip}
            disabled={startingTrip}
            accessibilityRole="button"
            accessibilityLabel="Start trip with Face ID verification"
          >
            <LinearGradient
              colors={['#27B987', '#169368']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.tripBtn}
            >
              {startingTrip ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="play-circle-outline" size={22} color="#FFFFFF" />
                  <Text style={styles.tripBtnText}>Start Trip (Face ID)</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        )}

        {/* ── Demo Mode — live-toggles the real device's own GPS/speed
            simulation, for presentations where driving isn't possible.
            Distance and drowsiness stay real either way. ─────────────── */}
        <View style={styles.demoCard}>
          <View style={styles.demoTextWrap}>
            <View style={styles.demoTitleRow}>
              <Text style={styles.demoTitle}>Demo Mode</Text>
              {liveData?.demoMode && (
                <View style={styles.demoActivePill}>
                  <Text style={styles.demoActivePillText}>Active</Text>
                </View>
              )}
            </View>
            <Text style={styles.demoSub}>
              Simulates GPS location and speed for presentations — distance
              and drowsiness readings stay real.
            </Text>
          </View>
          <Switch
            value={demoModeOn}
            onValueChange={handleToggleDemoMode}
            disabled={togglingDemo || !accessToken}
            trackColor={{ false: '#2A3B34', true: '#27B987' }}
            thumbColor="#FFFFFF"
          />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(12,36,26,0.85)',
    borderWidth: 1, borderColor: 'rgba(39,185,135,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: '#FFFFFF', fontFamily: fonts.displayBold, fontSize: 18 },
  connectionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  connectionDot: { width: 6, height: 6, borderRadius: 3 },
  connectionBadge: { fontFamily: fonts.body, fontSize: 12 },
  historyBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },

  // Alert tier card
  tierCard: {
    backgroundColor: '#04100C',
    borderRadius: 20,
    borderWidth: 1.5,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  tierIconRing: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  tierLabel: { fontFamily: fonts.displayBold, fontSize: 22, letterSpacing: -0.5 },
  riskScore: { color: '#9FBAAD', fontFamily: fonts.body, fontSize: 13, textAlign: 'center' },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 20, paddingVertical: 4, paddingHorizontal: 12, marginTop: 4,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  liveText: { fontFamily: fonts.body, fontSize: 12 },

  // Offline banner
  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(245,166,35,0.1)',
    borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: 'rgba(245,166,35,0.3)',
    marginBottom: 12,
  },
  offlineText: { color: '#F5A623', fontFamily: fonts.body, fontSize: 13 },

  // Secondary detail cards — grouped tighter together as one cluster
  detailGroup: { gap: 12 },

  // Map
  mapCard: {
    height: 200, borderRadius: 20, overflow: 'hidden',
    backgroundColor: '#04100C',
    borderWidth: 1, borderColor: 'rgba(39,185,135,0.18)',
  },
  gpsOverlay: {
    position: 'absolute', bottom: 10, left: 12,
    backgroundColor: 'rgba(8,28,20,0.85)', borderRadius: 10,
    paddingVertical: 6, paddingHorizontal: 10,
  },
  gpsCoord: { color: '#C6DFD4', fontFamily: fonts.body, fontSize: 12 },
  gpsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  gpsSub: { color: '#7C9B8C', fontFamily: fonts.body, fontSize: 11 },
  gpsSubApprox: { color: '#8FB8E0' },
  mapUnavailable: {
    backgroundColor: '#04100C',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mapUnavailableText: { color: '#4A6258', fontFamily: fonts.body, fontSize: 12 },
  mapPlaceholder: {
    height: 130, borderRadius: 20,
    backgroundColor: '#04100C',
    borderWidth: 1, borderColor: 'rgba(39,185,135,0.18)',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  mapIconRing: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center', justifyContent: 'center',
  },
  mapPlaceholderText: { color: '#7C9B8C', fontFamily: fonts.body, fontSize: 13 },

  // Panels
  panel: {
    backgroundColor: '#04100C', borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(39,185,135,0.18)',
    padding: 16,
  },
  panelTitle: {
    color: '#C6DFD4', fontFamily: fonts.bodySemibold,
    fontSize: 13, fontWeight: '700', marginBottom: 14,
  },
  metricsRow: { flexDirection: 'row' },
  metric: { flex: 1, alignItems: 'center', gap: 4 },
  metricDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: 'rgba(255,255,255,0.08)' },
  metricValue: { color: '#FFFFFF', fontFamily: fonts.displayBold, fontSize: 22, letterSpacing: -0.5 },
  metricLabel: { color: '#7C9B8C', fontFamily: fonts.body, fontSize: 12 },

  // Start trip — the primary action, given the same gradient treatment as
  // other primary CTAs in the app (see DeviceRegistrationScreen).
  tripFrame: {
    borderRadius: 28, overflow: 'hidden', marginTop: 24,
    shadowColor: '#27B987', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
  },
  tripBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    minHeight: 60,
  },
  tripBtnText: { color: '#FFFFFF', fontFamily: fonts.bodySemibold, fontSize: 17, fontWeight: '700' },
  demoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#04100C',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(39, 185, 135, 0.18)',
    padding: 16,
    marginTop: 14,
    gap: 12,
  },
  demoTextWrap: { flex: 1 },
  demoTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  demoTitle: { color: '#FFFFFF', fontFamily: fonts.bodySemibold, fontSize: 15, fontWeight: '700' },
  demoActivePill: {
    backgroundColor: 'rgba(39,185,135,0.15)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  demoActivePillText: { color: '#27B987', fontFamily: fonts.bodySemibold, fontSize: 10, fontWeight: '700' },
  demoSub: { color: '#7C9B8C', fontFamily: fonts.body, fontSize: 12, marginTop: 4, lineHeight: 17 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.6 },
});
