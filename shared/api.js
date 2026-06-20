// API + realtime client shared by all three apps.
// Each app sets VITE_API_URL (defaults to localhost:4000 via dev proxy).
import { io } from 'socket.io-client';

const BASE = import.meta.env?.VITE_API_URL || 'http://localhost:4000';

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
  return res.status === 204 ? null : res.json();
}

export const api = {
  get: (p) => req('GET', p),
  post: (p, b) => req('POST', p, b),
};

let socket;
export function getSocket() {
  if (!socket) socket = io(BASE, { transports: ['websocket', 'polling'] });
  return socket;
}

export const fmt = {
  money: (cents) => `S$${((cents || 0) / 100).toFixed(2)}`,
  time: (iso) => (iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''),
  date: (iso) => (iso ? new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' }) : ''),
  ago: (iso) => {
    if (!iso) return '';
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  },
};

// order status flow shared with backend
export const STATUS_FLOW = ['placed', 'assigned', 'driver_en_route', 'picked_up', 'at_facility', 'processing', 'ready', 'out_for_delivery', 'delivered', 'completed'];
export const STATUS_LABEL = {
  placed: 'Order placed', assigned: 'Driver assigned', driver_en_route: 'Driver on the way',
  picked_up: 'Picked up', at_facility: 'At facility', processing: 'Cleaning in progress',
  ready: 'Ready', out_for_delivery: 'Out for delivery', delivered: 'Delivered',
  completed: 'Completed', cancelled: 'Cancelled',
};
export const GARMENT_FLOW = ['checked_in', 'washing', 'drying', 'ironing', 'qc', 'packed', 'returned'];
export const GARMENT_LABEL = {
  checked_in: 'Checked in', washing: 'Washing', drying: 'Drying', ironing: 'Ironing',
  qc: 'Quality check', packed: 'Packed', returned: 'Returned',
};
