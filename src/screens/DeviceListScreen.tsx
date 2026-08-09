import React, { useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIoT } from '../context/IoTContext';
import { useAppSession } from '../context/AppSessionContext';
import { deleteDevice } from '../api/iotClient';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme/colors';
import type { DeviceSummary } from '../types/iot';

type Props = NativeStackScreenProps<RootStackParamList, 'IoTDevices'>;

export const DeviceListScreen = ({ navigation }: Props) => {
  const { devices, devicesLoading, refreshDevices, setActiveDevice } = useIoT();
  const { accessToken } = useAppSession();

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

  const renderDevice = ({ item }: { item: DeviceSummary }) => (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => handleSelect(item)}
    >
      <View style={styles.cardLeft}>
        <View style={[styles.onlineDot, { backgroundColor: item.online ? '#27B987' : '#4A6258' }]} />
        <View>
          <Text style={styles.deviceLabel}>{item.label}</Text>
          <Text style={styles.deviceSub}>
            {item.online
              ? 'Online'
              : item.last_seen
              ? `Last seen ${new Date(item.last_seen).toLocaleTimeString()}`
              : 'Never connected'}
          </Text>
        </View>
      </View>
      <Pressable onPress={() => handleDelete(item)} hitSlop={12} style={styles.deleteBtn}>
        <Ionicons name="trash-outline" size={20} color="#4A6258" />
      </Pressable>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Devices</Text>
        <Pressable
          style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
          onPress={() => navigation.navigate('IoTRegisterDevice')}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </Pressable>
      </View>

      {devicesLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : devices.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="hardware-chip-outline" size={64} color="#2A4A3A" />
          <Text style={styles.emptyTitle}>No devices registered</Text>
          <Text style={styles.emptySub}>Tap + to add your first vehicle</Text>
          <Pressable
            style={({ pressed }) => [styles.emptyBtn, pressed && styles.pressed]}
            onPress={() => navigation.navigate('IoTRegisterDevice')}
          >
            <Text style={styles.emptyBtnText}>Register a Device</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={devices}
          keyExtractor={(d) => d.device_id}
          renderItem={renderDevice}
          contentContainerStyle={styles.list}
          onRefresh={refreshDevices}
          refreshing={devicesLoading}
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
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    color: '#FFFFFF',
    fontFamily: fonts.displayBold,
    fontSize: 28,
    letterSpacing: -0.5,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#27B987',
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
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
    marginBottom: 10,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  onlineDot: { width: 10, height: 10, borderRadius: 5 },
  deviceLabel: {
    color: '#FFFFFF',
    fontFamily: fonts.bodySemibold,
    fontSize: 16,
    fontWeight: '700',
  },
  deviceSub: { color: '#7C9B8C', fontFamily: fonts.body, fontSize: 13, marginTop: 2 },
  deleteBtn: { paddingLeft: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyTitle: {
    color: '#FFFFFF',
    fontFamily: fonts.displayBold,
    fontSize: 20,
    marginTop: 16,
  },
  emptySub: { color: '#7C9B8C', fontFamily: fonts.body, fontSize: 14 },
  emptyBtn: {
    marginTop: 24,
    backgroundColor: '#27B987',
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  emptyBtnText: {
    color: '#FFFFFF',
    fontFamily: fonts.bodySemibold,
    fontSize: 16,
    fontWeight: '700',
  },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
