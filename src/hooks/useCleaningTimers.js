import { useState, useEffect, useRef, useCallback } from 'react';
import { doc, updateDoc, arrayUnion, serverTimestamp, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { notificarN8N, computeStateDurations } from '../utils';

const CLEANING_DURATION_MS = 15 * 60 * 1000;
const EXTEND_MS = 5 * 60 * 1000;

const resDocRef = (id) => doc(db, 'reservations', id);
const mesaReservadaRef = (tableId, date, service) => doc(db, 'mesasReservadas', `${tableId}_${date}_${service}`);

function toMs(v) {
  if (!v) return Date.now();
  if (typeof v === 'number') return v;
  if (v.toMillis) return v.toMillis();
  if (v.seconds) return v.seconds * 1000;
  return new Date(v).getTime();
}

async function saveMetrics(res, tables) {
  const table = tables.find(t => t.id === res.tableId);
  const stateLog = res.stateLog || [];
  const duraciones = computeStateDurations(stateLog);
  const ocupacionMin = duraciones.reduce((s, d) => s + d.durationMin, 0);
  const cleaningStart = toMs(res.cleaningStartedAt || Date.now());
  const cleaningEnd = Date.now();

  const metrics = {
    id_reserva: res.id,
    id_mesa: res.tableId,
    capacidad_mesa: table?.capacity || 0,
    hora_inicio: res.time || '',
    hora_ocupacion: res.startedAt
      ? new Date(toMs(res.startedAt)).toISOString()
      : '',
    hora_fin_ocupacion: new Date(cleaningStart).toISOString(),
    duracion_ocupacion_minutos: ocupacionMin || Math.round((cleaningStart - toMs(res.startedAt || res.createdAt)) / 60000),
    hora_inicio_limpieza: new Date(cleaningStart).toISOString(),
    hora_fin_limpieza: cleaningEnd ? new Date(cleaningEnd).toISOString() : '',
    duracion_limpieza_minutos: cleaningEnd ? Math.round((cleaningEnd - cleaningStart) / 60000) : 0,
    estado_final: 'completada',
    fecha_registro: res.date || new Date().toISOString().slice(0, 10),
    servicio: res.service || '',
    cliente: res.customerName || '',
    comensales: res.partySize || 0,
  };

  try {
    await setDoc(doc(db, 'metricas_reservas', res.id), metrics, { merge: true });
  } catch (e) {
    console.warn('[CleaningTimer] Error guardando métricas:', e);
  }
}

export function useCleaningTimers(reservations, date, tables) {
  const timersRef = useRef({});
  const [displayTimers, setDisplayTimers] = useState({});
  const finalizingRef = useRef(false);
  const doFinalizeRef = useRef(null);

  const doFinalize = useCallback(async (res) => {
    if (finalizingRef.current) return;
    finalizingRef.current = true;

    const tableName = tables.find(t => t.id === res.tableId)?.name || res.tableId;
    const startTs = toMs(res.startedAt || res.createdAt);
    const duracionMinutos = Math.round((Date.now() - startTs) / 60000);

    notificarN8N({
      evento: 'reserva_finalizada',
      cliente_nombre: res.customerName,
      mesa: tableName,
      mesa_id: res.tableId,
      servicio: res.service,
      duracion_total_minutos: duracionMinutos,
    });

    try {
      if (res.tableId && res.service) {
        await deleteDoc(mesaReservadaRef(res.tableId, date, res.service)).catch(() => {});
      }
      await updateDoc(resDocRef(res.id), {
        liveState: 'finalizado',
        cleaningCompletedAt: new Date().toISOString(),
        leftAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      updateDoc(resDocRef(res.id), {
        stateLog: arrayUnion({ state: 'finalizado', at: new Date().toISOString() }),
      }).catch(() => {});

      await saveMetrics(res, tables);
    } catch (e) {
      console.warn('[CleaningTimer] Error al finalizar:', e);
    }

    finalizingRef.current = false;
  }, [date, tables]);

  doFinalizeRef.current = doFinalize;

  const startTimer = useCallback((res) => {
    if (timersRef.current[res.id]) return;

    const startedAt = toMs(res.cleaningStartedAt);
    const elapsed = Date.now() - startedAt;
    const remainingMs = CLEANING_DURATION_MS - elapsed;

    if (remainingMs <= 0) {
      doFinalizeRef.current(res);
      return;
    }

    const remainingSec = Math.ceil(remainingMs / 1000);

    const timerData = { remainingSec, intervalId: null, startedAt, res, expiresAt: startedAt + CLEANING_DURATION_MS };
    timersRef.current[res.id] = timerData;
    setDisplayTimers(prev => ({ ...prev, [res.tableId]: { remainingSec, progress: remainingMs / CLEANING_DURATION_MS, resId: res.id } }));

    timerData.intervalId = setInterval(() => {
      const t = timersRef.current[res.id];
      if (!t) { clearInterval(timerData.intervalId); return; }

      const now = Date.now();
      const newRemaining = t.expiresAt - now;

      if (newRemaining <= 0) {
        clearInterval(timerData.intervalId);
        delete timersRef.current[res.id];
        setDisplayTimers(prev => { const n = { ...prev }; delete n[res.tableId]; return n; });
        doFinalizeRef.current(res);
        return;
      }

      t.remainingSec = Math.ceil(newRemaining / 1000);
      setDisplayTimers(prev => ({
        ...prev,
        [res.tableId]: { remainingSec: t.remainingSec, progress: newRemaining / CLEANING_DURATION_MS, resId: res.id },
      }));
    }, 1000);
  }, []);

  const finishNow = useCallback((res) => {
    const timer = timersRef.current[res.id];
    if (timer) {
      clearInterval(timer.intervalId);
      delete timersRef.current[res.id];
      setDisplayTimers(prev => { const n = { ...prev }; delete n[res.tableId]; return n; });
    }
    doFinalizeRef.current(res);
  }, []);

  const extendCleaning = useCallback(async (res) => {
    const timer = timersRef.current[res.id];
    if (timer) {
      timer.expiresAt += EXTEND_MS;
      timer.remainingSec += 300;
      const newStartedAt = new Date(timer.expiresAt - CLEANING_DURATION_MS);
      await updateDoc(resDocRef(res.id), { cleaningStartedAt: newStartedAt.toISOString() }).catch(() => {});
      setDisplayTimers(prev => ({
        ...prev,
        [res.tableId]: { remainingSec: timer.remainingSec, progress: (timer.expiresAt - Date.now()) / CLEANING_DURATION_MS, resId: res.id },
      }));
    }
  }, []);

  const cancelCleaning = useCallback(async (res) => {
    const timer = timersRef.current[res.id];
    if (timer) {
      clearInterval(timer.intervalId);
      delete timersRef.current[res.id];
      setDisplayTimers(prev => { const n = { ...prev }; delete n[res.tableId]; return n; });
    }
    await updateDoc(resDocRef(res.id), {
      liveState: null,
      cleaningStartedAt: null,
      leftAt: null,
      updatedAt: serverTimestamp(),
    }).catch(() => {});
  }, []);

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
        setDisplayTimers(prev => { const n = { ...prev }; delete n[timer.res.tableId]; return n; });
      }
    }
  }, [reservations, startTimer]);

  useEffect(() => {
    return () => {
      for (const timer of Object.values(timersRef.current)) {
        clearInterval(timer.intervalId);
      }
      timersRef.current = {};
    };
  }, []);

  return { cleaningTimers: displayTimers, finishNow, extendCleaning, cancelCleaning };
}
