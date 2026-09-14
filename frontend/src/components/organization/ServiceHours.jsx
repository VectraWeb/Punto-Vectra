// ServiceHours.jsx — Horarios de los turnos (Mediodía / Cena).
// Guarda en organization.configuration.services:
// { mediodia: { start, end }, cena: { start, end } }.
// La vista pública lee estos horarios (se espejan a la org pública al guardar).

import { useState } from 'react';
import { C, SERVICES, servicesOf } from '../../utils';

const inp = {
  padding: '10px 12px', fontSize: '14px',
  background: C.white, border: `1.5px solid ${C.creamDeep}`,
  borderRadius: '10px', color: C.espresso, outline: 'none',
  fontFamily: 'inherit',
};

const isHHMM = (v) => /^\d{2}:\d{2}$/.test(v || '');

export default function ServiceHours({ organization, onSave }) {
  const [hours, setHours] = useState(() => {
    const svc = servicesOf(organization);
    return {
      mediodia: { start: svc.mediodia.start, end: svc.mediodia.end },
      cena: { start: svc.cena.start, end: svc.cena.end },
    };
  });
  const [saving, setSaving] = useState(false);

  const set = (turn, field, value) => {
    const next = { ...hours, [turn]: { ...hours[turn], [field]: value } };
    setHours(next);
    // El input time solo emite valores HH:MM completos → guardar directo.
    if (isHHMM(next.mediodia.start) && isHHMM(next.mediodia.end)
      && isHHMM(next.cena.start) && isHHMM(next.cena.end) && !saving) {
      persist(next);
    }
  };

  const persist = async (next) => {
    setSaving(true);
    try {
      await onSave({
        ...organization,
        configuration: {
          ...(organization?.configuration || {}),
          services: {
            mediodia: { start: next.mediodia.start, end: next.mediodia.end },
            cena: { start: next.cena.start, end: next.cena.end },
          },
        },
      });
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = async () => {
    const next = {
      mediodia: { start: SERVICES.mediodia.start, end: SERVICES.mediodia.end },
      cena: { start: SERVICES.cena.start, end: SERVICES.cena.end },
    };
    setHours(next);
    await persist(next);
  };

  return (
    <div style={{ background: C.white, borderRadius: '14px', padding: '14px', border: `1px solid ${C.creamDeep}`, marginBottom: '12px' }}>
      <div style={{ fontSize: '13px', fontWeight: 700, color: C.forest, marginBottom: '2px' }}>
        Horarios del restaurante
      </div>
      <p style={{ fontSize: '11px', color: C.muted, margin: '0 0 10px', lineHeight: 1.4 }}>
        Definen los turnos de Mediodía y Cena: solapas del panel, horarios válidos de reserva y mensajes al cliente.
      </p>

      {['mediodia', 'cena'].map((turn) => (
        <div key={turn} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <div style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: C.espresso }}>
            {turn === 'mediodia' ? 'Mediodía' : 'Cena'}
          </div>
          <input
            type="time"
            value={hours[turn].start}
            onChange={e => set(turn, 'start', e.target.value)}
            style={{ ...inp, width: '110px' }}
            aria-label={`${turn} inicio`}
          />
          <span style={{ color: C.muted, fontSize: '13px' }}>a</span>
          <input
            type="time"
            value={hours[turn].end}
            onChange={e => set(turn, 'end', e.target.value)}
            style={{ ...inp, width: '110px' }}
            aria-label={`${turn} fin`}
          />
        </div>
      ))}

      <button onClick={resetDefaults} disabled={saving} style={{
        background: 'transparent', border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
        color: C.muted, fontSize: '11px', padding: '4px 0 0', fontFamily: 'inherit',
        textDecoration: 'underline',
      }}>
        {saving ? 'Guardando...' : 'Volver a los horarios por defecto'}
      </button>
    </div>
  );
}
