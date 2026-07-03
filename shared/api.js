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
  if (!res.ok) {
    // surface the server's { error } message when present
    let msg = `${method} ${path} → ${res.status}`;
    try { const body = await res.json(); if (body?.error) msg = body.error; } catch { /* non-JSON error */ }
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

// generate & download a proper PDF invoice (jsPDF). Works for consumer orders
// and B2B invoices (full bill-to: contact, address, GST, terms).
export async function printInvoice(order) {
  const o = order || {};
  const m = (c) => `S$${((c || 0) / 100).toFixed(2)}`;
  const navy = [29, 41, 81], lime = [168, 212, 0], gray = [107, 114, 128];
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  let y = 50;

  // ── header ──
  doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor(...navy);
  doc.text('Chase', 48, y);
  const cw = doc.getTextWidth('Chase');
  doc.setTextColor(...lime); doc.text('Laundry', 48 + cw, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...gray);
  doc.text('More Life. Less Laundry.', 48, y + 15);
  doc.text('1 Kim Seng Promenade, Singapore 237994', 48, y + 28);
  doc.text('GST Reg 202312345A  ·  hello@chaselaundry.com', 48, y + 39);

  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...navy);
  doc.text('INVOICE', W - 48, y, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...gray);
  const invNo = o.invoice_no || o.code || '—';
  doc.text(`No.  ${invNo}`, W - 48, y + 17, { align: 'right' });
  doc.text(`Date  ${o.created_at ? new Date(o.created_at).toLocaleDateString() : ''}`, W - 48, y + 31, { align: 'right' });
  const terms = o.payment_terms || o.customer?.payment_terms;
  if (terms) doc.text(`Terms  ${terms}`, W - 48, y + 45, { align: 'right' });

  y += 60;
  doc.setDrawColor(...lime); doc.setLineWidth(2.5); doc.line(48, y, W - 48, y);

  // ── bill to ──
  y += 26;
  const c = o.customer || {};
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...gray);
  doc.text('BILL TO', 48, y);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...navy);
  doc.text(c.name || '', 48, y + 16);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...gray);
  const bill = [];
  if (c.contact_person) bill.push(`Attn: ${c.contact_person}`);
  if (c.address) bill.push(c.address);
  else if (o.address) bill.push(`${o.address.line1 || ''}${o.address.postcode ? ', ' + o.address.postcode : ''}`);
  if (c.phone) bill.push(c.phone);
  if (c.email) bill.push(c.email);
  if (c.gst_no) bill.push(`GST: ${c.gst_no}`);
  bill.forEach((l, i) => doc.text(String(l), 48, y + 32 + i * 13));

  doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  const paid = o.payment_status === 'paid';
  doc.setTextColor(...(paid ? [22, 163, 74] : [180, 83, 9]));
  doc.text((o.payment_status || '').toUpperCase(), W - 48, y + 16, { align: 'right' });

  // ── line items ──
  const body = (o.items || []).map((it) => {
    const qty = it.weight_kg ? `${it.weight_kg} kg` : `${it.qty || 1}`;
    return [it.name, qty, it.unit_cents != null ? m(it.unit_cents) : '', m(it.price_cents)];
  });
  autoTable(doc, {
    startY: y + 32 + bill.length * 13 + 14,
    head: [['Description', 'Qty', 'Unit', 'Amount']],
    body,
    theme: 'striped',
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: navy, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    margin: { left: 48, right: 48 },
  });

  // ── totals ──
  let ty = doc.lastAutoTable.finalY + 18;
  const right = W - 48, lx = right - 200;
  const row = (label, val, bold) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(bold ? 13 : 10);
    doc.setTextColor(...(bold ? navy : gray));
    doc.text(label, lx, ty); doc.text(val, right, ty, { align: 'right' });
    ty += bold ? 22 : 16;
  };
  if (o.subtotal_cents != null) row('Subtotal', m(o.subtotal_cents));
  if (o.platform_fee_cents) row('Service fee', m(o.platform_fee_cents));
  if (o.delivery_fee_cents) row('Delivery', m(o.delivery_fee_cents));
  if (o.discount_cents > 0) row('Discount', '- ' + m(o.discount_cents));
  if (o.credit_applied_cents > 0) row('Wallet credit', '- ' + m(o.credit_applied_cents));
  if (o.tax_cents > 0) row('GST (9%)', m(o.tax_cents));
  doc.setDrawColor(...navy); doc.setLineWidth(1); doc.line(lx, ty - 7, right, ty - 7);
  row('Total', m(o.total_cents), true);

  // ── footer ──
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...gray);
  if (o.notes) doc.text(`Notes: ${o.notes}`, 48, H - 74);
  doc.text('Thank you for choosing ChaseLaundry  ·  chaselaundry.com', W / 2, H - 50, { align: 'center' });

  doc.save(`Invoice-${invNo}.pdf`);
}

// ── CSV import/export helpers ──
export function downloadCsv(filename, headers, rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map((r) => r.map(esc).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// parse CSV text → array of objects keyed by header row (handles quotes/commas)
export function parseCsv(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim().length);
  if (!lines.length) return [];
  const parseLine = (line) => {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === ',') { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur); return out;
  };
  const headers = parseLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((l) => {
    const cells = parseLine(l); const o = {};
    headers.forEach((h, i) => { o[h] = (cells[i] ?? '').trim(); });
    return o;
  });
}

// order status flow shared with backend
export const STATUS_FLOW = ['placed', 'assigned', 'driver_en_route', 'picked_up', 'at_facility', 'processing', 'ready', 'out_for_delivery', 'delivered', 'completed'];
export const STATUS_LABEL = {
  placed: 'Order placed', assigned: 'Driver assigned', driver_en_route: 'Driver on the way',
  picked_up: 'Picked up', at_facility: 'At facility', processing: 'Cleaning in progress',
  ready: 'Ready', out_for_delivery: 'Out for delivery', delivered: 'Delivered',
  completed: 'Completed', cancelled: 'Cancelled',
};
// support ticket categories (shared across customer / web)
export const TICKET_CATEGORIES = [
  { key: 'order', label: 'Order issue', icon: '📦' },
  { key: 'billing', label: 'Billing & payments', icon: '💳' },
  { key: 'delivery', label: 'Pickup / delivery', icon: '🚚' },
  { key: 'account', label: 'Account', icon: '👤' },
  { key: 'other', label: 'Something else', icon: '💬' },
];

// saved address types (shared across customer / web)
export const ADDRESS_TYPES = {
  home: { label: 'Home', icon: '🏠' },
  work: { label: 'Work', icon: '🏢' },
  other: { label: 'Other', icon: '📍' },
};

// pickup handover preferences (shared across customer / web / driver)
export const HANDOVER = {
  hand_to_me: { label: 'Hand to me', icon: '🙋', sub: "I'll pass the laundry to the driver" },
  leave_at_door: { label: 'Leave at my door', icon: '🚪', sub: 'Driver collects it from your door' },
  someone_else: { label: 'Someone else will hand over', icon: '🧑‍🤝‍🧑', sub: 'A friend, family member or concierge' },
};

export const GARMENT_FLOW = ['checked_in', 'washing', 'drying', 'ironing', 'qc', 'packed', 'returned'];

// repeat-order cadence options (shared across customer / web)
export const REPEAT_CADENCE = {
  weekly: { label: 'Every week', days: 7 },
  biweekly: { label: 'Every 2 weeks', days: 14 },
  monthly: { label: 'Every month', days: 30 },
};

// given an order's created_at + its repeat preference, when is the next one due?
export function nextRepeatDue(order) {
  if (!order?.repeat_requested || !order?.repeat_cadence) return null;
  const days = REPEAT_CADENCE[order.repeat_cadence]?.days || 7;
  return new Date(new Date(order.created_at).getTime() + days * 864e5);
}
export const GARMENT_LABEL = {
  checked_in: 'Checked in', washing: 'Washing', drying: 'Drying', ironing: 'Ironing',
  qc: 'Quality check', packed: 'Packed', returned: 'Returned',
};
