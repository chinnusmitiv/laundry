import { useFonts } from 'expo-font';

// Real Satoshi TTF weights (sourced from Fontshare, its actual publisher) bundled under
// assets/fonts — matches the family loaded on web via shared/brand/theme.css.
export function useSatoshiFonts() {
  return useFonts({
    'Satoshi-Regular': require('../assets/fonts/Satoshi-Regular.ttf'),
    'Satoshi-Medium': require('../assets/fonts/Satoshi-Medium.ttf'),
    'Satoshi-Bold': require('../assets/fonts/Satoshi-Bold.ttf'),
    'Satoshi-Black': require('../assets/fonts/Satoshi-Black.ttf'),
  });
}
