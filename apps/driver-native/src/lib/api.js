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
export const getJobs = (driverId) => api.get(`/api/drivers/${driverId}/jobs`);
export const getOrder = (orderId) => api.get(`/api/orders/${orderId}`);
export const setOrderStatus = (orderId, status) => api.post(`/api/orders/${orderId}/status`, { status });

// Driver-relevant status transitions only — factory/ops own the in-between steps
// (at_facility → confirmed → processing → ready) via their own consoles.
export const DRIVER_ADVANCE = {
  assigned: 'driver_en_route',
  driver_en_route: 'picked_up',
  out_for_delivery: 'delivered',
};

export const STATUS_LABEL = {
  placed: 'Order placed',
  assigned: 'Assigned to you',
  driver_en_route: 'Heading to pickup',
  picked_up: 'Picked up',
  at_facility: 'At the facility',
  confirmed: 'Confirmed at facility',
  processing: 'Being cleaned',
  ready: 'Ready for delivery',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  completed: 'Completed',
};
