import React, { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline } from 'react-native-maps';
import type { MapViewDirectionsOrigin } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIoT } from '../context/IoTContext';
import { useAppSession } from '../context/AppSessionContext';
import { endTrip } from '../api/iotClient';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme/colors';
import { ALERT_TIER_COLORS, ALERT_TIER_LABELS, type AlertTier } from '../types/iot';

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
  const { deviceId, tripId } = route.params;
  const { accessToken } = useAppSession();
  const { liveData, firebaseConnected, deviceOnline, recentAlerts, setActiveTripId } = useIoT();

  const [tripStart] = useState(new Date().toISOString());
  const [ending, setEnding] = useState(false);

  // GPS trail (ring buffer, max 500 points — no state, no re-render on push)
  const trailRef = useRef<LatLng[]>([]);
  const [trail, setTrail] = useState<LatLng[]>([]);
  const mapRef = useRef<MapView | null>(null);

  const gps = liveData?.gps;
  const tier = (liveData?.alertTier ?? 0) as AlertTier;
  const tierColor = ALERT_TIER_COLORS[tier];

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

      {/* Full-screen map */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        mapType="standard"
        initialRegion={
          gps?.fixed
            ? { latitude: gps.latitude, longitude: gps.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }
            : { latitude: 6.9, longitude: 79.97, latitudeDelta: 0.05, longitudeDelta: 0.05 }
        }
      >
        {trail.length > 1 && (
          <Polyline coordinates={trail} strokeColor="#27B987" strokeWidth={3} />
        )}
        {gps?.fixed && (
          <Marker coordinate={{ latitude: gps.latitude, longitude: gps.longitude }} pinColor="#27B987" />
        )}
      </MapView>

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

        {/* Connection state */}
        {!firebaseConnected && (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline-outline" size={14} color="#F5A623" />
            <Text style={styles.offlineText}>No connection — showing cached data</Text>
          </View>
        )}

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
