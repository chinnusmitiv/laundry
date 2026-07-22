import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider, customerTheme, useSatoshiFonts, useTheme, TopBar, Logo, BottomNav } from '@chaselaundry/shared-native';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import PricesScreen from './src/screens/PricesScreen';
import OrdersScreen from './src/screens/OrdersScreen';
import WalletScreen from './src/screens/WalletScreen';
import AccountScreen from './src/screens/AccountScreen';
import SupportScreen from './src/screens/SupportScreen';
import OrderFlowSheet from './src/screens/OrderFlowSheet';
import OrderDetailSheet from './src/screens/OrderDetailSheet';
import NotificationsSheet from './src/screens/NotificationsSheet';
import { getSummary, getOrders, getNotifications } from './src/lib/api';
import { loadCustomer, clearCustomer } from './src/lib/session';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [customer, setCustomer] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [fontsLoaded] = useSatoshiFonts();

  useEffect(() => { loadCustomer().then((u) => { setCustomer(u); setSessionReady(true); }); }, []);

  useEffect(() => {
    if (sessionReady && fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [sessionReady, fontsLoaded]);

  const onLogout = useCallback(async () => { await clearCustomer(); setCustomer(null); }, []);

  if (!sessionReady || !fontsLoaded) return null;

  return (
    <ThemeProvider theme={customerTheme}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {!customer ? <LoginScreen onLoggedIn={setCustomer} /> : <CustomerApp customer={customer} onLogout={onLogout} />}
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

function CustomerApp({ customer, onLogout }) {
  const t = useTheme();
  const [tab, setTab] = useState('home');
  const [summary, setSummary] = useState(null);
  const [orders, setOrders] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [openOrder, setOpenOrder] = useState(null);
  const [flowOpen, setFlowOpen] = useState(false);
  const [flowSeed, setFlowSeed] = useState(null);
  const [notifOpen, setNotifOpen] = useState(false);

  const openOrderFlow = (seed = null) => { setFlowSeed(seed); setFlowOpen(true); };

  const load = useCallback(async () => {
    const [s, o, n] = await Promise.all([
      getSummary(customer.id),
      getOrders(customer.id),
      getNotifications(customer.id),
    ]);
    setSummary(s); setOrders(o); setNotifs(n);
  }, [customer.id]);

  useEffect(() => { load(); }, [load]);

  const unread = notifs.filter((n) => !n.read).length;

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <TopBar
        left={<Logo size={20} mode="dark" />}
        right={
          <Pressable onPress={() => setNotifOpen(true)} style={{ width: 30, height: 30, alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 22 }}>🔔</Text>
            {unread > 0 && (
              <View style={{ position: 'absolute', top: -2, right: -2, backgroundColor: t.accent, minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
                <Text style={{ color: t.onAccentText, fontSize: 9, fontWeight: '800' }}>{unread}</Text>
              </View>
            )}
          </Pressable>
        }
      />

      <View style={{ flex: 1 }}>
        {tab === 'home' && <HomeScreen customer={customer} summary={summary} orders={orders} onOpenOrder={setOpenOrder} onOrder={() => openOrderFlow()} onTab={setTab} onReload={load} />}
        {tab === 'prices' && <PricesScreen onSchedule={(cart) => openOrderFlow({ cart })} onTab={setTab} />}
        {tab === 'orders' && <OrdersScreen orders={orders} onOpenOrder={setOpenOrder} onOrder={() => openOrderFlow()} />}
        {tab === 'wallet' && <WalletScreen customer={customer} onReload={load} />}
        {tab === 'support' && <SupportScreen customer={customer} />}
        {tab === 'account' && (
          <AccountScreen
            customer={customer} summary={summary} orders={orders}
            onOpenOrder={setOpenOrder} onOrder={() => openOrderFlow()} onReload={load} onTab={setTab}
            onLogout={onLogout} openOrders={summary?.open_orders || 0}
          />
        )}
      </View>

      <BottomNav
        active={tab}
        onChange={(k) => (k === 'book' ? openOrderFlow() : setTab(k))}
        tabs={[
          { key: 'home', label: 'Home', icon: '🏠' },
          { key: 'prices', label: 'Prices', icon: '🏷️' },
          { key: 'book', label: 'Book now', icon: '+', fab: true },
          { key: 'wallet', label: 'Prepaid', icon: '💳' },
          { key: 'account', label: 'More', icon: '☰' },
        ]}
      />

      <OrderFlowSheet
        open={flowOpen} seed={flowSeed} customer={customer} summary={summary}
        onClose={() => setFlowOpen(false)}
        onPlaced={(o) => { setFlowOpen(false); load(); setOpenOrder(o.id); }}
      />
      <OrderDetailSheet orderId={openOrder} onClose={() => { setOpenOrder(null); load(); }} />
      <NotificationsSheet open={notifOpen} onClose={() => { setNotifOpen(false); load(); }} notifs={notifs} customer={customer} />
    </View>
  );
}
