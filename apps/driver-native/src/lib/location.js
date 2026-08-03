import * as Location from 'expo-location';

// Falls back to a Singapore coord if location is denied/unavailable, or if the device
// reports a fix well outside Singapore (emulator with no location mocked, GPS glitch, etc.) —
// mirrors apps/driver/src/App.jsx's getPos() browser-geolocation helper.
const FALLBACK = { lat: 1.2931, lng: 103.852 };
const inSingapore = (lat, lng) => lat > 1.0 && lat < 1.6 && lng > 103.3 && lng < 104.4;

export async function getPos() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return FALLBACK;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const { latitude: lat, longitude: lng } = pos.coords;
    return inSingapore(lat, lng) ? { lat, lng } : FALLBACK;
  } catch {
    return FALLBACK;
  }
}
