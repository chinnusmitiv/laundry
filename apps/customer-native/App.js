import React, { useEffect, useState, useCallback } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LoginScreen from './src/screens/LoginScreen';
import CatalogScreen from './src/screens/CatalogScreen';
import ReviewScreen from './src/screens/ReviewScreen';
import ConfirmationScreen from './src/screens/ConfirmationScreen';
import OrdersScreen from './src/screens/OrdersScreen';
import { loadCustomer, clearCustomer } from './src/lib/session';
import { colors } from './src/theme';

const Stack = createNativeStackNavigator();

export default function App() {
  const [customer, setCustomer] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => { loadCustomer().then((u) => { setCustomer(u); setReady(true); }); }, []);

  const onLogout = useCallback(async () => { await clearCustomer(); setCustomer(null); }, []);

  if (!ready) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.navy }}><ActivityIndicator color="#fff" /></View>;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!customer ? (
            <Stack.Screen name="Login">
              {() => <LoginScreen onLoggedIn={setCustomer} />}
            </Stack.Screen>
          ) : (
            <>
              <Stack.Screen name="Catalog">
                {(props) => <CatalogScreen {...props} customer={customer} onLogout={onLogout} />}
              </Stack.Screen>
              <Stack.Screen name="Review" options={{ headerShown: true, title: 'Review order' }}>
                {(props) => <ReviewScreen {...props} customer={customer} />}
              </Stack.Screen>
              <Stack.Screen name="Confirmation" component={ConfirmationScreen} />
              <Stack.Screen name="Orders" options={{ headerShown: true, title: 'My orders' }}>
                {(props) => <OrdersScreen {...props} customer={customer} />}
              </Stack.Screen>
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
