import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppSession } from '../context/AppSessionContext';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Auth'>;

const HERO_IMAGE = { uri: 'https://tourproject-nu.vercel.app/sri_lanka_hero.jpg' };

export const AuthScreen = ({ route, navigation }: Props) => {
  const [mode, setMode] = useState<'login' | 'signup'>(route.params?.mode || 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const session = useAppSession();

  const submit = async () => {
    if (!email.trim() || password.length < 10 || (mode === 'signup' && !name.trim())) {
      Alert.alert('Check your details', 'Please enter a valid email and a password with at least 10 characters.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login' && email.trim().toLowerCase() === 'admin@tourmind.com') {
        const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/admin/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), password }),
        });
        if (!response.ok) {
          throw new Error('Invalid admin credentials.');
        }
        const data = await response.json();
        navigation.replace('AdminDashboard', { adminToken: data.token });
        return;
      }

      if (mode === 'signup') await session.signup(name.trim(), email.trim(), password);
      else await session.login(email.trim(), password);
      navigation.replace('GetStarted');
    } catch (error) {
      Alert.alert('Unable to continue', error instanceof Error ? error.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <ImageBackground source={HERO_IMAGE} resizeMode="cover" style={styles.heroImage}>
        <LinearGradient
          colors={['rgba(3, 14, 10, 0.4)', 'rgba(5, 18, 13, 0.8)', '#081C14']}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
      </ImageBackground>

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={navigation.goBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </Pressable>

        <KeyboardAvoidingView
          style={styles.keyboard}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.intro}>
              <Text style={styles.brand}>TripMind</Text>
              <Text style={styles.introText}>
                Your personalized itineraries and travel preferences, synced across all your devices.
              </Text>
            </View>

            <View style={styles.panel}>
              {/* Segmented Tab Switcher */}
              <View style={styles.segmentedControl}>
                <Pressable
                  onPress={() => setMode('login')}
                  style={[styles.segment, mode === 'login' && styles.segmentActive]}
                >
                  <Text style={[styles.segmentText, mode === 'login' && styles.segmentTextActive]}>
                    Sign in
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setMode('signup')}
                  style={[styles.segment, mode === 'signup' && styles.segmentActive]}
                >
                  <Text style={[styles.segmentText, mode === 'signup' && styles.segmentTextActive]}>
                    Create account
                  </Text>
                </Pressable>
              </View>

              <Text style={styles.title}>
                {mode === 'login' ? 'Welcome back' : 'Start your journey'}
              </Text>
              <Text style={styles.subtitle}>
                {mode === 'login'
                  ? 'Enter your details below to resume managing your active travel plans.'
                  : 'Set up your free account to generate AI travel routes, alerts, and budgets.'}
              </Text>

              {mode === 'signup' && (
                <View style={styles.field}>
                  <Text style={styles.label}>Name</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="person-outline" size={19} color="#27B987" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={name}
                      onChangeText={setName}
                      placeholder="Your full name"
                      placeholderTextColor="#648A79"
                      autoCapitalize="words"
                      textContentType="name"
                    />
                  </View>
                </View>
              )}

              <View style={styles.field}>
                <Text style={styles.label}>Email Address</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="mail-outline" size={19} color="#27B987" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    placeholderTextColor="#648A79"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="emailAddress"
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={19} color="#27B987" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="At least 10 characters"
                    placeholderTextColor="#648A79"
                    secureTextEntry
                    textContentType={mode === 'login' ? 'password' : 'newPassword'}
                  />
                </View>
              </View>

              <Pressable
                accessibilityRole="button"
                onPress={submit}
                disabled={loading}
                style={({ pressed }) => [
                  styles.submitButtonFrame,
                  pressed && styles.pressed,
                  loading && styles.disabled,
                ]}
              >
                <LinearGradient
                  colors={['#27B987', '#169368']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.submitButton}
                >
                  <Text style={styles.submitButtonText}>
                    {mode === 'login' ? 'Sign in' : 'Create account'}
                  </Text>
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                  )}
                </LinearGradient>
              </Pressable>

              <View style={styles.securityRow}>
                <Ionicons name="shield-checkmark" size={16} color="#27B987" />
                <Text style={styles.securityText}>
                  Secure & fully encrypted. Your credentials remain confidential and protected.
                </Text>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#081C14',
  },
  heroImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 380,
  },
  safeArea: {
    flex: 1,
  },
  keyboard: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    top: 14,
    left: 22,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(12, 36, 26, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(39, 185, 135, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingTop: 140,
  },
  intro: {
    paddingHorizontal: 30,
    paddingBottom: 28,
  },
  brand: {
    color: '#FFFFFF',
    fontFamily: fonts.displayExtraBold,
    fontSize: 42,
    lineHeight: 48,
    fontWeight: '800',
    letterSpacing: -1.5,
  },
  introText: {
    marginTop: 8,
    maxWidth: 320,
    color: '#B2C9BE',
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
  },
  panel: {
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: 26,
    paddingTop: 24,
    paddingBottom: 36,
    backgroundColor: '#081C14',
    borderTopWidth: 1,
    borderColor: 'rgba(39, 185, 135, 0.25)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 16,
  },
  segmentedControl: {
    flexDirection: 'row',
    padding: 5,
    borderRadius: 20,
    backgroundColor: '#04100C',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 24,
  },
  segment: {
    flex: 1,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: '#134D37',
    borderWidth: 1,
    borderColor: 'rgba(39, 185, 135, 0.5)',
    shadowColor: '#27B987',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  segmentText: {
    color: '#7C9B8C',
    fontFamily: fonts.bodySemibold,
    fontSize: 14.5,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#FFFFFF',
    fontFamily: fonts.bodySemibold,
    fontWeight: '800',
  },
  title: {
    color: '#FFFFFF',
    fontFamily: fonts.displayBold,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  subtitle: {
    color: '#9FBAAD',
    fontFamily: fonts.body,
    fontSize: 14.5,
    lineHeight: 22,
    marginTop: 6,
    marginBottom: 24,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    color: '#C6DFD4',
    fontFamily: fonts.bodySemibold,
    fontSize: 13.5,
    fontWeight: '700',
    marginBottom: 8,
    marginLeft: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#05120D',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(39, 185, 135, 0.28)',
    minHeight: 58,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontFamily: fonts.body,
    fontSize: 16,
    paddingVertical: 12,
  },
  submitButtonFrame: {
    marginTop: 12,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#27B987',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  submitButton: {
    minHeight: 60,
    paddingHorizontal: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontFamily: fonts.bodySemibold,
    fontSize: 18,
    fontWeight: '800',
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 22,
    paddingHorizontal: 10,
  },
  securityText: {
    color: '#84A395',
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    flexShrink: 1,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.6,
  },
});
