import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'chaselaundry_driver_session';

export const saveDriver = (driver) => AsyncStorage.setItem(KEY, JSON.stringify(driver));
export const loadDriver = async () => {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : null;
};
export const clearDriver = () => AsyncStorage.removeItem(KEY);
