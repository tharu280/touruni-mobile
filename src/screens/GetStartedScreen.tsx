import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { checkHealth } from '../api/client';
import { useAppSession } from '../context/AppSessionContext';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'GetStarted'>;

export const GetStartedScreen = ({ navigation }: Props) => {
  const [checkingBackend, setCheckingBackend] = useState(true);
  const [backendReady, setBackendReady] = useState(false);
  const { user, latestSessionId, initializing } = useAppSession();
  const reveal = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    let mounted = true;

    checkHealth()
      .then(() => {
        if (mounted) setBackendReady(true);
      })
      .catch(() => {
        if (mounted) setBackendReady(false);
      })
      .finally(() => {
        if (mounted) setCheckingBackend(false);
      });

    Animated.timing(reveal, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.65, duration: 1800, useNativeDriver: true }),
      ]),
    );
    glowLoop.start();

    return () => {
      mounted = false;
      glowLoop.stop();
    };
  }, [glow, reveal]);

  const busy = checkingBackend || initializing;

  const handleMainAction = () => {
    if (!backendReady && !checkingBackend) return;

    if (!user) {
      navigation.navigate('Auth', { mode: 'signup' });
      return;
    }

    if (latestSessionId) {
      navigation.navigate('PlanResult', { sessionId: latestSessionId });
      return;
    }

    navigation.navigate('FlightIntake');
  };

  const openAccount = () => {
    if (user) {
      navigation.navigate('Account');
      return;
    }
    navigation.navigate('Auth', { mode: 'login' });
  };

  return (
    <LinearGradient
      colors={['#082018', '#05120D', '#020705']}
      locations={[0, 0.5, 1]}
      style={styles.root}
    >
      <StatusBar barStyle="light-content" backgroundColor="#082018" />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <Animated.View
          style={[
            styles.content,
            {
              opacity: reveal,
              transform: [
                {
                  translateY: reveal.interpolate({
                    inputRange: [0, 1],
                    outputRange: [12, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {/* Top Header: Status Badge on LEFT (preventing overlap with Expo Dev Menu on right) */}
          <View style={styles.headerBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={user ? 'View Account' : 'Sign In'}
              onPress={openAccount}
              style={({ pressed }) => [
                styles.statusBadge,
                user ? styles.statusBadgeActive : styles.statusBadgeGuest,
                pressed && styles.pressed,
              ]}
            >
              {user ? (
                <>
                  <View style={styles.onlineDot} />
                  <Ionicons name="person-circle" size={18} color="#27B987" />
                  <Text style={styles.statusBadgeText} numberOfLines={1}>
                    {user.name || user.email.split('@')[0]}
                  </Text>
                  <Ionicons name="chevron-forward" size={12} color="#A0B3AC" />
                </>
              ) : (
                <>
                  <Ionicons name="person-circle-outline" size={18} color="#A0B3AC" />
                  <Text style={styles.statusBadgeGuestText}>Guest · Sign In</Text>
                  <Ionicons name="chevron-forward" size={12} color="#A0B3AC" />
                </>
              )}
            </Pressable>

            <View style={styles.headerRight}>
              <View style={styles.dotRow}>
                <View style={styles.dotStrong} />
                <View style={styles.dot} />
                <View style={styles.dotFaint} />
              </View>
            </View>
          </View>

          {/* Center Identity Section with Seamless Atmospheric Shine */}
          <View style={styles.identity}>
            <View style={styles.shineContainer} pointerEvents="none">
              <Animated.View style={[styles.shineAnimated, { opacity: glow }]}>
                {/* Vertical soft dissolved beam */}
                <LinearGradient
                  colors={['rgba(39,185,135,0)', 'rgba(39,185,135,0.16)', 'rgba(39,185,135,0)']}
                  locations={[0, 0.5, 1]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={styles.shineBeamVertical}
                />
                {/* Horizontal soft dissolved beam */}
                <LinearGradient
                  colors={['rgba(39,185,135,0)', 'rgba(39,185,135,0.22)', 'rgba(39,185,135,0)']}
                  locations={[0, 0.5, 1]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.shineBeamHorizontal}
                />
                {/* Diagonal core radiance */}
                <LinearGradient
                  colors={['rgba(42,216,152,0)', 'rgba(42,216,152,0.18)', 'rgba(42,216,152,0)']}
                  locations={[0.15, 0.5, 0.85]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.shineBeamCore}
                />
              </Animated.View>
            </View>

            <View style={styles.logoContainer}>
              <LinearGradient
                colors={['#27B987', '#13795A']}
                style={styles.logoTile}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.8, y: 1 }}
              >
                <Ionicons name="location-outline" size={54} color="#FFFFFF" />
              </LinearGradient>
            </View>

            <View style={styles.wordmarkRow}>
              <Text style={styles.wordmarkLight}>Trip</Text>
              <Text style={styles.wordmarkGreen}>Mind</Text>
            </View>
            <Text style={styles.subBrand}>INTELLIGENT TRAVEL COMPANION</Text>
          </View>

          {/* Bottom Action & Pitch Block */}
          <View style={styles.bottomBlock}>
            <View style={styles.kickerPill}>
              <View style={styles.kickerDot} />
              <Text style={styles.kickerText}>PROACTIVE AI · SRI LANKA</Text>
            </View>

            <Text style={styles.title}>
              Plan smart.{'\n'}
              Travel <Text style={styles.titleAccent}>Sri Lanka.</Text>
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                !user
                  ? 'Get started'
                  : latestSessionId
                  ? 'Monitor active plan'
                  : 'Start travel plan'
              }
              disabled={busy}
              onPress={handleMainAction}
              style={({ pressed }) => [
                styles.primaryButtonFrame,
                pressed && styles.pressed,
                busy && styles.disabled,
              ]}
            >
              <LinearGradient
                colors={['#27B987', '#17986B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>
                  {!user
                    ? 'Get started'
                    : latestSessionId
                    ? 'Monitor active plan'
                    : 'Start travel plan'}
                </Text>
                {busy ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Ionicons name="arrow-forward" size={22} color="#FFFFFF" />
                )}
              </LinearGradient>
            </Pressable>

            {!user ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => navigation.navigate('Auth', { mode: 'login' })}
                style={styles.accountAction}
              >
                <Text style={styles.accountText}>
                  I already have an account · <Text style={styles.accountTextAccent}>Sign in</Text>
                </Text>
              </Pressable>
            ) : latestSessionId ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => navigation.navigate('FlightIntake')}
                style={styles.accountAction}
              >
                <Text style={styles.accountText}>
                  Want a fresh start? <Text style={styles.accountTextAccent}>Plan a new trip</Text>
                </Text>
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() => navigation.navigate('Account')}
                style={styles.accountAction}
              >
                <Text style={styles.accountText}>
                  Manage session · <Text style={styles.accountTextAccent}>Account settings</Text>
                </Text>
              </Pressable>
            )}

            {!backendReady && !checkingBackend ? (
              <Text style={styles.offlineText}>Planner service is currently unreachable. Retrying...</Text>
            ) : null}
          </View>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#082018',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 26,
    paddingTop: 8,
    paddingBottom: 16,
    justifyContent: 'space-between',
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 42,
    width: '100%',
    paddingTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 22,
    borderWidth: 1,
    gap: 7,
    maxWidth: 210,
  },
  statusBadgeActive: {
    backgroundColor: 'rgba(15, 42, 31, 0.85)',
    borderColor: 'rgba(39, 185, 135, 0.45)',
  },
  statusBadgeGuest: {
    backgroundColor: 'rgba(18, 30, 24, 0.7)',
    borderColor: 'rgba(160, 179, 172, 0.25)',
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#27B987',
    shadowColor: '#27B987',
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontFamily: fonts.bodySemibold,
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
  statusBadgeGuestText: {
    color: '#E0E7E4',
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  dotRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dotStrong: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#27B987',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(39,185,135,0.5)',
  },
  dotFaint: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(39,185,135,0.2)',
  },
  identity: {
    alignItems: 'center',
    marginVertical: 10,
  },
  shineContainer: {
    position: 'absolute',
    top: -60,
    alignSelf: 'center',
    width: 360,
    height: 360,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shineAnimated: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shineBeamVertical: {
    position: 'absolute',
    width: 250,
    height: 350,
    borderRadius: 125,
  },
  shineBeamHorizontal: {
    position: 'absolute',
    width: 350,
    height: 250,
    borderRadius: 125,
  },
  shineBeamCore: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoTile: {
    width: 114,
    height: 114,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#27B987',
    shadowOpacity: 0.45,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 20,
  },
  wordmarkLight: {
    color: colors.text,
    fontFamily: fonts.displayExtraBold,
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1.6,
  },
  wordmarkGreen: {
    color: '#27B987',
    fontFamily: fonts.displayExtraBold,
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1.6,
  },
  subBrand: {
    color: '#769C8D',
    fontFamily: fonts.body,
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 3,
    marginTop: 6,
  },
  bottomBlock: {
    paddingBottom: 8,
  },
  kickerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(29, 158, 117, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(39, 185, 135, 0.35)',
    marginBottom: 14,
    gap: 8,
  },
  kickerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#27B987',
    shadowColor: '#27B987',
    shadowRadius: 4,
    shadowOpacity: 0.8,
  },
  kickerText: {
    color: '#27B987',
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.displayExtraBold,
    fontSize: 39,
    lineHeight: 46,
    fontWeight: '800',
    letterSpacing: -1.2,
  },
  titleAccent: {
    color: '#27B987',
  },
  description: {
    maxWidth: 420,
    marginTop: 12,
    color: '#A0B3AC',
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 23,
  },
  primaryButtonFrame: {
    marginTop: 24,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#27B987',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryButton: {
    minHeight: 62,
    paddingHorizontal: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontFamily: fonts.body,
    fontSize: 19,
    fontWeight: '800',
  },
  accountAction: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  accountText: {
    color: '#90A39C',
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '500',
  },
  accountTextAccent: {
    color: '#27B987',
    fontWeight: '700',
  },
  offlineText: {
    marginTop: 4,
    color: colors.error,
    fontFamily: fonts.body,
    fontSize: 12,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.65,
  },
});

