import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { confirmFlight } from '../api/client';
import { FlightOptionCard } from '../components/FlightOptionCard';
import type { RootStackParamList } from '../navigation/types';
import type { FlightOption } from '../types';
import { colors, fonts } from '../theme/colors';
import { estimateFlightBudgetHandoff } from '../utils/flightBudget';

type Props = NativeStackScreenProps<RootStackParamList, 'FlightOptions'>;

const sameFlight = (left: FlightOption | null, right: FlightOption | null) => {
  if (!left || !right) return false;
  return left.id === right.id || (
    left.airline === right.airline && left.price === right.price && left.departure_at === right.departure_at
  );
};

const formatSearchDate = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatLkr = (value: number | null | undefined) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'Not available';
  return `LKR ${Math.max(0, Math.round(value)).toLocaleString()}`;
};

const formatFare = (flight: FlightOption | null) => {
  if (!flight || flight.price === null || flight.price === undefined) return 'Fare pending';
  return `${flight.currency || 'USD'} ${Number(flight.price).toLocaleString()}`;
};

export const FlightOptionsScreen = ({ route, navigation }: Props) => {
  const { flightPlan, session } = route.params;
  const flights = useMemo(() => flightPlan.results.map((item, index) => ({
    ...item,
    id: item.id || `${item.airline || 'flight'}-${item.departure_at || index}`,
    origin: item.origin || flightPlan.origin,
    destination: item.destination || flightPlan.destination || 'CMB',
    passengers: item.passengers || flightPlan.passengers || 1,
    is_best_value: sameFlight(item, flightPlan.cheapest_result || null),
  })), [flightPlan]);
  const bestValue = flights.find(item => item.is_best_value) || flights[0] || null;
  const otherOptions = flights.filter(item => !sameFlight(item, bestValue));
  const [selected, setSelected] = useState<FlightOption | null>(bestValue);
  const [confirming, setConfirming] = useState(false);
  const selectedBudgetHandoff = useMemo(() => estimateFlightBudgetHandoff(
    selected,
    session.trip_requirements.total_budget_lkr ?? flightPlan.total_budget_lkr,
  ), [flightPlan.total_budget_lkr, selected, session.trip_requirements.total_budget_lkr]);
  const isRecommendedFlightSelected = sameFlight(selected, bestValue);
  const backendRemainingBudgetLkr = flightPlan.budget_handoff?.remaining_budget_lkr;
  const remainingBudgetLkr = isRecommendedFlightSelected
    ? backendRemainingBudgetLkr ?? selectedBudgetHandoff.remainingBudgetLkr
    : selectedBudgetHandoff.remainingBudgetLkr;

  const continueToTrip = async () => {
    if (!selected) return;
    setConfirming(true);
    try {
      const confirmation = await confirmFlight(session, selected);
      navigation.replace('TripIntake', {
        selectedFlight: selected,
        flightPlan,
        session: confirmation.session,
        initialAssistantReply: confirmation.turn.assistant_reply,
      });
    } catch (error) {
      Alert.alert('Unable to confirm flight', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setConfirming(false);
    }
  };

  const continueWithoutFare = async () => {
    setConfirming(true);
    try {
      const confirmation = await confirmFlight(session, null, true);
      navigation.replace('TripIntake', {
        selectedFlight: null,
        flightPlan,
        session: confirmation.session,
        initialAssistantReply: confirmation.turn.assistant_reply,
      });
    } catch (error) {
      Alert.alert('Unable to continue', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#05120D" />

      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={12} onPress={navigation.goBack} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Select your flight</Text>
          <Text numberOfLines={1} style={styles.headerSubtitle}>
            {flightPlan.origin} → {flightPlan.destination || 'CMB'} · {formatSearchDate(flightPlan.departure_date)}
          </Text>
        </View>
        <Pressable accessibilityRole="button" hitSlop={12} style={styles.headerButtonRight}>
          <Ionicons name="information-circle-outline" size={24} color="#7A9C8D" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {flightPlan.fallback_applied && (
          <View style={styles.fallbackBanner}>
            <View style={styles.fallbackIcon}><Ionicons name="refresh" size={20} color="#F0BF60" /></View>
            <View style={styles.fallbackCopy}>
              <Text style={styles.fallbackTitle}>Nearby date found</Text>
              <Text style={styles.fallbackText}>No useful fare was available on the exact date, so TripMind checked the surrounding week.</Text>
            </View>
          </View>
        )}

        {bestValue ? (
          <>
            <View style={styles.sectionHeadingRow}>
              <View>
                <View style={styles.eyebrowRow}>
                  <Ionicons name="sparkles" size={12} color="#27B987" style={{ marginRight: 4 }} />
                  <Text style={styles.eyebrow}>TRIPMIND RECOMMENDS</Text>
                </View>
                <Text style={styles.sectionTitle}>Best value</Text>
              </View>
              <Text style={styles.resultCount}>{flights.length} option{flights.length === 1 ? '' : 's'}</Text>
            </View>
            <FlightOptionCard
              option={bestValue}
              selected={sameFlight(selected, bestValue)}
              onSelect={setSelected}
            />

            {otherOptions.length > 0 && (
              <>
                <Text style={styles.otherTitle}>Other options</Text>
                {otherOptions.map((flight, index) => (
                  <FlightOptionCard
                    key={flight.id || index.toString()}
                    option={flight}
                    selected={sameFlight(selected, flight)}
                    onSelect={setSelected}
                  />
                ))}
              </>
            )}

            <View style={styles.handoffCard}>
              <View style={styles.handoffIcon}>
                <Ionicons name="wallet-outline" size={24} color="#27B987" />
              </View>
              <View style={styles.handoffCopy}>
                <Text style={styles.handoffLabel}>TRIP BUDGET AFTER FLIGHT</Text>
                <Text style={styles.handoffValue}>{formatLkr(remainingBudgetLkr)}</Text>
                <Text style={styles.handoffText}>Available for accommodation and your Sri Lanka route.</Text>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}><Ionicons name="airplane" size={32} color="#27B987" /></View>
            <Text style={styles.emptyTitle}>No live fare was returned</Text>
            <Text style={styles.emptyText}>You can still continue. TripMind will keep the full trip budget available for accommodation and the Sri Lanka route.</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {selected && flights.length > 0 && (
          <View style={styles.selectionSummary}>
            <View>
              <Text style={styles.selectionLabel}>SELECTED</Text>
              <Text numberOfLines={1} style={styles.selectionAirline}>{selected.airline || 'Flight'}</Text>
            </View>
            <Text style={styles.selectionFare}>{formatFare(selected)}</Text>
          </View>
        )}
        <Pressable
          accessibilityRole="button"
          disabled={confirming}
          onPress={flights.length ? continueToTrip : continueWithoutFare}
          style={({ pressed }) => [styles.ctaWrapper, pressed && styles.ctaPressed, confirming && styles.ctaDisabled]}
        >
          {flights.length ? (
            <LinearGradient
              colors={['#27B987', '#169368']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaActive}
            >
              {confirming ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.ctaText}>Use selected flight</Text>
                  <Ionicons name="arrow-forward" size={20} color="#FFFFFF" style={styles.ctaArrow} />
                </>
              )}
            </LinearGradient>
          ) : (
            <View style={styles.ctaInactive}>
              {confirming ? (
                <ActivityIndicator color="#27B987" />
              ) : (
                <>
                  <Text style={styles.ctaTextInactive}>Continue without live fare</Text>
                  <Ionicons name="arrow-forward" size={20} color="#27B987" style={styles.ctaArrow} />
                </>
              )}
            </View>
          )}
        </Pressable>
        <Text style={styles.confirmationNote}>Trip planning starts only after you confirm here.</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#05120D' },
  header: {
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(39, 185, 135, 0.15)',
    backgroundColor: '#05120D',
  },
  headerButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerButtonRight: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(39, 185, 135, 0.08)' },
  headerCopy: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  headerTitle: { color: '#FFFFFF', fontFamily: fonts.displayBold, fontSize: 18, fontWeight: '700' },
  headerSubtitle: { color: '#7A9C8D', fontFamily: fonts.body, fontSize: 11.5, marginTop: 4 },
  content: { backgroundColor: '#05120D', paddingHorizontal: 18, paddingTop: 24, paddingBottom: 190 },
  fallbackBanner: { flexDirection: 'row', backgroundColor: '#13281E', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#2A4A3A', marginBottom: 24 },
  fallbackIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(240, 191, 96, 0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  fallbackCopy: { flex: 1 },
  fallbackTitle: { color: '#FFFFFF', fontFamily: fonts.displayBold, fontSize: 14, fontWeight: '700' },
  fallbackText: { color: '#8AA496', fontFamily: fonts.body, fontSize: 12, lineHeight: 18, marginTop: 4 },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center' },
  eyebrow: { color: '#27B987', fontFamily: fonts.bodySemibold, fontSize: 10, fontWeight: '800', letterSpacing: 1.3 },
  sectionTitle: { color: '#FFFFFF', fontFamily: fonts.displayBold, fontSize: 32, fontWeight: '700', marginTop: 4 },
  resultCount: { color: '#7A9C8D', fontFamily: fonts.body, fontSize: 12.5, marginBottom: 6 },
  otherTitle: { color: '#FFFFFF', fontFamily: fonts.displayBold, fontSize: 22, fontWeight: '700', marginTop: 24, marginBottom: 16 },
  handoffCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#081A14', borderRadius: 24, padding: 20, marginTop: 12, borderWidth: 1, borderColor: 'rgba(39, 185, 135, 0.25)', shadowColor: '#27B987', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 3 },
  handoffIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(39, 185, 135, 0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 16, borderWidth: 1, borderColor: 'rgba(39, 185, 135, 0.3)' },
  handoffCopy: { flex: 1 },
  handoffLabel: { color: '#27B987', fontFamily: fonts.bodySemibold, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  handoffValue: { color: '#FFFFFF', fontFamily: fonts.displayBold, fontSize: 24, fontWeight: '800', marginTop: 4 },
  handoffText: { color: '#7A9C8D', fontFamily: fonts.body, fontSize: 12, marginTop: 4, lineHeight: 17 },
  emptyCard: { minHeight: 320, backgroundColor: '#081A14', borderRadius: 26, padding: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(39, 185, 135, 0.2)' },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(39, 185, 135, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 24, borderWidth: 1, borderColor: 'rgba(39, 185, 135, 0.3)' },
  emptyTitle: { color: '#FFFFFF', fontFamily: fonts.displayBold, fontSize: 24, fontWeight: '700', textAlign: 'center' },
  emptyText: { color: '#8AA496', fontFamily: fonts.body, fontSize: 14.5, lineHeight: 22, textAlign: 'center', marginTop: 12, maxWidth: 310 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5, 18, 13, 0.95)', borderTopWidth: 1, borderTopColor: 'rgba(39, 185, 135, 0.2)', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28 },
  selectionSummary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 14 },
  selectionLabel: { color: '#7A9C8D', fontFamily: fonts.bodySemibold, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  selectionAirline: { color: '#FFFFFF', fontFamily: fonts.bodySemibold, fontSize: 14, fontWeight: '700', maxWidth: 200, marginTop: 4 },
  selectionFare: { color: '#FFFFFF', fontFamily: fonts.displayBold, fontSize: 18, fontWeight: '800' },
  ctaWrapper: { borderRadius: 24 },
  ctaPressed: { transform: [{ scale: 0.99 }], opacity: 0.92 },
  ctaDisabled: { opacity: 0.65 },
  ctaActive: { height: 60, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, shadowColor: '#27B987', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  ctaInactive: { height: 60, borderRadius: 24, backgroundColor: 'rgba(39, 185, 135, 0.1)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, borderWidth: 1, borderColor: 'rgba(39, 185, 135, 0.3)' },
  ctaText: { color: '#FFFFFF', fontFamily: fonts.bodySemibold, fontSize: 16.5, fontWeight: '800' },
  ctaTextInactive: { color: '#27B987', fontFamily: fonts.bodySemibold, fontSize: 16.5, fontWeight: '800' },
  ctaArrow: { position: 'absolute', right: 24 },
  confirmationNote: { color: '#5E776A', fontFamily: fonts.body, fontSize: 10.5, textAlign: 'center', marginTop: 14 },
});
