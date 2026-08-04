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
import { GetStartedScreen } from './src/screens/GetStartedScreen';
import { FlightIntakeScreen } from './src/screens/FlightIntakeScreen';
import { FlightOptionsScreen } from './src/screens/FlightOptionsScreen';
import { TripIntakeScreen } from './src/screens/TripIntakeScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { AccountScreen } from './src/screens/AccountScreen';
import { PlanResultScreen } from './src/screens/PlanResultScreen';
import { colors, fonts } from './src/theme/colors';
import { ActivityIndicator, StatusBar, View } from 'react-native';
import { AppSessionProvider } from './src/context/AppSessionContext';
import type { RootStackParamList } from './src/navigation/types';

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
    <AppSessionProvider>
      <NavigationContainer theme={navigationTheme}>
        <StatusBar barStyle="light-content" backgroundColor={colors.background} />
        <Stack.Navigator
          initialRouteName="GetStarted"
          screenOptions={{
            headerStyle: {
              backgroundColor: colors.background,
            },
            headerTintColor: colors.primary,
            headerTitleStyle: {
              fontFamily: fonts.bodySemibold,
            },
            headerShadowVisible: false,
            contentStyle: {
              backgroundColor: colors.background,
            },
          }}
        >
          <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Account" component={AccountScreen} options={{ headerShown: false }} />
          <Stack.Screen name="GetStarted" component={GetStartedScreen} options={{ headerShown: false }} />
          <Stack.Screen name="FlightIntake" component={FlightIntakeScreen} options={{ headerShown: false }} />
          <Stack.Screen name="FlightOptions" component={FlightOptionsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="TripIntake" component={TripIntakeScreen} options={{ headerShown: false }} />
          <Stack.Screen name="PlanResult" component={PlanResultScreen} options={{ headerShown: false }} />
        </Stack.Navigator>
      </NavigationContainer>
    </AppSessionProvider>
  );
}
