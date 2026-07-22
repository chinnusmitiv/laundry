import * as Location from 'expo-location';

// Falls back to a Singapore coord if location is denied/unavailable — mirrors
// apps/driver/src/App.jsx's getPos() browser-geolocation helper.
const FALLBACK = { lat: 1.2931, lng: 103.852 };

export async function getPos() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return FALLBACK;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return FALLBACK;
  }
}
