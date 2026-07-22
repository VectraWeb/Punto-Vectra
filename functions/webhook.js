// webhook.js — Andi WhatsApp Bot
// Controlador Node.js para Firebase Functions o Supabase Edge Functions
// Recibe mensajes de la API oficial de WhatsApp (Meta Cloud API)
// y crea reservas directamente en Firestore.
//
// Deploy como Firebase Function:
//   firebase deploy --only functions
//
// Deploy como Supabase Edge Function:
//   supabase functions deploy andi-whatsapp

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// ── Firebase Admin SDK (solo inicializar una vez) ──────────────────────────
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// ── Variables de entorno ────────────────────────────────────────────────────
// Configurar en Firebase Functions config o en .env para Supabase:
//   firebase functions:config:set whatsapp.token="TU_TOKEN" whatsapp.verify_token="TU_VERIFY_TOKEN"
const WHATSAPP_TOKEN        = process.env.WHATSAPP_TOKEN        || functions.config().whatsapp?.token;
const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || functions.config().whatsapp?.verify_token;
const WHATSAPP_PHONE_ID     = process.env.WHATSAPP_PHONE_ID     || functions.config().whatsapp?.phone_id;

// ── Constantes de negocio ───────────────────────────────────────────────────
const SERVICES = {
  mediodia: { start: '11:30', end: '15:00', defaultDuration: 90 },
  cena:     { start: '19:30', end: '01:00', defaultDuration: 120 },
};

const t2m = (time, service) => {
  const [h, m] = time.split(':').map(Number);
  if (service === 'cena' && h < 12) return (h + 24) * 60 + m;
  return h * 60 + m;
};

// Sesiones de conversación en memoria (para producción: usar Firestore o Redis)
// key: phoneNumber → { step, name, partySize, date, time, service }
const sessions = new Map();

// ═══════════════════════════════════════════════════════════════════════════════
// ENDPOINT GET — Verificación del Webhook por Meta
// ═══════════════════════════════════════════════════════════════════════════════
export const whatsappWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method === 'GET') {
    const mode      = req.query['hub.mode'];
    const token     = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
      console.log('[Andi] Webhook verificado ✓');
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ENDPOINT POST — Recepción de mensajes
  // ═══════════════════════════════════════════════════════════════════════════
  if (req.method === 'POST') {
    try {
      const body = req.body;

      // Validar estructura del payload de Meta
      if (body.object !== 'whatsapp_business_account') {
        return res.sendStatus(400);
      }

      const entry   = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value   = changes?.value;
      const message = value?.messages?.[0];

      // Ignorar status updates (delivered, read, etc.)
      if (!message) return res.sendStatus(200);

      const from    = message.from;           // Número del cliente
      const msgBody = message.text?.body?.trim() || '';
      const msgId   = message.id;

      console.log(`[Andi] Mensaje de ${from}: "${msgBody}"`);

      // Procesar flujo conversacional
      const reply = await handleConversation(from, msgBody);

      // Enviar respuesta vía WhatsApp Cloud API
      await sendWhatsAppMessage(from, reply);

      return res.sendStatus(200);
    } catch (err) {
      console.error('[Andi] Error en webhook:', err);
      return res.sendStatus(500);
    }
  }

  return res.sendStatus(405);
});

// ═══════════════════════════════════════════════════════════════════════════════
// Máquina de estados conversacional
// ═══════════════════════════════════════════════════════════════════════════════
async function handleConversation(phone, message) {
  let session = sessions.get(phone) || { step: 'welcome' };
  const msg = message.toLowerCase().trim();

  // Reset si el usuario escribe "hola", "reservar" o "empezar"
  if (['hola', 'reservar', 'empezar', 'nueva reserva', 'inicio'].includes(msg)) {
    session = { step: 'ask_name' };
    sessions.set(phone, session);
    return '¡Hola! 👋 Soy el asistente de reservas de *Andi*.\n\n¿A qué nombre hago la reserva?';
  }

  switch (session.step) {

    // ── 1. Nombre ────────────────────────────────────────────────────────────
    case 'ask_name': {
      if (msg.length < 2) return '¿Podés decirme tu nombre? 😊';
      session.name = toTitleCase(message);
      session.step = 'ask_party';
      sessions.set(phone, session);
      return `Perfecto, *${session.name}*! ¿Para cuántas personas es la reserva?`;
    }

    // ── 2. Cantidad de comensales ─────────────────────────────────────────────
    case 'ask_party': {
      const n = parseInt(msg);
      if (isNaN(n) || n < 1 || n > 20) return 'Por favor indicá un número entre 1 y 20 personas.';
      session.partySize = n;
      session.step      = 'ask_date';
      sessions.set(phone, session);
      return `¡${n} personas! ¿Para qué fecha?\nPodés escribir *hoy*, *mañana* o una fecha como *15/06*.`;
    }

    // ── 3. Fecha ───────────────────────────────────────────────────────────────
    case 'ask_date': {
      const date = parseDate(msg);
      if (!date) return 'No entendí la fecha. Probá con *hoy*, *mañana* o *15/06*.';
      session.date = date;
      session.step = 'ask_time';
      sessions.set(phone, session);
      return `¿A qué hora? El mediodía es de *11:30 a 15:00* y la cena de *19:30 a 01:00*.`;
    }

    // ── 4. Hora ────────────────────────────────────────────────────────────────
    case 'ask_time': {
      const time = parseTime(msg);
      if (!time) return 'No entendí el horario. Escribí algo como *20:00* o *20hs*.';
      const service = detectServiceFromTime(time);
      if (!service) return 'Ese horario está fuera de nuestros turnos. Mediodía: 11:30–15:00, Cena: 19:30–01:00.';
      session.time    = time;
      session.service = service;
      session.step    = 'confirm';
      sessions.set(phone, session);
      return [
        `¡Perfecto! Confirmamos:`,
        `👤 *${session.name}*`,
        `👥 *${session.partySize} personas*`,
        `📅 *${formatDate(session.date)}*`,
        `🕐 *${session.time}* (${SERVICES[service].defaultDuration}min)`,
        ``,
        `¿Confirmás la reserva? Respondé *sí* o *no*.`,
      ].join('\n');
    }

    // ── 5. Confirmación ───────────────────────────────────────────────────────
    case 'confirm': {
      if (['no', 'cancelar', 'cancel'].includes(msg)) {
        sessions.delete(phone);
        return 'Reserva cancelada. Si querés intentarlo de nuevo, escribí *hola*.';
      }
      if (!['si', 'sí', 'yes', 'confirmar', 'ok', 'dale'].includes(msg)) {
        return 'Respondé *sí* para confirmar o *no* para cancelar.';
      }

      // Buscar mesa disponible en Firestore
      const result = await findAndBookTable(session, phone);

      sessions.delete(phone);

      if (result.success) {
        return [
          `✅ *¡Reserva confirmada!*`,
          ``,
          `📍 Mesa: *${result.tableName}*`,
          `👤 ${session.name} · ${session.partySize} personas`,
          `📅 ${formatDate(session.date)} a las ${session.time}`,
          ``,
          `Te esperamos en *Andi*. ¡Hasta pronto! 🍽️`,
        ].join('\n');
      } else {
        return [
          `😔 Lamentablemente *no hay mesas disponibles* para ${session.partySize} personas a las ${session.time} el ${formatDate(session.date)}.`,
          ``,
          `Podés intentar con otro horario. Escribí *hola* para empezar de nuevo.`,
        ].join('\n');
      }
    }

    // ── Default: redirigir ───────────────────────────────────────────────────
    default:
      sessions.set(phone, { step: 'ask_name' });
      return '¡Hola! Para hacer una reserva en *Andi*, escribí *hola* para comenzar.';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// findAndBookTable — Buscar disponibilidad e insertar en Firestore
// ═══════════════════════════════════════════════════════════════════════════════
async function findAndBookTable({ date, time, service, partySize, name }, phone) {
  try {
    // 1. Cargar configuración de mesas
    const cfgSnap = await db.doc('config/restaurant').get();
    const cfg     = cfgSnap.exists ? cfgSnap.data() : { cap2: 2, cap4: 2, cap5: 2, cap8: 2 };
    const tables  = buildTables(cfg);

    // 2. Cargar reservas del día (flat structure: reservations/{id})
    const resSnap = await db.collection('reservations').where('date', '==', date).get();
    let reservations = resSnap.docs.map(d => d.data());
    // Filtrar estados inactivos (cancelado, no_show, ausente)
    const estadosInactivos = ['cancelado', 'no_show', 'ausente'];
    reservations = reservations.filter(r => !estadosInactivos.includes(r.estado));

    // 3. Calcular duración y ventana de tiempo
    const duration = SERVICES[service].defaultDuration;
    const newStart = t2m(time, service);
    const newEnd   = newStart + duration;

    // 4. Encontrar mesas con capacidad suficiente que no tengan conflicto
    const candidateTables = tables
      .filter(t => t.capacity >= partySize)
      .sort((a, b) => a.capacity - b.capacity); // preferir la más pequeña que alcance

    const available = candidateTables.find(table => {
      const conflict = reservations.some(r => {
        if (r.tableId !== table.id || r.service !== service) return false;
        const rStart = t2m(r.time, r.service);
        const rEnd   = rStart + r.duration;
        return newStart < rEnd && newEnd > rStart;
      });
      return !conflict;
    });

    if (!available) return { success: false };

    // 5. Insertar reserva en Firestore (flat structure: reservations/{id})
    const id = `r${Date.now()}`;
    await db.collection('reservations').doc(id).set({
      id,
      customerName: name,
      phone,
      partySize,
      tableId:  available.id,
      mesa_id:  available.id,
      time,
      duration,
      service,
      date,
      estado:   'confirmada',
      source:   'whatsapp_bot',
      notes:    'Reservado vía WhatsApp Bot',
      liveState: null,
      startedAt: null,
      leftAt:   null,
      staffId:  null,
      staffName: null,
      customerPhone: phone,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`[Andi] Reserva creada: ${name} → ${available.name} ${date} ${time}`);
    return { success: true, tableName: available.name };

  } catch (err) {
    console.error('[Andi] Error en findAndBookTable:', err);
    return { success: false };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// sendWhatsAppMessage — Envío via Cloud API de Meta
// ═══════════════════════════════════════════════════════════════════════════════
async function sendWhatsAppMessage(to, text) {
  const url  = `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_ID}/messages`;
  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text },
  };

  const response = await fetch(url, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('[Andi] Error enviando WhatsApp:', err);
    throw new Error(`WhatsApp API error: ${response.status}`);
  }

  return response.json();
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════
function buildTables(cfg) {
  const tables = [];
  let n = 1;
  const SHAPE_MAP = { redonda: 'round', rectangular: 'rectangular', cuadrada: 'square' };
  const items = Array.isArray(cfg) ? cfg : (cfg && cfg.mesaTipos ? cfg.mesaTipos : [
    { capacidad: 2, forma: 'rectangular', cantidad: cfg.cap2 || 0 },
    { capacidad: 4, forma: 'rectangular', cantidad: cfg.cap4 || 0 },
    { capacidad: 5, forma: 'redonda', cantidad: cfg.cap5 || 0 },
    { capacidad: 8, forma: 'cuadrada', cantidad: cfg.cap8 || 0 },
  ]);
  for (const item of items) {
    const cap = item.capacidad || item.capacity || 0;
    const count = item.cantidad || 1;
    const shape = SHAPE_MAP[item.forma] || item.shape || 'rectangular';
    for (let i = 0; i < count; i++) {
      tables.push({ id: `m${n}`, name: `M${n}`, capacity: cap, shape });
      n++;
    }
  }
  return tables;
}

function detectServiceFromTime(time) {
  const [h, m] = time.split(':').map(Number);
  const mins = h * 60 + m;
  const mStart = t2m('11:30', 'mediodia');
  const mEnd   = t2m('15:00', 'mediodia');
  if (mins >= mStart && mins <= mEnd) return 'mediodia';
  const cStart = t2m('19:30', 'cena');
  // cena llega hasta 01:00 del día siguiente
  if (mins >= cStart || h < 2) return 'cena';
  return null;
}

function parseTime(text) {
  const clean = text.replace(/\s/g, '').replace(/hs?$/i, '');
  const match = clean.match(/^(\d{1,2})[:h]?(\d{0,2})$/);
  if (!match) return null;
  const h = parseInt(match[1]);
  const m = parseInt(match[2] || '0');
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function parseDate(text) {
  const msg = text.toLowerCase().trim();
  const today = new Date();
  if (msg === 'hoy') return today.toISOString().slice(0, 10);
  if (msg === 'mañana' || msg === 'manana') {
    const t = new Date(today); t.setDate(t.getDate() + 1);
    return t.toISOString().slice(0, 10);
  }
  // formato dd/mm o dd/mm/yy o dd/mm/yyyy
  const match = msg.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/);
  if (match) {
    const day   = parseInt(match[1]);
    const month = parseInt(match[2]) - 1;
    const year  = match[3] ? (match[3].length === 2 ? 2000 + parseInt(match[3]) : parseInt(match[3])) : today.getFullYear();
    const d = new Date(year, month, day);
    if (isNaN(d)) return null;
    return d.toISOString().slice(0, 10);
  }
  return null;
}

function formatDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function toTitleCase(str) {
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}
