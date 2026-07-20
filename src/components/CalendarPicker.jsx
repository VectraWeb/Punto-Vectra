import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { C } from '../utils';

export default function CalendarPicker({ date, onSelect, onClose, colors: C }) {
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date(date + 'T12:00:00');
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const daysInMonth = new Date(viewDate.year, viewDate.month + 1, 0).getDate();
  const startDay = new Date(viewDate.year, viewDate.month, 1).getDay();
  const today = new Date();

  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const weekdays = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

  const prev = () => setViewDate(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 });
  const next = () => setViewDate(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { ...v, month: v.month + 1 });

  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(<div key={`e${i}`} />);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${viewDate.year}-${String(viewDate.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const sel = iso === date;
    const isToday = viewDate.year === today.getFullYear() && viewDate.month === today.getMonth() && d === today.getDate();
    cells.push(
      <button key={d} onClick={() => onSelect(iso)} style={{
        aspectRatio: '1', borderRadius: '10px', border: 'none', cursor: 'pointer',
        background: sel ? C.terra : isToday ? 'rgba(196,96,47,0.15)' : 'transparent',
        color: sel ? '#fff' : C.espresso,
        fontWeight: sel ? 700 : isToday ? 600 : 400,
        fontSize: '14px', fontFamily: 'inherit',
      }}>{d}</button>
    );
  }

  return (
    <div ref={ref} style={{
      position: 'absolute', top: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)',
      background: C.white, borderRadius: '16px', boxShadow: '0 8px 32px rgba(31,58,46,0.2)',
      padding: '16px', width: '300px', zIndex: 300,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <button onClick={prev} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.espresso, padding: '4px' }}>
          <ChevronLeft size={18} />
        </button>
        <span style={{ fontFamily: '"Fraunces", serif', fontSize: '18px', fontStyle: 'italic', fontWeight: 600, color: C.forest }}>
          {months[viewDate.month]} {viewDate.year}
        </span>
        <button onClick={next} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.espresso, padding: '4px' }}>
          <ChevronRight size={18} />
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
        {weekdays.map(w => (
          <div key={w} style={{ textAlign: 'center', fontSize: '11px', color: C.muted, fontWeight: 600, padding: '4px 0' }}>{w}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {cells}
      </div>
      <button onClick={() => {
        const d = new Date();
        onSelect(d.toISOString().slice(0, 10));
      }} style={{
        width: '100%', marginTop: '10px', padding: '8px', borderRadius: '10px',
        background: C.creamDeep, border: 'none', cursor: 'pointer',
        color: C.forest, fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
      }}>Hoy</button>
    </div>
  );
}
