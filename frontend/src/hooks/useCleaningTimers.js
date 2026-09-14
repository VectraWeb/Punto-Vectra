import { useState, useEffect, useRef, useCallback } from 'react';
import { reservationApi, configApi } from '../services/api';
import { notificarN8N, computeStateDurations } from '../utils';

export const CLEANING_DURATION_MS = 5 * 60 * 1000;
const EXTEND_MS = 5 * 60 * 1000;

function toMs(v) {
  if (!v) return Date.now();
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return new Date(v).getTime() || 0;
  return new Date(v).getTime();
}

export function useCleaningCountdown(expiresAt) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!expiresAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (!expiresAt) return null;

  const remainingMs = expiresAt - now;
  return {
    remainingSec: Math.max(0, Math.ceil(remainingMs / 1000)),
    progress: Math.max(0, Math.min(1, remainingMs / CLEANING_DURATION_MS)),
  };
}

export function useCleaningTimers(reservations, date, tables) {
  const timersRef = useRef({});
  const [sharedTimers, setSharedTimers] = useState({});
  const finalizingRef = useRef(false);
  const doFinalizeRef = useRef(null);

  const doFinalize = useCallback(async (res) => {
    if (finalizingRef.current) return;
    finalizingRef.current = true;

    const tableName = tables.find(t => t.id === res.tableId)?.name || res.tableId;
    const startMs = toMs(res.startedAt || res.createdAt);
    const duracionMinutos = Math.round((Date.now() - startMs) / 60000);

    notificarN8N({
      evento: 'reserva_finalizada',
      cliente_nombre: res.customerName,
      mesa: tableName,
      mesa_id: res.tableId,
      servicio: res.service,
      duracion_total_minutos: duracionMinutos,
    });

    try {
      await reservationApi.update(res.id, {
        liveState: 'finalizado',
        cleaningCompletedAt: new Date().toISOString(),
        leftAt: new Date().toISOString(),
        stateLog: [...(res.stateLog || []), { state: 'finalizado', at: new Date().toISOString() }],
      });
    } catch (e) {
      console.warn('[CleaningTimer] Error al finalizar:', e);
    } finally {
      finalizingRef.current = false;
    }
  }, [date, tables]);

  useEffect(() => {
    doFinalizeRef.current = doFinalize;
  }, [doFinalize]);

  const removeShared = useCallback((tableId) => {
    setSharedTimers(prev => { const n = { ...prev }; delete n[tableId]; return n; });
  }, []);

  const startTimer = useCallback((res) => {
    if (timersRef.current[res.id]) return;

    const startedAt = toMs(res.cleaningStartedAt);
    const expiresAt = startedAt + CLEANING_DURATION_MS;

    if (expiresAt <= Date.now()) {
      doFinalizeRef.current(res);
      return;
    }

    const timerData = { resId: res.id, tableId: res.tableId, res, expiresAt, intervalId: null };
    timersRef.current[res.id] = timerData;
    setSharedTimers(prev => ({ ...prev, [res.tableId]: { expiresAt, resId: res.id } }));

    timerData.intervalId = setInterval(() => {
      const t = timersRef.current[res.id];
      if (!t) { clearInterval(timerData.intervalId); return; }

      if (t.expiresAt <= Date.now()) {
        clearInterval(timerData.intervalId);
        delete timersRef.current[res.id];
        removeShared(t.tableId);
        doFinalizeRef.current(t.res);
      }
    }, 1000);
  }, [removeShared]);

  const finishNow = useCallback((res) => {
    const timer = timersRef.current[res.id];
    if (timer) {
      clearInterval(timer.intervalId);
      delete timersRef.current[res.id];
      removeShared(timer.tableId);
    }
    return doFinalizeRef.current(res);
  }, [removeShared]);

  const extendCleaning = useCallback(async (res) => {
    const timer = timersRef.current[res.id];
    if (timer) {
      timer.expiresAt += EXTEND_MS;
      const newStartedAt = new Date(timer.expiresAt - CLEANING_DURATION_MS);
      await reservationApi.update(res.id, { cleaningStartedAt: newStartedAt.toISOString() }).catch(() => {});
      setSharedTimers(prev => ({
        ...prev,
        [res.tableId]: { expiresAt: timer.expiresAt, resId: res.id },
      }));
    }
  }, []);

  const cancelCleaning = useCallback(async (res) => {
    const timer = timersRef.current[res.id];
    if (timer) {
      clearInterval(timer.intervalId);
      delete timersRef.current[res.id];
      removeShared(timer.tableId);
    }
    await reservationApi.update(res.id, {
      liveState: null,
      cleaningStartedAt: null,
      leftAt: null,
    }).catch(() => {});
  }, [removeShared]);

  useEffect(() => {
    const cleaning = reservations.filter(
      r => r.liveState === 'para_limpiar' && r.cleaningStartedAt && !r.cleaningCompletedAt
    );
    for (const res of cleaning) {
      if (!timersRef.current[res.id]) startTimer(res);
    }

    const activeIds = new Set(cleaning.map(r => r.id));
    for (const [id, timer] of Object.entries(timersRef.current)) {
      if (!activeIds.has(id)) {
        clearInterval(timer.intervalId);
        delete timersRef.current[id];
        removeShared(timer.tableId);
      }
    }
  }, [reservations, startTimer, removeShared]);

  useEffect(() => {
    return () => {
      for (const timer of Object.values(timersRef.current)) {
        clearInterval(timer.intervalId);
      }
      timersRef.current = {};
    };
  }, []);

  return { cleaningTimers: sharedTimers, finishNow, extendCleaning, cancelCleaning };
}
