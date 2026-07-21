import React, { useEffect, useState, useCallback } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LoginScreen from './src/screens/LoginScreen';
import JobsScreen from './src/screens/JobsScreen';
import JobDetailScreen from './src/screens/JobDetailScreen';
import { loadDriver, clearDriver } from './src/lib/session';
import { colors } from './src/theme';

const Stack = createNativeStackNavigator();

export default function App() {
  const [driver, setDriver] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => { loadDriver().then((d) => { setDriver(d); setReady(true); }); }, []);

  const onLogout = useCallback(async () => { await clearDriver(); setDriver(null); }, []);

  if (!ready) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.navy }}><ActivityIndicator color="#fff" /></View>;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!driver ? (
            <Stack.Screen name="Login">
              {() => <LoginScreen onLoggedIn={setDriver} />}
            </Stack.Screen>
          ) : (
            <>
              <Stack.Screen name="Jobs">
                {(props) => <JobsScreen {...props} driver={driver} onLogout={onLogout} />}
              </Stack.Screen>
              <Stack.Screen name="JobDetail" component={JobDetailScreen} options={{ headerShown: true, title: 'Job details' }} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
