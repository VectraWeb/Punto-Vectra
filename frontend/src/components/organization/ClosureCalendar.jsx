import { useState, useMemo } from 'react';
import { C } from '../../utils';

const inp = {
  width: '100%', padding: '10px 12px', fontSize: '14px',
  background: C.white, border: `1.5px solid ${C.creamDeep}`,
  borderRadius: '10px', color: C.espresso, outline: 'none',
  fontFamily: 'inherit',
};

export default function ClosureCalendar({ organization, onSave }) {
  const closedDates = useMemo(
    () => Array.isArray(organization?.closedDates) ? organization.closedDates : [],
    [organization]
  );
  const [selectedDate, setSelectedDate] = useState('');

  const toggleDate = (iso) => {
    const next = closedDates.includes(iso)
      ? closedDates.filter(d => d !== iso)
      : [...closedDates, iso].sort();
    onSave({ ...organization, closedDates: next });
  };

  const addDate = () => {
    if (selectedDate && !closedDates.includes(selectedDate)) {
      const next = [...closedDates, selectedDate].sort();
      onSave({ ...organization, closedDates: next });
      setSelectedDate('');
    }
  };

  return (
    <div style={{ background: C.white, borderRadius: '14px', padding: '14px', border: `1px solid ${C.creamDeep}`, marginBottom: '12px' }}>
      <div style={{ fontSize: '13px', fontWeight: 700, color: C.forest, marginBottom: '2px' }}>
        Días cerrados
      </div>
      <p style={{ fontSize: '11px', color: C.muted, margin: '0 0 10px', lineHeight: 1.4 }}>
        Seleccioná los días en los que no aceptás reservas.
      </p>

      <div style={{ display: 'flex', gap: '8px', marginBottom: closedDates.length ? '10px' : 0 }}>
        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          style={{ ...inp, flex: 1 }}
        />
        <button onClick={addDate} disabled={!selectedDate} style={{
          padding: '10px 14px', borderRadius: '10px', border: 'none', cursor: selectedDate ? 'pointer' : 'not-allowed',
          background: selectedDate ? C.forest : C.creamDeep, color: selectedDate ? C.cream : C.muted,
          fontSize: '12px', fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap',
        }}>
          Agregar
        </button>
      </div>

      {closedDates.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {closedDates.map(iso => (
            <div key={iso} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 10px', background: '#fef2f2', border: '1px solid #fecaca',
              borderRadius: '8px', fontSize: '13px', color: '#991b1b',
            }}>
              <span>{new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
              <button onClick={() => toggleDate(iso)} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b',
                fontSize: '16px', padding: '0 4px', fontWeight: 700,
              }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
