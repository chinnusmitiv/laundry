// Minimal fetch client for the customer app — mirrors the pattern in shared/api.js
// (used by the web/customer/driver/ops Vite apps) but written standalone here
// since Metro can't resolve that module's Vite-only `import.meta.env` and DOM bits.
const BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = `${method} ${path} → ${res.status}`;
    try { const b = await res.json(); if (b?.error) msg = b.error; } catch { /* non-JSON error */ }
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  get: (p) => req('GET', p),
  post: (p, b) => req('POST', p, b),
};

export const requestOtp = (identifier) => api.post('/api/auth/request-otp', { identifier });
export const verifyOtp = (identifier, code, name) => api.post('/api/auth/verify-otp', { identifier, code, name });
export const getCatalog = () => api.get('/api/catalog');
export const getSummary = (customerId) => api.get(`/api/customers/${customerId}/summary`);
export const addAddress = (customerId, address) => api.post(`/api/customers/${customerId}/addresses`, address);
export const quoteOrder = (payload) => api.post('/api/orders/quote', payload);
export const placeOrder = (payload) => api.post('/api/orders', payload);
export const getOrders = (customerId) => api.get(`/api/customers/${customerId}/orders`);

export const CATEGORY_LABEL = {
  wash_fold: 'Wash & Fold',
  dry_clean: 'Dry Cleaning',
  ironing: 'Ironing Only',
  bedding: 'Duvets & Bulky Items',
  specialty: 'Specialty Care',
};

export const PICKUP_SLOTS = ['Today · 18:00–20:00', 'Tomorrow · 08:00–10:00', 'Tomorrow · 18:00–20:00', 'Sat · 10:00–12:00'];
