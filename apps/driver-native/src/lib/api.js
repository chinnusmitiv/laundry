// Minimal fetch client for the driver app — mirrors the pattern in shared/api.js
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

export const driverLogin = (email, password) => api.post('/api/auth/driver-login', { email, password });
export const getUser = (userId) => api.get(`/api/users/${userId}`);
export const getShift = (driverId) => api.get(`/api/drivers/${driverId}/shift`);
export const clockIn = (driverId, pos) => api.post(`/api/drivers/${driverId}/clock-in`, pos);
export const clockOut = (driverId) => api.post(`/api/drivers/${driverId}/clock-out`);
export const getJobs = (driverId) => api.get(`/api/drivers/${driverId}/jobs`);
export const getOrder = (orderId) => api.get(`/api/orders/${orderId}`);
export const setOrderStatus = (orderId, status) => api.post(`/api/orders/${orderId}/status`, { status });
export const pushLocation = (driverId, pos) => api.post(`/api/drivers/${driverId}/location`, pos);
export const simulateDrive = (orderId) => api.post(`/api/demo/orders/${orderId}/simulate-drive`, {});
export const getReviewLink = (orderId) => api.get(`/api/orders/${orderId}/review-link`);
export const generateTags = (orderId) => api.post(`/api/orders/${orderId}/generate-tags`);
export const advanceByTag = (code) => api.post(`/api/garments/by-tag/${code}/advance`, { actor: 'scan' });

// driver actions mapped to the next status they can set — ported 1:1 from
// apps/driver/src/App.jsx's ACTIONS map so the label copy matches web exactly.
export const ACTIONS = {
  assigned: { next: 'driver_en_route', label: 'Start route to customer' },
  driver_en_route: { next: 'picked_up', label: 'Mark picked up' },
  picked_up: { next: 'at_facility', label: 'Dropped at facility' },
  ready: { next: 'out_for_delivery', label: 'Start delivery' },
  out_for_delivery: { next: 'delivered', label: 'Mark delivered' },
};

export const HANDOVER = {
  hand_to_me: { label: 'Hand to me', icon: '🙋', sub: "I'll pass the laundry to the driver" },
  leave_at_door: { label: 'Leave at my door', icon: '🚪', sub: 'Driver collects it from your door' },
  someone_else: { label: 'Someone else will hand over', icon: '🧑‍🤝‍🧑', sub: 'A friend, family member or concierge' },
};
