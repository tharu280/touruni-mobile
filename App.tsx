import React from 'react';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  Syne_400Regular,
  Syne_600SemiBold,
  Syne_700Bold,
  Syne_800ExtraBold,
} from '@expo-google-fonts/syne';
import {
  DMSans_300Light,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
} from '@expo-google-fonts/dm-sans';
import { useFonts } from 'expo-font';
import { ActivityIndicator, StatusBar, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// ── Existing screens (unchanged) ─────────────────────────────────────────────
import { GetStartedScreen } from './src/screens/GetStartedScreen';
import { FlightIntakeScreen } from './src/screens/FlightIntakeScreen';
import { FlightOptionsScreen } from './src/screens/FlightOptionsScreen';
import { TripIntakeScreen } from './src/screens/TripIntakeScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { AccountScreen } from './src/screens/AccountScreen';
import { PlanResultScreen } from './src/screens/PlanResultScreen';
import { AdminDashboardScreen } from './src/screens/AdminDashboardScreen';

// ── Existing providers / theme (unchanged) ───────────────────────────────────
import { AppSessionProvider } from './src/context/AppSessionContext';
import { colors, fonts } from './src/theme/colors';
import type { RootStackParamList } from './src/navigation/types';

// ── New: IoT provider and screens ────────────────────────────────────────────
import { IoTProvider } from './src/context/IoTContext';
import { DeviceListScreen } from './src/screens/DeviceListScreen';
import { DeviceRegistrationScreen } from './src/screens/DeviceRegistrationScreen';
import { IoTDashboardScreen } from './src/screens/IoTDashboardScreen';
import { TripMonitorScreen } from './src/screens/TripMonitorScreen';
import { IoTAlertHistoryScreen } from './src/screens/IoTAlertHistoryScreen';

// ── New: Admin IoT fleet management provider and screens ────────────────────
import { AdminSessionProvider } from './src/context/AdminSessionContext';
import { AdminIoTDeviceListScreen } from './src/screens/AdminIoTDeviceListScreen';
import { AdminIoTProvisionScreen } from './src/screens/AdminIoTProvisionScreen';
import { AdminIoTAlertsScreen } from './src/screens/AdminIoTAlertsScreen';
import { AdminIoTRecordsScreen } from './src/screens/AdminIoTRecordsScreen';
import { AdminIoTLocationsScreen } from './src/screens/AdminIoTLocationsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.warning,
  },
};

export default function App() {
  const [fontsLoaded] = useFonts({
    Syne_400Regular,
    Syne_600SemiBold,
    Syne_700Bold,
    Syne_800ExtraBold,
    DMSans_300Light,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.mint} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AppSessionProvider>
        {/* IoTProvider is nested inside AppSessionProvider so it can read the access token */}
        <IoTProvider>
          {/* AdminSessionProvider is independent of the user session — admin auth
              is a separate JWT, not the app's regular login. */}
          <AdminSessionProvider>
            <NavigationContainer theme={navigationTheme}>
              <StatusBar barStyle="light-content" backgroundColor={colors.background} />
              <Stack.Navigator
                initialRouteName="GetStarted"
                screenOptions={{
                  headerStyle: { backgroundColor: colors.background },
                  headerTintColor: colors.primary,
                  headerTitleStyle: { fontFamily: fonts.bodySemibold },
                  headerShadowVisible: false,
                  contentStyle: { backgroundColor: colors.background },
                }}
              >
                {/* ── Existing screens — DO NOT MODIFY ───────────────────────────── */}
                <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
                <Stack.Screen name="Account" component={AccountScreen} options={{ headerShown: false }} />
                <Stack.Screen name="GetStarted" component={GetStartedScreen} options={{ headerShown: false }} />
                <Stack.Screen name="FlightIntake" component={FlightIntakeScreen} options={{ headerShown: false }} />
                <Stack.Screen name="FlightOptions" component={FlightOptionsScreen} options={{ headerShown: false }} />
                <Stack.Screen name="TripIntake" component={TripIntakeScreen} options={{ headerShown: false }} />
                <Stack.Screen name="PlanResult" component={PlanResultScreen} options={{ headerShown: false }} />
                <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ headerShown: false }} />

                {/* ── New: IoT screens ────────────────────────────────────────────── */}
                <Stack.Screen name="IoTDevices" component={DeviceListScreen} options={{ headerShown: false }} />
                <Stack.Screen name="IoTRegisterDevice" component={DeviceRegistrationScreen} options={{ headerShown: false }} />
                <Stack.Screen name="IoTDashboard" component={IoTDashboardScreen} options={{ headerShown: false }} />
                <Stack.Screen name="IoTTripMonitor" component={TripMonitorScreen} options={{ headerShown: false }} />
                <Stack.Screen name="IoTAlertHistory" component={IoTAlertHistoryScreen} options={{ headerShown: false }} />

                {/* ── New: Admin IoT fleet management screens ─────────────────────── */}
                <Stack.Screen name="AdminIoTDevices" component={AdminIoTDeviceListScreen} options={{ headerShown: false }} />
                <Stack.Screen name="AdminIoTProvision" component={AdminIoTProvisionScreen} options={{ headerShown: false }} />
                <Stack.Screen name="AdminIoTAlerts" component={AdminIoTAlertsScreen} options={{ headerShown: false }} />
                <Stack.Screen name="AdminIoTRecords" component={AdminIoTRecordsScreen} options={{ headerShown: false }} />
                <Stack.Screen name="AdminIoTLocations" component={AdminIoTLocationsScreen} options={{ headerShown: false }} />
              </Stack.Navigator>
            </NavigationContainer>
          </AdminSessionProvider>
        </IoTProvider>
      </AppSessionProvider>
    </SafeAreaProvider>
  );
}
