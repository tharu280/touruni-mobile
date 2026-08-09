import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIoT } from '../context/IoTContext';
import { useAppSession } from '../context/AppSessionContext';
import { startTrip } from '../api/iotClient';
import { authenticateDriver } from '../hooks/useBiometricAuth';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme/colors';
import { ALERT_TIER_COLORS, ALERT_TIER_LABELS, type AlertTier } from '../types/iot';

type Props = NativeStackScreenProps<RootStackParamList, 'IoTDashboard'>;

export const IoTDashboardScreen = ({ navigation, route }: Props) => {
  const { deviceId } = route.params;
  const { accessToken } = useAppSession();
  const {
    liveData,
    deviceOnline,
    firebaseConnected,
    firebaseError,
    setActiveTripId,
  } = useIoT();

  const [startingTrip, setStartingTrip] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

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

  // ── Start trip with biometric auth ────────────────────────────────────────
  const handleStartTrip = async () => {
    setStartingTrip(true);
    try {
      const bio = await authenticateDriver();
      if (!bio.success) {
        if (bio.error) Alert.alert('Authentication Failed', bio.error);
        return;
      }

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

  const tier = (liveData?.alertTier ?? 0) as AlertTier;
  const tierColor = ALERT_TIER_COLORS[tier];
  const tierLabel = ALERT_TIER_LABELS[tier];
  const gps = liveData?.gps;
  const driver = liveData?.driver;
  const vehicle = liveData?.vehicle;

  // ── Connection badge ───────────────────────────────────────────────────────
  const connectionLabel = !firebaseConnected
    ? '⚠ Reconnecting...'
    : deviceOnline
    ? `● Connected · ${gps?.speedKmh?.toFixed(0) ?? '—'} km/h`
    : '● Device Offline';
  const connectionColor = !firebaseConnected ? '#F5A623' : deviceOnline ? '#27B987' : '#4A6258';

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          onPress={navigation.goBack}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </Pressable>
        <View>
          <Text style={styles.headerTitle}>IoT Monitor</Text>
          <Text style={[styles.connectionBadge, { color: connectionColor }]}>
            {connectionLabel}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.historyBtn, pressed && styles.pressed]}
          onPress={() => navigation.navigate('IoTAlertHistory', { deviceId })}
        >
          <Ionicons name="notifications-outline" size={22} color="#27B987" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Alert tier card ──────────────────────────────────────────────── */}
        <Animated.View style={[styles.tierCard, { borderColor: tierColor, transform: [{ scale: pulseAnim }] }]}>
          <Ionicons
            name={tier === 0 ? 'shield-checkmark' : tier === 1 ? 'warning' : 'alert-circle'}
            size={32}
            color={tierColor}
          />
          <Text style={[styles.tierLabel, { color: tierColor }]}>{tierLabel}</Text>
          {liveData && (
            <Text style={styles.riskScore}>
              Risk Score: {(liveData.riskScore * 100).toFixed(0)}%
            </Text>
          )}
          <View style={[styles.liveBadge, { backgroundColor: `${tierColor}22` }]}>
            <View style={[styles.liveDot, { backgroundColor: liveData ? tierColor : '#4A6258' }]} />
            <Text style={[styles.liveText, { color: tierColor }]}>
              {liveData ? 'Live Data' : 'No Data'}
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

        {/* ── GPS Map ──────────────────────────────────────────────────────── */}
        {gps?.fixed ? (
          <View style={styles.mapCard}>
            <MapView
              style={StyleSheet.absoluteFillObject}
              region={{
                latitude: gps.latitude,
                longitude: gps.longitude,
                latitudeDelta: 0.004,
                longitudeDelta: 0.004,
              }}
              mapType="standard"
            >
              <Marker
                coordinate={{ latitude: gps.latitude, longitude: gps.longitude }}
                title="Vehicle"
                pinColor="#27B987"
              />
            </MapView>
            <View style={styles.gpsOverlay}>
              <Text style={styles.gpsCoord}>
                {gps.latitude.toFixed(5)} · {gps.longitude.toFixed(5)}
              </Text>
              <View style={styles.gpsRow}>
                <Ionicons name="satellite-outline" size={12} color="#27B987" />
                <Text style={styles.gpsSub}>{gps.satellites} sats · {gps.fixed ? '● Fix' : '○ No Fix'}</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.mapPlaceholder}>
            <Ionicons name="location-outline" size={32} color="#2A4A3A" />
            <Text style={styles.mapPlaceholderText}>GPS not acquired</Text>
          </View>
        )}

        {/* ── Drowsiness panel ─────────────────────────────────────────────── */}
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Drowsiness Detection</Text>
          <View style={styles.metricsRow}>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{driver?.earScore?.toFixed(2) ?? '—'}</Text>
              <Text style={styles.metricLabel}>EAR</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{driver?.drowsyLevel ?? '—'}</Text>
              <Text style={styles.metricLabel}>Drowsy Lvl</Text>
            </View>
            <View style={styles.metric}>
              <Text style={[styles.metricValue, { color: driver?.eyeStatus === 'closed' ? '#E8441A' : '#27B987' }]}>
                {driver?.eyeStatus ?? '—'}
              </Text>
              <Text style={styles.metricLabel}>Eyes</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>
                {driver?.confidence != null ? `${(driver.confidence * 100).toFixed(0)}%` : '—'}
              </Text>
              <Text style={styles.metricLabel}>Confidence</Text>
            </View>
          </View>
        </View>

        {/* ── Vehicle panel ─────────────────────────────────────────────────── */}
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Vehicle & Safety</Text>
          <View style={styles.metricsRow}>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>
                {gps?.speedKmh != null ? `${gps.speedKmh.toFixed(0)}` : '—'}
              </Text>
              <Text style={styles.metricLabel}>km/h</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>
                {vehicle?.distanceCm != null ? `${(vehicle.distanceCm / 100).toFixed(1)}m` : '—'}
              </Text>
              <Text style={styles.metricLabel}>Distance</Text>
            </View>
            <View style={styles.metric}>
              <Text style={[
                styles.metricValue,
                { color: (vehicle?.ttcSeconds ?? 99) < 2 ? '#E8441A' : '#FFFFFF' },
              ]}>
                {vehicle?.ttcSeconds != null ? `${vehicle.ttcSeconds.toFixed(1)}s` : '—'}
              </Text>
              <Text style={styles.metricLabel}>TTC</Text>
            </View>
          </View>
        </View>

        {/* ── Start Trip button ────────────────────────────────────────────── */}
        <Pressable
          style={({ pressed }) => [styles.tripBtn, pressed && styles.pressed, startingTrip && styles.disabled]}
          onPress={handleStartTrip}
          disabled={startingTrip}
        >
          {startingTrip ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="play-circle-outline" size={22} color="#FFFFFF" />
              <Text style={styles.tripBtnText}>Start Trip (Face ID)</Text>
            </>
          )}
        </Pressable>

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
  connectionBadge: { fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  historyBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },

  // Alert tier card
  tierCard: {
    backgroundColor: '#04100C',
    borderRadius: 20,
    borderWidth: 1.5,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 8,
  },
  tierLabel: { fontFamily: fonts.displayBold, fontSize: 22, letterSpacing: -0.5 },
  riskScore: { color: '#9FBAAD', fontFamily: fonts.body, fontSize: 13 },
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
  },
  offlineText: { color: '#F5A623', fontFamily: fonts.body, fontSize: 13 },

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
  mapPlaceholder: {
    height: 120, borderRadius: 20,
    backgroundColor: '#04100C',
    borderWidth: 1, borderColor: 'rgba(39,185,135,0.18)',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  mapPlaceholderText: { color: '#4A6258', fontFamily: fonts.body, fontSize: 13 },

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
  metricsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  metric: { alignItems: 'center', gap: 4 },
  metricValue: { color: '#FFFFFF', fontFamily: fonts.displayBold, fontSize: 22, letterSpacing: -0.5 },
  metricLabel: { color: '#7C9B8C', fontFamily: fonts.body, fontSize: 12 },

  // Start trip
  tripBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#134D37',
    borderRadius: 28, minHeight: 60,
    borderWidth: 1, borderColor: 'rgba(39,185,135,0.4)',
  },
  tripBtnText: { color: '#FFFFFF', fontFamily: fonts.bodySemibold, fontSize: 17, fontWeight: '700' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.6 },
});
