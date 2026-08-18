import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getConditionNotifications,
  getSessionDashboard,
  markConditionNotificationRead,
  refreshSessionIntelligence,
} from '../api/client';
import { useVoiceUpdates } from '../hooks/useVoiceUpdates';
import { VoiceNotificationCard } from '../components/VoiceNotificationCard';
import { TripAssistantChatbot } from '../components/TripAssistantChatbot';
import { DevicePickerModal } from '../components/DevicePickerModal';
import { useAppSession } from '../context/AppSessionContext';
import { useIoT } from '../context/IoTContext';
import { startTrip } from '../api/iotClient';
import type { DeviceSummary } from '../types/iot';
import { fonts } from '../theme/colors';
import {
  CrowdSection,
  RoadsSection,
  RouteSection,
  TipsSection,
  WeatherSection,
} from '../features/dashboard/DashboardSections';
import {
  buildDashboardViewModel,
  dashboardFromPlan,
  type DashboardTab,
} from '../features/dashboard/model';
import type { RootStackParamList } from '../navigation/types';
import { useRepeatingDemoTask } from '../hooks/useRepeatingDemoTask';
import { colors } from '../theme/colors';
import type { ConditionNotification, DashboardPayload } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'PlanResult'>;

const TABS: Array<{ key: DashboardTab; label: string }> = [
  { key: 'route', label: 'Route' },
  { key: 'crowd', label: 'Crowd' },
  { key: 'weather', label: 'Weather' },
  { key: 'roads', label: 'Roads' },
  { key: 'tips', label: 'Tips' },
];

const notificationKey = (item: ConditionNotification, index: number) => (
  item.notification_id || item.id || `${item.created_at || 'update'}-${index}`
);

export const PlanResultScreen = ({ navigation, route }: Props) => {
  const { accessToken } = useAppSession();
  const initialDashboard = useMemo(
    () => route.params?.plan ? dashboardFromPlan(route.params.plan) : null,
    [route.params?.plan],
  );

  const requestedSessionId = route.params?.sessionId || initialDashboard?.session_id || '';
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(initialDashboard);
  const [activeTab, setActiveTab] = useState<DashboardTab>('route');
  const [notifications, setNotifications] = useState<ConditionNotification[]>([]);
  const [notificationsLoaded, setNotificationsLoaded] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(!initialDashboard && Boolean(requestedSessionId));
  const [intelligenceRefreshing, setIntelligenceRefreshing] = useState(false);
  const [conditionsDemoEnabled, setConditionsDemoEnabled] = useState(false);
  const [conditionsPromptDue, setConditionsPromptDue] = useState(false);
  const [conditionsLastUpdated, setConditionsLastUpdated] = useState<Date | null>(null);
  const [moodDemoEnabled, setMoodDemoEnabled] = useState(false);
  const [moodPromptDue, setMoodPromptDue] = useState(false);
  const [voiceUpdatesEnabled, setVoiceUpdatesEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { devices, devicesLoading, refreshDevices, setActiveDevice, setActiveTripId } = useIoT();
  const [devicePickerVisible, setDevicePickerVisible] = useState(false);
  const [startingIoTTrip, setStartingIoTTrip] = useState(false);

  useEffect(() => {
    refreshDevices();
  }, []);

  const { isPlaying, play, stop } = useVoiceUpdates(
    notifications,
    voiceUpdatesEnabled,
    requestedSessionId,
    notificationsLoaded,
  );

  const loadNotifications = useCallback(async (sessionId: string) => {
    setNotificationsLoaded(false);
    try {
      const response = await getConditionNotifications(sessionId, accessToken);
      setNotifications(response.items || []);
      setUnreadCount(response.unread_count || 0);
    } catch {
      // Notifications are supplementary; a failure must not hide the trip.
    } finally {
      setNotificationsLoaded(true);
    }
  }, [accessToken]);

  const loadDashboard = useCallback(async (showSpinner = false) => {
    if (!requestedSessionId) {
      if (!initialDashboard) setError('This trip has no saved session or planner result to display.');
      return;
    }
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const response = await getSessionDashboard(requestedSessionId, accessToken);
      setDashboard(response);
      await loadNotifications(requestedSessionId);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The saved trip could not be loaded.');
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [accessToken, initialDashboard, loadNotifications, requestedSessionId]);

  useEffect(() => {
    if (requestedSessionId) void loadDashboard(!initialDashboard);
  }, [initialDashboard, loadDashboard, requestedSessionId]);

  const model = useMemo(
    () => dashboard ? buildDashboardViewModel(dashboard) : null,
    [dashboard],
  );

  const refreshIntelligence = useCallback(async () => {
    if (!requestedSessionId) return;
    setIntelligenceRefreshing(true);
    setError(null);
    try {
      await refreshSessionIntelligence(requestedSessionId, accessToken);
      await loadDashboard(false);
      setConditionsLastUpdated(new Date());
      setConditionsPromptDue(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Trip intelligence could not be refreshed.');
    } finally {
      setIntelligenceRefreshing(false);
    }
  }, [accessToken, loadDashboard, requestedSessionId]);

  const beginIoTTrip = useCallback(async (device: DeviceSummary) => {
    setDevicePickerVisible(false);
    setStartingIoTTrip(true);
    try {
      setActiveDevice(device.device_id);
      if (!accessToken) return;
      const trip = await startTrip(accessToken, {
        device_id: device.device_id,
        biometric_verified: true,
        planning_session_id: requestedSessionId || undefined,
      });
      setActiveTripId(trip.trip_id);
      navigation.navigate('IoTTripMonitor', {
        deviceId: device.device_id,
        tripId: trip.trip_id,
        sessionId: requestedSessionId || undefined,
      });
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not start the trip.');
    } finally {
      setStartingIoTTrip(false);
    }
  }, [accessToken, navigation, requestedSessionId, setActiveDevice, setActiveTripId]);

  const handleStartTripPress = () => {
    if (devices.length === 1) {
      beginIoTTrip(devices[0]);
    } else if (devices.length > 1) {
      setDevicePickerVisible(true);
    }
  };

  const conditionsDemo = useRepeatingDemoTask({
    enabled: conditionsDemoEnabled && Boolean(requestedSessionId),
    intervalMs: 60_000,
    onTick: refreshIntelligence,
    runImmediately: true,
  });

  const [moodTimerRemaining, setMoodTimerRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (moodTimerRemaining === null) return;
    if (!moodDemoEnabled) {
      setMoodTimerRemaining(null);
      return;
    }
    if (moodTimerRemaining <= 0) {
      setMoodPromptDue(true);
      setMoodTimerRemaining(null);
      return;
    }
    const id = setTimeout(() => {
      setMoodTimerRemaining(r => r !== null ? r - 1 : null);
    }, 1000);
    return () => clearTimeout(id);
  }, [moodTimerRemaining, moodDemoEnabled]);

  const markNotificationRead = async (notification: ConditionNotification) => {
    if (!requestedSessionId) return;
    const id = notification.notification_id || notification.id;
    if (!id) return;
    try {
      await markConditionNotificationRead(requestedSessionId, String(id), accessToken);
      setUnreadCount(current => Math.max(0, current - (notification.read ? 0 : 1)));
      setNotifications(current => current.map(item => (
        (item.notification_id || item.id) === id ? { ...item, read: true } : item
      )));
    } catch {
      setError('The update could not be marked as read.');
    }
  };

  const renderSection = () => {
    if (!dashboard || !model) return null;
    return (
      <View style={{ flex: 1 }}>
        {activeTab === 'crowd' && <CrowdSection dashboard={dashboard} model={model} />}
        {activeTab === 'weather' && <WeatherSection dashboard={dashboard} model={model} />}
        {activeTab === 'roads' && <RoadsSection dashboard={dashboard} model={model} />}
        {activeTab === 'route' && <RouteSection dashboard={dashboard} model={model} />}
        
        <View style={{ display: activeTab === 'tips' ? 'flex' : 'none', flex: 1 }}>
          <TipsSection 
            dashboard={dashboard} 
            model={model} 
            accessToken={accessToken} 
            moodDemoEnabled={moodDemoEnabled} 
            setMoodDemoEnabled={(val) => {
              setMoodDemoEnabled(val);
              if (val) setConditionsDemoEnabled(false);
            }} 
            moodPromptDue={moodPromptDue} 
            setMoodPromptDue={setMoodPromptDue} 
            moodDemo={{ running: moodTimerRemaining !== null, secondsRemaining: moodTimerRemaining || 0 }}
            isActive={activeTab === 'tips'}
            onMoodCheckIn={() => {
              if (moodDemoEnabled) setMoodTimerRemaining(30);
            }}
          />
        </View>
      </View>
    );
  };

  if (loading && !dashboard) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar barStyle="light-content" backgroundColor={colors.forest} />
        <View style={styles.loadingOrb}><ActivityIndicator size="large" color={colors.mint} /></View>
        <Text style={styles.loadingTitle}>Opening your trip</Text>
        <Text style={styles.loadingCopy}>Loading the route, stays and latest travel intelligence.</Text>
      </View>
    );
  }

  const conditionsSummary = (() => {
    if (!model || !model.days || model.days.length === 0) return "Conditions refreshed.";
    const today = model.days[0];
    const weather = today.weather?.condition || today.weather?.status || '';
    const temp = today.weather?.temperature_max_c != null ? `${Math.round(today.weather.temperature_max_c)}°C` : '';
    const crowd = model.crowdRisk || today.crowd?.risk_level || '';
    const crowdSummary = model.crowdSummary;
    const incidents = model.roadIncidents?.length || 0;
    
    const parts = [];
    if (weather && temp) {
      parts.push(`Today is ${weather.toLowerCase()} (${temp}).`);
    } else if (weather) {
      parts.push(`Today is ${weather.toLowerCase()}.`);
    }
    
    if (crowdSummary) {
      parts.push(crowdSummary.endsWith('.') ? crowdSummary : `${crowdSummary}.`);
    } else if (crowd) {
      parts.push(`Crowds are ${crowd.toLowerCase()}.`);
    }

    if (incidents > 0) {
      parts.push(`⚠️ ${incidents} road incident${incidents === 1 ? '' : 's'} reported on your route.`);
    } else {
      parts.push(`🚗 Route is clear.`);
    }
    
    return parts.length > 0 ? parts.join(' ') : "Trip signals updated successfully.";
  })();

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.forest} />
      <View style={styles.header}>
        <Pressable style={styles.headerButton} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {model ? `${model.originName} to ${model.destinationName}` : 'Your Sri Lanka trip'}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {[model?.durationLabel, model?.dateLabel].filter(Boolean).join(' · ') || 'Trip dashboard'}
          </Text>
        </View>
        <Pressable
          style={[styles.headerButton, intelligenceRefreshing && styles.headerButtonBusy]}
          onPress={refreshIntelligence}
          disabled={!requestedSessionId || intelligenceRefreshing}
          accessibilityLabel="Refresh trip intelligence"
        >
          {intelligenceRefreshing
            ? <ActivityIndicator color={colors.cream} />
            : <Text style={styles.refreshGlyph}>↻</Text>}
        </Pressable>
      </View>

      <View style={styles.tabShell}>
        {TABS.map(tab => (
          <Pressable
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.activeTabLabel]}>{tab.label}</Text>
            {tab.key === 'route' && unreadCount > 0 && <View style={styles.unreadDot} />}
          </Pressable>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {!!error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Some live data could not be updated</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {unreadCount > 0 && notifications.length > 0 && (
          <>
            <VoiceNotificationCard
              notification={notifications.find(n => !n.read) || notifications[0]}
              isPlaying={isPlaying}
              onPlay={play}
              onStop={stop}
              onMarkRead={markNotificationRead}
            />
          </>
        )}
        {activeTab !== 'tips' && (() => {
          const createdAtStr = (dashboard as any)?.created_at as string | undefined;
          const displayTime = conditionsLastUpdated || (createdAtStr ? new Date(createdAtStr) : null);
          return (
          <>
            <View style={styles.demoControl}>
              <View style={styles.demoControlCopy}>
                <Text style={styles.demoEyebrow}>LIVE DEMO</Text>
                <Text style={styles.demoTitle}>Refresh trip conditions</Text>
                <Text style={styles.demoDetail}>
                  {conditionsDemo.running
                    ? 'Checking weather, crowd and road signals now...'
                    : conditionsDemoEnabled
                      ? `Next check in ${conditionsDemo.secondsRemaining}s. The latest result stays visible.`
                      : 'Off. Turn on to refresh every 1 minute while the app is open.'}
                </Text>
                {!conditionsDemo.running && displayTime ? (
                  <Text style={[styles.demoDetail, { color: '#FF6B6B', fontWeight: '700', marginTop: 2, fontSize: 13 }]}>
                    Last updated at {displayTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.
                  </Text>
                ) : null}
              </View>
              <Switch
                value={conditionsDemoEnabled}
                onValueChange={(val) => {
                  setConditionsDemoEnabled(val);
                  if (val) setMoodDemoEnabled(false);
                }}
                disabled={!requestedSessionId}
                trackColor={{ false: '#294239', true: '#1B765C' }}
                thumbColor={conditionsDemoEnabled ? colors.mint : '#A7B5AE'}
              />
            </View>

            <View style={styles.demoControl}>
              <View style={styles.demoControlCopy}>
                <Text style={styles.demoEyebrow}>SETTINGS</Text>
                <Text style={styles.demoTitle}>Voice updates</Text>
                <Text style={styles.demoDetail}>
                  {voiceUpdatesEnabled
                    ? 'On. New updates will be spoken aloud automatically.'
                    : 'Off. You can still listen manually.'}
                </Text>
              </View>
              <Switch
                value={voiceUpdatesEnabled}
                onValueChange={setVoiceUpdatesEnabled}
                trackColor={{ false: '#294239', true: '#1B765C' }}
                thumbColor={voiceUpdatesEnabled ? colors.mint : '#A7B5AE'}
                accessibilityLabel="Enable voice updates"
              />
            </View>
          </>
          );
        })()}

        {devices.length > 0 && dashboard && model && (
          <View style={styles.demoControl}>
            <View style={styles.demoControlCopy}>
              <Text style={styles.demoEyebrow}>SAFETY</Text>
              <Text style={styles.demoTitle}>Start trip monitoring</Text>
              <Text style={styles.demoDetail}>
                {devicesLoading
                  ? 'Checking your registered devices...'
                  : devices.length === 1
                    ? `Monitor this trip with "${devices[0].label}".`
                    : `${devices.length} devices available — choose one to start.`}
              </Text>
            </View>
            <Pressable
              onPress={handleStartTripPress}
              disabled={startingIoTTrip || devicesLoading}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <LinearGradient
                colors={['#27B987', '#169368']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.iotStartBtn}
              >
                {startingIoTTrip ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.iotStartBtnText}>Start Trip</Text>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        )}

        {dashboard && model ? (
          <>
            {renderSection()}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Trip dashboard unavailable</Text>
            <Text style={styles.emptyCopy}>{error || 'Generate or open a saved trip to continue.'}</Text>
          </View>
        )}
      </ScrollView>

      <DevicePickerModal
        visible={devicePickerVisible}
        devices={devices}
        busy={startingIoTTrip}
        onSelect={beginIoTTrip}
        onClose={() => setDevicePickerVisible(false)}
      />

      {dashboard && model && requestedSessionId && (
        <TripAssistantChatbot sessionId={requestedSessionId} />
      )}

      {(moodPromptDue || conditionsPromptDue) && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {moodPromptDue && (
            <Pressable 
              style={styles.moodPromptBanner} 
              onPress={(e) => {
                setActiveTab('tips');
                setMoodPromptDue(false);
              }}
            >
              <View style={styles.androidNotifHeader}>
                <View style={styles.androidAppIcon}><Text style={{fontSize: 10}}>🧭</Text></View>
                <Text style={styles.moodPromptAppName}>TripMind</Text>
                <Text style={styles.androidNotifDot}>•</Text>
                <Text style={styles.moodPromptTime}>now</Text>
                <View style={{flex: 1}} />
                <Pressable 
                  style={styles.moodPromptDismiss} 
                  onPress={(e) => {
                    e.stopPropagation();
                    setMoodPromptDue(false);
                  }}
                  hitSlop={20}
                >
                  <Text style={styles.moodPromptDismissText}>✕</Text>
                </Pressable>
              </View>
              <View style={styles.androidNotifContent}>
                <Text style={styles.moodPromptTitle}>Mood check due</Text>
                <Text style={styles.moodPromptText}>You have reached your next stop. Tap to log how you are feeling.</Text>
              </View>
            </Pressable>
          )}
          {conditionsPromptDue && (
            <Pressable 
              style={[styles.moodPromptBanner, moodPromptDue && { top: 160 }]} 
              onPress={() => {
                setConditionsPromptDue(false);
              }}
            >
              <View style={styles.androidNotifHeader}>
                <View style={styles.androidAppIcon}><Text style={{fontSize: 10}}>🧭</Text></View>
                <Text style={styles.moodPromptAppName}>TripMind</Text>
                <Text style={styles.androidNotifDot}>•</Text>
                <Text style={styles.moodPromptTime}>now</Text>
                <View style={{flex: 1}} />
                <Pressable 
                  style={styles.moodPromptDismiss} 
                  onPress={(e) => {
                    e.stopPropagation();
                    setConditionsPromptDue(false);
                  }}
                  hitSlop={20}
                >
                  <Text style={styles.moodPromptDismissText}>✕</Text>
                </Pressable>
              </View>
              <View style={styles.androidNotifContent}>
                <Text style={styles.moodPromptTitle}>Conditions updated</Text>
                <Text style={styles.moodPromptText}>
                  {voiceUpdatesEnabled ? "Audio update available." : conditionsSummary}
                </Text>
                {voiceUpdatesEnabled && (
                  <View style={{ flexDirection: 'row', marginTop: 12 }}>
                    <Pressable 
                      style={{ 
                        flexDirection: 'row', 
                        alignItems: 'center', 
                        backgroundColor: isPlaying ? 'rgba(255, 107, 107, 0.15)' : '#303134', 
                        paddingVertical: 8, 
                        paddingHorizontal: 16, 
                        borderRadius: 100 
                      }} 
                      onPress={isPlaying ? stop : () => play({ title: 'Conditions updated', message: conditionsSummary.replace(/[⚠️🚗]/g, ''), category: 'multi_signal' })}
                    >
                      <Ionicons name={isPlaying ? "stop" : "play"} size={16} color={isPlaying ? "#FF6B6B" : "#E8EAED"} />
                      <Text style={{ color: isPlaying ? "#FF6B6B" : "#E8EAED", fontSize: 14, fontWeight: '500', marginLeft: 8 }}>
                        {isPlaying ? "Stop playing" : "Listen to update"}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </Pressable>
          )}
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05120D' },
  scroll: { flex: 1, backgroundColor: '#05120D' },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 48 },
  header: { minHeight: 68, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: '#05120D', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(39, 185, 135, 0.2)' },
  headerButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(39, 185, 135, 0.05)', borderWidth: 1, borderColor: 'rgba(39, 185, 135, 0.22)' },
  headerButtonBusy: { opacity: 0.7 },
  backGlyph: { color: '#FFFFFF', fontSize: 38, lineHeight: 38, marginTop: -4 },
  refreshGlyph: { color: '#FFFFFF', fontSize: 25, fontWeight: '600' },
  headerCopy: { flex: 1, alignItems: 'center', paddingHorizontal: 10 },
  headerTitle: { color: '#FFFFFF', fontFamily: fonts.displayBold, fontSize: 17.5, fontWeight: '700' },
  headerSubtitle: { color: '#8BA398', fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  tabShell: { margin: 12, marginBottom: 0, padding: 4, borderRadius: 18, flexDirection: 'row', backgroundColor: 'rgba(226, 75, 74, 0.12)', borderWidth: 1, borderColor: 'rgba(255, 92, 92, 0.2)' },
  tab: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  activeTab: { backgroundColor: '#FF5C5C', shadowColor: '#FF5C5C', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 6, elevation: 3 },
  tabLabel: { color: '#FF9E9F', fontFamily: fonts.bodySemibold, fontSize: 12.5, fontWeight: '700' },
  activeTabLabel: { color: '#05120D' },
  unreadDot: { position: 'absolute', right: 8, top: 7, width: 6, height: 6, borderRadius: 3, backgroundColor: colors.warning },
  loadingScreen: { flex: 1, backgroundColor: '#05120D', alignItems: 'center', justifyContent: 'center', padding: 36 },
  loadingOrb: { width: 82, height: 82, borderRadius: 41, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(39, 185, 135, 0.05)', borderWidth: 1, borderColor: 'rgba(39, 185, 135, 0.22)' },
  loadingTitle: { color: '#FFFFFF', fontFamily: fonts.displayBold, fontSize: 24, fontWeight: '700', marginTop: 24 },
  loadingCopy: { color: colors.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 22, marginTop: 8 },
  errorBanner: { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.35)', borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 14 },
  errorTitle: { color: '#FFB4B4', fontSize: 14, fontWeight: '700' },
  errorText: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 5 },
  updateBanner: { minHeight: 128, borderRadius: 20, backgroundColor: '#133126', borderWidth: 1, borderColor: 'rgba(92,225,181,0.36)', overflow: 'hidden', flexDirection: 'row', marginBottom: 16 },
  updateAccent: { width: 5, backgroundColor: colors.mint },
  updateCopy: { flex: 1, padding: 16 },
  updateEyebrow: { color: colors.mint, fontSize: 10, letterSpacing: 1.2, fontWeight: '800' },
  updateTitle: { color: colors.warmWhite, fontSize: 16, fontWeight: '700', marginTop: 7 },
  updateMessage: { color: '#B9C8C0', fontSize: 13, lineHeight: 19, marginTop: 5 },
  updateAction: { color: colors.mint, fontSize: 11, fontWeight: '700', marginTop: 9 },
  demoControl: { minHeight: 110, borderRadius: 20, backgroundColor: colors.forestElevated, borderWidth: 1, borderColor: 'rgba(74, 214, 167, 0.22)', padding: 16, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 16 },
  demoControlCopy: { flex: 1 },
  demoEyebrow: { color: colors.mint, fontSize: 9, letterSpacing: 1.3, fontWeight: '900' },
  demoTitle: { color: colors.warmWhite, fontSize: 15, fontWeight: '800', marginTop: 5 },
  demoDetail: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  iotStartBtn: { minHeight: 48, borderRadius: 24, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
  iotStartBtnText: { color: '#FFFFFF', fontFamily: fonts.bodySemibold, fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.85 },
  emptyState: { padding: 28, marginTop: 32, borderRadius: 20, alignItems: 'center', backgroundColor: colors.forestElevated, borderWidth: 1, borderColor: 'rgba(74, 214, 167, 0.22)' },
  emptyTitle: { color: colors.warmWhite, fontSize: 18, fontWeight: '700' },
  emptyCopy: { color: colors.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  moodPromptBanner: { position: 'absolute', top: 40, left: 16, right: 16, zIndex: 999, borderRadius: 28, backgroundColor: '#202124', padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 12 },
  androidNotifHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  androidAppIcon: { width: 20, height: 20, borderRadius: 4, backgroundColor: '#1B765C', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  androidNotifDot: { color: '#9AA0A6', fontSize: 10, marginHorizontal: 6 },
  androidNotifContent: { paddingLeft: 0, paddingRight: 8 },
  moodPromptAppName: { color: '#E8EAED', fontSize: 12, fontWeight: '400' },
  moodPromptTime: { color: '#9AA0A6', fontSize: 12, fontWeight: '400' },
  moodPromptTitle: { color: '#E8EAED', fontSize: 15, fontWeight: '600', marginBottom: 4 },
  moodPromptText: { color: '#9AA0A6', fontSize: 14, lineHeight: 20 },
  moodPromptDismiss: { paddingHorizontal: 4 },
  moodPromptDismissText: { color: '#9AA0A6', fontSize: 14, fontWeight: '600' },
});
