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
import { useAppSession } from '../context/AppSessionContext';
import { getAlertHistory } from '../api/iotClient';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme/colors';
import { ALERT_TIER_COLORS, ALERT_TIER_LABELS, type AlertEvent, type AlertTier } from '../types/iot';

type Props = NativeStackScreenProps<RootStackParamList, 'IoTAlertHistory'>;

const TIER_FILTERS = [0, 1, 2, 3] as const;

export const IoTAlertHistoryScreen = ({ navigation, route }: Props) => {
  const { deviceId } = route.params;
  const { accessToken } = useAppSession();

  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [filterTier, setFilterTier] = useState<AlertTier | null>(null);

  const fetchEvents = useCallback(async (reset = false) => {
    if (!accessToken) return;
    setLoading(true);
    const currentOffset = reset ? 0 : offset;
    try {
      const res = await getAlertHistory(accessToken, deviceId, 50, currentOffset);
      setEvents((prev) => reset ? res.events : [...prev, ...res.events]);
      setHasMore(res.has_more);
      setOffset(currentOffset + res.events.length);
    } catch {
      // keep stale list
    } finally {
      setLoading(false);
    }
  }, [accessToken, deviceId, offset]);

  useEffect(() => {
    fetchEvents(true);
  }, [deviceId]);

  const filtered = filterTier !== null
    ? events.filter((e) => e.alert_tier === filterTier)
    : events;

  const renderEvent = ({ item }: { item: AlertEvent }) => {
    const tc = ALERT_TIER_COLORS[item.alert_tier];
    return (
      <View style={[styles.eventCard, { borderLeftColor: tc }]}>
        <View style={styles.eventLeft}>
          <View style={[styles.tierBadge, { backgroundColor: `${tc}22`, borderColor: tc }]}>
            <Text style={[styles.tierBadgeText, { color: tc }]}>
              {ALERT_TIER_LABELS[item.alert_tier]}
            </Text>
          </View>
          <Text style={styles.eventTime}>
            {new Date(item.triggered_at).toLocaleString([], {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
        <View style={styles.eventRight}>
          <Text style={styles.eventScore}>
            {(item.risk_score * 100).toFixed(0)}%
          </Text>
          <Text style={styles.eventScoreLbl}>Risk</Text>
        </View>
      </View>
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
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.title}>Alert History</Text>
        <Text style={styles.count}>{filtered.length} events</Text>
      </View>

      {/* Filter tabs */}
      <View style={styles.filters}>
        <Pressable
          style={[styles.filterTab, filterTier === null && styles.filterTabActive]}
          onPress={() => setFilterTier(null)}
        >
          <Text style={[styles.filterText, filterTier === null && styles.filterTextActive]}>All</Text>
        </Pressable>
        {TIER_FILTERS.filter((t) => t > 0).map((t) => (
          <Pressable
            key={t}
            style={[styles.filterTab, filterTier === t && styles.filterTabActive, filterTier === t && { borderColor: ALERT_TIER_COLORS[t] }]}
            onPress={() => setFilterTier((prev) => prev === t ? null : t)}
          >
            <Text style={[styles.filterText, filterTier === t && { color: ALERT_TIER_COLORS[t] }]}>
              Tier {t}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading && events.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="shield-checkmark-outline" size={64} color="#2A4A3A" />
          <Text style={styles.emptyText}>No alerts found</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(e) => e.event_id}
          renderItem={renderEvent}
          contentContainerStyle={styles.list}
          onEndReached={() => hasMore && fetchEvents()}
          onEndReachedThreshold={0.2}
          ListFooterComponent={loading ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} /> : null}
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
    paddingTop: 12,
    paddingBottom: 8,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(12,36,26,0.85)',
    borderWidth: 1, borderColor: 'rgba(39,185,135,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: '#FFFFFF', fontFamily: fonts.displayBold, fontSize: 22, letterSpacing: -0.5 },
  count: { color: '#7C9B8C', fontFamily: fonts.body, fontSize: 13 },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterTab: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 7,
    paddingHorizontal: 16,
    backgroundColor: '#04100C',
  },
  filterTabActive: {
    backgroundColor: '#134D37',
    borderColor: 'rgba(39,185,135,0.5)',
  },
  filterText: { color: '#7C9B8C', fontFamily: fonts.bodySemibold, fontSize: 13 },
  filterTextActive: { color: '#FFFFFF', fontWeight: '700' },
  list: { paddingHorizontal: 16, paddingBottom: 32, gap: 8 },
  eventCard: {
    backgroundColor: '#04100C',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(39,185,135,0.12)',
    borderLeftWidth: 3,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventLeft: { gap: 6 },
  tierBadge: {
    borderRadius: 20, borderWidth: 1,
    paddingVertical: 3, paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  tierBadgeText: { fontFamily: fonts.bodySemibold, fontSize: 12, fontWeight: '700' },
  eventTime: { color: '#7C9B8C', fontFamily: fonts.body, fontSize: 12 },
  eventRight: { alignItems: 'center' },
  eventScore: { color: '#FFFFFF', fontFamily: fonts.displayBold, fontSize: 22 },
  eventScoreLbl: { color: '#7C9B8C', fontFamily: fonts.body, fontSize: 11 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { color: '#4A6258', fontFamily: fonts.body, fontSize: 15 },
  pressed: { opacity: 0.8 },
});
