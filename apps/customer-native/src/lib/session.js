import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'chaselaundry_customer_session';

export const saveCustomer = (user) => AsyncStorage.setItem(KEY, JSON.stringify(user));
export const loadCustomer = async () => {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : null;
};
export const clearCustomer = () => AsyncStorage.removeItem(KEY);
