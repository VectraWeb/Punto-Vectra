import { useState, useEffect, useCallback, useRef } from 'react';
import { reservationApi } from '../services/api';
import { toLocalISO } from '../utils';

// El bot (y datos viejos) pueden traer service como 'Cena'/'Mediodía'.
const normService = (s) => {
  const r = String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (r.includes('mediod') || r.includes('almuerzo')) return 'mediodia';
  if (r.includes('cen') || r.includes('noche')) return 'cena';
  return r;
};

export function useReservations(date) {
  const [reservations, setReservations] = useState([]);
  const fetchRef = useRef(null);

  const fetchReservations = useCallback(async () => {
    try {
      const { data } = await reservationApi.getAll({ date });
      const filtered = (data || [])
        .map(r => ({ ...r, service: normService(r.service) }))
        .filter(r => r.source !== 'whatsapp_bot')
        .filter(r => !['cancelled', 'no_show', 'expired'].includes(r.status))
        .filter(r => !['cancelado', 'no_show', 'ausente'].includes(r.estado));
      setReservations(filtered);
    } catch (err) {
      console.error('[PuntoVectra] API error:', err);
    }
  }, [date]);

  useEffect(() => {
    fetchRef.current = fetchReservations;
    fetchReservations();
    const interval = setInterval(() => fetchRef.current?.(), 10000);
    return () => clearInterval(interval);
  }, [fetchReservations]);

  return { reservations, refetch: fetchReservations };
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
        const { data } = await reservationApi.getAnalytics('default', dates);
        const all = (data || [])
          .map(r => ({ ...r, service: normService(r.service) }))
          .filter(r => r.source !== 'whatsapp_bot');
        if (!cancelled) setAnalyticsState({ period: key, month: analyticsMonth, data: all });
      } catch (err) {
        console.error('[PuntoVectra] Analytics fetch error:', err);
      }
    })();

    return () => { cancelled = true; };
  }, [showAnalytics, analyticsPeriod, date, analyticsMonth]);

  const key = analyticsPeriod === 'month' ? `month:${analyticsMonth}` : analyticsPeriod;
  const fresh = analyticsPeriod === 'month'
    ? analyticsState.period === key && analyticsState.month === analyticsMonth
    : analyticsState.period === key;

  return (showAnalytics && analyticsPeriod !== 'day' && fresh) ? analyticsState.data : [];
}
