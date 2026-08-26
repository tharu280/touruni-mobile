import React, { useEffect, useState } from 'react';
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
  Platform,
  RefreshControl,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';

import type { RootStackParamList } from '../navigation/types';
import { fonts } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminDashboard'>;

interface Session {
  session_id: string;
  user_id?: string;
  user_name?: string;
  status: string;
  created_at: string;
  origin?: any;
  destination?: any;
  budget?: number;
  trip_days?: number;
  locations?: string[];
}

export const AdminDashboardScreen = ({ route, navigation }: Props) => {
  const { adminToken } = route.params;
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const filteredSessions = React.useMemo(() => {
    if (!selectedDate) return sessions;
    return sessions.filter(s => {
      const dateStr = s.created_at.split('T')[0];
      return dateStr === selectedDate;
    });
  }, [sessions, selectedDate]);

  const markedDates = React.useMemo(() => {
    const marks: Record<string, any> = {};
    sessions.forEach(s => {
      const dateStr = s.created_at.split('T')[0];
      marks[dateStr] = { marked: true, dotColor: '#00D287' };
    });
    if (selectedDate) {
      if (marks[selectedDate]) {
        marks[selectedDate] = { ...marks[selectedDate], selected: true, selectedColor: 'rgba(0, 210, 135, 0.3)', selectedTextColor: '#FFF' };
      } else {
        marks[selectedDate] = { selected: true, selectedColor: 'rgba(0, 210, 135, 0.3)', selectedTextColor: '#FFF' };
      }
    }
    return marks;
  }, [sessions, selectedDate]);

  const fetchSessions = async () => {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/admin/sessions`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!response.ok) throw new Error('Failed to fetch sessions');
      const data = await response.json();
      setSessions(data.sessions);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to fetch sessions.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSessions();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const deleteSession = async (sessionId: string) => {
    Alert.alert('Delete Trip?', 'Are you sure you want to permanently delete this trip?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/admin/sessions/${sessionId}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${adminToken}` },
            });
            if (!response.ok) throw new Error('Failed to delete session');
            setSessions(prev => prev.filter(s => s.session_id !== sessionId));
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete session.');
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: Session }) => {
    const destName = item.destination?.name || item.destination || 'Unknown';
    const originName = item.origin?.name || item.origin || '';
    const routeTitle = originName ? `${originName} → ${destName}` : destName;

    return (
      <View style={styles.cardWrapper}>
        <LinearGradient
          colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']}
          style={styles.card}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.cardHeader}>
            <View style={styles.destinationContainer}>
              <Text style={styles.destination} numberOfLines={1}>{routeTitle}</Text>
              {item.user_id && (
                <Text style={styles.userEmail} numberOfLines={1}>
                  <Ionicons name="person" size={12} color="#7C9B8C" /> {item.user_name || item.user_id}
                </Text>
              )}
              <View style={styles.badge}>
                <View style={styles.badgeDot} />
                <Text style={styles.badgeText}>{item.status.toUpperCase()}</Text>
              </View>
            </View>
            <Pressable onPress={() => deleteSession(item.session_id)} style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}>
              <Ionicons name="trash" size={18} color="#FF4A4A" />
            </Pressable>
          </View>

          {item.locations && item.locations.length > 0 && (
            <View style={styles.locationsContainer}>
              <Ionicons name="location-outline" size={14} color="#27B987" style={styles.locationIcon} />
              <View style={styles.locationsList}>
                {item.locations.slice(0, 4).map((loc, idx) => (
                  <View key={idx} style={styles.locationPill}>
                    <Text style={styles.locationText} numberOfLines={1}>{loc}</Text>
                  </View>
                ))}
                {item.locations.length > 4 && (
                  <View style={styles.locationPillPlus}>
                    <Text style={styles.locationTextPlus}>+{item.locations.length - 4}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Ionicons name="calendar-outline" size={16} color="#648A79" />
              <View style={styles.statTextGroup}>
                <Text style={styles.statLabel}>Duration</Text>
                <Text style={styles.statValue}>{item.trip_days ? `${item.trip_days} Days` : 'N/A'}</Text>
              </View>
            </View>
            
            <View style={styles.statDivider} />
            
            <View style={styles.statBox}>
              <Ionicons name="time-outline" size={16} color="#648A79" />
              <View style={styles.statTextGroup}>
                <Text style={styles.statLabel}>Created</Text>
                <Text style={styles.statValue}>{new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient colors={['#081C14', '#040C09']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.replace('Auth', { mode: 'login' })} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <Ionicons name="log-out-outline" size={24} color="#FFFFFF" />
          </Pressable>
          <View>
            <Text style={styles.title}>Admin Panel</Text>
            <Text style={styles.subtitle}>Manage Trips & Sessions</Text>
          </View>
        </View>
        
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator color="#27B987" size="large" />
          </View>
        ) : (
          <FlatList
            data={filteredSessions}
            keyExtractor={item => item.session_id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00D287" />}
            renderItem={renderItem}
            ListHeaderComponent={
              <View>
                <View style={styles.calendarContainer}>
                  <Calendar
                    theme={{
                      calendarBackground: '#12241C',
                      textSectionTitleColor: '#7C9B8C',
                      selectedDayBackgroundColor: 'rgba(0, 210, 135, 0.3)',
                      selectedDayTextColor: '#FFF',
                      todayTextColor: '#00D287',
                      dayTextColor: '#FFF',
                      textDisabledColor: 'rgba(255,255,255,0.2)',
                      dotColor: '#00D287',
                      selectedDotColor: '#00D287',
                      arrowColor: '#00D287',
                      monthTextColor: '#FFF',
                      indicatorColor: '#00D287',
                      textDayFontFamily: fonts.body,
                      textMonthFontFamily: fonts.displayBold,
                      textDayHeaderFontFamily: fonts.bodySemibold,
                    }}
                    markedDates={markedDates}
                    onDayPress={(day: any) => {
                      setSelectedDate(day.dateString === selectedDate ? null : day.dateString);
                    }}
                  />
                </View>
                <View style={styles.dashboardStats}>
                  <View style={styles.statChip}>
                    <Ionicons name="map" size={16} color="#00D287" />
                    <Text style={styles.statChipText}>Total Trips: {filteredSessions.length}</Text>
                  </View>
                  {selectedDate && (
                    <Pressable onPress={() => setSelectedDate(null)} style={styles.clearFilterChip}>
                      <Ionicons name="close-circle" size={16} color="#FF6B6B" />
                      <Text style={styles.clearFilterText}>Clear Filter</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            }
            contentContainerStyle={styles.listContent}
          />
        )}
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? 40 : 16,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  backButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 16,
  },
  title: {
    color: '#FFFFFF',
    fontFamily: fonts.displayExtraBold,
    fontSize: 24, fontWeight: '800', letterSpacing: -0.5,
  },
  subtitle: {
    color: '#27B987',
    fontFamily: fonts.bodySemibold,
    fontSize: 13, marginTop: 2,
  },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#7C9B8C', fontFamily: fonts.body, marginTop: 12, fontSize: 15 },
  listContent: { padding: 20, paddingBottom: 120 },
  cardWrapper: {
    marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  card: { borderRadius: 24, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  destinationContainer: { flex: 1, paddingRight: 16 },
  destination: { color: '#FFFFFF', fontFamily: fonts.displayBold, fontSize: 22, fontWeight: '700', letterSpacing: -0.5, marginBottom: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(39, 185, 135, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(39, 185, 135, 0.3)' },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#27B987', marginRight: 6 },
  badgeText: { color: '#27B987', fontFamily: fonts.bodySemibold, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  userEmail: { color: '#7C9B8C', fontFamily: fonts.body, fontSize: 13, marginBottom: 10 },
  locationsContainer: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, paddingRight: 10 },
  locationIcon: { marginTop: 4, marginRight: 8 },
  locationsList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
  locationPill: { backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  locationText: { color: '#B2C9BE', fontFamily: fonts.body, fontSize: 11 },
  locationPillPlus: { backgroundColor: 'rgba(39, 185, 135, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(39, 185, 135, 0.3)' },
  locationTextPlus: { color: '#27B987', fontFamily: fonts.bodySemibold, fontSize: 11 },
  deleteButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255, 74, 74, 0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255, 74, 74, 0.3)' },
  statsGrid: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 16, padding: 16, alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  statBox: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  statTextGroup: { flex: 1 },
  statDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 8 },
  statLabel: { color: '#648A79', fontFamily: fonts.body, fontSize: 11, marginBottom: 2 },
  statValue: { color: '#FFFFFF', fontFamily: fonts.bodySemibold, fontSize: 12 },
  dashboardStats: { flexDirection: 'row', marginBottom: 24, paddingHorizontal: 4, gap: 12 },
  statChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0, 210, 135, 0.1)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(0, 210, 135, 0.2)', gap: 8 },
  statChipText: { color: '#00D287', fontFamily: fonts.bodySemibold, fontSize: 13, fontWeight: '600' },
  clearFilterChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 107, 107, 0.1)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255, 107, 107, 0.2)', gap: 8 },
  clearFilterText: { color: '#FF6B6B', fontFamily: fonts.bodySemibold, fontSize: 13, fontWeight: '600' },
  calendarContainer: { borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#1E3329', marginBottom: 24 },
  footerRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  idText: { color: 'rgba(255,255,255,0.3)', fontFamily: fonts.body, fontSize: 11 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyText: { color: '#7C9B8C', textAlign: 'center', marginTop: 16, fontFamily: fonts.body, fontSize: 16 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.95 }] },
});
