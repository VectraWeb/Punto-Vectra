// cartaFetcher.js — Obtiene la carta actualizada desde el sitio (WordPress API).
// Si el sitio no responde o el formato cambia, devuelve null (la UI usa el fallback local).

const CARTA_API = 'https://andirestaurante.com.ar/wp-json/wp/v2/pages?slug=nuestra-carta&_fields=content';

const ICON_BY_TAB = {
  'bebidas': 'CupSoda',
  'tapeo': 'UtensilsCrossed',
  'sandw': 'Sandwich',
  'hambur': 'Croissant',
  'pastas': 'UtensilsCrossed',
  'salsas': 'Droplets',
  'carnes': 'Drumstick',
  'pesca': 'Fish',
  'ensaladas': 'Salad',
  'postres': 'IceCreamBowl',
};

const TITLE_MAP = {
  'bebidas': 'Bebidas',
  'tapeo': 'Tapeo',
  'sandwhambur': 'Sándwiches y Hamburguesas',
  'nuestraspastas': 'Nuestras pastas',
  'salsas': 'Salsas',
  'carnes': 'Carnes',
  'pesca': 'Pesca',
  'ensaladas': 'Ensaladas',
  'postres': 'Postres',
};

const fmtTitle = (raw) => {
  let clean = String(raw || '')
    .replace(/[·•]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  const collapsed = clean.replace(/ /g, '');
  if (TITLE_MAP[collapsed]) return TITLE_MAP[collapsed];
  return clean
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

const normPrecio = (raw) => {
  const digits = String(raw || '').replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : null;
};

const parseItem = (li) => {
  const titulo = li.querySelector('.titulo')?.textContent?.trim() || '';
  if (!titulo) return null;
  const precio = normPrecio(li.querySelector('.precio')?.textContent);
  const desc = li.querySelector('.descripcion')?.textContent?.trim() || '';
  return { name: titulo, ...(precio != null ? { price: precio } : {}), ...(desc ? { desc } : {}) };
};

const parseGrupo = (modulo) => {
  const groups = [];
  let current = null;
  for (const el of modulo.children) {
    if (el.tagName === 'H3' && el.classList.contains('carta-subtitulo')) {
      current = { title: el.textContent.trim(), items: [] };
      groups.push(current);
    } else if (el.tagName === 'UL') {
      const items = [...el.querySelectorAll('li.carta-item')].map(parseItem).filter(Boolean);
      if (!current) {
        current = { title: '', items: [] };
        groups.push(current);
      }
      current.items.push(...items);
    } else if (el.tagName === 'H3') {
      const label = el.textContent.trim();
      if (label && label.toUpperCase() !== label && label.length > 3 && label.length < 50) {
        current = { title: label, items: [] };
        groups.push(current);
      }
    }
  }
  return groups.filter(g => g.items.length > 0);
};

const parseSugeridos = (doc) => {
  const ul = doc.querySelector('.modulo-sugeridos-hoy ul');
  if (!ul) return [];
  return [...ul.querySelectorAll('li')].map(li => {
    const text = li.textContent.trim();
    const m = text.match(/^(.*?)\s*[–-]+\s*\$?\s*([\d.,]+)\s*$/);
    if (!m) return null;
    return { name: m[1].trim(), price: normPrecio(m[2]) };
  }).filter(Boolean);
};

export async function fetchCarta() {
  try {
    const res = await fetch(CARTA_API, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json();
    const html = data?.[0]?.content?.rendered;
    if (!html || html.length < 500) return null;

    const doc = new DOMParser().parseFromString(html, 'text/html');

    const sugerencias = parseSugeridos(doc);
    if (!sugerencias.length) return null;

    const secciones = [];
    for (const section of doc.querySelectorAll('.w-tabs-section')) {
      const titleEl = section.querySelector('.w-tabs-section-title');
      if (!titleEl) continue;
      const title = fmtTitle(titleEl.textContent);
      const modulos = section.querySelectorAll('.modulo-carta');
      const groups = [];
      for (const modulo of modulos) {
        groups.push(...parseGrupo(modulo));
      }
      if (!groups.length) continue;
      const key = title.toLowerCase();
      const icon = Object.entries(ICON_BY_TAB)
        .find(([k]) => key.includes(k))?.[1] || 'UtensilsCrossed';
      secciones.push({ title, icon, groups });
    }

    if (!secciones.length) return null;

    return { CARTA: secciones, SUGERENCIAS: sugerencias };
  } catch {
    return null;
  }
}
