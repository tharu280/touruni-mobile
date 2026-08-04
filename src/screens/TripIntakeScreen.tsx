import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
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
import { chatWithBackend, generatePlan } from '../api/client';
import { ChatBubble } from '../components/ChatBubble';
import { MessageInput } from '../components/MessageInput';
import { ChatSuggestions } from '../components/ChatSuggestions';
import { useAppSession } from '../context/AppSessionContext';
import type { RootStackParamList } from '../navigation/types';
import type { ChatSessionState, ChatTurn } from '../types';
import { colors, fonts } from '../theme/colors';
import { buildPlanRequest, getSessionId } from '../utils/planner';
import { estimateFlightBudgetHandoff } from '../utils/flightBudget';

type Props = NativeStackScreenProps<RootStackParamList, 'TripIntake'>;

const PLANNING_STEPS = [
  'Mapping the best route',
  'Ranking stays within budget',
  'Checking weather and roads',
  'Estimating crowd windows',
  'Building your day-by-day plan',
];

const formatMoney = (value: number | null | undefined) => (
  typeof value === 'number' && Number.isFinite(value)
    ? `LKR ${Math.round(value).toLocaleString()}`
    : 'Budget ready'
);

export const TripIntakeScreen = ({ route, navigation }: Props) => {
  const { selectedFlight, flightPlan, initialAssistantReply } = route.params;
  const initialSession = route.params.session;
  const initialMessage = initialAssistantReply || 'Where should your trip start in Sri Lanka?';
  const [session, setSession] = useState<ChatSessionState>(initialSession);
  const [messages, setMessages] = useState<ChatTurn[]>([
    { role: 'assistant', content: initialMessage },
  ]);
  const [loading, setLoading] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [planningStep, setPlanningStep] = useState(0);
  const planningStarted = useRef(false);
  const listRef = useRef<FlatList<ChatTurn>>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const { accessToken, refreshLatestSession } = useAppSession();

  const remainingBudget = useMemo(() => {
    const confirmedRemainingBudget = session.flight_budget_handoff?.remaining_budget_lkr;
    if (typeof confirmedRemainingBudget === 'number' && Number.isFinite(confirmedRemainingBudget)) {
      return confirmedRemainingBudget;
    }

    const total = session.trip_requirements.total_budget_lkr;
    const handoff = estimateFlightBudgetHandoff(selectedFlight, total);
    return handoff.remainingBudgetLkr
      ?? session.trip_requirements.accommodation_budget_lkr;
  }, [
    selectedFlight,
    session.flight_budget_handoff?.remaining_budget_lkr,
    session.trip_requirements.accommodation_budget_lkr,
    session.trip_requirements.total_budget_lkr,
  ]);

  const flightLabel = selectedFlight
    ? `${selectedFlight.origin} → ${selectedFlight.destination}`
    : 'Flight details confirmed';

  const runPlanner = async (completedSession: ChatSessionState) => {
    if (planningStarted.current) return;
    planningStarted.current = true;
    setPlanningStep(0);
    setPlanning(true);

    try {
      const request = buildPlanRequest(completedSession, selectedFlight, flightPlan);
      const plan = await generatePlan(request, accessToken);
      const sessionId = getSessionId(plan);
      await refreshLatestSession();
      navigation.replace('PlanResult', { plan, sessionId });
    } catch (error) {
      planningStarted.current = false;
      setPlanning(false);
      Alert.alert(
        'Planning failed',
        error instanceof Error ? error.message : 'Please try again.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Retry',
            onPress: () => {
              void runPlanner(completedSession);
            },
          },
        ],
      );
    }
  };

  const handleSend = async (text: string) => {
    setMessages(previous => [...previous, { role: 'user', content: text }]);
    setLoading(true);

    try {
      const result = await chatWithBackend(text, session);
      setSession(result.session);
      setMessages(previous => [...previous, {
        role: 'assistant',
        content: result.turn.assistant_reply || 'Got it.',
      }]);

      if (
        result.turn.is_complete ||
        result.turn.active_phase === 'complete' ||
        result.session.active_phase === 'complete'
      ) {
        await runPlanner(result.session);
      }
    } catch (error) {
      Alert.alert('Unable to continue', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetTripConversation = () => {
    if (loading || planning) return;
    planningStarted.current = false;
    setSession(initialSession);
    setMessages([{ role: 'assistant', content: initialMessage }]);
  };

  useEffect(() => {
    const timer = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 120);
    return () => clearTimeout(timer);
  }, [messages, loading]);

  useEffect(() => {
    if (!planning) {
      progress.setValue(0);
      return undefined;
    }

    Animated.timing(progress, {
      toValue: 1,
      duration: 11000,
      useNativeDriver: false,
    }).start();

    const timer = setInterval(() => {
      setPlanningStep(current => Math.min(current + 1, PLANNING_STEPS.length - 1));
    }, 2200);

    return () => clearInterval(timer);
  }, [planning, progress]);

  if (planning) {
    const progressWidth = progress.interpolate({
      inputRange: [0, 1],
      outputRange: ['8%', '94%'],
    });

    return (
      <View style={styles.planningScreen}>
        <StatusBar barStyle="light-content" backgroundColor={colors.forest} />
        <SafeAreaView style={styles.planningSafeArea} edges={['top', 'bottom']}>
          <View style={styles.routeGlyph}>
            <View style={styles.routeRingOuter} />
            <View style={styles.routeRingInner} />
            <View style={styles.routeLine} />
            <View style={[styles.routePoint, styles.routePointStart]} />
            <View style={[styles.routePoint, styles.routePointEnd]} />
            <Ionicons name="sparkles" size={24} color="#27B987" style={styles.routeCenterIcon} />
          </View>

          <View style={styles.eyebrowRow}>
            <Ionicons name="map" size={14} color="#27B987" style={{ marginRight: 6 }} />
            <Text style={styles.planningEyebrow}>TRIPMIND ROUTE ENGINE</Text>
          </View>
          <Text style={styles.planningTitle}>Building your route plan...</Text>
          <Text style={styles.planningText}>
            Joining the route, stays, conditions and budget into one practical Sri Lanka itinerary.
          </Text>

          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFillWrapper, { width: progressWidth }]}>
              <LinearGradient 
                colors={['#169368', '#38DFA8']} 
                start={{ x: 0, y: 0 }} 
                end={{ x: 1, y: 0 }} 
                style={StyleSheet.absoluteFill as any} 
              />
            </Animated.View>
          </View>

          <View style={styles.steps}>
            {PLANNING_STEPS.map((step, index) => {
              const complete = index < planningStep;
              const active = index === planningStep;
              return (
                <View key={step} style={styles.stepRow}>
                  <View style={[
                    styles.stepMarker,
                    complete && styles.stepMarkerComplete,
                    active && styles.stepMarkerActive,
                  ]}>
                    <Text style={[
                      styles.stepMarkerText,
                      (complete || active) && styles.stepMarkerTextActive,
                    ]}>
                      {complete ? <Ionicons name="checkmark" size={14} color="#05120D" /> : index + 1}
                    </Text>
                  </View>
                  <Text style={[
                    styles.stepText,
                    active && styles.stepTextActive,
                    complete && styles.stepTextComplete,
                  ]}>
                    {step}
                  </Text>
                </View>
              );
            })}
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={colors.forest} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.headerContainer}>
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to flight options"
              onPress={() => navigation.goBack()}
              style={styles.headerButton}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={styles.headerTitle}>Plan your route</Text>
              <Text style={styles.headerSubtitle}>Sri Lanka trip details</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reset trip conversation"
              onPress={resetTripConversation}
              style={styles.resetButton}
            >
              <Ionicons name="refresh" size={14} color="#27B987" style={{ marginRight: 4 }} />
              <Text style={styles.resetText}>Reset</Text>
            </Pressable>
          </View>

        <View style={styles.handoffCard}>
          <View style={styles.handoffIcon}>
            <Ionicons name="checkmark" size={18} color="#FF5C5C" />
          </View>
          <View style={styles.handoffCopy}>
            <Text style={styles.handoffLabel}>FLIGHT LOCKED IN</Text>
            <Text style={styles.handoffValue}>{flightLabel}</Text>
          </View>
          <View style={styles.budgetCopy}>
            <Text style={styles.budgetLabel}>TRIP BUDGET</Text>
            <Text style={styles.budgetValue}>{formatMoney(remainingBudget)}</Text>
          </View>
        </View>

        <View style={styles.integratedDivider}>
          <View style={styles.dividerLineShort} />
          <View style={styles.phaseRow}>
            <View style={styles.phaseDot} />
            <Text style={styles.phaseText}>Route plan · step 2 of 2</Text>
          </View>
          <View style={styles.dividerLineLong} />
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(_, index) => index.toString()}
        renderItem={({ item }) => <ChatBubble turn={item} />}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={<View style={{ height: 12 }} />}
          ListFooterComponent={
            loading ? (
              <View style={styles.thinkingBubble}>
                <View style={styles.thinkingDots}>
                  <View style={styles.thinkingDot} />
                  <View style={[styles.thinkingDot, styles.thinkingDotMuted]} />
                  <View style={[styles.thinkingDot, styles.thinkingDotFaint]} />
                </View>
                <Text style={styles.thinkingText}>TripMind is shaping the next question</Text>
              </View>
            ) : null
          }
        />

        <ChatSuggestions 
          suggestions={['Colombo', 'Kandy', '3 days']} 
          onSelect={handleSend} 
          disabled={loading} 
        />
        <MessageInput onSend={handleSend} disabled={loading} />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#05120D' },
  safeArea: { flex: 1, backgroundColor: '#05120D' },
  headerContainer: {
    backgroundColor: '#05120D',
    zIndex: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  header: {
    minHeight: 68,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#05120D',
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1, alignItems: 'center' },
  headerTitle: { color: '#FFFFFF', fontFamily: fonts.displayBold, fontSize: 18, fontWeight: '700' },
  headerSubtitle: { color: '#90A39C', fontFamily: fonts.body, fontSize: 12.5, marginTop: 2 },
  resetButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(39, 185, 135, 0.1)', 
    paddingHorizontal: 12, 
    paddingVertical: 7, 
    borderRadius: 16, 
    borderWidth: 1, 
    borderColor: 'rgba(39, 185, 135, 0.25)', 
    marginRight: 24 
  },
  resetText: { color: '#27B987', fontFamily: fonts.bodySemibold, fontSize: 13.5, fontWeight: '700' },
  handoffCard: {
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 92, 92, 0.35)',
    backgroundColor: 'rgba(226, 75, 74, 0.14)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  handoffIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 92, 92, 0.15)', borderWidth: 1, borderColor: 'rgba(255, 92, 92, 0.3)' },
  handoffCopy: { flex: 1, marginLeft: 12 },
  handoffLabel: { color: '#FF9E9F', fontFamily: fonts.bodySemibold, fontSize: 9.5, fontWeight: '800', letterSpacing: 1.1 },
  handoffValue: { color: '#FFFFFF', fontFamily: fonts.displayBold, fontSize: 15, marginTop: 3 },
  budgetCopy: { alignItems: 'flex-end', maxWidth: '42%' },
  budgetLabel: { color: '#FF9E9F', fontFamily: fonts.bodySemibold, fontSize: 9.5, fontWeight: '800', letterSpacing: 0.8 },
  budgetValue: { color: '#FFFFFF', fontFamily: fonts.displayBold, fontSize: 14.5, marginTop: 3 },
  listContent: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24 },
  integratedDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 10,
  },
  dividerLineShort: {
    width: 24,
    height: 1,
    backgroundColor: 'rgba(39, 185, 135, 0.25)',
  },
  dividerLineLong: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(39, 185, 135, 0.25)',
  },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(39, 185, 135, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(39, 185, 135, 0.2)',
  },
  phaseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#38DFA8',
    marginRight: 8,
    shadowColor: '#27B987',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  phaseText: { color: '#27B987', fontFamily: fonts.bodySemibold, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  thinkingBubble: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 20,
    borderBottomLeftRadius: 7,
    backgroundColor: colors.forestElevated,
    borderWidth: 1,
    borderColor: '#254234',
  },
  thinkingDots: { flexDirection: 'row', gap: 5, marginBottom: 7 },
  thinkingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.mint },
  thinkingDotMuted: { opacity: 0.62 },
  thinkingDotFaint: { opacity: 0.3 },
  thinkingText: { color: '#98B3A5', fontSize: 12 },
  planningScreen: { flex: 1, backgroundColor: '#05120D' },
  planningSafeArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, backgroundColor: '#05120D' },
  routeGlyph: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center', marginBottom: 36, marginTop: -20 },
  routeRingOuter: { position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 1.5, borderColor: 'rgba(39, 185, 135, 0.15)' },
  routeRingInner: { position: 'absolute', width: 84, height: 84, borderRadius: 42, borderWidth: 1.5, borderColor: 'rgba(39, 185, 135, 0.3)' },
  routeLine: { position: 'absolute', width: 68, height: 2, backgroundColor: '#27B987', transform: [{ rotate: '-24deg' }], shadowColor: '#27B987', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 6, elevation: 2 },
  routePoint: { position: 'absolute', width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#05120D', backgroundColor: '#38DFA8', shadowColor: '#27B987', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 8, elevation: 4 },
  routePointStart: { left: 24, bottom: 32 },
  routePointEnd: { right: 24, top: 30 },
  routeCenterIcon: { opacity: 0.9 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  planningEyebrow: { color: '#27B987', fontFamily: fonts.bodySemibold, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  planningTitle: { color: '#FFFFFF', fontFamily: fonts.displayBold, fontSize: 32, lineHeight: 38, fontWeight: '700', textAlign: 'center' },
  planningText: { color: '#84A395', fontFamily: fonts.body, fontSize: 15, lineHeight: 24, textAlign: 'center', marginTop: 14, maxWidth: 350 },
  progressTrack: { width: '100%', maxWidth: 350, height: 6, borderRadius: 3, backgroundColor: 'rgba(39, 185, 135, 0.1)', marginTop: 40, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(39, 185, 135, 0.2)' },
  progressFillWrapper: { height: '100%', borderRadius: 3, overflow: 'hidden' },
  steps: { width: '100%', maxWidth: 350, marginTop: 32, gap: 16 },
  stepRow: { flexDirection: 'row', alignItems: 'center' },
  stepMarker: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(39, 185, 135, 0.25)', alignItems: 'center', justifyContent: 'center', marginRight: 16, backgroundColor: 'rgba(39, 185, 135, 0.05)' },
  stepMarkerComplete: { backgroundColor: '#27B987', borderColor: '#27B987' },
  stepMarkerActive: { backgroundColor: '#27B987', borderColor: '#27B987', shadowColor: '#27B987', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 6, elevation: 3 },
  stepMarkerText: { color: '#5E776A', fontFamily: fonts.bodySemibold, fontSize: 12, fontWeight: '800' },
  stepMarkerTextActive: { color: '#05120D' },
  stepText: { color: '#5E776A', fontFamily: fonts.bodySemibold, fontSize: 15, fontWeight: '600' },
  stepTextActive: { color: '#FFFFFF', fontFamily: fonts.bodySemibold, fontSize: 15.5 },
  stepTextComplete: { color: '#27B987' },
});
