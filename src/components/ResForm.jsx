// ResForm.jsx — Formulario de reserva independiente para clientes
import { useState, useRef, useCallback } from 'react';
import { Check, AlertCircle, Calendar, Clock, ArrowLeft } from 'lucide-react';
import {
  doc, setDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { C, SERVICES, serviceFromTime, defaultServiceTime, todayISO } from '../utils';
import { Field } from './ui';
import PhoneField from './PhoneField';
import DynamicFields from './reservations/DynamicFields';
import { useOrganization } from '../hooks/useOrganization';
import {
  resourceLabelOf, reserveActionOf, bookingFieldsOf,
  businessUsesGuests, serviceLabelOf, CORE_BOOKING_FIELD_NAMES,
} from '../config/businessTypes';

// ─── Firestore helpers ───────────────────────────────────────────────────────
const resDocRef = (id) => doc(db, 'reservations', id);

// ─── Estilos ─────────────────────────────────────────────────────────────────
const inp = {
  width: '100%', padding: '12px 14px', fontSize: '16px',
  background: C.white, border: `1.5px solid ${C.creamDeep}`,
  borderRadius: '12px', color: C.espresso, outline: 'none',
  fontFamily: 'inherit',
  WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none',
};

// ═══════════════════════════════════════════════════════════════════════════════
// ResForm — Formulario de reserva para clientes
// ═══════════════════════════════════════════════════════════════════════════════
export default function ResForm({ onStaffAccess, onBack, organization: organizationProp }) {
  const orgFromHook = useOrganization();
  const organization = organizationProp || orgFromHook;
  const resourceLabel = resourceLabelOf(organization);
  const reserveAction = reserveActionOf(organization);
  const bookingFields = bookingFieldsOf(organization);
  const usesGuests = businessUsesGuests(organization);
  const guestsField = bookingFields.find(f => f.name === 'guests');
  const partyLabel = resourceLabel === 'Mesa' ? 'Comensales' : (guestsField?.label || 'Cantidad de personas');

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

  const [form, setForm] = useState({
    customerName: '',
    phone: '',
    partySize: 2,
    time: defaultServiceTime(),
    notes: '',
    metadata: {},
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setMeta = (k, v) => setForm(f => ({ ...f, metadata: { ...(f.metadata || {}), [k]: v } }));

  // Servicio (Mediodía/Cena) derivado de la hora elegida
  const service = serviceFromTime(form.time);
  const timeOutOfRange = form.time && !service;
  const serviceLabel = serviceLabelOf(organization, service);

  // Cierre semanal: los martes no se atiende (solo restaurante).
  const closedTuesday = organization.businessType === 'restaurant' && new Date(date + 'T12:00:00').getDay() === 2;

  // Campos personalizados requeridos (solo los que se renderizan).
  const requiredCustom = bookingFields.filter(f => f && f.required && !CORE_BOOKING_FIELD_NAMES.has(f.name));
  const customOk = requiredCustom.every(f => {
    const v = form.metadata?.[f.name];
    return v !== undefined && v !== null && v !== '';
  });

  // ── Validación ───────────────────────────────────────────────────────────
  const valid = form.customerName.trim().length >= 2
    && form.phone.trim().length >= 6
    && form.time
    && service
    && (usesGuests ? form.partySize > 0 : true)
    && customOk
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
        phone: form.phone.trim(),
        partySize: usesGuests ? form.partySize : 1,
        staffId: null,
        staffName: '',
        time: form.time,
        duration: SERVICES[service].defaultDuration,
        service,
        notes: form.notes,
        mesa_id: null,
        resourceId: null,
        organizationId: organization.id,
        metadata: form.metadata || {},
        estado: 'pendiente',
        date,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setForm({ customerName: '', phone: '', partySize: 2, time: defaultServiceTime(), notes: '', metadata: {} });
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
          {date} · {form.time} · {serviceLabel || ''}
        </p>
        <p style={{ fontSize: '14px', color: C.muted, margin: '4px 0 0' }}>
          Te esperamos en <strong>{organization.name}</strong>
        </p>
        {onBack && (
          <button onClick={onBack} style={{
            marginTop: '24px', padding: '12px 28px', background: C.forest, color: C.cream,
            border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Volver al inicio
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: '0 0 40px' }}>
      {/* Volver al selector */}
      {onBack && (
        <button onClick={onBack} style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          background: 'none', border: 'none', cursor: 'pointer',
          color: C.muted, fontSize: '13px', fontWeight: 600,
          fontFamily: 'inherit', padding: '18px 20px 0',
        }}>
          <ArrowLeft size={16} /> Volver
        </button>
      )}

      {/* Header branding */}
      <div style={{ padding: '32px 24px 24px', textAlign: 'center' }}>
        <h1 onClick={handleLogoClicks} style={{ fontFamily: '"Fraunces", serif', fontSize: '36px', fontStyle: 'italic', fontWeight: 700, color: C.forest, margin: 0, lineHeight: 1, cursor: 'default', userSelect: 'none' }}>
          Andi
        </h1>
        <p style={{ fontSize: '12px', color: C.muted, margin: '6px 0 0', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          Reservá tu {resourceLabel.toLowerCase()}
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
          />
        </Field>

        <PhoneField
          label="Teléfono"
          value={form.phone}
          onChange={v => set('phone', v)}
          placeholder="11 5555-1234"
        />

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

        {usesGuests && (
          <Field label={partyLabel}>
            <select value={form.partySize} onChange={e => set('partySize', parseInt(e.target.value))} style={inp}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                <option key={n} value={n}>{n} {n === 1 ? 'persona' : 'personas'}</option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Horario">
          <input type="time" value={form.time}
            onChange={e => set('time', e.target.value)}
            style={inp} />
        </Field>

        {service && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', padding: '10px 14px', background: '#fdf6e3', border: `1px solid ${C.soon}`, borderRadius: '12px', color: '#6b5a00', lineHeight: '1.4' }}>
            {service === 'mediodia' ? <Calendar size={15} /> : <Clock size={15} />}
            <span><strong>{serviceLabel}</strong> · de {SERVICES[service].start} a {SERVICES[service].end}</span>
          </div>
        )}

        <DynamicFields
          fields={bookingFields}
          values={form.metadata || {}}
          onChange={setMeta}
        />

        {timeOutOfRange && (
          <div style={{ padding: '10px 14px', background: '#fdf6e3', border: `1px solid ${C.soon}`, borderRadius: '12px', fontSize: '13px', color: '#6b5a00', lineHeight: '1.4' }}>
            Ese horario está fuera de nuestra atención: {serviceLabelOf(organization, 'mediodia')} de {SERVICES.mediodia.start} a {SERVICES.mediodia.end} y {serviceLabelOf(organization, 'cena')} de {SERVICES.cena.start} a {SERVICES.cena.end}.
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
          {submitting ? 'Reservando...' : reserveAction}
        </button>
      </div>
    </div>
  );
}
