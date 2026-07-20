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

export const DEFAULT_CONFIG = { cap2: 34, cap4: 0, cap5: 5, cap8: 2 };

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

export const buildTables = (cfg) => {
  const tables = [];
  let n = 1;
  const groups = [
    { count: cfg.cap2 || 0, capacity: 2, shape: 'rectangular' },
    { count: cfg.cap4 || 0, capacity: 4, shape: 'rectangular' },
    { count: cfg.cap5 || 0, capacity: 5, shape: 'round' },
    { count: cfg.cap8 || 0, capacity: 8, shape: 'square' },
  ];
  for (const { count, capacity, shape } of groups) {
    for (let i = 0; i < count; i++) {
      tables.push({ id: `m${n}`, name: `M${n}`, capacity, shape });
      n++;
    }
  }
  return tables;
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
