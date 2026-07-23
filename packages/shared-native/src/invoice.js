import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const money = (c) => `S$${((c || 0) / 100).toFixed(2)}`;

function invoiceHtml(order) {
  const o = order || {};
  const c = o.customer || {};
  const invNo = o.invoice_no || o.code || '—';
  const date = o.created_at ? new Date(o.created_at).toLocaleDateString() : '';
  const terms = o.payment_terms || c.payment_terms;
  const paid = o.payment_status === 'paid';

  const bill = [];
  if (c.contact_person) bill.push(`Attn: ${c.contact_person}`);
  if (c.address) bill.push(c.address);
  else if (o.address) bill.push(`${o.address.line1 || ''}${o.address.postcode ? ', ' + o.address.postcode : ''}`);
  if (c.phone) bill.push(c.phone);
  if (c.email) bill.push(c.email);
  if (c.gst_no) bill.push(`GST: ${c.gst_no}`);

  const rows = (o.items || []).map((it) => {
    const qty = it.weight_kg ? `${it.weight_kg} kg` : `${it.qty || 1}`;
    const unit = it.unit_cents != null ? money(it.unit_cents) : '';
    return `<tr><td>${it.name}</td><td style="text-align:right">${qty}</td><td style="text-align:right">${unit}</td><td style="text-align:right">${money(it.price_cents)}</td></tr>`;
  }).join('');

  const totalRows = [
    o.subtotal_cents != null && ['Subtotal', money(o.subtotal_cents)],
    o.platform_fee_cents && ['Service fee', money(o.platform_fee_cents)],
    o.delivery_fee_cents && ['Delivery', money(o.delivery_fee_cents)],
    o.discount_cents > 0 && ['Discount', '- ' + money(o.discount_cents)],
    o.credit_applied_cents > 0 && ['Wallet credit', '- ' + money(o.credit_applied_cents)],
    o.tip_cents > 0 && ['Driver tip', money(o.tip_cents)],
    o.tax_cents > 0 && ['GST (9%)', money(o.tax_cents)],
  ].filter(Boolean).map(([l, v]) => `<div class="row"><span>${l}</span><span>${v}</span></div>`).join('');

  return `<!doctype html><html><head><meta charset="utf-8" />
    <style>
      body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 32px; color: #1D2951; }
      .top { display: flex; justify-content: space-between; align-items: flex-start; }
      .brand { font-size: 22px; font-weight: 800; }
      .brand .lime { color: #A8D400; }
      .muted { color: #6B7280; font-size: 12px; }
      .right { text-align: right; }
      hr { border: none; border-top: 3px solid #A8D400; margin: 16px 0; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th { background: #1D2951; color: #fff; text-align: left; padding: 8px; font-size: 12px; }
      td { padding: 8px; border-bottom: 1px solid #eee; font-size: 13px; }
      .totals { max-width: 260px; margin-left: auto; margin-top: 16px; }
      .row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 13px; color: #6B7280; }
      .row.total { font-weight: 800; color: #1D2951; font-size: 15px; border-top: 1px solid #1D2951; padding-top: 8px; margin-top: 6px; }
      .status { font-weight: 800; text-transform: uppercase; color: ${paid ? '#16A34A' : '#B45309'}; }
      .footer { margin-top: 40px; text-align: center; color: #6B7280; font-size: 11px; }
      .billto { font-weight: 800; font-size: 14px; margin-bottom: 4px; }
    </style></head>
    <body>
      <div class="top">
        <div>
          <div class="brand">Chase<span class="lime">Laundry</span></div>
          <div class="muted">More Life. Less Laundry.</div>
          <div class="muted">1 Kim Seng Promenade, Singapore 237994</div>
          <div class="muted">GST Reg 202312345A · hello@chaselaundry.com</div>
        </div>
        <div class="right">
          <div style="font-size:18px; font-weight:800;">INVOICE</div>
          <div class="muted">No. ${invNo}</div>
          <div class="muted">Date ${date}</div>
          ${terms ? `<div class="muted">Terms ${terms}</div>` : ''}
        </div>
      </div>
      <hr />
      <div class="top">
        <div>
          <div class="muted">BILL TO</div>
          <div class="billto">${c.name || ''}</div>
          ${bill.map((l) => `<div class="muted">${l}</div>`).join('')}
        </div>
        <div class="status">${(o.payment_status || '').toUpperCase()}</div>
      </div>
      <table>
        <thead><tr><th>Description</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit</th><th style="text-align:right">Amount</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="totals">
        ${totalRows}
        <div class="row total"><span>Total</span><span>${money(o.total_cents)}</span></div>
      </div>
      ${o.notes ? `<div class="muted" style="margin-top:24px;">Notes: ${o.notes}</div>` : ''}
      <div class="footer">Thank you for choosing ChaseLaundry · chaselaundry.com</div>
    </body></html>`;
}

export async function downloadInvoice(order) {
  const { uri } = await Print.printToFileAsync({ html: invoiceHtml(order) });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Invoice ${order?.code || ''}` });
  }
  return uri;
}
