import React, { useEffect, useState, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider, navyLimeTheme, useSatoshiFonts } from '@chaselaundry/shared-native';
import LoginScreen from './src/screens/LoginScreen';
import JobsScreen from './src/screens/JobsScreen';
import { loadDriver, clearDriver } from './src/lib/session';

SplashScreen.preventAutoHideAsync().catch(() => {});

const Stack = createNativeStackNavigator();
const navTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: navyLimeTheme.bg } };

export default function App() {
  const [driver, setDriver] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [fontsLoaded] = useSatoshiFonts();

  useEffect(() => { loadDriver().then((d) => { setDriver(d); setSessionReady(true); }); }, []);

  useEffect(() => {
    if (sessionReady && fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [sessionReady, fontsLoaded]);

  const onLogout = useCallback(async () => { await clearDriver(); setDriver(null); }, []);

  if (!sessionReady || !fontsLoaded) return null;

  return (
    <ThemeProvider theme={navyLimeTheme}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <NavigationContainer theme={navTheme}>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            {!driver ? (
              <Stack.Screen name="Login">
                {() => <LoginScreen onLoggedIn={setDriver} />}
              </Stack.Screen>
            ) : (
              <Stack.Screen name="Jobs">
                {() => <JobsScreen driver={driver} onLogout={onLogout} />}
              </Stack.Screen>
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
