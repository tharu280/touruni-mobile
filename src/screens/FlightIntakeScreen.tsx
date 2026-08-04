import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChatBubble } from '../components/ChatBubble';
import { MessageInput } from '../components/MessageInput';
import { ChatSuggestions } from '../components/ChatSuggestions';
import { chatWithBackend, searchFlights } from '../api/client';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme/colors';
import type { ChatSessionState, ChatTurn } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'FlightIntake'>;

const INITIAL_MESSAGE: ChatTurn = {
  role: 'assistant',
  content: 'Hi, I’m TripMind. Let’s find the best flight to Sri Lanka. Which city are you flying from?',
};

export const FlightIntakeScreen = ({ navigation }: Props) => {
  const [session, setSession] = useState<ChatSessionState | null>(null);
  const [messages, setMessages] = useState<ChatTurn[]>([INITIAL_MESSAGE]);
  const [loading, setLoading] = useState(false);
  const [searchingFlights, setSearchingFlights] = useState(false);
  const listRef = useRef<FlatList<ChatTurn>>(null);

  const handleSend = async (text: string) => {
    const userMsg: ChatTurn = { role: 'user', content: text };
    setMessages(previous => [...previous, userMsg]);
    setLoading(true);

    try {
      const result = await chatWithBackend(text, session);
      setSession(result.session);
      setMessages(previous => [
        ...previous,
        {
          role: 'assistant',
          content: result.turn?.assistant_reply || 'Got it.',
        },
      ]);

      const readyForFlightSearch =
        result.session?.active_phase === 'flight_selection' ||
        result.turn?.active_phase === 'flight_selection';

      if (readyForFlightSearch) {
        setSearchingFlights(true);
        const searchResult = await searchFlights(result.session);
        navigation.navigate('FlightOptions', {
          flightPlan: searchResult,
          session: result.session,
        });
      }
    } catch (error) {
      Alert.alert(
        'Unable to continue',
        error instanceof Error ? error.message : 'The travel assistant could not respond. Please try again.',
      );
    } finally {
      setLoading(false);
      setSearchingFlights(false);
    }
  };

  const resetConversation = () => {
    setSession(null);
    setMessages([INITIAL_MESSAGE]);
  };

  useEffect(() => {
    const timer = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 120);
    return () => clearTimeout(timer);
  }, [messages, loading]);

  const dateSuggestion = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }, []);

  if (searchingFlights) {
    return (
      <View style={styles.searchScreen}>
        <StatusBar barStyle="light-content" backgroundColor="#082018" />
        <SafeAreaView style={styles.searchSafeArea} edges={['top', 'bottom']}>
          <View style={styles.searchOrb}>
            <ActivityIndicator color="#27B987" size="large" />
          </View>
          <Text style={styles.searchTitle}>Finding your best flights...</Text>
          <Text style={styles.searchDescription}>
            Comparing available fares to Colombo and protecting the rest of your trip budget.
          </Text>
          <View style={styles.searchSteps}>
            <View style={styles.searchStep}>
              <View style={styles.stepDone}>
                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
              </View>
              <Text style={styles.stepText}>Flight details confirmed</Text>
            </View>
            <View style={styles.searchStep}>
              <View style={styles.stepActive} />
              <Text style={[styles.stepText, styles.stepActiveText]}>Searching live and nearby-date fares</Text>
            </View>
            <View style={styles.searchStep}>
              <View style={styles.stepPending} />
              <Text style={styles.stepMutedText}>Selecting the best value</Text>
            </View>
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
      <StatusBar barStyle="light-content" backgroundColor="#05120D" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.headerContainer}>
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={() => navigation.goBack()}
              style={styles.headerButton}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={styles.headerTitle}>Flight details</Text>
              <Text style={styles.headerSubtitle}>To Colombo, Sri Lanka</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reset flight conversation"
              onPress={resetConversation}
              style={styles.resetButton}
            >
              <Ionicons name="refresh" size={14} color="#27B987" style={{ marginRight: 4 }} />
              <Text style={styles.resetText}>Reset</Text>
            </Pressable>
          </View>

          <View style={styles.integratedDivider}>
            <View style={styles.dividerLineShort} />
            <View style={styles.phaseRow}>
              <View style={styles.phaseDot} />
              <Text style={styles.phaseText}>Flight search · step 1 of 2</Text>
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
                <Text style={styles.thinkingText}>TripMind is checking your answer</Text>
              </View>
            ) : null
          }
        />

        <ChatSuggestions 
          suggestions={['Dubai', dateSuggestion, '1 passenger', 'Economy', '500,000 LKR']} 
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
    backgroundColor: 'rgba(226, 75, 74, 0.14)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 92, 92, 0.35)',
    shadowColor: '#FF5C5C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  phaseDot: { 
    width: 7, 
    height: 7, 
    borderRadius: 3.5, 
    backgroundColor: '#FF5C5C', 
    marginRight: 8, 
    shadowColor: '#FF5C5C', 
    shadowOpacity: 1, 
    shadowRadius: 6, 
    elevation: 3 
  },
  phaseText: { 
    color: '#FF9E9F', 
    fontFamily: fonts.bodySemibold, 
    fontSize: 10.5, 
    fontWeight: '800', 
    letterSpacing: 1.1, 
    textTransform: 'uppercase' 
  },
  thinkingBubble: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 24,
    borderBottomLeftRadius: 6,
    backgroundColor: '#0A1C14',
    borderWidth: 1,
    borderColor: 'rgba(39, 185, 135, 0.22)',
  },
  thinkingDots: { flexDirection: 'row', gap: 5, marginBottom: 7 },
  thinkingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#27B987' },
  thinkingDotMuted: { opacity: 0.62 },
  thinkingDotFaint: { opacity: 0.3 },
  thinkingText: { color: '#84A395', fontFamily: fonts.body, fontSize: 12.5 },
  searchScreen: { flex: 1, backgroundColor: '#082018' },
  searchSafeArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  searchOrb: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A1C14',
    borderWidth: 1,
    borderColor: 'rgba(39, 185, 135, 0.35)',
    shadowColor: '#27B987',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  searchTitle: { color: '#FFFFFF', fontFamily: fonts.displayBold, fontSize: 27, fontWeight: '700', textAlign: 'center', marginTop: 32 },
  searchDescription: { color: '#A0B3AC', fontFamily: fonts.body, fontSize: 15, lineHeight: 23, textAlign: 'center', marginTop: 12, maxWidth: 340 },
  searchSteps: { width: '100%', maxWidth: 360, marginTop: 46, gap: 20 },
  searchStep: { flexDirection: 'row', alignItems: 'center' },
  stepDone: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#27B987', alignItems: 'center', justifyContent: 'center', marginRight: 13 },
  stepActive: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#27B987', marginHorizontal: 6, marginRight: 19, shadowColor: '#27B987', shadowOpacity: 0.8, shadowRadius: 6 },
  stepPending: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: 'rgba(39, 185, 135, 0.4)', marginHorizontal: 6, marginRight: 19 },
  stepText: { color: '#A0B3AC', fontFamily: fonts.body, fontSize: 15 },
  stepActiveText: { color: '#FFFFFF', fontFamily: fonts.bodySemibold, fontWeight: '700' },
  stepMutedText: { color: '#648A79', fontFamily: fonts.body, fontSize: 15 },
});
