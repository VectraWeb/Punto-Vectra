import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { toLocalISO } from '../utils';

const resCol = () => collection(db, 'reservations');
const MAX_IN_VALUES = 10;

// El bot (y datos viejos) pueden traer service como 'Cena'/'Mediodía'.
// Normalizamos a 'mediodia'/'cena' para que los filtros de la UI matcheen.
const normService = (s) => {
  const r = String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (r.includes('mediod') || r.includes('almuerzo')) return 'mediodia';
  if (r.includes('cen') || r.includes('noche')) return 'cena';
  return r;
};

export function useReservations(date) {
  const [reservations, setReservations] = useState([]);

  useEffect(() => {
    const q = query(resCol(), where('date', '==', date));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs
          .map(d => ({ ...d.data(), id: d.id, service: normService(d.data().service) }))
          .filter(r => r.source !== 'whatsapp_bot')
          .filter(r => !['cancelado', 'no_show', 'ausente'].includes(r.estado));
        setReservations(data);
      },
      (err) => { console.error('[Andi] Firestore error:', err); }
    );
    return unsub;
  }, [date]);

  return reservations;
}

export function useAnalyticsReservations(date, showAnalytics, analyticsPeriod, analyticsMonth) {
  const [analyticsState, setAnalyticsState] = useState({ period: null, month: null, data: [] });

  useEffect(() => {
    if (!showAnalytics || analyticsPeriod === 'day') {
      return;
    }

    let cancelled = false;
    const key = analyticsPeriod === 'month' ? `month:${analyticsMonth}` : analyticsPeriod;

    let dates = [];

    if (analyticsPeriod === 'trend') {
      // Tendencia: últimos 12 meses
      for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const daysInMonth = new Date(y, m, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
          dates.push(`${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
        }
      }
    } else if (analyticsPeriod === 'month' && analyticsMonth) {
      const [y, m] = analyticsMonth.split('-').map(Number);
      const daysInMonth = new Date(y, m, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        dates.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
      }
    } else {
      const days = analyticsPeriod === 'week' ? 7 : 30;
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(date + 'T12:00:00');
        d.setDate(d.getDate() - i);
        dates.push(toLocalISO(d));
      }
    }

    (async () => {
      try {
        const chunks = [];
        for (let i = 0; i < dates.length; i += MAX_IN_VALUES) {
          chunks.push(dates.slice(i, i + MAX_IN_VALUES));
        }
        const results = await Promise.all(
          chunks.map(c => getDocs(query(resCol(), where('date', 'in', c))))
        );
        const all = results.flatMap(snap => snap.docs
          .map(d => ({ ...d.data(), id: d.id, service: normService(d.data().service) }))
          .filter(r => r.source !== 'whatsapp_bot')
        );
        if (!cancelled) setAnalyticsState({ period: key, month: analyticsMonth, data: all });
      } catch (err) {
        console.error('[Andi] Analytics fetch error:', err);
      }
    })();

    return () => { cancelled = true; };
  }, [showAnalytics, analyticsPeriod, date, analyticsMonth]);

  const key = analyticsPeriod === 'month' ? `month:${analyticsMonth}` : analyticsPeriod;
  const fresh = analyticsPeriod === 'month'
    ? analyticsState.period === key && analyticsState.month === analyticsMonth
    : analyticsState.period === key;

  // Derivado: solo se exponen datos frescos del período/click actual.
  // Evita mostrar datos viejos (de otra vista) durante la carga.
  return (showAnalytics && analyticsPeriod !== 'day' && fresh) ? analyticsState.data : [];
}
