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

// auth
export const requestOtp = (identifier) => api.post('/api/auth/request-otp', { identifier });
export const verifyOtp = (identifier, code, name) => api.post('/api/auth/verify-otp', { identifier, code, name });

// catalog / plans
export const getCatalog = () => api.get('/api/catalog');
export const getPlans = () => api.get('/api/plans');
export const placesSearch = (q) => api.get(`/api/places/search?q=${encodeURIComponent(q)}`);

// customer summary / profile / addresses
export const getSummary = (customerId) => api.get(`/api/customers/${customerId}/summary`);
export const updateProfile = (customerId, patch) => api.post(`/api/customers/${customerId}/profile`, patch);
export const addAddress = (customerId, address) => api.post(`/api/customers/${customerId}/addresses`, address);
export const updateAddress = (customerId, addrId, patch) => api.post(`/api/customers/${customerId}/addresses/${addrId}`, patch);
export const setDefaultAddress = (customerId, addrId) => api.post(`/api/customers/${customerId}/addresses/${addrId}/default`);

// orders
export const getOrders = (customerId) => api.get(`/api/customers/${customerId}/orders`);
export const getOrder = (orderId) => api.get(`/api/orders/${orderId}`);
export const quoteOrder = (payload) => api.post('/api/orders/quote', payload);
export const placeOrder = (payload) => api.post('/api/orders', payload);
export const payOrder = (orderId, paymentIntentId) => api.post(`/api/orders/${orderId}/pay`, { payment_intent_id: paymentIntentId });
export const submitReview = (orderId, payload) => api.post(`/api/orders/${orderId}/review`, payload);
export const confirmPayment = (payload) => api.post('/api/payments/confirm', payload);
export const createPaymentIntent = (amountCents, description) => api.post('/api/payments/create-intent', { amount_cents: amountCents, description });

// wallet / packs / referrals / subscriptions
export const getCredits = (customerId) => api.get(`/api/customers/${customerId}/credits`);
export const topup = (customerId, amountCents, paymentIntentId) => api.post(`/api/customers/${customerId}/topup`, { amount_cents: amountCents, payment_intent_id: paymentIntentId });
export const getPacks = (customerId) => api.get(`/api/customers/${customerId}/packs`);
export const buyPack = (customerId, catalogId, qty, paymentIntentId) => api.post(`/api/customers/${customerId}/packs`, { catalog_id: catalogId, qty, payment_intent_id: paymentIntentId });
export const getReferrals = (customerId) => api.get(`/api/customers/${customerId}/referrals`);
export const inviteReferral = (customerId, email) => api.post(`/api/customers/${customerId}/referrals`, { email });
export const activateSubscription = (customerId, planId, paymentIntentId) => api.post(`/api/customers/${customerId}/subscription`, { plan_id: planId, payment_intent_id: paymentIntentId });
export const cancelSubscription = (customerId) => api.post(`/api/customers/${customerId}/subscription/cancel`);

// notifications
export const getNotifications = (customerId) => api.get(`/api/customers/${customerId}/notifications`);
export const markAllNotificationsRead = (customerId) => api.post(`/api/customers/${customerId}/notifications/read-all`);

// support
export const getThreads = (customerId) => api.get(`/api/customers/${customerId}/threads`);
export const createThread = (customerId, payload) => api.post(`/api/customers/${customerId}/threads`, payload);
export const getThread = (threadId) => api.get(`/api/threads/${threadId}`);
export const sendThreadMessage = (threadId, payload) => api.post(`/api/threads/${threadId}/messages`, payload);

// demo / live tracking
export const spawnTracking = (customerId) => api.post(`/api/demo/customers/${customerId}/spawn-tracking`);
export const simulateDrive = (orderId) => api.post(`/api/demo/orders/${orderId}/simulate-drive`, {});
