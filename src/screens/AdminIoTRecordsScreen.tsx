import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAdminSession } from '../context/AdminSessionContext';
import { adminListTrips, AdminAuthError } from '../api/adminClient';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme/colors';
import type { AdminTripRecord } from '../types/adminIot';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminIoTRecords'>;
type Filter = 'all' | 'active' | 'completed';

export const AdminIoTRecordsScreen = ({ navigation }: Props) => {
  const { adminToken, logoutAdmin } = useAdminSession();

  const [trips, setTrips] = useState<AdminTripRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');

  const fetchTrips = useCallback(async (reset = false) => {
    if (!adminToken) return;
    setLoading(true);
    const currentOffset = reset ? 0 : offset;
    try {
      const res = await adminListTrips(adminToken, { limit: 50, offset: currentOffset });
      setTrips((prev) => (reset ? res.trips : [...prev, ...res.trips]));
      setHasMore(res.has_more);
      setOffset(currentOffset + res.trips.length);
    } catch (e) {
      if (e instanceof AdminAuthError) {
        await logoutAdmin();
        navigation.replace('Auth', { mode: 'login' });
        return;
      }
      // keep stale list
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminToken, offset]);

  useEffect(() => {
    fetchTrips(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = trips.filter((t) => {
    if (filter === 'active') return t.status === 'active';
    if (filter === 'completed') return t.status === 'completed';
    return true;
  });

  const renderTrip = ({ item }: { item: AdminTripRecord }) => {
    const isActive = item.status === 'active';
    return (
      <View style={[styles.tripCard, isActive && styles.tripCardActive]}>
        <View style={styles.tripHeader}>
          <Text style={styles.tripDevice} numberOfLines={1}>
            {item.device_label ?? item.device_id}
          </Text>
          <View style={[styles.statusBadge, isActive && styles.statusBadgeActive]}>
            <Text style={[styles.statusBadgeText, isActive && styles.statusBadgeTextActive]}>
              {isActive ? 'In progress' : 'Completed'}
            </Text>
          </View>
        </View>
        <Text style={styles.tripOwner} numberOfLines={1}>{item.owner_name ?? 'Unknown owner'}</Text>
        <Text style={styles.tripTime}>
          {new Date(item.started_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          {item.ended_at
            ? ` → ${new Date(item.ended_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : ''}
        </Text>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Ionicons name="time-outline" size={14} color="#648A79" />
            <Text style={styles.statText}>{item.duration_minutes != null ? `${item.duration_minutes}m` : '—'}</Text>
          </View>
          <View style={styles.statBox}>
            <Ionicons name="warning-outline" size={14} color="#648A79" />
            <Text style={styles.statText}>{item.total_alerts} alert{item.total_alerts === 1 ? '' : 's'}</Text>
          </View>
          <View style={styles.statBox}>
            <Ionicons name="pulse-outline" size={14} color="#648A79" />
            <Text style={styles.statText}>
              {item.max_risk_score != null ? `${(item.max_risk_score * 100).toFixed(0)}% peak` : '—'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <View style={styles.header}>
        <Pressable style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]} onPress={navigation.goBack}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.title}>Trip Records</Text>
        <Text style={styles.count}>{filtered.length} trips</Text>
      </View>

      <View style={styles.filters}>
        {(['all', 'active', 'completed'] as Filter[]).map((f) => (
          <Pressable key={f} style={[styles.filterTab, filter === f && styles.filterTabActive]} onPress={() => setFilter(f)}>
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Completed'}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading && trips.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="document-text-outline" size={64} color="#2A4A3A" />
          <Text style={styles.emptyText}>No trip records found</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(t) => t.trip_id}
          renderItem={renderTrip}
          contentContainerStyle={styles.list}
          onEndReached={() => hasMore && fetchTrips()}
          onEndReachedThreshold={0.2}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListFooterComponent={loading ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} /> : null}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(12,36,26,0.85)', borderWidth: 1, borderColor: 'rgba(39,185,135,0.35)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#FFFFFF', fontFamily: fonts.displayBold, fontSize: 22, letterSpacing: -0.5 },
  count: { color: '#7C9B8C', fontFamily: fonts.body, fontSize: 13 },
  filters: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterTab: { borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingVertical: 7, paddingHorizontal: 16, backgroundColor: '#04100C' },
  filterTabActive: { backgroundColor: '#134D37', borderColor: 'rgba(39,185,135,0.5)' },
  filterText: { color: '#7C9B8C', fontFamily: fonts.bodySemibold, fontSize: 13 },
  filterTextActive: { color: '#FFFFFF', fontWeight: '700' },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  tripCard: {
    backgroundColor: '#04100C',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(39,185,135,0.12)',
    padding: 16,
  },
  tripCardActive: { borderColor: 'rgba(39,185,135,0.4)' },
  tripHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  tripDevice: { color: '#FFFFFF', fontFamily: fonts.bodySemibold, fontSize: 15, fontWeight: '700', flex: 1, minWidth: 0 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)' },
  statusBadgeActive: { backgroundColor: 'rgba(39,185,135,0.15)' },
  statusBadgeText: { color: '#7C9B8C', fontFamily: fonts.bodySemibold, fontSize: 10.5, fontWeight: '700' },
  statusBadgeTextActive: { color: '#27B987' },
  tripOwner: { color: '#7C9B8C', fontFamily: fonts.body, fontSize: 12.5, marginTop: 4 },
  tripTime: { color: '#4A6258', fontFamily: fonts.body, fontSize: 12, marginTop: 6 },
  statsRow: { flexDirection: 'row', gap: 16, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  statBox: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statText: { color: '#B2C9BE', fontFamily: fonts.body, fontSize: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { color: '#4A6258', fontFamily: fonts.body, fontSize: 15 },
  pressed: { opacity: 0.8 },
});
