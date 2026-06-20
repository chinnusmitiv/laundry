import React, { useEffect, useState, useCallback, useRef } from 'react';
import QRCode from 'qrcode';
import {
  api, fmt, getSocket, useSocket, STATUS_FLOW, STATUS_LABEL,
  Logo, Button, Card, Chip, Avatar, StatusPill, TopBar, Sheet, Empty, OneMap,
} from '@shared';

const DRIVER_ID = 'drv_1'; // demo session: Marcus Reid

// driver actions mapped to the next status they can set
const ACTIONS = {
  assigned: { next: 'driver_en_route', label: 'Start route to customer' },
  driver_en_route: { next: 'picked_up', label: 'Mark picked up' },
  picked_up: { next: 'at_facility', label: 'Dropped at facility' },
  ready: { next: 'out_for_delivery', label: 'Start delivery' },
  out_for_delivery: { next: 'delivered', label: 'Mark delivered' },
};

export default function App() {
  const [driver, setDriver] = useState(null);
  const [shift, setShift] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [openJob, setOpenJob] = useState(null);

  const load = useCallback(async () => {
    const [d, s, j] = await Promise.all([
      api.get(`/api/users/${DRIVER_ID}`),
      api.get(`/api/drivers/${DRIVER_ID}/shift`),
      api.get(`/api/drivers/${DRIVER_ID}/jobs`),
    ]);
    setDriver(d); setShift(s); setJobs(j);
  }, []);
  useEffect(() => { load(); }, [load]);
  useSocket({ 'job:assigned': () => load(), 'order:updated': () => load() }, { userId: DRIVER_ID, role: 'driver' }, []);

  if (!driver) return null;

  return (
    <div className="cl-phone">
      <TopBar
        left={<Logo size={18} theme="dark" />}
        right={<Chip variant="navy">DRIVER</Chip>}
      />
      <div className="cl-scroll" style={{ paddingBottom: 30 }}>
        <ShiftCard driver={driver} shift={shift} onChange={load} />
        {shift ? (
          <div style={{ padding: '0 18px' }}>
            <div className="cl-between" style={{ margin: '8px 0 12px' }}>
              <div className="cl-eyebrow">Today's jobs</div>
              <span className="cl-muted" style={{ fontSize: 12 }}>{jobs.length} assigned</span>
            </div>
            {jobs.length === 0 ? <Empty icon="✅" title="No active jobs" sub="You're all caught up" /> :
              jobs.map((j) => <JobRow key={j.id} job={j} onClick={() => setOpenJob(j.id)} />)}
          </div>
        ) : (
          <div style={{ padding: 18 }}><Empty icon="⏰" title="You're off the clock" sub="Clock in to receive jobs" /></div>
        )}
      </div>
      <JobDetail jobId={openJob} onClose={() => { setOpenJob(null); load(); }} />
    </div>
  );
}

// ── shift / clock in-out with live timer
function ShiftCard({ driver, shift, onChange }) {
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    if (!shift) return;
    const tick = () => {
      const ms = Date.now() - new Date(shift.clock_in).getTime();
      const h = Math.floor(ms / 3600e3), m = Math.floor((ms % 3600e3) / 60e3), s = Math.floor((ms % 60e3) / 1000);
      setElapsed(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, [shift]);

  const clockIn = async () => {
    const pos = await getPos();
    await api.post(`/api/drivers/${DRIVER_ID}/clock-in`, pos);
    onChange();
  };
  const clockOut = async () => { await api.post(`/api/drivers/${DRIVER_ID}/clock-out`); onChange(); };

  return (
    <div style={{ padding: 18 }}>
      <Card style={{ background: shift ? 'linear-gradient(135deg,#162040,#253470)' : '#fff', color: shift ? '#fff' : 'var(--text)' }}>
        <div className="cl-between">
          <div className="cl-row" style={{ gap: 12 }}>
            <Avatar name={driver.name} size={46} color={shift ? 'var(--lime)' : 'var(--navy)'} />
            <div>
              <div style={{ fontWeight: 900, fontSize: 16 }}>{driver.name}</div>
              <div style={{ fontSize: 12, color: shift ? 'var(--lime)' : 'var(--gray)' }}>{shift ? '● On shift' : '○ Off shift'}</div>
            </div>
          </div>
          {shift && <div style={{ textAlign: 'right' }}><div style={{ fontSize: 22, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>{elapsed}</div><div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)' }}>since {fmt.time(shift.clock_in)}</div></div>}
        </div>
        <div style={{ marginTop: 16 }}>
          {shift
            ? <Button variant="ghost" style={{ background: 'rgba(255,255,255,.12)', color: '#fff' }} onClick={clockOut}>Clock out</Button>
            : <Button variant="lime" onClick={clockIn}>Clock in & go online</Button>}
        </div>
      </Card>
    </div>
  );
}

function JobRow({ job, onClick }) {
  const a = ACTIONS[job.status];
  return (
    <Card onClick={onClick} style={{ marginBottom: 10, cursor: 'pointer' }}>
      <div className="cl-between">
        <div>
          <div style={{ fontWeight: 800 }}>{job.code} · {job.customer?.name}</div>
          <div className="cl-muted" style={{ fontSize: 12, marginTop: 2 }}>📍 {job.address?.line1}, {job.address?.postcode}</div>
        </div>
        <StatusPill status={job.status} label={job.status_label} />
      </div>
      {a && <div className="cl-row" style={{ gap: 6, marginTop: 10, color: 'var(--navy)', fontWeight: 700, fontSize: 13 }}><span>→</span>{a.label}</div>}
    </Card>
  );
}

// ── job detail: customer info, map, status actions, location ping, QR review
function JobDetail({ jobId, onClose }) {
  const [job, setJob] = useState(null);
  const [driverLoc, setDriverLoc] = useState(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => { if (jobId) api.get(`/api/orders/${jobId}`).then((o) => { setJob(o); setDriverLoc(o.location); }); }, [jobId]);
  useEffect(() => { setJob(null); reload(); }, [jobId, reload]);

  if (!jobId) return null;
  const a = job && ACTIONS[job.status];

  const advance = async () => {
    setBusy(true);
    // when starting route, push current GPS as a location ping
    if (a.next === 'driver_en_route') {
      const pos = await getPos();
      await api.post(`/api/drivers/${DRIVER_ID}/location`, { ...pos, order_id: jobId });
    }
    await api.post(`/api/orders/${jobId}/status`, { status: a.next });
    setBusy(false); reload();
  };

  const pingLocation = async () => {
    // simulate stepping toward the customer (demo for live tracking)
    const r = await api.post(`/api/demo/orders/${jobId}/simulate-drive`, {});
    setDriverLoc(r.location);
  };

  return (
    <Sheet open={!!jobId} onClose={onClose} title={job ? job.code : 'Loading…'}>
      {!job ? null : <>
        <div className="cl-between" style={{ marginBottom: 14 }}>
          <StatusPill status={job.status} label={job.status_label} />
          <Chip variant={job.payment_status === 'paid' ? 'navy' : 'gray'}>{job.payment_status}</Chip>
        </div>

        {/* customer details */}
        <Card style={{ marginBottom: 14 }}>
          <div className="cl-eyebrow" style={{ marginBottom: 10 }}>Customer</div>
          <div className="cl-row" style={{ gap: 12, marginBottom: 12 }}>
            <Avatar name={job.customer?.name} size={44} />
            <div><div style={{ fontWeight: 800 }}>{job.customer?.name}</div><div className="cl-muted" style={{ fontSize: 13 }}>{job.customer?.phone}</div></div>
          </div>
          <div style={{ background: 'var(--light)', borderRadius: 12, padding: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>📍 {job.address?.label}</div>
            <div className="cl-muted" style={{ fontSize: 13, marginTop: 2 }}>{job.address?.line1}{job.address?.line2 ? `, ${job.address.line2}` : ''}, {job.address?.city} {job.address?.postcode}</div>
          </div>
          <div className="cl-row" style={{ gap: 8, marginTop: 12 }}>
            <Button sm variant="ghost" onClick={() => window.open(`tel:${job.customer?.phone}`)} style={{ flex: 1 }}>📞 Call</Button>
            <Button sm variant="ghost" onClick={() => window.open(`https://maps.google.com/?q=${job.address?.lat},${job.address?.lng}`)} style={{ flex: 1 }}>🧭 Navigate</Button>
          </div>
          {job.notes && <div style={{ marginTop: 12, fontSize: 13, fontStyle: 'italic', color: 'var(--gray)' }}>“{job.notes}”</div>}
        </Card>

        {/* live map + location ping */}
        {['driver_en_route', 'out_for_delivery'].includes(job.status) && job.address && <Card style={{ marginBottom: 14 }}>
          <OneMap driver={driverLoc} dest={job.address} height={170} />
          <Button sm variant="ghost" style={{ marginTop: 10 }} onClick={pingLocation}>📡 Send location update</Button>
        </Card>}

        {/* drop-off warehouse */}
        {job.facility && <Card style={{ marginBottom: 14, background: 'var(--navy)', color: '#fff' }}>
          <div className="cl-eyebrow" style={{ color: 'rgba(255,255,255,.4)', marginBottom: 8 }}>
            {['picked_up', 'at_facility'].includes(job.status) ? 'Drop off at' : 'Processing warehouse'}
          </div>
          <div className="cl-between">
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>🏭 {job.facility.name} <span style={{ color: 'var(--lime)', fontSize: 12 }}>{job.facility.code}</span></div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', marginTop: 2 }}>{job.facility.line1}, {job.facility.postcode}</div>
            </div>
            <Button sm variant="lime" onClick={() => window.open(`https://maps.google.com/?q=${job.facility.lat},${job.facility.lng}`)}>🧭 Navigate</Button>
          </div>
        </Card>}

        {/* order contents */}
        <Card style={{ marginBottom: 14 }}>
          <div className="cl-eyebrow" style={{ marginBottom: 8 }}>Items · {fmt.money(job.total_cents)}</div>
          {job.items.map((i) => <div key={i.id} className="cl-between" style={{ fontSize: 14, padding: '4px 0' }}><span>{i.name}{i.weight_kg ? ` (${i.weight_kg}kg)` : i.qty > 1 ? ` ×${i.qty}` : ''}</span><span className="cl-muted">{fmt.money(i.price_cents)}</span></div>)}
        </Card>

        {/* primary action */}
        {a && <Button variant="lime" style={{ marginBottom: 10 }} disabled={busy} onClick={advance}>{busy ? '…' : a.label}</Button>}

        {/* QR review on delivery */}
        {['delivered', 'completed'].includes(job.status) && <>
          <Button variant="navy" style={{ marginBottom: 10 }} onClick={() => setQrOpen(true)}>★ Request Google review</Button>
          {job.status === 'delivered' && <Button variant="ghost" style={{ marginBottom: 10 }} onClick={async () => { await api.post(`/api/orders/${jobId}/status`, { status: 'completed' }); reload(); }}>Mark complete</Button>}
        </>}

        <Button variant="ghost" onClick={onClose}>Close</Button>
        <ReviewQR open={qrOpen} onClose={() => setQrOpen(false)} orderId={jobId} />
      </>}
    </Sheet>
  );
}

// ── QR code linking to a Google review page
function ReviewQR({ open, onClose, orderId }) {
  const [url, setUrl] = useState('');
  const [dataUrl, setDataUrl] = useState('');
  useEffect(() => {
    if (!open) return;
    api.get(`/api/orders/${orderId}/review-link`).then(async ({ url }) => {
      setUrl(url);
      setDataUrl(await QRCode.toDataURL(url, { margin: 1, width: 260, color: { dark: '#1D2951', light: '#FFFFFF' } }));
    });
  }, [open, orderId]);
  return (
    <Sheet open={open} onClose={onClose} title="Show this to the customer">
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 14, color: 'var(--gray)', marginBottom: 16 }}>Loved the service? Scan to leave us a Google review ⭐</div>
        <div style={{ background: '#fff', borderRadius: 18, padding: 16, display: 'inline-block', boxShadow: 'var(--shadow-sm)' }}>
          {dataUrl ? <img src={dataUrl} width={240} height={240} alt="Google review QR" /> : <div className="cl-skel" style={{ width: 240, height: 240 }} />}
        </div>
        <div className="cl-muted" style={{ fontSize: 11, marginTop: 14, wordBreak: 'break-all', padding: '0 20px' }}>{url}</div>
        <Button variant="lime" style={{ marginTop: 16 }} onClick={onClose}>Done</Button>
      </div>
    </Sheet>
  );
}

// ── geolocation helper (falls back to a Singapore coord if denied)
function getPos() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ lat: 1.2931, lng: 103.8520 });
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve({ lat: 1.2931, lng: 103.8520 }),
      { timeout: 3000 }
    );
  });
}
