import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppSession } from '../context/AppSessionContext';
import { useIoT } from '../context/IoTContext';
import { registerDevice } from '../api/iotClient';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'IoTRegisterDevice'>;

interface QRPayload {
  v: number;
  device_id: string;
  secret: string;
}

function parseQRPayload(raw: string): QRPayload | null {
  try {
    const obj = JSON.parse(raw) as Partial<QRPayload>;
    if (obj.v === 1 && typeof obj.device_id === 'string' && typeof obj.secret === 'string') {
      return obj as QRPayload;
    }
    return null;
  } catch {
    return null;
  }
}

export const DeviceRegistrationScreen = ({ navigation }: Props) => {
  const { accessToken } = useAppSession();
  const { setActiveDevice, refreshDevices } = useIoT();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [qrPayload, setQRPayload] = useState<QRPayload | null>(null);
  const [label, setLabel] = useState('');
  const [loading, setLoading] = useState(false);

  // ── QR scanned ─────────────────────────────────────────────────────────────
  const handleBarCode = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);

    const payload = parseQRPayload(data);
    if (!payload) {
      Alert.alert('Invalid QR Code', 'This QR code is not a valid device registration code.', [
        { text: 'Try Again', onPress: () => setScanned(false) },
      ]);
      return;
    }
    setQRPayload(payload);
  };

  // ── Register ───────────────────────────────────────────────────────────────
  const handleRegister = async () => {
    if (!qrPayload || !accessToken) return;
    if (!label.trim()) {
      Alert.alert('Name required', 'Please give this vehicle a name.');
      return;
    }

    setLoading(true);
    try {
      await registerDevice(accessToken, {
        device_id: qrPayload.device_id,
        label: label.trim(),
        registration_secret: qrPayload.secret,
      });

      await refreshDevices();
      setActiveDevice(qrPayload.device_id);
      navigation.replace('IoTDashboard', { deviceId: qrPayload.device_id });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Registration failed.';
      Alert.alert('Registration Failed', msg, [
        { text: 'OK', onPress: () => { setScanned(false); setQRPayload(null); } },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // ── Permission not yet requested ───────────────────────────────────────────
  if (!permission) {
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Back button */}
      <Pressable
        style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        onPress={navigation.goBack}
      >
        <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
      </Pressable>

      <Text style={styles.title}>Register Device</Text>
      <Text style={styles.subtitle}>Scan the QR code inside the vehicle cabin</Text>

      {/* ── Camera / QR scanner ────────────────────────────────────────────── */}
      {!qrPayload ? (
        <View style={styles.scanArea}>
          {!permission.granted ? (
            <View style={styles.permBox}>
              <Ionicons name="camera-outline" size={48} color="#27B987" />
              <Text style={styles.permText}>Camera access is needed to scan the QR code.</Text>
              <Pressable style={styles.permBtn} onPress={requestPermission}>
                <Text style={styles.permBtnText}>Allow Camera</Text>
              </Pressable>
            </View>
          ) : (
            <CameraView
              style={StyleSheet.absoluteFillObject}
              onBarcodeScanned={scanned ? undefined : handleBarCode}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            >
              {/* Viewfinder overlay */}
              <View style={styles.overlay}>
                <View style={styles.finder} />
                <Text style={styles.scanHint}>Align QR code within the frame</Text>
              </View>
            </CameraView>
          )}
        </View>
      ) : (
        /* ── Label entry panel ──────────────────────────────────────────── */
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView contentContainerStyle={styles.formPanel}>
            <View style={styles.successRow}>
              <Ionicons name="checkmark-circle" size={32} color="#27B987" />
              <Text style={styles.successText}>QR code scanned</Text>
            </View>

            <Text style={styles.deviceIdLabel}>Device ID</Text>
            <Text style={styles.deviceIdValue}>{qrPayload.device_id}</Text>

            <Text style={styles.fieldLabel}>Vehicle Name</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="car-outline" size={19} color="#27B987" style={{ marginRight: 12 }} />
              <TextInput
                style={styles.input}
                value={label}
                onChangeText={setLabel}
                placeholder="e.g. Tourism Van 01"
                placeholderTextColor="#648A79"
                autoFocus
                maxLength={40}
              />
            </View>

            <Pressable
              onPress={handleRegister}
              disabled={loading}
              style={({ pressed }) => [styles.submitFrame, pressed && styles.pressed, loading && styles.disabled]}
            >
              <LinearGradient
                colors={['#27B987', '#169368']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitBtn}
              >
                <Text style={styles.submitText}>Register Vehicle</Text>
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                )}
              </LinearGradient>
            </Pressable>

            <Pressable onPress={() => { setScanned(false); setQRPayload(null); }} style={styles.rescanBtn}>
              <Text style={styles.rescanText}>Scan a different QR code</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
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
  scanArea: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#04100C',
    borderWidth: 1,
    borderColor: 'rgba(39,185,135,0.25)',
    marginBottom: 32,
  },
  permBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
  permText: { color: '#9FBAAD', fontFamily: fonts.body, fontSize: 14, textAlign: 'center' },
  permBtn: { backgroundColor: '#27B987', borderRadius: 28, paddingVertical: 12, paddingHorizontal: 28 },
  permBtnText: { color: '#FFFFFF', fontFamily: fonts.bodySemibold, fontSize: 15, fontWeight: '700' },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 },
  finder: {
    width: 220,
    height: 220,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#27B987',
    backgroundColor: 'transparent',
  },
  scanHint: { color: '#FFFFFF', fontFamily: fonts.body, fontSize: 14, opacity: 0.8 },
  formPanel: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
  successRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24 },
  successText: { color: '#27B987', fontFamily: fonts.bodySemibold, fontSize: 16, fontWeight: '700' },
  deviceIdLabel: { color: '#7C9B8C', fontFamily: fonts.body, fontSize: 12, marginBottom: 4 },
  deviceIdValue: { color: '#C6DFD4', fontFamily: fonts.bodySemibold, fontSize: 13, marginBottom: 24 },
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
    marginBottom: 24,
  },
  input: { flex: 1, color: '#FFFFFF', fontFamily: fonts.body, fontSize: 16, paddingVertical: 12 },
  submitFrame: { borderRadius: 28, overflow: 'hidden', shadowColor: '#27B987', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 8 },
  submitBtn: { minHeight: 60, paddingHorizontal: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  submitText: { color: '#FFFFFF', fontFamily: fonts.bodySemibold, fontSize: 18, fontWeight: '800' },
  rescanBtn: { alignItems: 'center', marginTop: 20 },
  rescanText: { color: '#7C9B8C', fontFamily: fonts.body, fontSize: 14, textDecorationLine: 'underline' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.6 },
});
