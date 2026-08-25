import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useAdminSession } from '../context/AdminSessionContext';
import { adminListDevices, adminUnclaimDevice, AdminAuthError } from '../api/adminClient';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme/colors';
import type { AdminDeviceSummary } from '../types/adminIot';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminIoTDevices'>;
type Filter = 'all' | 'claimed' | 'unclaimed';

export const AdminIoTDeviceListScreen = ({ navigation }: Props) => {
  const { adminToken, logoutAdmin } = useAdminSession();
  const [devices, setDevices] = useState<AdminDeviceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async () => {
    if (!adminToken) return;
    try {
      const res = await adminListDevices(adminToken, { limit: 200 });
      setDevices(res.devices);
    } catch (e) {
      if (e instanceof AdminAuthError) {
        await logoutAdmin();
        navigation.replace('Auth', { mode: 'login' });
        return;
      }
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not load devices.');
    } finally {
      setLoading(false);
    }
  }, [adminToken, logoutAdmin, navigation]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === 'claimed') return devices.filter((d) => d.registered);
    if (filter === 'unclaimed') return devices.filter((d) => !d.registered);
    return devices;
  }, [devices, filter]);

  const handleUnclaim = useCallback((device: AdminDeviceSummary) => {
    Alert.alert(
      'Force Unclaim Device',
      `Release "${device.label}" back to the unclaimed pool? Its owner will lose access immediately, and the same QR can re-pair it to anyone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unclaim',
          style: 'destructive',
          onPress: async () => {
            if (!adminToken) return;
            try {
              await adminUnclaimDevice(adminToken, device.device_id);
              load();
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Could not unclaim device.');
            }
          },
        },
      ]
    );
  }, [adminToken, load]);

  const claimedCount = devices.filter((d) => d.registered).length;

  const renderDevice = ({ item }: { item: AdminDeviceSummary }) => (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <View style={[styles.statusDot, { backgroundColor: item.registered ? '#27B987' : '#4A6258' }]} />
        <View style={styles.cardText}>
          <Text style={styles.deviceLabel} numberOfLines={1}>{item.label}</Text>
          <Text style={styles.deviceIdText} numberOfLines={1}>{item.device_id}</Text>
          <Text style={styles.deviceSub} numberOfLines={1}>
            {item.registered
              ? `Claimed · ${item.owner_name ?? 'Unknown owner'}`
              : 'Unclaimed — awaiting pairing'}
          </Text>
        </View>
      </View>
      {item.registered && (
        <Pressable
          onPress={() => handleUnclaim(item)}
          hitSlop={12}
          style={({ pressed }) => [styles.unclaimBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Force unclaim ${item.label}`}
        >
          <Ionicons name="lock-open-outline" size={18} color="#F5A623" />
        </Pressable>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          onPress={navigation.goBack}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>Fleet Devices</Text>
          {!loading && (
            <Text style={styles.subtitle}>
              {devices.length} device{devices.length === 1 ? '' : 's'} · {claimedCount} claimed
            </Text>
          )}
        </View>
        <Pressable
          style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
          onPress={() => navigation.navigate('AdminIoTProvision')}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={styles.filterRow}>
        {(['all', 'claimed', 'unclaimed'] as Filter[]).map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {f === 'all' ? 'All' : f === 'claimed' ? 'Claimed' : 'Unclaimed'}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="hardware-chip-outline" size={48} color="#27B987" />
          <Text style={styles.emptyTitle}>No devices here</Text>
          <Text style={styles.emptySub}>
            {filter === 'all' ? 'Provision a device to get started.' : `No ${filter} devices right now.`}
          </Text>
          {filter === 'all' && (
            <Pressable
              style={({ pressed }) => [styles.emptyBtnFrame, pressed && styles.pressed]}
              onPress={() => navigation.navigate('AdminIoTProvision')}
            >
              <LinearGradient colors={['#27B987', '#169368']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.emptyBtn}>
                <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
                <Text style={styles.emptyBtnText}>Provision a Device</Text>
              </LinearGradient>
            </Pressable>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(d) => d.device_id}
          renderItem={renderDevice}
          contentContainerStyle={styles.list}
          onRefresh={load}
          refreshing={loading}
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
    paddingBottom: 12,
  },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(12,36,26,0.85)', borderWidth: 1, borderColor: 'rgba(39,185,135,0.35)', alignItems: 'center', justifyContent: 'center' },
  headerTextWrap: { flex: 1, alignItems: 'center', marginHorizontal: 8 },
  title: { color: '#FFFFFF', fontFamily: fonts.displayBold, fontSize: 20, letterSpacing: -0.3 },
  subtitle: { color: '#7C9B8C', fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#27B987', alignItems: 'center', justifyContent: 'center', shadowColor: '#27B987', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 5 },

  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 12 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  filterChipActive: { backgroundColor: 'rgba(39,185,135,0.15)', borderColor: 'rgba(39,185,135,0.4)' },
  filterChipText: { color: '#7C9B8C', fontFamily: fonts.bodySemibold, fontSize: 13 },
  filterChipTextActive: { color: '#27B987' },

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
  cardLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 0 },
  cardText: { flex: 1, minWidth: 0 },
  statusDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0, marginTop: 6 },
  deviceLabel: { color: '#FFFFFF', fontFamily: fonts.bodySemibold, fontSize: 16, fontWeight: '700' },
  deviceIdText: { color: '#4A6258', fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  deviceSub: { color: '#7C9B8C', fontFamily: fonts.body, fontSize: 13, marginTop: 4 },
  unclaimBtn: { padding: 8, marginLeft: 8 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, gap: 8 },
  emptyTitle: { color: '#FFFFFF', fontFamily: fonts.displayBold, fontSize: 20, marginTop: 8, textAlign: 'center' },
  emptySub: { color: '#7C9B8C', fontFamily: fonts.body, fontSize: 14, textAlign: 'center', maxWidth: 280 },
  emptyBtnFrame: { marginTop: 16, borderRadius: 28, overflow: 'hidden', shadowColor: '#27B987', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 6 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 56, paddingHorizontal: 28 },
  emptyBtnText: { color: '#FFFFFF', fontFamily: fonts.bodySemibold, fontSize: 16, fontWeight: '700' },

  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
