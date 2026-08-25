import * as LocalAuthentication from 'expo-local-authentication';

export interface BiometricResult {
  success: boolean;
  error?: string;
}

/**
 * Authenticates the driver using device-native biometrics (Face ID / fingerprint).
 * The biometric template NEVER leaves the device — only the boolean result is used.
 */
export async function authenticateDriver(): Promise<BiometricResult> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) {
    return { success: false, error: 'Biometric hardware not available on this device.' };
  }

  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  if (!isEnrolled) {
    return {
      success: false,
      error: 'No biometrics enrolled. Please set up Face ID or fingerprint in device settings.',
    };
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Verify your identity to start the trip',
    fallbackLabel: 'Use PIN',
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
  });

  if (result.success) return { success: true };
  return {
    success: false,
    error: result.error === 'user_cancel' ? undefined : 'Biometric authentication failed.',
  };
}
