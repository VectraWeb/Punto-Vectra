import { Sun, Moon } from 'lucide-react';

// ─── Paleta ──────────────────────────────────────────────────────────────────
export const C = {
  cream: '#f5efe6',
  creamDeep: '#ebe3d5',
  forest: '#7a3a1e',
  forestSoft: '#9B4B2A',
  terra: '#c4602f',
  terraSoft: '#e09368',
  espresso: '#2a1f1a',
  muted: '#8b7d6b',
  free: '#6f8d4d',
  soon: '#d4a04a',
  white: '#fffdf8',
};

// ─── Máquina de estados en vivo ──────────────────────────────────────────────
export const LIVE_STATES = {
  esperando_cliente: { label: 'Esperando', color: '#4a90d9', dot: '#2171c7' },
  comiendo_entrada: { label: 'Entrada', color: '#c4602f', dot: '#a04020' },
  plato_principal: { label: 'Principal', color: '#7b1f2e', dot: '#5c1520' },
  en_postre_cafe: { label: 'Postre / Café', color: '#c49a35', dot: '#a07820' },
  sobremesa: { label: 'Sobremesa', color: '#6b8e7b', dot: '#4d6b5a' },
  esperando_cuenta: { label: 'Cuenta', color: '#9b59b6', dot: '#7d3f9c' },
  para_limpiar: { label: 'A limpiar', color: '#e67e22', dot: '#c05e0a' },
};

// ─── Servicios ───────────────────────────────────────────────────────────────
export const SERVICES = {
  mediodia: { name: 'Mediodía', start: '11:30', end: '15:00', defaultDuration: 90, icon: Sun },
  cena: { name: 'Cena', start: '19:30', end: '01:00', defaultDuration: 120, icon: Moon },
};

// ─── Formas de mesas ─────────────────────────────────────────────────────────
export const SHAPE_MAP = { redonda: 'round', rectangular: 'rectangular', cuadrada: 'square' };
export const SHAPE_LABELS = { redonda: 'Redonda', rectangular: 'Rectangular', cuadrada: 'Cuadrada' };
export const SHAPE_KEYS = Object.keys(SHAPE_MAP);

export const DEFAULT_CONFIG = [
  { id: 1, capacidad: 2, forma: 'cuadrada', cantidad: 12 },
  { id: 2, capacidad: 4, forma: 'rectangular', cantidad: 12 },
  { id: 3, capacidad: 5, forma: 'redonda', cantidad: 5 },
  { id: 4, capacidad: 8, forma: 'cuadrada', cantidad: 2 },
];

export const DEFAULT_ASSIGNMENTS = {
  leo: [60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 160, 161, 162, 163, 164],
  mica: [51, 52, 53, 54, 55, 56, 57, 58, 59, 150, 151, 152, 153, 154],
  mauro: [40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 140, 141, 142, 143, 144],
  rosanna: [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 120, 121, 122, 123, 124],
  jota: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
  miguel: [30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 130, 131, 132, 133, 134],
};

export const getAssignedTables = (s) => {
  if (!s) return [];
  const fromDb = Array.isArray(s.assignedTables) ? s.assignedTables : [];
  if (fromDb.length > 0) return fromDb;
  const nums = DEFAULT_ASSIGNMENTS[(s.name || '').toLowerCase().trim()];
  return nums ? nums.map(n => `m${n}`) : [];
};

// ─── Geometría de sectores ───────────────────────────────────────────────────
// Dos rectángulos se consideran superpuestos si se tocan o cruzan
export const rectsOverlap = (a, b) =>
  a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;

export const configToArray = (cfg) => {
  if (Array.isArray(cfg)) return cfg;
  if (cfg && typeof cfg === 'object' && cfg.cantidad === undefined) {
    const groups = [
      { capacidad: 2, forma: 'cuadrada', cantidad: cfg.cap2 || 0 },
      { capacidad: 4, forma: 'rectangular', cantidad: cfg.cap4 || 0 },
      { capacidad: 5, forma: 'redonda', cantidad: cfg.cap5 || 0 },
      { capacidad: 8, forma: 'cuadrada', cantidad: cfg.cap8 || 0 },
    ];
    return groups.filter(g => g.cantidad > 0).map((g, i) => ({ ...g, id: i + 1 }));
  }
  return cfg || [];
};

export const buildTables = (cfg) => {
  const items = Array.isArray(cfg)
    ? cfg
    : (cfg && typeof cfg.mesaTipos !== 'undefined' ? cfg.mesaTipos : configToArray(cfg));
  const tables = [];
  let n = 1;
  for (const item of items) {
    const cap = item.capacidad || item.capacity || 0;
    const count = item.cantidad ?? 1;
    for (let i = 0; i < count; i++) {
      tables.push({
        id: `m${n}`,
        name: `M${n}`,
        capacity: cap,
        shape: cap === 2 ? 'square' : (SHAPE_MAP[item.forma] || item.shape || item.forma || 'rectangular'),
        number: n,
      });
      n++;
    }
  }
  return tables;
};

// ─── Utilidades de tiempo ────────────────────────────────────────────────────
export const t2m = (time, service) => {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  if (service === 'cena' && h < 12) return (h + 24) * 60 + m;
  return h * 60 + m;
};

export const m2t = (mins) => {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const genSlots = (service) => {
  const start = t2m(SERVICES[service].start, service);
  const end = t2m(SERVICES[service].end, service);
  const slots = [];
  for (let m = start; m <= end; m += 15) slots.push(m2t(m));
  return slots;
};

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const formatDate = (iso) => {
  const d = new Date(iso + 'T12:00:00');
  const isMobile = window.innerWidth <= 480;
  if (isMobile) {
    const day = d.getDate();
    const month = d.toLocaleDateString('es-AR', { month: 'short' });
    const weekday = d.toLocaleDateString('es-AR', { weekday: 'short' });
    return `${weekday} ${day} ${month}`;
  }
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
};

export const detectService = () => {
  const h = new Date().getHours();
  return (h >= 11 && h < 17) ? 'mediodia' : 'cena';
};

export const detectTime = (svc) => {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const slots = genSlots(svc);
  const target = svc === 'cena' && h < 12 ? (h + 24) * 60 + m : h * 60 + m;
  let best = slots[0], bestDiff = Infinity;
  for (const s of slots) {
    const diff = Math.abs(t2m(s, svc) - target);
    if (diff < bestDiff) { best = s; bestDiff = diff; }
  }
  return best;
};

// ─── Horarios y servicios ────────────────────────────────────────────────────
export const timeBelongsToService = (time, svc) => {
  if (!time || !SERVICES[svc]) return false;
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return false;
  const [sh, sm] = (SERVICES[svc].start || '00:00').split(':').map(Number);
  const [eh, em] = (SERVICES[svc].end || '00:00').split(':').map(Number);
  let start = sh * 60 + sm;
  let end = eh * 60 + em;
  if (end < start) end += 24 * 60;
  const t = h * 60 + m + (h < 12 ? 24 * 60 : 0);
  return t >= start && t <= end;
};

// Determina el servicio al que pertenece una hora (ej: 21:30 → cena)
export const serviceFromTime = (time, fallback) => {
  if (!time) return fallback;
  const inLunch = timeBelongsToService(time, 'mediodia');
  const inDinner = timeBelongsToService(time, 'cena');
  if (inLunch && !inDinner) return 'mediodia';
  if (inDinner && !inLunch) return 'cena';
  return fallback;
};

// ─── Utilidad N8N ────────────────────────────────────────────────────────────
const N8N_WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL || '';
export const notificarN8N = (datos) => {
  if (!N8N_WEBHOOK_URL) return;
  fetch(N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  }).catch(err => console.error('[Andi] Error silencioso al notificar a n8n:', err));
};

// ─── Calcula duración (min) de cada estado desde stateLog ─────────────────
export const computeStateDurations = (stateLog) => {
  if (!stateLog || stateLog.length < 2) return [];
  const toMs = (v) => {
    if (!v) return 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') return new Date(v).getTime() || 0;
    if (v.seconds != null) return v.seconds * 1000 + (v.nanoseconds || 0) / 1e6;
    if (v.toDate) return v.toDate().getTime();
    if (v.getTime) return v.getTime();
    return 0;
  };
  const sorted = [...stateLog].sort((a, b) => toMs(a.at) - toMs(b.at));
  const result = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const dur = Math.round((toMs(sorted[i + 1].at) - toMs(sorted[i].at)) / 60000);
    result.push({ state: sorted[i].state, durationMin: dur });
  }
  return result.filter(d => d.durationMin >= 0 && d.durationMin <= 600);
};

// ─── Analytics helpers ───────────────────────────────────────────────────────
export const todayISOForAnalytics = (analyticsPeriod, currentDate) => {
  const days = analyticsPeriod === 'week' ? 7 : 30;
  const dates = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(currentDate + 'T12:00:00');
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
};

// --- Utilitarios compartidos de UI / auth (fuera de componentes para fast-refresh) ---
export const inp = {
  width: '100%', padding: '12px 14px', fontSize: '16px',
  background: C.white, border: '1.5px solid ' + C.creamDeep,
  borderRadius: '12px', color: C.espresso, outline: 'none',
};

export const SECTOR_COLORS = [
  '#7a3a1e', '#c4602f', '#6f8d4d', '#4a90d9', '#9b59b6',
  '#d4a04a', '#e67e22', '#2a1f1a', '#e09368', '#6b8e7b',
  '#7b1f2e', '#c49a35', '#455a64', '#00897b', '#5c6bc0',
];

const STAFF_AUTH_KEY = 'isStaff';

export function isStaffAuthenticated() {
  return localStorage.getItem(STAFF_AUTH_KEY) === 'true';
}

export function logoutStaff() {
  localStorage.removeItem(STAFF_AUTH_KEY);
}
