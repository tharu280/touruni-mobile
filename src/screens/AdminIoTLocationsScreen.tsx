import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAdminSession } from '../context/AdminSessionContext';
import { adminListLocations, AdminAuthError } from '../api/adminClient';
import { hasNativeGoogleMapsKey } from '../config/maps';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme/colors';
import { ALERT_TIER_COLORS } from '../types/iot';
import type { AdminDeviceLocation } from '../types/adminIot';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminIoTLocations'>;

// Google Maps renders as a flat black surface (no error, no placeholder) when
// the API key isn't wired into the running build — show a real "unavailable"
// state instead. Only relevant on Android native builds, never Expo Go.
const MAP_UNAVAILABLE = Platform.OS === 'android' && !hasNativeGoogleMapsKey;

// No live listener here (see the module note in the plan this screen came
// from): RTDB security rules only grant an owner read access to their own
// device, so an admin's identity can't fan out to every owner's subtree the
// way a single-device dashboard can. This polls the backend's Admin-SDK
// aggregated snapshot instead — real-time-ish, not push.
const POLL_INTERVAL_MS = 12_000;

// Colombo, Sri Lanka — fallback center when no device has a live GPS fix yet.
const FALLBACK_REGION = { latitude: 6.9271, longitude: 79.8612, latitudeDelta: 0.5, longitudeDelta: 0.5 };

function computeRegion(devices: AdminDeviceLocation[]) {
  const fixed = devices.filter((d) => d.live);
  if (fixed.length === 0) return FALLBACK_REGION;

  const lats = fixed.map((d) => d.live!.latitude);
  const lngs = fixed.map((d) => d.live!.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.02, (maxLat - minLat) * 1.6),
    longitudeDelta: Math.max(0.02, (maxLng - minLng) * 1.6),
  };
}

export const AdminIoTLocationsScreen = ({ navigation }: Props) => {
  const { adminToken, logoutAdmin } = useAdminSession();
  const [devices, setDevices] = useState<AdminDeviceLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdatedMs, setLastUpdatedMs] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const mapRef = useRef<MapView>(null);

  const fetchLocations = useCallback(async () => {
    if (!adminToken) return;
    try {
      const res = await adminListLocations(adminToken);
      setDevices(res.devices);
      setLastUpdatedMs(Date.now());
    } catch (e) {
      if (e instanceof AdminAuthError) {
        await logoutAdmin();
        navigation.replace('Auth', { mode: 'login' });
        return;
      }
      // keep last known snapshot on a transient error
    } finally {
      setLoading(false);
    }
  }, [adminToken, logoutAdmin, navigation]);

  useEffect(() => {
    fetchLocations();
    const poll = setInterval(fetchLocations, POLL_INTERVAL_MS);
    return () => clearInterval(poll);
  }, [fetchLocations]);

  // Re-render the "Updated Xs ago" label once a second without re-polling.
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(tick);
  }, []);

  const region = useMemo(() => computeRegion(devices), [devices]);
  const withFix = devices.filter((d) => d.live);
  const updatedSecondsAgo = lastUpdatedMs ? Math.round((now - lastUpdatedMs) / 1000) : null;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <View style={styles.header}>
        <Pressable style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]} onPress={navigation.goBack}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>Fleet Locations</Text>
          <Text style={styles.subtitle}>
            {withFix.length} of {devices.length} device{devices.length === 1 ? '' : 's'} reporting
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.refreshBtn, pressed && styles.pressed]}
          onPress={fetchLocations}
          accessibilityLabel="Refresh locations"
        >
          <Ionicons name="refresh" size={20} color="#27B987" />
        </Pressable>
      </View>

      {updatedSecondsAgo !== null && (
        <View style={styles.updatedRow}>
          <View style={styles.liveDot} />
          <Text style={styles.updatedText}>
            Updated {updatedSecondsAgo <= 1 ? 'just now' : `${updatedSecondsAgo}s ago`} · polls every {POLL_INTERVAL_MS / 1000}s
          </Text>
        </View>
      )}

      <View style={styles.mapWrap}>
        {MAP_UNAVAILABLE ? (
          <View style={[StyleSheet.absoluteFill, styles.mapUnavailable]}>
            <Ionicons name="map-outline" size={28} color="#4A6258" />
            <Text style={styles.mapUnavailableText}>Map unavailable</Text>
          </View>
        ) : (
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            region={region}
            mapType="standard"
          >
            {withFix.map((d) => (
              <Marker
                key={d.device_id}
                coordinate={{ latitude: d.live!.latitude, longitude: d.live!.longitude }}
                title={d.label}
                description={`${d.owner_name ?? 'Unknown owner'} · ${Math.round(d.live!.speed_kmh)} km/h`}
                pinColor={ALERT_TIER_COLORS[d.live!.alert_tier]}
              />
            ))}
          </MapView>
        )}

        {!loading && withFix.length === 0 && (
          <View style={styles.noDataOverlay} pointerEvents="none">
            <Ionicons name="location-outline" size={32} color="#4A6258" />
            <Text style={styles.noDataText}>No devices have reported a GPS fix yet</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(12,36,26,0.85)', borderWidth: 1, borderColor: 'rgba(39,185,135,0.35)', alignItems: 'center', justifyContent: 'center' },
  headerTextWrap: { flex: 1, alignItems: 'center', marginHorizontal: 8 },
  title: { color: '#FFFFFF', fontFamily: fonts.displayBold, fontSize: 20, letterSpacing: -0.3 },
  subtitle: { color: '#7C9B8C', fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  refreshBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(39,185,135,0.12)', borderWidth: 1, borderColor: 'rgba(39,185,135,0.3)', alignItems: 'center', justifyContent: 'center' },

  updatedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingBottom: 10 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#27B987' },
  updatedText: { color: '#4A6258', fontFamily: fonts.body, fontSize: 11.5 },

  mapWrap: { flex: 1, marginHorizontal: 16, marginBottom: 16, borderRadius: 20, overflow: 'hidden', backgroundColor: '#04100C', borderWidth: 1, borderColor: 'rgba(39,185,135,0.18)' },
  mapUnavailable: { backgroundColor: '#04100C', alignItems: 'center', justifyContent: 'center', gap: 8 },
  mapUnavailableText: { color: '#4A6258', fontFamily: fonts.body, fontSize: 12 },
  noDataOverlay: { position: 'absolute', top: 16, left: 16, right: 16, alignItems: 'center', gap: 8, backgroundColor: 'rgba(8,28,20,0.85)', borderRadius: 14, paddingVertical: 16 },
  noDataText: { color: '#7C9B8C', fontFamily: fonts.body, fontSize: 12.5, textAlign: 'center', paddingHorizontal: 20 },

  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
