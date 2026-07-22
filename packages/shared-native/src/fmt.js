// Ported 1:1 from shared/api.js's `fmt` helper so money/time/date formatting matches web exactly.
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
