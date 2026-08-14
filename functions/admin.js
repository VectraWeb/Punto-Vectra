// admin.js — Gestión de cuentas staff de Andi
// Crea usuarios de Firebase Auth con el custom claim `staff: true` que exigen
// las reglas de Firestore (firestore.rules → isStaff()).
//
// Deploy:
//   firebase deploy --only functions:createStaff,functions:setStaffRole
//
// Seguridad: cada endpoint requiere el header `x-admin-secret` igual a la
// variable ANDI_ADMIN_SECRET (o functions config andi.admin_secret).
// Sin ese secreto, los endpoints responden 401.
//
// Uso (via OpenClaw / curl):
//   curl -X POST https://<region>-<project>.cloudfunctions.net/createStaff \
//     -H "Content-Type: application/json" \
//     -H "x-admin-secret: TU_SECRETO" \
//     -d '{"email":"mozo@andi.com","password":"contraseña-fuerte","name":"Mozo 1"}'
//
//   curl -X POST https://<region>-<project>.cloudfunctions.net/setStaffRole \
//     -H "Content-Type: application/json" \
//     -H "x-admin-secret: TU_SECRETO" \
//     -d '{"uid":"abc123...","staff":true}'

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const ADMIN_SECRET = process.env.ANDI_ADMIN_SECRET || functions.config().andi?.admin_secret;

const NAME_MAX = 60;
const PASSWORD_MIN = 8;

function isAuthorized(req) {
  if (!ADMIN_SECRET) {
    console.error('[Andi] ANDI_ADMIN_SECRET no configurado: se rechaza el request.');
    return false;
  }
  const provided = req.headers['x-admin-secret'] || req.query.secret;
  if (typeof provided !== 'string') return false;
  return provided === ADMIN_SECRET;
}

function parseBody(req) {
  try {
    return req.body && typeof req.body === 'object' ? req.body : {};
  } catch {
    return {};
  }
}

// ── POST /createStaff { email, password, name } ─────────────────────────────
// Crea el usuario, le otorga el claim staff y lo registra en la colección staff/.
export const createStaff = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') return res.sendStatus(405);
  if (!isAuthorized(req)) return res.sendStatus(401);

  const { email, password, name } = parseBody(req);
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'email, password y name son requeridos.' });
  }
  if (password.length < PASSWORD_MIN) {
    return res.status(400).json({ error: `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.` });
  }
  if (name.trim().length < 2 || name.trim().length > NAME_MAX) {
    return res.status(400).json({ error: 'name debe tener entre 2 y 60 caracteres.' });
  }

  try {
    const user = await admin.auth().createUser({
      email,
      password,
      displayName: name.trim(),
    });
    await admin.auth().setCustomUserClaims(user.uid, { staff: true });

    const staffId = `s${user.uid.slice(0, 8)}`;
    await db.doc(`staff/${staffId}`).set({
      name: name.trim(),
      active: true,
      assignedTables: [],
      uid: user.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`[Andi] Cuenta staff creada: ${email} (${staffId})`);
    return res.status(201).json({ ok: true, uid: user.uid, staffId });
  } catch (err) {
    console.error('[Andi] Error creando cuenta staff:', err);
    return res.status(400).json({ error: err.message || 'No se pudo crear la cuenta.' });
  }
});

// ── POST /setStaffRole { uid, staff } ───────────────────────────────────────
// Otorga o revoca el claim staff de un usuario existente.
export const setStaffRole = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') return res.sendStatus(405);
  if (!isAuthorized(req)) return res.sendStatus(401);

  const { uid, staff } = parseBody(req);
  if (!uid || typeof staff !== 'boolean') {
    return res.status(400).json({ error: 'uid y staff (boolean) son requeridos.' });
  }

  try {
    await admin.auth().setCustomUserClaims(uid, { staff });
    console.log(`[Andi] Claim staff=${staff} aplicado a ${uid}`);
    return res.status(200).json({ ok: true, uid, staff });
  } catch (err) {
    console.error('[Andi] Error actualizando claim:', err);
    return res.status(400).json({ error: err.message || 'No se pudo actualizar el claim.' });
  }
});