import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppSession } from '../context/AppSessionContext';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Account'>;

export const AccountScreen = ({ navigation }: Props) => {
  const { user, latestSessionId, logout } = useAppSession();
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    try {
      await logout();
      navigation.reset({ index: 0, routes: [{ name: 'GetStarted' }] });
    } catch {
      Alert.alert('Unable to sign out', 'Please try again.');
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.header}>
        <Pressable onPress={navigation.goBack} style={styles.backButton} accessibilityLabel="Go back">
          <Text style={styles.backArrow}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Account</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.charAt(0).toUpperCase() || 'T'}</Text>
          </View>
          <Text style={styles.name}>{user?.name || 'TripMind traveller'}</Text>
          <Text style={styles.email}>{user?.email || 'Guest session'}</Text>
          <View style={styles.sessionBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.sessionBadgeText}>Secure session active</Text>
          </View>
        </View>

        {latestSessionId ? (
          <Pressable onPress={() => navigation.navigate('PlanResult', { sessionId: latestSessionId })} style={styles.latestCard}>
            <View>
              <Text style={styles.cardEyebrow}>LATEST JOURNEY</Text>
              <Text style={styles.cardTitle}>Continue your saved trip</Text>
              <Text style={styles.cardSubtitle}>Live conditions and recommendations stay attached to this plan.</Text>
            </View>
            <Text style={styles.cardArrow}>→</Text>
          </Pressable>
        ) : null}

        <Pressable disabled={signingOut} onPress={signOut} style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}>
          {signingOut ? <ActivityIndicator color={colors.error} /> : <Text style={styles.signOutText}>Sign out</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: { height: 62, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  backArrow: { color: colors.forest, fontSize: 36, lineHeight: 38, fontWeight: '300', marginTop: -4 },
  headerTitle: { color: colors.forest, fontSize: 18, fontWeight: '700' },
  headerSpacer: { width: 44 },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 18 },
  profileCard: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 26, padding: 26, borderWidth: 1, borderColor: '#182C24' },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.forest, alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(39, 185, 135, 0.3)' },
  avatarText: { color: '#FFFFFF', fontSize: 29, fontWeight: '700' },
  name: { color: '#FFFFFF', fontSize: 24, fontWeight: '700', letterSpacing: -0.6 },
  email: { color: '#90A39C', fontSize: 14, marginTop: 5 },
  sessionBadge: { marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, height: 32, borderRadius: 16, backgroundColor: 'rgba(39, 185, 135, 0.12)', borderWidth: 1, borderColor: 'rgba(39, 185, 135, 0.2)' },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#38DFA8', shadowColor: '#27B987', shadowOpacity: 0.8, shadowRadius: 4 },
  sessionBadgeText: { color: '#27B987', fontSize: 12, fontWeight: '700' },
  latestCard: { marginTop: 18, minHeight: 132, padding: 20, borderRadius: 22, backgroundColor: colors.forestElevated, borderWidth: 1, borderColor: '#182C24', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardEyebrow: { color: '#27B987', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  cardTitle: { maxWidth: 260, color: '#FFFFFF', fontSize: 20, lineHeight: 26, fontWeight: '700', marginTop: 8 },
  cardSubtitle: { maxWidth: 270, color: '#90A39C', fontSize: 13, lineHeight: 19, marginTop: 6 },
  cardArrow: { color: '#27B987', fontSize: 29, fontWeight: '300', marginLeft: 12 },
  signOutButton: { marginTop: 18, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255, 92, 92, 0.35)', backgroundColor: 'rgba(226, 75, 74, 0.14)' },
  signOutText: { color: '#FF9E9F', fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
