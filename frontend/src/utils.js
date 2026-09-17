import { Sun, Moon, ShoppingCart, Clock, CheckCircle, XCircle, PackageCheck } from 'lucide-react';

// ─── Helper: hex ↔ RGB ──────────────────────────────────────────────────────
function hexToHSL(hex) {
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function adjustLightness(hex, lightnessDelta, saturationDelta = 0) {
  const [h, s, l] = hexToHSL(hex);
  return hslToHex(h, Math.max(0, Math.min(100, s + saturationDelta)), Math.max(0, Math.min(100, l + lightnessDelta)));
}

function desaturate(hex, amount) {
  const [h, s, l] = hexToHSL(hex);
  return hslToHex(h, Math.max(0, s - amount), l);
}

// ─── Paleta dinámica ───────────────────────────────────────────────────────
export function generatePalette(primary) {
  const [h, s, l] = hexToHSL(primary);
  return {
    cream: hslToHex(h, Math.min(s, 8), 97),
    creamDeep: hslToHex(h, Math.min(s, 12), 93),
    forest: adjustLightness(primary, -25, 10),
    forestSoft: adjustLightness(primary, -15, 5),
    terra: primary,
    terraSoft: adjustLightness(primary, 12, -5),
    espresso: adjustLightness(primary, -40, -10),
    muted: desaturate(primary, 20),
    free: hslToHex(140, 45, 45),
    soon: hslToHex(38, 60, 55),
    white: '#ffffff',
  };
}

// ─── Paleta por defecto (azul) ──────────────────────────────────────────────
const DEFAULT_PRIMARY = '#0086c9';

function loadPrimaryColor() {
  try {
    return localStorage.getItem('pv_primary_color') || DEFAULT_PRIMARY;
  } catch { return DEFAULT_PRIMARY; }
}

let _currentPrimary = loadPrimaryColor();
let _palette = generatePalette(_currentPrimary);

export function setPrimaryColor(hex) {
  _currentPrimary = hex;
  _palette = generatePalette(hex);
  try { localStorage.setItem('pv_primary_color', hex); } catch {}
  applyPaletteToDOM(_palette);
}

export function getPrimaryColor() { return _currentPrimary; }

export function getCurrentPalette() { return _palette; }

// ─── Tipografía del logo ──────────────────────────────────────────────────
const DEFAULT_LOGO_FONT = 'Fraunces';

const LOGO_FONTS = [
  { name: 'Fraunces', family: '"Fraunces", serif' },
  { name: 'Playfair Display', family: '"Playfair Display", serif' },
  { name: 'DM Serif Display', family: '"DM Serif Display", serif' },
  { name: 'Libre Baskerville', family: '"Libre Baskerville", serif' },
  { name: 'Merriweather', family: '"Merriweather", serif' },
  { name: 'Poppins', family: '"Poppins", sans-serif' },
  { name: 'Montserrat', family: '"Montserrat", sans-serif' },
  { name: 'Raleway', family: '"Raleway", sans-serif' },
  { name: 'Inter', family: '"Inter", sans-serif' },
  { name: 'Bebas Neue', family: '"Bebas Neue", sans-serif' },
];

export { LOGO_FONTS };

function loadLogoFont() {
  try {
    return localStorage.getItem('pv_logo_font') || DEFAULT_LOGO_FONT;
  } catch { return DEFAULT_LOGO_FONT; }
}

let _currentLogoFont = loadLogoFont();

export function setLogoFont(name) {
  _currentLogoFont = name;
  try { localStorage.setItem('pv_logo_font', name); } catch {}
  applyLogoFont(name);
}

export function getLogoFont() { return _currentLogoFont; }

export function getLogoFontFamily() {
  const found = LOGO_FONTS.find(f => f.name === _currentLogoFont);
  return found ? found.family : `"${DEFAULT_LOGO_FONT}", serif`;
}

function applyLogoFont(name) {
  const found = LOGO_FONTS.find(f => f.name === name);
  if (found) {
    document.documentElement.style.setProperty('--logo-font', found.family);
  }
}

applyLogoFont(_currentLogoFont);

// ─── Paleta CSS vars (se actualiza dinámicamente) ───────────────────────────
export function applyPaletteToDOM(palette) {
  const p = palette || _palette;
  const root = document.documentElement;
  root.style.setProperty('--color-cream', p.cream);
  root.style.setProperty('--color-cream-deep', p.creamDeep);
  root.style.setProperty('--color-forest', p.forest);
  root.style.setProperty('--color-forest-soft', p.forestSoft);
  root.style.setProperty('--color-terra', p.terra);
  root.style.setProperty('--color-terra-soft', p.terraSoft);
  root.style.setProperty('--color-espresso', p.espresso);
  root.style.setProperty('--color-muted', p.muted);
  root.style.setProperty('--color-free', p.free);
  root.style.setProperty('--color-soon', p.soon);
}

// Aplicar al cargar el módulo
applyPaletteToDOM(_palette);

// ─── Paleta (live reference via Proxy) ──────────────────────────────────────
export const C = new Proxy({}, {
  get(_, prop) { return _palette[prop]; }
});

// ─── Máquina de estados en vivo ──────────────────────────────────────────────
export const LIVE_STATES = {
  esperando_cliente: { label: 'Esperando', color: '#0086c9', dot: '#004d73' },
  comiendo_entrada: { label: 'Entrada', color: '#4da6d9', dot: '#0086c9' },
  plato_principal: { label: 'Principal', color: '#006699', dot: '#004d73' },
  en_postre_cafe: { label: 'Postre / Café', color: '#d4a04a', dot: '#b08030' },
  sobremesa: { label: 'Sobremesa', color: '#4a9e6b', dot: '#357a50' },
  esperando_cuenta: { label: 'Cuenta', color: '#7b61c9', dot: '#5a40a0' },
  para_limpiar: { label: 'A limpiar', color: '#e09040', dot: '#c07020' },
};

// ─── Estados de pedidos (dinámicos) ─────────────────────────────────────────
function _pedidoEstados() {
  return {
    pendiente:      { label: 'Pendiente',       color: C.soon,     icon: Clock },
    en_preparacion: { label: 'En preparación',  color: C.terraSoft, icon: ShoppingCart },
    listo:          { label: 'Listo',           color: C.free,     icon: CheckCircle },
    entregado:      { label: 'Entregado',       color: C.forest,   icon: PackageCheck },
    cancelado:      { label: 'Cancelado',       color: '#b0b0b0',  icon: XCircle },
  };
}
export const PEDIDO_ESTADOS = new Proxy({}, {
  get(_, prop) { return _pedidoEstados()[prop]; }
});

// ─── Servicios ───────────────────────────────────────────────────────────────
export const SERVICES = {
  mediodia: { name: 'Mediodía', start: '11:30', end: '15:00', defaultDuration: 90, icon: Sun },
  cena: { name: 'Cena', start: '19:30', end: '01:00', defaultDuration: 120, icon: Moon },
};

// Horarios efectivos: defaults + lo configurado en organization.configuration.services
// ({ mediodia: { start, end }, cena: { start, end } }). Sin config → defaults.
export function servicesOf(organization) {
  const custom = organization?.configuration?.services;
  if (!custom || typeof custom !== 'object') return SERVICES;
  const merge = (key) => {
    const base = SERVICES[key];
    const over = custom[key] || {};
    const start = typeof over.start === 'string' && /^\d{2}:\d{2}$/.test(over.start) ? over.start : base.start;
    const end = typeof over.end === 'string' && /^\d{2}:\d{2}$/.test(over.end) ? over.end : base.end;
    return { ...base, start, end };
  };
  return { mediodia: merge('mediodia'), cena: merge('cena') };
}

// ─── Formas de mesas ─────────────────────────────────────────────────────────
export const SHAPE_MAP = { redonda: 'round', rectangular: 'rectangular', cuadrada: 'square', 'cuadrada chica': 'square-sm' };
export const SHAPE_LABELS = { redonda: 'Redonda', rectangular: 'Rectangular', cuadrada: 'Cuadrada', 'cuadrada chica': 'Cuadrada chica' };
export const SHAPE_KEYS = Object.keys(SHAPE_MAP);

export const DEFAULT_CONFIG = [
  { id: 1, capacidad: 4, forma: 'cuadrada', cantidad: 10 },
];

export const getAssignedTables = (s) => {
  if (!s) return [];
  return Array.isArray(s.assignedTables) ? s.assignedTables : [];
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
        shape: SHAPE_MAP[item.forma] || item.shape || item.forma || 'rectangular',
        number: n,
      });
      n++;
    }
  }
  return tables;
};

// ─── Recursos genéricos ──────────────────────────────────────────────────────
// Un recurso de tipo "table" mantiene el id legacy "m{n}" (compat con n8n y
// mesasReservadas). Otros tipos usan "res{n}". Reutiliza buildTables.
export const buildResources = (cfg, opts = {}) => {
  const type = opts.type || 'table';
  const tables = buildTables(cfg);
  return tables.map(t => ({
    id: type === 'table' ? t.id : `res${t.number}`,
    name: type === 'table' ? t.name : `${opts.prefix || 'Recurso'} ${t.number}`,
    capacity: t.capacity,
    shape: t.shape,
    number: t.number,
    type,
  }));
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

export const genSlots = (service, services = SERVICES) => {
  const svc = services[service] || SERVICES[service];
  const start = t2m(svc.start, service);
  const end = t2m(svc.end, service);
  const slots = [];
  for (let m = start; m <= end; m += 15) slots.push(m2t(m));
  return slots;
};

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Formatea una fecha en ISO local (YYYY-MM-DD). A diferencia de
// toISOString().slice(0,10), no se desplaza con el huso horario.
export const toLocalISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const formatDate = (iso) => {
  const d = new Date(iso + 'T12:00:00');
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 480;
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

export const detectTime = (svc, services = SERVICES) => {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const slots = genSlots(svc, services);
  const target = svc === 'cena' && h < 12 ? (h + 24) * 60 + m : h * 60 + m;
  let best = slots[0], bestDiff = Infinity;
  for (const s of slots) {
    const diff = Math.abs(t2m(s, svc) - target);
    if (diff < bestDiff) { best = s; bestDiff = diff; }
  }
  return best;
};

// ─── Horarios y servicios ────────────────────────────────────────────────────
export const timeBelongsToService = (time, svc, services = SERVICES) => {
  const all = services || SERVICES;
  if (!time || !all[svc]) return false;
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return false;
  const [sh, sm] = (all[svc].start || '00:00').split(':').map(Number);
  const [eh, em] = (all[svc].end || '00:00').split(':').map(Number);
  let start = sh * 60 + sm;
  let end = eh * 60 + em;
  if (end < start) end += 24 * 60;
  // El +24h solo aplica a la cena (cruza medianoche). Para el mediodía,
  // "11:30" es válido y NO debe desplazarse al día siguiente.
  const t = h * 60 + m + (svc === 'cena' && h < 12 ? 24 * 60 : 0);
  return t >= start && t <= end;
};

// Determina el servicio al que pertenece una hora (ej: 21:30 → cena)
export const serviceFromTime = (time, fallback, services = SERVICES) => {
  if (!time) return fallback;
  const inLunch = timeBelongsToService(time, 'mediodia', services);
  const inDinner = timeBelongsToService(time, 'cena', services);
  if (inLunch && !inDinner) return 'mediodia';
  if (inDinner && !inLunch) return 'cena';
  return fallback;
};

// Hora sugerida para pedidos/reservas: si la hora actual está dentro de la
// atención se usa tal cual; si no, salta al inicio del próximo turno.
export const defaultServiceTime = (services = SERVICES) => {
  const all = services || SERVICES;
  const d = new Date();
  const now = d.getHours() * 60 + d.getMinutes();
  const mStart = t2m(all.mediodia.start, 'mediodia');
  const mEnd = t2m(all.mediodia.end, 'mediodia');
  const cStart = t2m(all.cena.start, 'cena');
  const cEnd = t2m(all.cena.end, 'cena');
  const inLunch = now >= mStart && now <= mEnd;
  const inDinner = now >= cStart || (now + 24 * 60 >= cStart && now + 24 * 60 <= cEnd);
  if (inLunch || inDinner) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return now < mStart ? all.mediodia.start : all.cena.start;
};

// ─── Utilidad N8N ────────────────────────────────────────────────────────────
const N8N_WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL || '';
const N8N_WEBHOOK_SECRET = import.meta.env.VITE_N8N_WEBHOOK_SECRET || '';
export const notificarN8N = async (datos) => {
  if (!N8N_WEBHOOK_URL) {
    console.warn('[PuntoVectra] VITE_N8N_WEBHOOK_URL no configurada: no se notificará a n8n.', datos);
    return;
  }
  if (!N8N_WEBHOOK_SECRET) {
    console.warn('[PuntoVectra] VITE_N8N_WEBHOOK_SECRET no configurada: el webhook de n8n rechazará el aviso (403) si exige header. Seteala al mismo valor que la credencial "PuntoVectra webhook secret".', datos);
  }
  const headers = { 'Content-Type': 'application/json' };
  if (N8N_WEBHOOK_SECRET) headers['x-andi-secret'] = N8N_WEBHOOK_SECRET;

  // Reintentos con backoff: el notificador de n8n deduplica por document_id
  // (Redis), así que reintentar nunca duplica mensajes al cliente.
  const delays = [0, 2000, 8000];
  let lastErr = null;
  for (const delay of delays) {
    if (delay) await new Promise((r) => setTimeout(r, delay));
    try {
      const res = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(datos),
      });
      if (res.ok) return;
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
  }
  console.error('[PuntoVectra] n8n no alcanzado tras reintentos:', datos, lastErr);
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
  // Estados administrativos de cierre no aportan tiempo real de servicio
  const EXCLUDED = new Set(['finalizado', 'liberada', 'liberado']);
  return result.filter(d => !EXCLUDED.has(d.state) && d.durationMin >= 0 && d.durationMin <= 600);
};

// ─── Analytics helpers ───────────────────────────────────────────────────────
export const todayISOForAnalytics = (analyticsPeriod, currentDate) => {
  const days = analyticsPeriod === 'week' ? 7 : 30;
  const dates = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(currentDate + 'T12:00:00');
    d.setDate(d.getDate() - i);
    dates.push(toLocalISO(d));
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
  '#004d73', '#0086c9', '#4a9e6b', '#006699', '#7b61c9',
  '#d4a04a', '#4da6d9', '#1a2a35', '#0086c9', '#4a9e6b',
  '#004d73', '#d4a04a', '#455a64', '#00897b', '#5c6bc0',
];

// ─── Acceso staff por PIN (modo compatibilidad sin Firebase Auth) ───────────
const STAFF_AUTH_KEY = 'isStaff';

const staffPin = () => import.meta.env.VITE_STAFF_PIN || '';

export function isStaffAuthenticated() {
  return sessionStorage.getItem(STAFF_AUTH_KEY) === btoa('andi:' + staffPin());
}

export function markStaffAuthenticated() {
  sessionStorage.setItem(STAFF_AUTH_KEY, btoa('andi:' + staffPin()));
}

export function logoutStaff() {
  sessionStorage.removeItem(STAFF_AUTH_KEY);
}

export function setFavicon(dataUrl) {
  let link = document.querySelector("link[rel~='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = dataUrl || '/vite.svg';
}
