import { useState, useEffect } from 'react';
import { collection, doc, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const resCol = () => collection(db, 'reservations');

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

export function useAnalyticsReservations(date, showAnalytics, analyticsPeriod) {
  const [analyticsRes, setAnalyticsRes] = useState([]);

  useEffect(() => {
    if (!showAnalytics || analyticsPeriod === 'day') {
      setAnalyticsRes([]);
      return;
    }
    const days = analyticsPeriod === 'week' ? 7 : 30;
    const dates = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(date + 'T12:00:00');
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }
    (async () => {
      try {
        const snap = await getDocs(query(resCol(), where('date', 'in', dates)));
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setAnalyticsRes(all);
      } catch (err) {
        console.error('[Andi] Analytics fetch error:', err);
      }
    })();
  }, [showAnalytics, analyticsPeriod, date]);

  return analyticsRes;
}
