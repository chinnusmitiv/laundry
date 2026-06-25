// Customer auth session for the web app (mirrors the mobile customer app).
// Uses a full page navigation on login/logout so module-level CUSTOMER_ID
// re-evaluates with the signed-in id.
const KEY = 'cl_customer_auth';

export function getAuth() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } }
export function saveAuth(user) { localStorage.setItem(KEY, JSON.stringify(user)); }
export function clearAuth() { localStorage.removeItem(KEY); }
export const customerId = () => getAuth()?.id || null;

export function logout() { clearAuth(); window.location.assign('/'); }
