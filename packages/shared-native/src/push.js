import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

// temporary debugging aid: relays a client-side error to the server so it shows up in
// `pm2 logs` — signed release APKs have no attached debugger to see console output otherwise
export function reportError(context, err) {
  fetch(`${API_BASE}/api/debug/log`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ context, message: err?.message || String(err) }),
  }).catch(() => {});
}

// foreground behavior: show an alert + play the default sound while the app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// requests permission and returns a real Expo push token, or null if denied/unavailable
// (never throws — callers just skip saving a token when this comes back null).
export async function registerForPushToken() {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return null;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    return token || null;
  } catch (e) {
    console.error('[push] registerForPushToken failed:', e);
    reportError('push-token:register', e);
    return null;
  }
}
