import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAdminSession } from '../context/AdminSessionContext';
import { adminProvisionDevice, AdminAuthError } from '../api/adminClient';
import type { AdminProvisionDeviceResponse } from '../types/adminIot';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminIoTProvision'>;

export const AdminIoTProvisionScreen = ({ navigation }: Props) => {
  const { adminToken, logoutAdmin } = useAdminSession();

  const [label, setLabel] = useState('');
  const [macAddress, setMacAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AdminProvisionDeviceResponse | null>(null);

  const handleProvision = async () => {
    if (!adminToken) return;
    if (!label.trim()) {
      Alert.alert('Name required', 'Give this device a label so it can be identified in the fleet.');
      return;
    }

    setLoading(true);
    try {
      const response = await adminProvisionDevice(adminToken, {
        label: label.trim(),
        mac_address: macAddress.trim() || undefined,
      });
      setResult(response);
    } catch (e) {
      if (e instanceof AdminAuthError) {
        await logoutAdmin();
        navigation.replace('Auth', { mode: 'login' });
        return;
      }
      Alert.alert('Provisioning Failed', e instanceof Error ? e.message : 'Could not provision device.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setLabel('');
    setMacAddress('');
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <Pressable
        style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        onPress={navigation.goBack}
      >
        <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
      </Pressable>

      <Text style={styles.title}>Provision Device</Text>
      <Text style={styles.subtitle}>
        {result
          ? 'Attach the QR to the vehicle — whoever scans it becomes the owner.'
          : 'Adds a new device to the unclaimed pool and generates its claim QR.'}
      </Text>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.formPanel}>
          {!result ? (
            <>
              <Text style={styles.fieldLabel}>Label</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="car-outline" size={19} color="#27B987" style={{ marginRight: 12 }} />
                <TextInput
                  style={styles.input}
                  value={label}
                  onChangeText={setLabel}
                  placeholder="e.g. Tourism Van 04"
                  placeholderTextColor="#648A79"
                  autoFocus
                  maxLength={80}
                />
              </View>

              <Text style={styles.fieldLabel}>MAC Address (optional)</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="hardware-chip-outline" size={19} color="#27B987" style={{ marginRight: 12 }} />
                <TextInput
                  style={styles.input}
                  value={macAddress}
                  onChangeText={setMacAddress}
                  placeholder="F4:2D:C9:71:8A:60 — real hardware only"
                  placeholderTextColor="#648A79"
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
              </View>
              <Text style={styles.helperText}>
                Leave blank for a virtual/demo device (a random ID is generated). Fill in only when
                provisioning a real ESP32 hub — this must match the MAC it prints at boot.
              </Text>

              <Pressable
                onPress={handleProvision}
                disabled={loading}
                style={({ pressed }) => [styles.submitFrame, pressed && styles.pressed, loading && styles.disabled]}
              >
                <LinearGradient
                  colors={['#27B987', '#169368']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.submitBtn}
                >
                  <Text style={styles.submitText}>Provision Device</Text>
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Ionicons name="qr-code-outline" size={20} color="#FFFFFF" />
                  )}
                </LinearGradient>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.successRow}>
                <Ionicons name="checkmark-circle" size={32} color="#27B987" />
                <Text style={styles.successText}>Device provisioned</Text>
              </View>

              <Text style={styles.deviceIdLabel}>Device ID</Text>
              <Text style={styles.deviceIdValue} selectable>{result.device_id}</Text>

              <View style={styles.qrCard}>
                <QRCode value={result.qr_payload} size={220} backgroundColor="#FFFFFF" color="#081C14" />
              </View>
              <Text style={styles.helperText}>
                Scan this with the mobile app's "Register Device" screen to claim it. The QR is
                reusable — it keeps working across any number of claim/unclaim cycles.
              </Text>

              <View style={styles.warningBox}>
                <Ionicons name="warning-outline" size={18} color="#F5A623" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.warningTitle}>Device secret — shown once</Text>
                  <Text style={styles.warningText} selectable>{result.device_secret}</Text>
                  <Text style={styles.warningSubtext}>
                    Paste into the firmware's secrets.h before flashing. Long-press to copy — this
                    won't be shown again after you leave this screen.
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={reset}
                style={({ pressed }) => [styles.submitFrame, pressed && styles.pressed, { marginTop: 8 }]}
              >
                <LinearGradient
                  colors={['#27B987', '#169368']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.submitBtn}
                >
                  <Text style={styles.submitText}>Provision Another</Text>
                  <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
                </LinearGradient>
              </Pressable>

              <Pressable onPress={() => navigation.navigate('AdminIoTDevices')} style={styles.rescanBtn}>
                <Text style={styles.rescanText}>View all devices</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  backBtn: {
    position: 'absolute',
    top: 16,
    left: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(12,36,26,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(39,185,135,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontFamily: fonts.displayBold,
    fontSize: 26,
    letterSpacing: -0.5,
    marginTop: 72,
    marginHorizontal: 24,
  },
  subtitle: {
    color: '#9FBAAD',
    fontFamily: fonts.body,
    fontSize: 14,
    marginHorizontal: 24,
    marginTop: 6,
    marginBottom: 20,
  },
  formPanel: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
  fieldLabel: { color: '#C6DFD4', fontFamily: fonts.bodySemibold, fontSize: 13.5, fontWeight: '700', marginBottom: 8 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#05120D',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(39,185,135,0.28)',
    minHeight: 58,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  input: { flex: 1, color: '#FFFFFF', fontFamily: fonts.body, fontSize: 16, paddingVertical: 12 },
  helperText: { color: '#7C9B8C', fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, marginBottom: 24 },
  submitFrame: { borderRadius: 28, overflow: 'hidden', shadowColor: '#27B987', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 8 },
  submitBtn: { minHeight: 60, paddingHorizontal: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  submitText: { color: '#FFFFFF', fontFamily: fonts.bodySemibold, fontSize: 18, fontWeight: '800' },
  rescanBtn: { alignItems: 'center', marginTop: 20 },
  rescanText: { color: '#7C9B8C', fontFamily: fonts.body, fontSize: 14, textDecorationLine: 'underline' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.6 },
  successRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24 },
  successText: { color: '#27B987', fontFamily: fonts.bodySemibold, fontSize: 16, fontWeight: '700' },
  deviceIdLabel: { color: '#7C9B8C', fontFamily: fonts.body, fontSize: 12, marginBottom: 4 },
  deviceIdValue: { color: '#C6DFD4', fontFamily: fonts.bodySemibold, fontSize: 13, marginBottom: 24 },
  qrCard: {
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  warningBox: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'rgba(245,166,35,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.3)',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
  },
  warningTitle: { color: '#F5A623', fontFamily: fonts.bodySemibold, fontSize: 13, fontWeight: '700', marginBottom: 6 },
  warningText: { color: '#FFFFFF', fontFamily: fonts.body, fontSize: 12, marginBottom: 8 },
  warningSubtext: { color: '#C9B389', fontFamily: fonts.body, fontSize: 11.5, lineHeight: 16 },
});
