import React, { useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIoT } from '../context/IoTContext';
import { useAppSession } from '../context/AppSessionContext';
import { deleteDevice } from '../api/iotClient';
import { useDevicesOnlineStatus } from '../hooks/useDevicesOnlineStatus';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme/colors';
import type { DeviceSummary } from '../types/iot';

type Props = NativeStackScreenProps<RootStackParamList, 'IoTDevices'>;

export const DeviceListScreen = ({ navigation }: Props) => {
  const { devices, devicesLoading, refreshDevices, setActiveDevice, listFirebaseToken } = useIoT();
  const { accessToken } = useAppSession();

  // devices_router.py's list_devices() hardcodes online=False on every
  // device ("mobile resolves online state via Firebase RTDB") — this hook is
  // the actual resolution. Falls back to the backend's last_seen (Mongo) for
  // a device that's never sent live Firebase data at all.
  const onlineStatus = useDevicesOnlineStatus(devices, listFirebaseToken);

  useEffect(() => {
    refreshDevices();
  }, []);

  const handleDelete = useCallback((device: DeviceSummary) => {
    Alert.alert(
      'Remove Device',
      `Remove "${device.label}" from your account?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (!accessToken) return;
            try {
              await deleteDevice(accessToken, device.device_id);
              refreshDevices();
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Could not remove device.');
            }
          },
        },
      ]
    );
  }, [accessToken, refreshDevices]);

  const handleSelect = useCallback((device: DeviceSummary) => {
    setActiveDevice(device.device_id);
    navigation.navigate('IoTDashboard', { deviceId: device.device_id });
  }, [navigation, setActiveDevice]);

  const onlineCount = devices.filter((d) => onlineStatus[d.device_id]?.online).length;

  const renderDevice = ({ item }: { item: DeviceSummary }) => {
    const status = onlineStatus[item.device_id];
    const isOnline = status?.online ?? false;
    // Firebase's live timestamp is the truth when we have it; fall back to
    // the backend's last_seen (Mongo) only for a device that's never sent
    // live data at all — same reasoning useFirebaseDevice.ts uses for the
    // single active device, now applied per row.
    const lastSeenMs = status?.lastSeenMs ?? null;
    const lastSeenLabel = lastSeenMs
      ? new Date(lastSeenMs).toLocaleTimeString()
      : item.last_seen
      ? new Date(item.last_seen).toLocaleTimeString()
      : null;

    return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => handleSelect(item)}
      accessibilityRole="button"
      accessibilityLabel={`${item.label}, ${isOnline ? 'online' : 'offline'}`}
    >
      <View style={styles.cardLeft}>
        <View style={[styles.onlineDot, { backgroundColor: isOnline ? '#27B987' : '#4A6258' }]} />
        <View style={styles.cardText}>
          <Text style={styles.deviceLabel} numberOfLines={1}>{item.label}</Text>
          <Text style={styles.deviceSub} numberOfLines={1}>
            {isOnline
              ? 'Online'
              : lastSeenLabel
              ? `Last seen ${lastSeenLabel}`
              : 'Never connected'}
          </Text>
        </View>
      </View>
      <View style={styles.cardRight}>
        <Pressable
          onPress={() => handleDelete(item)}
          hitSlop={12}
          style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${item.label}`}
        >
          <Ionicons name="trash-outline" size={19} color="#4A6258" />
        </Pressable>
        <Ionicons name="chevron-forward" size={18} color="#3A554A" />
      </View>
    </Pressable>
    );
  };

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

        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>My Devices</Text>
          {!devicesLoading && (
            <Text style={styles.subtitle}>
              {devices.length === 0
                ? 'No devices yet'
                : `${devices.length} device${devices.length === 1 ? '' : 's'} · ${onlineCount} online`}
            </Text>
          )}
        </View>

        <Pressable
          style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
          onPress={() => navigation.navigate('IoTRegisterDevice')}
          accessibilityRole="button"
          accessibilityLabel="Register a device"
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </Pressable>
      </View>

      {devicesLoading ? (
        <View style={styles.center}>
          <View style={styles.loadingOrb}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
          <Text style={styles.loadingTitle}>Loading your devices</Text>
        </View>
      ) : devices.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIconOuter}>
            <View style={styles.emptyIconInner}>
              <Ionicons name="hardware-chip-outline" size={36} color="#27B987" />
            </View>
          </View>
          <Text style={styles.emptyTitle}>No devices yet</Text>
          <Text style={styles.emptySub}>
            Pair your vehicle's safety device to start monitoring driver alertness and road conditions in real time.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.emptyBtnFrame, pressed && styles.pressed]}
            onPress={() => navigation.navigate('IoTRegisterDevice')}
            accessibilityRole="button"
          >
            <LinearGradient
              colors={['#27B987', '#169368']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.emptyBtn}
            >
              <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
              <Text style={styles.emptyBtnText}>Register a Device</Text>
            </LinearGradient>
          </Pressable>
          <View style={styles.emptyHintRow}>
            <Ionicons name="qr-code-outline" size={14} color="#4A6258" />
            <Text style={styles.emptyHint}>You'll scan a QR code inside the vehicle</Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={devices}
          keyExtractor={(d) => d.device_id}
          renderItem={renderDevice}
          contentContainerStyle={styles.list}
          onRefresh={refreshDevices}
          refreshing={devicesLoading}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
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
    paddingTop: 8,
    paddingBottom: 16,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(12,36,26,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(39,185,135,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: { flex: 1, alignItems: 'center', marginHorizontal: 8 },
  title: {
    color: '#FFFFFF',
    fontFamily: fonts.displayBold,
    fontSize: 20,
    letterSpacing: -0.3,
  },
  subtitle: { color: '#7C9B8C', fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#27B987',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#27B987',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },

  list: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 32 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#04100C',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(39, 185, 135, 0.18)',
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  cardText: { flex: 1, minWidth: 0 },
  onlineDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  deviceLabel: { color: '#FFFFFF', fontFamily: fonts.bodySemibold, fontSize: 16, fontWeight: '700' },
  deviceSub: { color: '#7C9B8C', fontFamily: fonts.body, fontSize: 13, marginTop: 2 },
  cardRight: { flexDirection: 'row', alignItems: 'center', gap: 14, marginLeft: 8 },
  deleteBtn: { padding: 2 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 },

  // Loading state (matches PlanResultScreen's loading treatment)
  loadingOrb: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(39, 185, 135, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(39, 185, 135, 0.22)',
  },
  loadingTitle: { color: '#FFFFFF', fontFamily: fonts.displayBold, fontSize: 18, marginTop: 22 },

  // Empty state
  emptyIconOuter: {
    width: 128,
    height: 128,
    borderRadius: 64,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(39, 185, 135, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(39, 185, 135, 0.15)',
  },
  emptyIconInner: {
    width: 84,
    height: 84,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.forestElevated,
    borderWidth: 1,
    borderColor: 'rgba(39, 185, 135, 0.3)',
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontFamily: fonts.displayBold,
    fontSize: 22,
    letterSpacing: -0.4,
    marginTop: 24,
    textAlign: 'center',
  },
  emptySub: {
    color: '#7C9B8C',
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 10,
    maxWidth: 290,
  },
  emptyBtnFrame: {
    marginTop: 28,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#27B987',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 56,
    paddingHorizontal: 28,
  },
  emptyBtnText: { color: '#FFFFFF', fontFamily: fonts.bodySemibold, fontSize: 16, fontWeight: '700' },
  emptyHintRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18 },
  emptyHint: { color: '#4A6258', fontFamily: fonts.body, fontSize: 12 },

  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
