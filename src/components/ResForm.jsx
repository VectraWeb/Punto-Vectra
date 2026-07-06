// ResForm.jsx — Formulario de reserva independiente para clientes
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Sun, Moon, Check, AlertCircle } from 'lucide-react';
import {
  collection, doc, onSnapshot, setDoc, serverTimestamp,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../firebase';

// ─── Paleta (misma que App.jsx) ─────────────────────────────────────────────
const C = {
  cream: '#f5efe6',
  creamDeep: '#ebe3d5',
  forest: '#7a3a1e',
  forestSoft: '#9B4B2A',
  terra: '#c4602f',
  terraSoft: '#e09368',
  espresso: '#2a1f1a',
  muted: '#8b7d6b',
  free: '#6f8d4d',
  white: '#fffdf8',
};

// ─── Servicios ───────────────────────────────────────────────────────────────
const SERVICES = {
  mediodia: { name: 'Mediodía', start: '11:30', end: '15:00', defaultDuration: 90, icon: Sun },
  cena: { name: 'Cena', start: '19:30', end: '01:00', defaultDuration: 120, icon: Moon },
};

const DEFAULT_CONFIG = { cap2: 2, cap4: 2, cap5: 2, cap8: 2 };

// ─── Utilidades de tiempo ────────────────────────────────────────────────────
const t2m = (time, service) => {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  if (service === 'cena' && h < 12) return (h + 24) * 60 + m;
  return h * 60 + m;
};

const m2t = (mins) => {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const genSlots = (service) => {
  const start = t2m(SERVICES[service].start, service);
  const end = t2m(SERVICES[service].end, service);
  const slots = [];
  for (let m = start; m <= end; m += 15) slots.push(m2t(m));
  return slots;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const detectService = () => {
  const h = new Date().getHours();
  return (h >= 11 && h < 17) ? 'mediodia' : 'cena';
};

const detectTime = (svc) => {
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

const buildTables = (cfg) => {
  const tables = [];
  let n = 1;
  const groups = [
    { count: cfg.cap2 || 0, capacity: 2 },
    { count: cfg.cap4 || 0, capacity: 4 },
    { count: cfg.cap5 || 0, capacity: 5 },
    { count: cfg.cap8 || 0, capacity: 8 },
  ];
  for (const { count, capacity } of groups) {
    for (let i = 0; i < count; i++) {
      tables.push({ id: `m${n}`, name: `M${n}`, capacity });
      n++;
    }
  }
  return tables;
};

// ─── Firestore helpers ───────────────────────────────────────────────────────
const resCol = (date) => collection(db, 'reservations', date, 'items');
const resDocRef = (date, id) => doc(db, 'reservations', date, 'items', id);
const guardRef = (date, tableId, service, time) =>
  doc(db, 'reservations', date, 'guards', `${tableId}_${service}_${time.replace(':', '.')}`);
const cfgRef = () => doc(db, 'config', 'restaurant');

// ─── Estilos ─────────────────────────────────────────────────────────────────
const inp = {
  width: '100%', padding: '12px 14px', fontSize: '16px',
  background: C.white, border: `1.5px solid ${C.creamDeep}`,
  borderRadius: '12px', color: C.espresso, outline: 'none',
  fontFamily: 'inherit',
};

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: C.muted, fontWeight: 600, marginBottom: '6px' }}>{label}</label>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ResForm — Formulario de reserva para clientes
// ═══════════════════════════════════════════════════════════════════════════════
export default function ResForm({ onStaffAccess }) {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [service, setService] = useState(detectService);
  const [date, setDate] = useState(todayISO());
  const [reservations, setReservations] = useState([]);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ── Triple clic en logo → acceso staff ──────────────────────────────────
  const clickCount = useRef(0);
  const clickTimer = useRef(null);
  const handleLogoClicks = useCallback(() => {
    clickCount.current += 1;
    if (clickCount.current >= 3) {
      clickCount.current = 0;
      if (clickTimer.current) clearTimeout(clickTimer.current);
      if (onStaffAccess) onStaffAccess();
      return;
    }
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => { clickCount.current = 0; }, 1500);
  }, [onStaffAccess]);

  const tables = useMemo(() => buildTables(config), [config]);
  const slots = useMemo(() => genSlots(service), [service]);

  const [form, setForm] = useState({
    customerName: '',
    phone: '',
    partySize: 2,
    tableId: '',
    time: detectTime(detectService()),
    notes: '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ── Suscripción a config ─────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(cfgRef(), (snap) => {
      if (snap.exists()) setConfig(snap.data());
    });
    return unsub;
  }, []);

  // ── Suscripción a reservas del día ───────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(resCol(date), (snap) => {
      setReservations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [date]);

  // ── Corregir time si cambia de servicio ──────────────────────────────────
  useEffect(() => {
    if (!slots.includes(form.time)) {
      set('time', slots[Math.floor(slots.length / 2)] || slots[0]);
    }
  }, [service]);

  // ── Mesas disponibles (solo por capacidad, sin validar estado) ──────────
  const availableTables = useMemo(() => {
    return tables.filter(t => t.capacity >= form.partySize);
  }, [tables, form.partySize]);

  // ── Validación ───────────────────────────────────────────────────────────
  const valid = form.customerName.trim().length >= 2
    && form.tableId
    && form.time
    && form.partySize > 0
    && !submitting;

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!valid) return;
    setSubmitting(true);
    setError('');

    const id = `r${Date.now()}`;
    const guardPath = guardRef(date, form.tableId, service, form.time);

    try {
      await runTransaction(db, async (transaction) => {
        const guardSnap = await transaction.get(guardPath);
        if (guardSnap.exists()) {
          throw new Error('Esa mesa ya está reservada para ese horario. Elegí otra mesa u horario.');
        }

        transaction.set(guardPath, { reservationId: id, createdAt: serverTimestamp() });
        transaction.set(resDocRef(date, id), {
          id,
          customerName: form.customerName.trim(),
          phone: form.phone,
          partySize: form.partySize,
          tableId: form.tableId,
          time: form.time,
          duration: SERVICES[service].defaultDuration,
          service,
          notes: form.notes,
          liveState: null,
          date,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        });
      });

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setForm({
          customerName: '',
          phone: '',
          partySize: 2,
          tableId: '',
          time: slots[Math.floor(slots.length / 2)] || slots[0],
          notes: '',
        });
      }, 3000);
    } catch (e) {
      setError(e.message || 'Error al crear la reserva. Intentá de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Si ya fue creada exitosamente ────────────────────────────────────────
  if (success) {
    return (
      <div style={{ padding: '60px 24px', textAlign: 'center' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: C.free, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <Check size={32} color="#fff" />
        </div>
        <h2 style={{ fontFamily: '"Fraunces", serif', fontSize: '24px', fontStyle: 'italic', fontWeight: 600, color: C.forest, margin: '0 0 8px' }}>
          Reserva confirmada
        </h2>
        <p style={{ fontSize: '14px', color: C.muted, margin: 0 }}>
          Te esperamos en <strong>Andi</strong>
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 0 40px' }}>
      {/* Header branding */}
      <div style={{ padding: '32px 24px 24px', textAlign: 'center' }}>
        <h1 onClick={handleLogoClicks} style={{ fontFamily: '"Fraunces", serif', fontSize: '36px', fontStyle: 'italic', fontWeight: 700, color: C.forest, margin: 0, lineHeight: 1, cursor: 'default', userSelect: 'none' }}>
          Andi
        </h1>
        <p style={{ fontSize: '12px', color: C.muted, margin: '6px 0 0', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          Reservá tu mesa
        </p>
      </div>

      {/* Selector de servicio */}
      <div style={{ padding: '0 20px 16px', display: 'flex', gap: '8px' }}>
        {Object.entries(SERVICES).map(([k, s]) => {
          const Icon = s.icon;
          const active = service === k;
          return (
            <button key={k} onClick={() => setService(k)} style={{
              flex: 1, padding: '14px 8px',
              background: active ? C.forest : 'transparent',
              color: active ? C.cream : C.forest,
              border: `1.5px solid ${C.forest}`,
              borderRadius: '14px', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
              fontFamily: 'inherit',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 600 }}>
                <Icon size={14} />{s.name}
              </div>
              <span style={{ fontSize: '10px', opacity: 0.7 }}>{s.start} — {s.end}</span>
            </button>
          );
        })}
      </div>

      {/* Formulario */}
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <Field label="Nombre">
          <input
            value={form.customerName}
            onChange={e => set('customerName', e.target.value)}
            placeholder="Tu nombre"
            style={inp}
            autoFocus
          />
        </Field>

        <Field label="Teléfono (opcional)">
          <input
            value={form.phone}
            onChange={e => set('phone', e.target.value)}
            placeholder="+54 9 11 ..."
            type="tel"
            style={inp}
          />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Field label="Comensales">
            <select value={form.partySize} onChange={e => set('partySize', parseInt(e.target.value))} style={inp}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                <option key={n} value={n}>{n} {n === 1 ? 'persona' : 'personas'}</option>
              ))}
            </select>
          </Field>
          <Field label="Mesa">
            <select value={form.tableId} onChange={e => set('tableId', e.target.value)} style={inp}>
              <option value="">— elegir —</option>
              {availableTables.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.capacity}p)</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Horario">
          <select value={form.time} onChange={e => set('time', e.target.value)} style={inp}>
            {slots.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>

        <Field label="Notas (opcional)">
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="Alergias, pedidos especiales..."
            rows={2}
            style={{ ...inp, resize: 'vertical' }}
          />
        </Field>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', fontSize: '13px', color: '#991b1b' }}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <button onClick={handleSubmit} disabled={!valid} style={{
          width: '100%', padding: '16px',
          background: valid ? C.terra : C.creamDeep,
          border: 'none', borderRadius: '14px',
          cursor: valid ? 'pointer' : 'not-allowed',
          color: valid ? C.white : C.muted,
          fontSize: '16px', fontWeight: 600,
          fontFamily: 'inherit',
          marginTop: '4px',
        }}>
          {submitting ? 'Reservando...' : 'Reservar mesa'}
        </button>
      </div>
    </div>
  );
}
