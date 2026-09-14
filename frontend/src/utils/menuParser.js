// menuParser.js — Lee una carta pegada como texto (o .txt/.csv) y la convierte
// en ítems { name, price, category } para importar a la carta del negocio.
//
// Formatos que entiende, uno por línea:
//   BEBIDAS                  → encabezado de categoría (mayúsculas, # Título, "Título:")
//   Coca $1200               → ítem con precio al final
//   Coca - $1.200            → separadores -, :, •, ... antes del precio
//   Coca 1200                → número final sin $ también vale
//   Coca,1200,Bebidas        → CSV  nombre,precio,categoría (o con ;)
//   Pan casero               → ítem sin precio (precio 0)

let seq = 0;
const nextKey = () => `imp_${Date.now()}_${seq++}`;

function stripBullets(line) {
  return line
    .replace(/^(?:[-*•>▪–—]|\d+[.)])\s+/, '')
    .trim();
}

function cleanCategory(line) {
  return line
    .replace(/^#{1,4}\s*/, '')
    .replace(/^\*{1,2}\s*/, '')
    .replace(/\s*\*{1,2}$/, '')
    .replace(/[:：]\s*$/, '')
    .replace(/^[-_=—–\s]{2,}/, '')
    .replace(/[-_=—–\s]{2,}$/, '')
    .trim();
}

// "$1.200" | "1.200,50" | "1200,50" | "12.50" | "1200" → número
export function parsePrice(raw) {
  if (raw == null) return 0;
  let s = String(raw).trim().replace(/[$\s]/g, '');
  if (!s) return 0;
  // coma = decimal argentino → sacar puntos de miles, coma a punto
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes('.')) {
    // solo puntos: si lo que sigue al último punto tiene 3 dígitos → miles
    const parts = s.split('.');
    const last = parts[parts.length - 1];
    if (/^\d{3}$/.test(last) && parts.length > 1) {
      s = parts.join('');
    }
  }
  const n = parseFloat(s);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function tryCsv(line) {
  const sep = line.includes(';') ? ';' : (line.includes(',') ? ',' : null);
  if (!sep) return null;
  const parts = line.split(sep).map(p => p.trim()).filter(p => p !== '');
  if (parts.length < 2 || parts.length > 3) return null;
  // al menos un campo debe parecer precio
  const priceIdx = parts.findIndex(p => /^\$?\s*[\d.,]+\s*\$?$/.test(p) && /\d/.test(p));
  if (priceIdx === -1) return null;
  if (parts.length === 2) {
    // nombre,precio (la categoría la pone el encabezado actual)
    if (priceIdx === 1) return { name: parts[0], price: parsePrice(parts[1]), category: '' };
    return null;
  }
  // 3 campos: nombre,precio,categoría en cualquier orden razonable
  const price = parsePrice(parts[priceIdx]);
  const rest = parts.filter((_, i) => i !== priceIdx);
  // la categoría suele ser la palabra más corta / mayúsculas; si no, el último campo
  let category = '';
  let name = rest.join(' ');
  const catIdx = rest.findIndex(p => p === p.toUpperCase() && p.length <= 30);
  if (catIdx !== -1) {
    category = rest[catIdx];
    name = rest.filter((_, i) => i !== catIdx).join(' ');
  } else if (rest.length === 2) {
    category = rest[1];
    name = rest[0];
  }
  return { name, price, category };
}

function looksLikeCategory(line) {
  if (/^#{1,4}\s+\S/.test(line)) return true;
  if (/[:：]\s*$/.test(line)) return true;
  if (/^\*{1,2}\S.*\S\*{1,2}$/.test(line)) return true;
  if (/^[-_=—–]{3,}/.test(line)) return true;
  if (line.length <= 40 && line === line.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(line)) return true;
  // línea corta sin dígitos y sin precio → probablemente encabezado
  if (line.length <= 32 && !/\d/.test(line) && !/[$]/.test(line)) return true;
  return false;
}

// Precio al final: "Coca $1.200" | "Coca - 1200" | "Milanesa .... 4500" | "Coca 1200$"
const TRAILING_PRICE = /^(.*?)[\s\-–—:·•.*_]*\$?\s*(\d[\d.,]*)\s*\$?\s*$/;

export function parseMenuText(text) {
  const lines = String(text || '').split(/\r?\n/);
  const items = [];
  let currentCategory = '';

  for (let raw of lines) {
    let line = stripBullets(raw.trim());
    if (!line) continue;

    // 1) CSV
    const csv = tryCsv(line);
    if (csv && csv.name) {
      items.push({ key: nextKey(), name: csv.name, price: csv.price, category: csv.category || currentCategory });
      if (csv.category) currentCategory = csv.category;
      continue;
    }

    // 2) Ítem con precio al final — exigir $ en la línea, o número final "limpio"
    //    para no comerse cosas como "Promo 2x1" o "para 2 personas".
    const m = line.match(TRAILING_PRICE);
    if (m) {
      const name = m[1].replace(/[….]{2,}\s*$/, '').replace(/[-–—:·•]\s*$/, '').trim();
      const priceToken = m[2];
      const hasDollar = line.includes('$');
      const cleanNum = priceToken.replace(/[.,]/g, '');
      const plausiblePrice = hasDollar || /^\d{3,}$/.test(cleanNum) || /[.,]\d{2}$/.test(priceToken);
      if (name && plausiblePrice && !/[xX]\s*\d+\s*$/.test(name + priceToken)) {
        const price = parsePrice(priceToken);
        // evitar falsos positivos tipo "Mesa 12" sin $ con número chico
        if (hasDollar || price >= 100) {
          items.push({ key: nextKey(), name, price, category: currentCategory });
          continue;
        }
      }
    }

    // 3) Sin precio: ¿encabezado o plato sin precio?
    if (looksLikeCategory(line)) {
      const cat = cleanCategory(line);
      if (cat) currentCategory = cat;
    } else {
      items.push({ key: nextKey(), name: line, price: 0, category: currentCategory });
    }
  }

  return items;
}
