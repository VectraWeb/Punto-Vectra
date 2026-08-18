// ResForm.jsx — Formulario de reserva independiente para clientes
import { useState, useEffect, useRef, useCallback } from 'react';
import { Check, AlertCircle, Calendar, Clock } from 'lucide-react';
import {
  doc, onSnapshot, setDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { C, SERVICES, DEFAULT_CONFIG, configToArray, t2m, todayISO } from '../utils';
import { Field } from './ui';

// ─── Firestore helpers ───────────────────────────────────────────────────────
const resDocRef = (id) => doc(db, 'reservations', id);
const cfgRef = () => doc(db, 'config', 'restaurant');

// ─── Estilos ─────────────────────────────────────────────────────────────────
const inp = {
  width: '100%', padding: '12px 14px', fontSize: '16px',
  background: C.white, border: `1.5px solid ${C.creamDeep}`,
  borderRadius: '12px', color: C.espresso, outline: 'none',
  fontFamily: 'inherit',
  WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none',
};

// Detección del servicio (turno) según la hora elegida: Mediodía (AM) o Cena (PM)
const serviceFromTime = (time) => {
  if (!time) return null;
  const mins = t2m(time, 'mediodia');
  const mStart = t2m(SERVICES.mediodia.start, 'mediodia');
  const mEnd = t2m(SERVICES.mediodia.end, 'mediodia');
  if (mins >= mStart && mins <= mEnd) return 'mediodia';
  const cMins = t2m(time, 'cena');
  const cStart = t2m(SERVICES.cena.start, 'cena');
  const cEnd = t2m(SERVICES.cena.end, 'cena');
  if (cMins >= cStart && cMins <= cEnd) return 'cena';
  return null;
};

// ═══════════════════════════════════════════════════════════════════════════════
// ResForm — Formulario de reserva para clientes
// ═══════════════════════════════════════════════════════════════════════════════
export default function ResForm({ onStaffAccess }) {
  const [, setConfig] = useState(DEFAULT_CONFIG);
  const [date, setDate] = useState(todayISO());
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

  const [form, setForm] = useState({
    customerName: '',
    partySize: 2,
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

  // Servicio (Mediodía/Cena) derivado de la hora elegida
  const service = serviceFromTime(form.time);
  const timeOutOfRange = form.time && !service;

  // Cierre semanal: los martes no se atiende
  const closedTuesday = new Date(date + 'T12:00:00').getDay() === 2;

  // ── Validación ───────────────────────────────────────────────────────────
  const valid = form.customerName.trim().length >= 2
    && form.time
    && service
    && form.partySize > 0
    && date
    && !closedTuesday
    && !submitting;

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!valid) return;
    setSubmitting(true);
    setError('');

    const id = `r${Date.now()}`;

    try {
      // GUARDADO SIMPLE: Sin búsqueda de mesas, sin transacciones.
      // La reserva nace estrictamente como 'pendiente' y sin mesa asignada.
      await setDoc(resDocRef(id), {
        id,
        customerName: form.customerName.trim(),
        partySize: form.partySize,
        staffId: null,
        staffName: '',
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
        setForm({ customerName: '', partySize: 2, time: nowHHMM(), notes: '' });
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
          {date} · {form.time} · {service === 'mediodia' ? 'Mediodía' : 'Cena'}
        </p>
        <p style={{ fontSize: '14px', color: C.muted, margin: '4px 0 0' }}>
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

        <Field label="Fecha">
          <input
            type="date"
            value={date}
            min={todayISO()}
            onChange={e => setDate(e.target.value)}
            style={inp}
          />
          {closedTuesday && (
            <div style={{
              marginTop: '8px', fontSize: '13px', padding: '10px 14px',
              background: '#fdf6e3', border: `1px solid ${C.soon}`, borderRadius: '12px',
              color: '#6b5a00', lineHeight: '1.4',
            }}>
              Cerrado los martes. Elegí otro día para reservar.
            </div>
          )}
        </Field>

        <Field label="Comensales">
          <select value={form.partySize} onChange={e => set('partySize', parseInt(e.target.value))} style={inp}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
              <option key={n} value={n}>{n} {n === 1 ? 'persona' : 'personas'}</option>
            ))}
          </select>
        </Field>

        <Field label="Horario">
          <input type="time" value={form.time}
            onChange={e => set('time', e.target.value)}
            style={inp} />
        </Field>

        {service && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', padding: '10px 14px', background: '#fdf6e3', border: `1px solid ${C.soon}`, borderRadius: '12px', color: '#6b5a00', lineHeight: '1.4' }}>
            {service === 'mediodia' ? <Calendar size={15} /> : <Clock size={15} />}
            <span><strong>{service === 'mediodia' ? 'Mediodía' : 'Cena'}</strong> · de {SERVICES[service].start} a {SERVICES[service].end}</span>
          </div>
        )}

        {timeOutOfRange && (
          <div style={{ padding: '10px 14px', background: '#fdf6e3', border: `1px solid ${C.soon}`, borderRadius: '12px', fontSize: '13px', color: '#6b5a00', lineHeight: '1.4' }}>
            Ese horario está fuera de nuestra atención: Mediodía de {SERVICES.mediodia.start} a {SERVICES.mediodia.end} y Cena de {SERVICES.cena.start} a {SERVICES.cena.end}.
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
