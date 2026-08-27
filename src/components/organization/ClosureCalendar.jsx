// ClosureCalendar.jsx — Calendario de días cerrados del negocio.
// El dueño marca las fechas en las que NO se aceptan reservas ni pedidos
// desde la vista pública. Se guarda en organization.closedDates (ISO).

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { C, toLocalISO } from '../../utils';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function isoOf(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export default function ClosureCalendar({ organization, onSave }) {
  const closedSet = useMemo(
    () => new Set(Array.isArray(organization?.closedDates) ? organization.closedDates : []),
    [organization]
  );

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const days = useMemo(() => {
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7; // lunes = 0
    const total = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= total; d++) cells.push(isoOf(year, month, d));
    return cells;
  }, [year, month]);

  const todayIso = toLocalISO(now);

  const goPrev = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const goNext = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const toggle = async (iso) => {
    const nextSet = new Set(closedSet);
    if (nextSet.has(iso)) nextSet.delete(iso);
    else nextSet.add(iso);
    const next = [...nextSet].sort();
    if (onSave) {
      await onSave({ ...organization, closedDates: next });
    }
  };

  return (
    <div style={{ background: C.white, borderRadius: '14px', padding: '14px', border: `1px solid ${C.creamDeep}`, marginBottom: '12px' }}>
      <div style={{ fontSize: '13px', fontWeight: 700, color: C.forest, marginBottom: '2px' }}>
        Días cerrados
      </div>
      <p style={{ fontSize: '11px', color: C.muted, margin: '0 0 10px', lineHeight: 1.4 }}>
        Tocá los días en los que <strong>no</strong> aceptás reservas ni pedidos. Los clientes no podrán reservar esas fechas.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <button onClick={goPrev} style={{ background: C.creamDeep, border: 'none', borderRadius: '8px', padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <ChevronLeft size={15} color={C.muted} />
        </button>
        <div style={{ fontSize: '13px', fontWeight: 700, color: C.espresso }}>
          {MONTHS[month]} {year}
        </div>
        <button onClick={goNext} style={{ background: C.creamDeep, border: 'none', borderRadius: '8px', padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <ChevronRight size={15} color={C.muted} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px' }}>
        {WEEKDAYS.map((w, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: '10px', fontWeight: 700, color: C.muted }}>
            {w}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
        {days.map((iso, i) => {
          if (!iso) return <div key={`e${i}`} />;
          const closed = closedSet.has(iso);
          const isToday = iso === todayIso;
          const isPast = iso < todayIso;
          return (
            <button
              key={iso}
              onClick={() => toggle(iso)}
              title={closed ? 'Tocá para abrir el día' : 'Tocá para cerrar el día'}
              style={{
                aspectRatio: '1', borderRadius: '8px', border: isToday ? `1.5px solid ${C.terra}` : '1px solid transparent',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px', fontWeight: closed ? 700 : 600,
                background: closed ? '#c0392b' : (isPast ? C.creamDeep : C.white),
                color: closed ? '#fff' : (isPast ? C.muted : C.espresso),
                opacity: isPast && !closed ? 0.55 : 1,
              }}
            >
              {Number(iso.slice(-2))}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: '14px', marginTop: '10px', fontSize: '11px', color: C.muted, alignItems: 'center' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '12px', height: '12px', borderRadius: '4px', background: '#c0392b', display: 'inline-block' }} /> Cerrado
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '12px', height: '12px', borderRadius: '4px', border: `1.5px solid ${C.terra}`, background: C.white, display: 'inline-block' }} /> Hoy
        </span>
        <span style={{ marginLeft: 'auto' }}>
          {closedSet.size} día{closedSet.size !== 1 ? 's' : ''} cerrado{closedSet.size !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}
