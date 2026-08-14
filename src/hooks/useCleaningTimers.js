import { useState, useEffect, useRef, useCallback } from 'react';
import { doc, updateDoc, arrayUnion, serverTimestamp, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { notificarN8N, computeStateDurations } from '../utils';

export const CLEANING_DURATION_MS = 5 * 60 * 1000;
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

// Countdown local por mesa: solo los componentes que lo necesitan
// (mesa en limpieza) hacen tick cada segundo, sin re-renderizar el resto.
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
  // Estado interno por reserva (no cambia por segundo)
  const timersRef = useRef({});
  // Solamente expiración por mesa: estable entre inicio/fin/extensión
  const [sharedTimers, setSharedTimers] = useState({});
  // Reservas en proceso de finalización: un Set por id permite que dos mesas
  // expiren en el mismo tick sin que una pierda su finalización (antes era un
  // boolean global y la segunda mesa quedaba "para_limpiar" para siempre).
  const finalizingRef = useRef(new Set());
  const doFinalizeRef = useRef(null);

  const doFinalize = useCallback(async (res) => {
    if (finalizingRef.current.has(res.id)) return;
    finalizingRef.current.add(res.id);

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
    } finally {
      finalizingRef.current.delete(res.id);
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

    // El intervalo solo existe para auto-finalizar al vencer: no toca estado
    // de React, así el plano no se re-renderiza cada segundo.
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
    doFinalizeRef.current(res);
  }, [removeShared]);

  const extendCleaning = useCallback(async (res) => {
    const timer = timersRef.current[res.id];
    if (timer) {
      timer.expiresAt += EXTEND_MS;
      const newStartedAt = new Date(timer.expiresAt - CLEANING_DURATION_MS);
      await updateDoc(resDocRef(res.id), { cleaningStartedAt: newStartedAt.toISOString() }).catch(() => {});
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
    await updateDoc(resDocRef(res.id), {
      liveState: null,
      cleaningStartedAt: null,
      leftAt: null,
      updatedAt: serverTimestamp(),
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