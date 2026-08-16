import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { toLocalISO } from '../utils';

const resCol = () => collection(db, 'reservations');
const MAX_IN_VALUES = 10;

export function useReservations(date) {
  const [reservations, setReservations] = useState([]);

  useEffect(() => {
    const q = query(resCol(), where('date', '==', date));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setReservations(data);
      },
      (err) => { console.error('[Andi] Firestore error:', err); }
    );
    return unsub;
  }, [date]);

  return reservations;
}

export function useAnalyticsReservations(date, showAnalytics, analyticsPeriod, analyticsMonth) {
  const [analyticsRes, setAnalyticsRes] = useState([]);

  useEffect(() => {
    if (!showAnalytics || analyticsPeriod === 'day') {
      return;
    }

    let dates = [];

    if (analyticsPeriod === 'month' && analyticsMonth) {
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
        const all = results.flatMap(snap => snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setAnalyticsRes(all);
      } catch (err) {
        console.error('[Andi] Analytics fetch error:', err);
      }
    })();
  }, [showAnalytics, analyticsPeriod, date, analyticsMonth]);

  // Derivado: cuando el panel está cerrado o en modo día no se exponen datos
  // viejos (evita limpiar estado dentro del efecto)
  return (showAnalytics && analyticsPeriod !== 'day') ? analyticsRes : [];
}
