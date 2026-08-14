// ResForm.jsx — Formulario de reserva independiente para clientes
import { useState, useEffect, useRef, useCallback } from 'react';
import { Check, AlertCircle } from 'lucide-react';
import {
  collection, doc, onSnapshot, setDoc, serverTimestamp,
  query, where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { C, SERVICES, DEFAULT_CONFIG, configToArray, t2m, todayISO, detectService } from '../utils';
import { Field } from './ui';

// ─── Firestore helpers ───────────────────────────────────────────────────────
const resCol = () => collection(db, 'reservations');
const resDocRef = (id) => doc(db, 'reservations', id);
const cfgRef = () => doc(db, 'config', 'restaurant');

// ─── Estilos ─────────────────────────────────────────────────────────────────
const inp = {
  width: '100%', padding: '12px 14px', fontSize: '16px',
  background: C.white, border: `1.5px solid ${C.creamDeep}`,
  borderRadius: '12px', color: C.espresso, outline: 'none',
  fontFamily: 'inherit',
};

// ═══════════════════════════════════════════════════════════════════════════════
// ResForm — Formulario de reserva para clientes
// ═══════════════════════════════════════════════════════════════════════════════
export default function ResForm({ onStaffAccess }) {
  const [, setConfig] = useState(DEFAULT_CONFIG);
  const [service, setService] = useState(detectService);
  const [date] = useState(todayISO());
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

  const nowHHMM = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const [staff, setStaff] = useState([]);

  const [form, setForm] = useState({
    customerName: '',
    phone: '',
    partySize: 2,
    staffId: '',
    time: nowHHMM(),
    notes: '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ── Suscripción a config ─────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(cfgRef(), (snap) => {
      if (snap.exists()) setConfig(configToArray(snap.data()));
    });
    return unsub;
  }, []);

  // ── Suscripción a staff (mozos) ──────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'staff'), (snap) => {
      setStaff(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  // ── Suscripción a reservas del día ───────────────────────────────────────
  useEffect(() => {
    const q = query(resCol(), where('date', '==', date));
    const unsub = onSnapshot(q, (snap) => {
      setReservations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [date]);

  // ── Corregir time si cambia de servicio ──────────────────────────────────
  const tInRange = (time, svc) => {
    if (!time) return false;
    const mins = t2m(time, svc);
    const start = t2m(SERVICES[svc].start, svc);
    const end = t2m(SERVICES[svc].end, svc);
    return mins >= start && mins <= end;
  };

  const timeOutOfRange = form.time && !tInRange(form.time, service);

  // ── Validación ───────────────────────────────────────────────────────────
  const valid = form.customerName.trim().length >= 2
    && form.time
    && tInRange(form.time, service)
    && form.partySize > 0
    && !submitting;

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!valid) return;
    setSubmitting(true);
    setError('');

    const id = `r${Date.now()}`;
    const date = todayISO();

    const validEstados = ['pendiente', 'confirmada', 'esperando_cliente'];
    const duplicate = form.phone && reservations.some(r =>
      (r.customerPhone === form.phone || r.phone === form.phone) &&
      r.service === service &&
      validEstados.includes(r.estado || '')
    );
    if (duplicate) {
      setError('Ya tenés una reserva activa para este turno. No podés reservar dos veces.');
      setSubmitting(false);
      return;
    }

    try {
      // GUARDADO SIMPLE: Sin búsqueda de mesas, sin transacciones.
      // La reserva nace estrictamente como 'pendiente' y sin mesa asignada.
      await setDoc(resDocRef(id), {
        id,
        customerName: form.customerName.trim(),
        phone: form.phone,
        partySize: form.partySize,
        staffId: form.staffId || null,
        staffName: staff.find(s => s.id === form.staffId)?.name || '',
        time: form.time,
        duration: SERVICES[service].defaultDuration,
        service,
        notes: form.notes,
        mesa_id: null,
        estado: 'pendiente',
        date,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setForm({ customerName: '', phone: '', partySize: 2, staffId: '', time: nowHHMM(), notes: '' });
      }, 3000);
    } catch (e) {
      console.error('Error al crear la reserva:', e);
      setError('Error al crear la reserva. Intente de nuevo.');
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
              fontFamily: 'inherit', transition: 'all 0.2s ease',
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

        <Field label="Comensales">
          <select value={form.partySize} onChange={e => set('partySize', parseInt(e.target.value))} style={inp}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
              <option key={n} value={n}>{n} {n === 1 ? 'persona' : 'personas'}</option>
            ))}
          </select>
        </Field>

        {staff.filter(s => s.active !== false).length > 0 && (
          <Field label="Mozo (opcional)">
            <select value={form.staffId} onChange={e => set('staffId', e.target.value)} style={inp}>
              <option value="">Sin preferencia</option>
              {staff.filter(s => s.active !== false).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
        )}

        {staff.length === 0 && (
          <p style={{ fontSize: '13px', color: C.muted, margin: '-4px 0 4px' }}>No hay mozos cargados</p>
        )}

        <Field label="Horario">
          <input type="time" value={form.time}
            onChange={e => set('time', e.target.value)}
            style={inp} />
        </Field>

        {timeOutOfRange && (
          <div style={{ padding: '10px 14px', background: '#fdf6e3', border: `1px solid ${C.soon}`, borderRadius: '12px', fontSize: '13px', color: '#6b5a00', lineHeight: '1.4' }}>
            El horario de <strong>{SERVICES[service].name}</strong> es de {SERVICES[service].start} a {SERVICES[service].end}. Probá con otro horario o cambiá a <strong>{service === 'mediodia' ? 'Cena' : 'Mediodía'}</strong>.
          </div>
        )}

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 14px', background: '#fef2f2', border: `1px solid ${C.terraSoft}`, borderRadius: '12px', fontSize: '13px', color: '#991b1b' }}>
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
