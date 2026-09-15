import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Plus, X } from 'lucide-react';
import {
  doc, setDoc, updateDoc,
  serverTimestamp, arrayUnion,
  collection, query, where, onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import api from '../services/api/client';
import { syncMesasWithConfig } from '../services/mesasHelpers';
import { seedDefaultResourcesForOrg } from '../services/resourceService';
import { saveOrganization } from '../services/organizationService';
import { createReservation, cancelReservation, rejectReservation } from '../services/reservationService';
import { checkResourceAvailability } from '../services/availabilityService';
import { useCleaningTimers } from '../hooks/useCleaningTimers';
import { useReservations, useAnalyticsReservations } from '../hooks/useReservations';
import { useConfig } from '../hooks/useConfig';
import { useMesas } from '../hooks/useMesas';
import { useStaff } from '../hooks/useStaff';
import { useOrganization } from '../hooks/useOrganization';
import { useMozoTableNumbers } from '../hooks/useMozoTableNumbers';
import { useSalonLayout } from '../hooks/useSalonLayout';
import { useBranches, resolveBranchId } from '../hooks/useBranches';
import ResourceMap from './resources/ResourceMap';
import ResourceEditor from './resources/ResourceEditor';
import LiveStateModal from './LiveStateModal';
import ResModal from './ResModal';
import SettingsModal from './SettingsModal';
import { AnalyticsPanel } from './AnalyticsPanel';
import { Stat } from './ui';
import { DashboardHeader } from './DashboardHeader';
import ReservationList from './ReservationList';
import StaffModal from './StaffModal';
import PedidosPanel from './PedidosPanel';
import ComandasPanel from './ComandasPanel';
import CartaManager from './CartaManager';
import { useCatalog } from '../hooks/useCatalog';
import {
  C, LIVE_STATES,
  t2m, genSlots, buildTables, todayISO,
  detectService, computeStateDurations,
  notificarN8N, servicesOf,
} from '../utils';
import { resourceLabelOf, resourcePluralOf, serviceLabelOf, featureEnabled, DEFAULT_ORG_ID } from '../config/businessTypes';

// ─── Firestore helpers ───────────────────────────────────────────────────────
const resDocRef = (id) => doc(db, 'reservations', id);
const mesaReservadaRef = (tableId, date, service) =>
  doc(db, 'mesasReservadas', `${tableId}_${date}_${service}`);
const cfgRef = () => doc(db, 'config', 'restaurant');

const FREE_TABLE_STATUS = { status: 'free' };

// ═══════════════════════════════════════════════════════════════════════════════
// StaffDashboard — Dashboard completo del negocio
// ═══════════════════════════════════════════════════════════════════════════════
export default function StaffDashboard({ onLogout, organizationId = DEFAULT_ORG_ID }) {
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(todayISO);
  const [service, setService] = useState(detectService);

  // Modales
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [preTable, setPreTable] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showLiveMenu, setShowLiveMenu] = useState(null); // reserva seleccionada para cambiar estado
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analyticsPeriod, setAnalyticsPeriod] = useState('day');
  const nowMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
  const [analyticsMonth, setAnalyticsMonth] = useState(nowMonth);
  const [mainTab, setMainTab] = useState('reservas');
  const [highlightTableId, setHighlightTableId] = useState(null);
  const [focusRequest, setFocusRequest] = useState(null);
  const highlightTimerRef = useRef(null);
  const [planoHover, setPlanoHover] = useState(false);
  const [editingLayout, setEditingLayout] = useState(false);
  const [optimisticStates, setOptimisticStates] = useState({});
  const [quickActionMenu, setQuickActionMenu] = useState(null);
  const [modalMode, setModalMode] = useState('reserva');
  const [showStaff, setShowStaff] = useState(false);
  const [showSectors, setShowSectors] = useState(false);
  const [showResources, setShowResources] = useState(false);
  const [showCarta, setShowCarta] = useState(false);
  const [selectedMozoTab, setSelectedMozoTab] = useState(null);
  const [showReservas, setShowReservas] = useState(true);
  const [editingSectors, setEditingSectors] = useState(false);
  const deferredPrompt = useRef(null);
  const [canInstall, setCanInstall] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const configLoaded = useRef(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const showToast = useCallback((msg, type = 'error') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  // ── Hooks de datos externos ────────────────────────────────────────────────
  const { config, sectors, setSectors, saveSectors } = useConfig();
  const [organization, updateOrganization] = useOrganization(organizationId, { ensure: organizationId === DEFAULT_ORG_ID });
  const isRestaurant = organization.businessType === 'restaurant';
  const hasOrdersFeature = featureEnabled(organization, 'orders');
  const resourceLabel = resourceLabelOf(organization);
  const resourcePlural = resourcePluralOf(organization);
  // Horarios efectivos de los turnos (configurables desde Configuración).
  const SVC = useMemo(() => servicesOf(organization), [organization]);
  const branches = useBranches(organizationId, { ensure: organizationId === DEFAULT_ORG_ID });
  const [branchIdState, setBranchIdState] = useState(null);
  const currentBranchId = resolveBranchId(branches, branchIdState);
  const mesas = useMesas(config, organization);
  const [staff, refetchStaff] = useStaff();
  const catalog = useCatalog();
  const { reservations, refetch: refetchReservations } = useReservations(date);
  const analyticsRes = useAnalyticsReservations(date, showAnalytics, analyticsPeriod, analyticsMonth);
  const [pedidoCount, setPedidoCount] = useState(0);

  useEffect(() => {
    const q = query(
      collection(db, 'pedidos'),
      where('date', '==', date),
      where('source', 'in', ['whatsapp_bot', 'cliente_web', 'staff']),
    );
    const unsub = onSnapshot(q, (snap) => setPedidoCount(snap.size), () => {});
    return unsub;
  }, [date]);

  const tables = useMemo(() => {
    const base = mesas.length > 0 ? mesas : (isRestaurant ? buildTables(config) : []);
    return base;
  }, [mesas, config, isRestaurant]);
  const slots = useMemo(() => genSlots(service, SVC), [service, SVC]);

  // Posiciones del salón: suscripción única compartida con SalonFloor
  const { positions, setPositions, groups, setGroups, saveLayout, groupOwners, saveGroupOwner } = useSalonLayout();

  // Números elegidos por cada mozo mapeados a las mesas físicas de su sector.
  const { tableNumByTable, ownerByTable, mozoTableIds } = useMozoTableNumbers(tables, staff, sectors, positions);

  // Grupos de mesas unidas: número único para todas sus mesas y el mozo
  // elegido cuando el grupo cruza sectores.
  const { groupNumByTable, groupOwnerByTable } = useMemo(() => {
    const nums = {};
    const owners = {};
    for (const g of groups || []) {
      const key = [...g].sort().join('|');
      const chosen = (groupOwners && groupOwners[key]) || null;
      let num = '';
      if (chosen) {
        for (const id of g) {
          if (ownerByTable[id] === chosen && tableNumByTable[id]) {
            num = tableNumByTable[id];
            break;
          }
        }
      }
      if (!num) num = g.map(id => tableNumByTable[id]).find(n => n && n !== '') || '';
      for (const id of g) {
        if (num) nums[id] = num;
        if (chosen) owners[id] = chosen;
      }
    }
    return { groupNumByTable: nums, groupOwnerByTable: owners };
  }, [groups, groupOwners, ownerByTable, tableNumByTable]);

  // Números visibles por recurso: mozo + grupo (usado por ResModal y toasts).
  const resourceNums = useMemo(
    () => ({ ...tableNumByTable, ...groupNumByTable }),
    [tableNumByTable, groupNumByTable]
  );

  // ── Loading state ──────────────────────────────────────────────────────────
  useEffect(() => {
    // config arranca en null: sin la guarda `config`, el null !== DEFAULT_CONFIG
    // cortaba el loading en el primer render (antes de que llegara la config).
    if (!configLoaded.current && config) {
      configLoaded.current = true;
      setLoading(false);
    }
    const timer = setTimeout(() => {
      setLoading(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, [config]);

  // ── Capturar prompt de instalación PWA ──────────────────────────────────
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); deferredPrompt.current = e; setCanInstall(true); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (deferredPrompt.current) {
      deferredPrompt.current.prompt();
      const { outcome } = await deferredPrompt.current.userChoice;
      if (outcome === 'accepted') setCanInstall(false);
      deferredPrompt.current = null;
    } else {
      setShowInstallGuide(true);
    }
  }, []);

  // ── Persistir configuración ────────────────────────────────────────────────────────
  const saveConfig = useCallback(async (c) => {
    try {
      // merge: true preserva los campos que no se tocan (p. ej. sectors):
      // NO se incluye `sectors` acá para no pisarlo con un valor desactualizado.
      await setDoc(cfgRef(), { mesaTipos: c }, { merge: true });
      await syncMesasWithConfig(c);
    } catch (e) { console.error(e); }
  }, []);

  // ── Guardar organización (tipo de negocio + labels + días cerrados) ────
  const saveOrg = useCallback(async (nextOrg) => {
    const prevKey = `${organization.businessType}|${organization.configuration?.resourceLabel}|${organization.configuration?.resourcePlural}`;
    const nextKey = `${nextOrg.businessType}|${nextOrg.configuration?.resourceLabel}|${nextOrg.configuration?.resourcePlural}`;
    const rubroChanged = prevKey !== nextKey;

    updateOrganization(nextOrg);
    await saveOrganization(nextOrg);

    if (!rubroChanged) return;

    if (nextOrg.businessType === 'restaurant') {
      if (config) await syncMesasWithConfig(config).catch((e) => console.warn('[PuntoVectra] Error re-sincronizando mesas:', e));
    } else {
      await seedDefaultResourcesForOrg(nextOrg)
        .catch((e) => console.warn('[PuntoVectra] Error sembrando recursos:', e));
    }
  }, [config, organization, updateOrganization]);

  const saveSectorsFromPlano = useCallback(async (updatedSectors) => {
    setSectors(updatedSectors);
    await setDoc(cfgRef(), { sectors: updatedSectors }, { merge: true });
  }, [setSectors]);

  const saveSectorsFromModal = useCallback(async (updatedSectors) => {
    setSectors(updatedSectors);
    await setDoc(cfgRef(), { sectors: updatedSectors }, { merge: true });
  }, [setSectors]);

  // ── CRUD de reservas ───────────────────────────────────────────────────────
  const saveRes = useCallback(async (data) => {
    const resourceId = data.tableId || data.resourceId || null;
    const resourceNum = resourceId ? (groupNumByTable[resourceId] || tableNumByTable[resourceId]) : null;

    await createReservation({
      data,
      date,
      resourceLabel,
      resourceName: resourceNum,
      organizationId: organization.id,
      branchId: currentBranchId,
      existingReservations: reservations,
    });

    notificarN8N({
      evento: 'solicitud_confirmada',
      document_id: data.id || 'new',
      tipo: 'reserva',
    });
  }, [date, tableNumByTable, groupNumByTable, reservations, organization, resourceLabel, currentBranchId]);

  const deleteRes = useCallback(async (resData) => {
    await cancelReservation(resData, date);
  }, [date]);

  const rejectRes = useCallback(async (resData, motivo) => {
    await rejectReservation(resData, motivo, date);
    refetchReservations();
    notificarN8N({
      evento: 'solicitud_rechazada',
      document_id: resData.id,
      tipo: 'reserva',
      motivo: motivo.trim(),
    });
  }, [date, refetchReservations]);

  // ── Actualizar solo el estado en vivo de una reserva ──────────────────────
  const updateLiveState = useCallback(async (res, liveState) => {
    setShowLiveMenu(null);
    setOptimisticStates(prev => ({ ...prev, [res.id]: liveState }));
    const patch = {
      liveState,
      stateLog: [...(res.stateLog || []), { state: liveState, at: new Date().toISOString() }],
    };
    if (liveState === 'esperando_cliente' && !res.startedAt) patch.startedAt = new Date().toISOString();
    if (liveState === 'para_limpiar') {
      patch.leftAt = new Date().toISOString();
      patch.cleaningStartedAt = new Date().toISOString();
    }
    try {
      await api.put(`/reservations/${res.id}`, patch);
    } catch (e) {
      console.warn('[PuntoVectra] Fallo actualizando liveState, revirtiendo...', e);
    } finally {
      refetchReservations();
      setOptimisticStates(prev => { const n = { ...prev }; delete n[res.id]; return n; });
    }
  }, [refetchReservations]);

  // ── Limpiar mesa: borra la reserva ────────────────────────────────────
  const resetLiveState = useCallback(async (res) => {
    setShowLiveMenu(null);
    setOptimisticStates(prev => ({ ...prev, [res.id]: null }));
    try {
      await api.delete(`/reservations/${res.id}`);
      refetchReservations();
    } catch (e) {
      console.warn('[PuntoVectra] Fallo al borrar reserva, revirtiendo...', e);
      refetchReservations();
    } finally {
      setOptimisticStates(prev => { const n = { ...prev }; delete n[res.id]; return n; });
    }
  }, [refetchReservations]);

  // ── Cálculos ───────────────────────────────────────────────────────────────
  const svcRes = useMemo(() =>
    reservations
      .map(r => optimisticStates[r.id] !== undefined ? { ...r, liveState: optimisticStates[r.id] } : r)
      .filter(r => r.service === service)
      .filter(r => r.liveState !== 'finalizado')
      // Sucursal: docs legacy sin branchId se consideran de la principal.
      .filter(r => (r.branchId || 'main') === currentBranchId),
    [reservations, optimisticStates, service, currentBranchId]
  );

  // Estado por mesa pre-calculado: lookup O(1) y referencialmente estable.
  // statusByTable solo se reconstruye cuando cambian las reservas del servicio,
  // así el plano no se re-renderiza con cada tick de reloj o estado de UI.
  const statusByTable = useMemo(() => {
    const byId = new Map();
    for (const r of svcRes) {
      // Sin mesa asignada no aparece en el mapa.
      const key = r.tableId || r.resourceId;
      if (!key) continue;
      const arr = byId.get(key);
      if (arr) arr.push(r);
      else byId.set(key, [r]);
    }
    const out = new Map();
    for (const [id, tableRes] of byId) {
      const cleaning = tableRes.find(r => r.liveState === 'para_limpiar');
      if (cleaning) { out.set(id, { status: 'soon', res: cleaning }); continue; }
      const active = tableRes.find(r => r.liveState && r.liveState !== 'para_limpiar');
      if (active) { out.set(id, { status: 'busy', res: active }); continue; }
      const pending = tableRes.find(r => !r.liveState);
      if (pending) { out.set(id, { status: 'reserved', res: pending }); continue; }
      out.set(id, FREE_TABLE_STATUS);
    }
    return out;
  }, [svcRes]);

  const tableStatus = useCallback(
    (id) => statusByTable.get(id) || FREE_TABLE_STATUS,
    [statusByTable]
  );

  const stats = useMemo(() => {
    let free = 0, busy = 0, soon = 0, reserved = 0, seatsBusy = 0;
    tables.forEach(t => {
      const s = tableStatus(t.id);
      if (s.status === 'free') free++;
      else if (s.status === 'reserved') reserved++;
      else if (s.status === 'busy') { busy++; seatsBusy += (s.res.partySize || 0); }
      else soon++;
    });
    return { free, busy, soon, reserved, seatsBusy };
  }, [tables, tableStatus]);

  // ── Cleaning Timers ──────────────────────────────────────────────────────────
  const { cleaningTimers, finishNow, extendCleaning, cancelCleaning } = useCleaningTimers(reservations, date, tables);

  // ── Finalizar reserva desde el menú rápido ─────────────────────────────
  // Delega en doFinalize (useCleaningTimers) para tener UNA sola implementación:
  // notificación a n8n, liberación de mesa, métricas y stateLog consistentes.
  const handleFinalizeQuick = useCallback((res) => {
    setQuickActionMenu(null);
    setShowLiveMenu(null);
    setOptimisticStates(prev => ({ ...prev, [res.id]: 'finalizada' }));
    Promise.resolve(finishNow(res))
      .catch(() => {})
      .finally(() => {
        setOptimisticStates(prev => { const n = { ...prev }; delete n[res.id]; return n; });
      });
  }, [finishNow]);

  const analyticsData = useMemo(() => {
    const src = analyticsPeriod === 'day' ? reservations : analyticsRes;

    const toMin = (ts) => {
      if (!ts) return null;
      if (typeof ts === 'number') return ts > 1e6 ? ts / 60000 : ts;
      if (ts.seconds != null) return ts.seconds / 60 + (ts.nanoseconds || 0) / 6e10;
      if (ts.toDate) return ts.toDate().getTime() / 60000;
      const d = new Date(ts);
      return isNaN(d.getTime()) ? null : d.getTime() / 60000;
    };

    const active = src.filter(r => r.startedAt || r.liveState);

    const stays = active.map(r => {
      const start = toMin(r.startedAt) || t2m(r.time, r.service);
      if (start == null) return null;
      const end = r.leftAt ? toMin(r.leftAt) : null;
      const stayMin = end != null ? Math.round(end - start) : null;
      return { ...r, stayMin };
    }).filter(Boolean);

    const withDuration = stays.filter(r => r.stayMin != null && r.stayMin >= 0 && r.stayMin <= 600);
    const totalCustomers = src.reduce((s, r) => s + (r.partySize || 0), 0);
    const avgStay = withDuration.length > 0
      ? Math.round(withDuration.reduce((s, r) => s + r.stayMin, 0) / withDuration.length)
      : 0;

    // ── stateLog breakdown by partySize ──
    const byPs = {};
    for (const r of src) {
      if (!r.stateLog || !Array.isArray(r.stateLog) || r.stateLog.length < 2) continue;
      const durations = computeStateDurations(r.stateLog);
      if (durations.length === 0) continue;
      const ps = r.partySize || 0;
      if (!byPs[ps]) byPs[ps] = {};
      for (const d of durations) {
        if (!byPs[ps][d.state]) byPs[ps][d.state] = [];
        byPs[ps][d.state].push(d.durationMin);
      }
    }
    const stateBreakdown = {};
    for (const [ps, states] of Object.entries(byPs)) {
      stateBreakdown[ps] = {};
      for (const [state, durs] of Object.entries(states)) {
        stateBreakdown[ps][state] = {
          avg: Math.round(durs.reduce((a, b) => a + b, 0) / durs.length),
          count: durs.length,
        };
      }
    }

    // ── Tendencia mensual: clientes por mes (últimos 12 meses) ──
    const monthlyTrend = {};
    for (const r of src) {
      if (!r.date) continue;
      const month = r.date.slice(0, 7); // "YYYY-MM"
      if (!monthlyTrend[month]) monthlyTrend[month] = 0;
      monthlyTrend[month] += (r.partySize || 0);
    }

    return { totalCustomers, avgStay, stateBreakdown, monthlyTrend };
  }, [reservations, analyticsRes, analyticsPeriod]);

  const sortedRes = useMemo(() =>
    [...svcRes].sort((a, b) => {
      // Sin mesa primero
      if (!a.mesa_id && b.mesa_id) return -1;
      if (a.mesa_id && !b.mesa_id) return 1;
      return t2m(a.time, a.service) - t2m(b.time, b.service);
    }),
    [svcRes]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSave = useCallback(async (data) => {
    // Validar estado de la mesa antes de guardar
    const s = tableStatus(data.tableId);
    // La reserva que se edita puede no traer tableId (el backend guarda
    // resourceId): comparar ids efectivos para no bloquear la propia mesa.
    const editingTableId = editing && (editing.tableId || editing.resourceId || editing.mesaId || editing.mesa_id);
    const isCurrentRes = editing && editingTableId && editingTableId === data.tableId;
    const isAllowed = s.status === 'free' || s.status === 'soon' || isCurrentRes;

    if (!isAllowed) {
      const stateLabel = s.status === 'busy' ? 'Ocupada' : 'Reservada';
      showToast(`El ${resourceLabel.toLowerCase()} no se puede reservar porque su estado actual es "${stateLabel}". Solo se pueden reservar ${resourcePlural.toLowerCase()} que estén libres o en estado "A limpiar".`);
      return;
    }

    const saveData = {
      ...data,
      id: editing ? editing.id : data.id,
      resourceId: data.tableId || data.resourceId || null,
      duration: data.duration || SVC[data.service || service].defaultDuration,
      service: data.service || service,
      date,
    };
    if (editing) {
      saveData._oldMesaRef = mesaReservadaRef(editing.tableId, date, editing.service);
    }

    // Si el recurso está "A limpiar", pasar la reserva anterior para eliminarla en la misma transacción
    if (!editing && s.status === 'soon' && s.res) {
      saveData._prevResId = s.res.id;
      saveData._prevMesaRef = mesaReservadaRef(s.res.tableId || s.res.resourceId, date, s.res.service);
    }

    try {
      await saveRes(saveData);
      setShowModal(false); setEditing(null); setPreTable(null);
      // Si la reserva cayó en otro turno (por la hora elegida), saltar a esa
      // solapa para que se vea al instante en el plano y en pendientes.
      if (saveData.service && saveData.service !== service) setService(saveData.service);
      refetchReservations();
    } catch (e) {
      if (e.code === 'RESOURCE_UNAVAILABLE') {
        showToast(`⚠️ Este ${resourceLabel.toLowerCase()} acaba de ser reservado por otro cliente. Por favor seleccioná otra opción disponible.`);
        return;
      }
      if (e.code === 'TIME_CONFLICT' || e.code === 'RESERVATION_CONFLICT') {
        showToast(`⚠️ Ese horario ya está ocupado en la ${resourceLabel.toLowerCase()} elegida. Probá otro horario o elegí otra ${resourceLabel.toLowerCase()}.`);
        return;
      }
      showToast(e.message || 'Error al guardar la reserva. Intentá de nuevo.');
    }
  }, [saveRes, service, setService, SVC, date, editing, tableStatus, showToast, resourceLabel, resourcePlural, tables, reservations, resourceNums, refetchReservations]);

  const handleDelete = useCallback(async (resData) => {
    try {
      await deleteRes(resData);
      setShowModal(false); setEditing(null);
      refetchReservations();
    } catch {
      showToast('Error al eliminar la reserva. Intentá de nuevo.');
    }
  }, [deleteRes, showToast, refetchReservations]);

  const handleSavePlates = useCallback(async (resId, plates) => {
    try {
      await api.put(`/reservations/${resId}`, { plates });
      refetchReservations();
    } catch (e) {
      console.warn('[StaffDashboard] Error guardando comanda:', e);
    }
  }, [refetchReservations]);

  // Botón "Plano" en la tarjeta: ir al plano y resaltar la mesa de la reserva.
  // El highlight + banner expiran a los 5s; el foco se re-arma con cada click
  // (key nueva) para que se pueda repetir las veces que se quiera.
  const handleGoToTable = useCallback((r) => {
    // Solo ids reales de mesa: el string `mesa` es solo display y no matchea.
    const tableId = r?.tableId || r?.resourceId || r?.mesa_id || r?.mesaId;
    if (!tableId) {
      showToast('Esta reserva no tiene mesa asignada.');
      return;
    }
    setPlanoHover(false);
    setMainTab('plano');
    setHighlightTableId(tableId);
    setFocusRequest({ tableId, key: Date.now() });
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightTableId(null), 5000);
  }, [showToast]);

  // ── CRUD de pedidos (staff) ────────────────────────────────────────────────
  const savePedido = useCallback(async (data) => {
    const id = `p${Date.now()}`;
    try {
      await setDoc(doc(db, 'pedidos', id), {
        id,
        organizationId: organization.id,
        branchId: currentBranchId,
        customerName: data.customerName.trim(),
        customerPhone: data.phone.trim(),
        modalidad: data.modalidad,
        direccion: data.modalidad === 'envio' ? data.direccion.trim() : '',
        notes: data.details.trim(),
        tipo: 'pedido',
        source: 'staff',
        pedidoEstado: 'pendiente',
        estado: 'pendiente',
        service,
        date,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
      setShowModal(false); setEditing(null); setPreTable(null);
      showToast('Pedido guardado.');
    } catch {
      showToast('Error al guardar el pedido. Intentá de nuevo.');
    }
  }, [service, date, setShowModal, setEditing, setPreTable, showToast, organization, currentBranchId]);

  // ── Callbacks estables para el plano (mantienen efectivo el React.memo) ────
  // Modos de edición mutuamente excluyentes: editar mesas y sectores a la vez
  // dejaba las mesas sin pointerEvents y los gestos en un estado raro.
  const toggleEditingLayout = useCallback(() => {
    setEditingLayout(v => !v);
    setEditingSectors(false);
  }, []);
  const toggleEditingSectors = useCallback(() => {
    setEditingSectors(v => !v);
    setEditingLayout(false);
  }, []);
  const handleTableClick = useCallback((t, s) => {
    if (editingSectors) return;
    if (s.status === 'free') {
      setModalMode('reserva'); setPreTable(t); setEditing(null); setShowModal(true);
    } else if (isRestaurant) {
      // Restaurante: máquina de estados en vivo del mozo.
      setShowLiveMenu(s.res);
    } else {
      // Otros rubros: abrir la reserva para editarla/cancelarla.
      setModalMode('reserva'); setEditing(s.res); setPreTable(null); setShowModal(true);
    }
  }, [editingSectors, isRestaurant]);

  // ─── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.cream, fontFamily: '"Manrope", system-ui, sans-serif' }}>
        {/* Header skeleton */}
        <div style={{ background: C.forest, padding: '24px 20px 28px', borderBottomLeftRadius: '28px', borderBottomRightRadius: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <div className="skeleton" style={{ width: '70px', height: '10px', marginBottom: '8px', opacity: 0.4 }} />
              <div className="skeleton" style={{ width: '80px', height: '30px', opacity: 0.4 }} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ width: '38px', height: '38px', borderRadius: '12px', opacity: 0.3 }} />)}
            </div>
          </div>
          <div className="skeleton" style={{ width: '100%', height: '44px', borderRadius: '12px', opacity: 0.35 }} />
        </div>
        {/* Service tabs skeleton */}
        <div style={{ padding: '20px 16px 8px', display: 'flex', gap: '8px' }}>
          {[1,2].map(i => <div key={i} className="skeleton" style={{ flex: 1, height: '56px', borderRadius: '14px' }} />)}
        </div>
        {/* Stats skeleton */}
        <div style={{ padding: '0 16px 16px', display: 'flex', gap: '8px' }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ flex: 1, height: '52px', borderRadius: '12px' }} />)}
        </div>
        {/* Tabs skeleton */}
        <div style={{ padding: '0 16px', display: 'flex', gap: '4px', marginBottom: '12px' }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ flex: 1, height: '52px', borderRadius: '12px' }} />)}
        </div>
        {/* Table grid skeleton */}
        <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: '6px' }}>
          {Array.from({ length: 12 }).map((_, i) => <div key={i} className="skeleton" style={{ aspectRatio: '1', borderRadius: '10px' }} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="main-container" style={{ minHeight: '100vh', background: C.cream, color: C.espresso, fontFamily: '"Manrope", system-ui, sans-serif' }}>
      {/* ── TOAST ── */}
      {toast && (
        <div style={{
          position: 'fixed', top: '16px', left: '16px', right: '16px', zIndex: 9999,
          background: toast.type === 'error' ? '#fef2f2' : toast.type === 'success' ? '#f0fdf4' : '#fffbeb',
          border: `1px solid ${toast.type === 'error' ? C.terraSoft : toast.type === 'success' ? C.free : C.soon}`,
          borderRadius: '14px', padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: '10px',
          fontSize: '13px', color: C.espresso, fontWeight: 500,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          animation: 'modalIn 0.25s ease-out',
        }}>
          <span style={{ flex: 1 }}>{toast.msg}</span>
          <button onClick={() => setToast(null)} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: '4px',
          }}><X size={16} /></button>
        </div>
      )}

      {/* ── HEADER ── */}
      <DashboardHeader
        canInstall={canInstall}
        handleInstall={handleInstall}
        date={date}
        setDate={setDate}
        setShowAnalytics={setShowAnalytics}
        setShowSettings={setShowSettings}
        setShowStaff={setShowStaff}
        setShowResources={setShowResources}
        setShowCarta={setShowCarta}
        orgName={organization.name || 'PuntoVectra'}
        isRestaurant={isRestaurant}
        onLogout={onLogout}
      />

      {/* ── SELECTOR DE SUCURSAL (solo si hay más de una) ── */}
      {branches.length > 1 && (
        <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: C.muted, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Sucursal
          </span>
          <select
            value={currentBranchId}
            onChange={e => setBranchIdState(e.target.value)}
            style={{
              flex: 1, padding: '8px 10px', fontSize: '13px', borderRadius: '10px',
              border: `1.5px solid ${C.creamDeep}`, background: C.white, color: C.espresso,
              fontFamily: 'inherit',
            }}
          >
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* ── SELECTOR DE SERVICIO / TURNO ── */}
      <div style={{ padding: '20px 16px 8px', display: 'flex', gap: '8px' }}>
        {Object.entries(SVC).map(([k, s]) => {
          const Icon = s.icon;
          const active = service === k;
          return (
            <button key={k} onClick={() => setService(k)} style={{
              flex: 1, padding: '14px 8px',
              background: active ? C.forest : 'transparent',
              color: active ? C.cream : C.forest,
              border: `1.5px solid ${C.forest}`,
              borderRadius: '14px', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
              transition: 'all 0.2s ease',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 600 }}>
                <Icon size={14} />{serviceLabelOf(organization, k)}
              </div>
              <span style={{ fontSize: '10px', opacity: 0.7 }}>{s.start} — {s.end}</span>
            </button>
          );
        })}
      </div>

      {/* ── STATS ── */}
      <div style={{ padding: '0 16px 16px', display: 'flex', gap: '8px' }}>
        <Stat color={C.free} label="Libres" value={stats.free} />
        <Stat color={C.terra} label={isRestaurant ? 'Ocupadas' : 'Ocupados'} value={stats.busy} />
        <Stat color={C.forestSoft} label={isRestaurant ? 'Próximas' : 'Próximos'} value={stats.reserved} />
        <Stat color={C.soon} label="A limpiar" value={stats.soon} />
        {hasOrdersFeature && <Stat color={C.forest} label="Pedidos" value={pedidoCount} />}
      </div>

      {/* ── TABS: RESERVAS / PLANO / PEDIDOS (solo restaurante) ── */}
      <div className="desktop-tabs" style={{ padding: '0 16px', display: 'flex', gap: '4px', marginBottom: '12px' }}>
        {[
          ['reservas', isRestaurant ? 'Mozos' : 'Reservas', ''],
          ['plano', 'Plano', ''],
          ...(hasOrdersFeature ? [['comandas', 'Comandas', ''], ['pedidos', 'Pedidos', '']] : []),
        ].map(([key, label, sub]) => (
          <button key={key} onClick={() => { setMainTab(key); setPlanoHover(false); }} style={{
            flex: 1, padding: '10px 12px', borderRadius: '12px', border: 'none', cursor: 'pointer',
            background: mainTab === key ? C.forest : C.creamDeep,
            color: mainTab === key ? C.cream : C.muted,
            fontFamily: 'inherit', textAlign: 'left',
          }}>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '1px' }}>{sub}</div>
          </button>
        ))}
      </div>

      {/* ── RESERVAS: lista de mozos + reservas (o lista genérica) ── */}
      {mainTab === 'reservas' && (() => {
        if (!isRestaurant) {
          // Rubros sin mozos: pendientes + confirmadas del turno.
          const pending = sortedRes.filter(r => !(r.tableId || r.resourceId) && r.estado === 'pendiente');
          const confirmed = sortedRes.filter(r => (r.tableId || r.resourceId) && r.estado !== 'cancelado');
          return (
            <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: C.forest }}>
                Reservas pendientes <span style={{ color: C.muted, fontWeight: 600 }}>({pending.length})</span>
              </div>
              {pending.length > 0 ? (
                <ReservationList
                  sortedRes={pending}
                  tables={tables}
                  onEdit={(r) => { setModalMode('reserva'); setEditing(r); setShowModal(true); }}
                  onAction={(r) => { setModalMode('reserva'); setEditing(r); setShowModal(true); }}
                  onGoToTable={handleGoToTable}
                  onReject={rejectRes}
                />
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', color: C.muted, fontSize: '13px', background: C.creamDeep, borderRadius: '12px' }}>
                  No hay reservas pendientes
                </div>
              )}
              <div style={{ fontSize: '15px', fontWeight: 700, color: C.forest, marginTop: '8px' }}>
                Confirmadas <span style={{ color: C.muted, fontWeight: 600 }}>({confirmed.length})</span>
              </div>
              {confirmed.length > 0 ? (
                <ReservationList
                  sortedRes={confirmed}
                  tables={tables}
                  onEdit={(r) => { setModalMode('reserva'); setEditing(r); setShowModal(true); }}
                  onAction={(r) => { setModalMode('reserva'); setEditing(r); setShowModal(true); }}
                  onGoToTable={handleGoToTable}
                  onReject={rejectRes}
                />
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', color: C.muted, fontSize: '13px', background: C.creamDeep, borderRadius: '12px' }}>
                  Sin reservas confirmadas en este turno
                </div>
              )}
            </div>
          );
        }

        const activeStaff = (staff || []).filter(s => s && s.active !== false);
        const selected = activeStaff.find(s => s.id === selectedMozoTab) || null;
        // Reservas por mozo (por nombre, como se guarda en la reserva).
        const mozoSvcRes = (s) => svcRes.filter(r => r.staffName === s.name);
        // La lista general muestra solo reservas PENDIENTES sin mozo asignado:
        // las que ya tienen mozo viven en el bloque de ese mozo.
        const unassignedRes = sortedRes.filter(r => !r.staffName && r.estado === 'pendiente');

        const handleMozoTap = (s) => {
          setSelectedMozoTab(prev => (prev === s.id ? '__todas__' : s.id));
        };

        return (
          <div style={{ padding: '0 16px 24px' }}>
            {/* Lista de mozos: un toque abre sus mesas, otro toque las cierra */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '4px' }}>
              {/* Acordeón de reservas */}
              <button onClick={() => setShowReservas(!showReservas)} style={{
                width: '100%', padding: '12px 14px', borderRadius: '14px', border: 'none',
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: showReservas ? C.forest : C.creamDeep,
                color: showReservas ? C.cream : C.espresso,
              }}>
                <div style={{ fontSize: '15px', fontWeight: 700 }}>Reservas pendientes</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    background: showReservas ? C.cream : C.forestSoft,
                    color: showReservas ? C.forest : C.cream,
                    padding: '4px 10px', borderRadius: '8px',
                    fontSize: '12px', fontWeight: 700,
                  }}>
                    {unassignedRes.length}
                  </div>
                  <div style={{
                    width: '24px', height: '24px', borderRadius: '50%',
                    background: showReservas ? C.cream : C.forestSoft,
                    color: showReservas ? C.forest : C.cream,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '10px', fontWeight: 700,
                    transform: showReservas ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s',
                  }}>▼</div>
                </div>
              </button>

              {showReservas && (
                unassignedRes.length > 0 ? (
                  <ReservationList
                    sortedRes={unassignedRes}
                    tables={tables}
                    onEdit={(r) => { setModalMode('reserva'); setEditing(r); setShowModal(true); }}
                    onAction={(r) => setShowLiveMenu(r)}
                    onGoToTable={handleGoToTable}
                    onReject={rejectRes}
                  />
                ) : (
                  <div style={{ padding: '20px', textAlign: 'center', color: C.muted, fontSize: '13px', background: C.creamDeep, borderRadius: '12px' }}>
                    No hay reservas pendientes sin mozo asignado
                  </div>
                )
              )}

              {/* Mozos */}
              {activeStaff.map(s => {
                const count = svcRes.filter(r => r.staffName === s.name).length;
                const expanded = selected && selected.id === s.id;
                return (
                  <div key={s.id}>
                    <button onClick={() => handleMozoTap(s)} style={{
                      width: '100%', padding: '12px 14px', borderRadius: expanded ? '14px 14px 0 0' : '14px',
                      border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                      display: 'flex', alignItems: 'center', gap: '12px',
                      background: expanded ? C.forest : C.creamDeep,
                      color: expanded ? C.cream : C.espresso,
                    }}>
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '50%',
                        background: expanded ? C.cream : C.forest,
                        color: expanded ? C.forest : C.cream,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '14px', fontWeight: 700, flexShrink: 0,
                      }}>
                        {s.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: 600 }}>{s.name}</div>
                        <div style={{ fontSize: '11px', opacity: 0.75 }}>
                          {count > 0 ? `${count} reserva${count !== 1 ? 's' : ''}` : 'Sin reservas'}
                        </div>
                      </div>
                      {count > 0 && (
                        <div style={{
                          flexShrink: 0, minWidth: '40px', textAlign: 'center',
                          background: expanded ? 'rgba(255,255,255,0.2)' : C.forest,
                          color: expanded ? C.cream : C.cream,
                          padding: '6px 10px', borderRadius: '10px',
                          fontSize: '18px', fontWeight: 800, fontFamily: '"Fraunces", serif',
                          boxShadow: !expanded ? `0 3px 10px rgba(31,58,46,0.25)` : 'none',
                          lineHeight: 1,
                        }}>
                          {count}
                        </div>
                      )}
                      <div style={{
                        width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                        background: expanded ? C.cream : C.forestSoft,
                        color: expanded ? C.forest : C.cream,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '10px', fontWeight: 700,
                        transform: expanded ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.2s',
                      }}>▼</div>
                    </button>

                    {/* Reservas del mozo (desplegadas con un solo toque) */}
                    {expanded && (
                      <div style={{ padding: '12px', background: C.creamDeep, borderRadius: '0 0 14px 14px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: C.forest, marginBottom: '8px' }}>
                          Reservas de {s.name} ({count})
                        </div>

                        {/* Reservas del mozo dentro de su bloque */}
                        {mozoSvcRes(s).length > 0 ? (
                          <div style={{ marginTop: '12px', background: C.white, borderRadius: '12px', padding: '10px' }}>
                            <ReservationList
                              sortedRes={mozoSvcRes(s)}
                              tables={tables}
                              onEdit={(r) => { setModalMode('reserva'); setEditing(r); setShowModal(true); }}
                              onAction={(r) => setShowLiveMenu(r)}
                              onGoToTable={handleGoToTable}
                              onPlanoHover={setPlanoHover}
                              onReject={rejectRes}
                            />
                          </div>
                        ) : (
                          <div style={{ marginTop: '12px', padding: '10px', textAlign: 'center', color: C.muted, fontSize: '12px', background: C.white, borderRadius: '10px' }}>
                            Sin reservas para este mozo
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Reservas del mozo seleccionado (bloque colapsado: ayuda rápidamente) */}
            {selected && !mozoSvcRes(selected).length && (
              <div style={{ padding: '20px', textAlign: 'center', color: C.muted, fontSize: '13px', background: C.creamDeep, borderRadius: '12px', marginTop: '8px' }}>
                {selected.name} no tiene reservas en este servicio
              </div>
            )}
          </div>
        );
      })()}

      {/* ── PLANO DEL SALON ── */}
      {mainTab === 'plano' && (
        <ResourceMap
          organization={organization}
          tables={tables}
          tableStatus={tableStatus}
          cleaningTimers={cleaningTimers}
          tableNums={tableNumByTable}
          positions={positions}
          setPositions={setPositions}
          groups={groups}
          setGroups={setGroups}
          saveLayout={saveLayout}
          isEditing={editingLayout}
          onToggleEdit={toggleEditingLayout}
          sectors={sectors}
          isEditingSectors={editingSectors}
          onToggleEditSectors={toggleEditingSectors}
          onSaveSectors={saveSectorsFromPlano}
          onTableClick={handleTableClick}
          highlightTableId={highlightTableId}
          focusRequest={focusRequest}
          ownerByTable={ownerByTable}
          staff={staff}
          groupOwners={groupOwners}
          onChooseGroupOwner={saveGroupOwner}
          onSaveError={showToast}
        />
      )}

      {/* ── PEDIDOS ── */}
      {mainTab === 'pedidos' && (
        <PedidosPanel date={date} service={service} />
      )}

      {/* ── COMANDAS ── */}
      {mainTab === 'comandas' && (
        <ComandasPanel
          reservations={svcRes}
          tables={tables}
          catalog={catalog}
          onSavePlates={handleSavePlates}
        />
      )}

      {/* ── FAB: Nueva reserva / pedido según el panel activo ── */}
      <button onClick={() => {
        setEditing(null); setPreTable(null);
        setModalMode(hasOrdersFeature && mainTab === 'pedidos' ? 'pedido' : 'reserva');
        setShowModal(true);
      }} style={{
        position: 'fixed', bottom: 'calc(84px + env(safe-area-inset-bottom, 0px))', right: '24px',
        width: '60px', height: '60px', borderRadius: '30px',
        background: C.terra, color: '#fff', border: 'none',
        boxShadow: '0 8px 24px rgba(0,134,201,0.4)', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        opacity: planoHover ? 0.08 : 1,
        pointerEvents: planoHover ? 'none' : 'auto',
        transition: 'opacity 0.15s ease',
      }}>
        <Plus size={26} />
      </button>

      {/* ── BOTTOM NAV (móvil) ── */}
      <div className="mobile-bottom-nav" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: C.cream, borderTop: `1px solid ${C.creamDeep}`,
        padding: '10px 16px calc(12px + env(safe-area-inset-bottom, 0px))',
        display: 'flex', gap: '8px', zIndex: 200,
        boxShadow: '0 -4px 12px rgba(0,0,0,0.08)',
      }}>
        {[
          ['reservas', isRestaurant ? 'Mozos' : 'Reservas', ''],
          ['plano', 'Plano', ''],
          ...(hasOrdersFeature ? [['comandas', 'Comandas', ''], ['pedidos', 'Pedidos', '']] : []),
        ].map(([key, label, count]) => (
          <button key={key} onClick={() => { setMainTab(key); setPlanoHover(false); }} style={{
            flex: 1, padding: '10px 8px', borderRadius: '12px', border: 'none', cursor: 'pointer',
            background: mainTab === key ? C.forest : 'transparent',
            color: mainTab === key ? C.cream : C.muted,
            fontFamily: 'inherit', textAlign: 'center',
            transition: 'all 0.2s ease',
          }}>
            <div style={{ fontSize: '13px', fontWeight: 600 }}>{label}</div>
            {count && <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '2px' }}>{count}</div>}
          </button>
        ))}
      </div>

      {/* ── MODAL: Estado en vivo ── */}
      {showLiveMenu && (
        <LiveStateModal
          res={showLiveMenu}
          tables={tables}
          cleaningTimer={cleaningTimers[showLiveMenu.tableId || showLiveMenu.resourceId] || null}
          onSelect={(state) => updateLiveState(showLiveMenu, state)}
          onEdit={() => { setModalMode('reserva'); setEditing(showLiveMenu); setShowLiveMenu(null); setShowModal(true); }}
          onClose={() => setShowLiveMenu(null)}
          onFinalize={() => finishNow(showLiveMenu)}
          onReset={() => resetLiveState(showLiveMenu)}
          onExtend={() => extendCleaning(showLiveMenu)}
          onCancelCleaning={() => cancelCleaning(showLiveMenu)}
        />
      )}

      {/* ── MODAL: Reserva ── */}
      {showModal && (
        <ResModal
          editing={editing}
          initialMode={modalMode}
          preTable={preTable}
          tables={tables}
          slots={slots}
          service={service}
          tableStatus={tableStatus}
          staff={staff}
          tableNums={resourceNums}
          ownerByTable={{ ...ownerByTable, ...groupOwnerByTable }}
          mozoTableIds={mozoTableIds}
          resourceLabel={resourceLabel}
          bookingFields={organization.bookingFields}
          serviceLabels={{ mediodia: serviceLabelOf(organization, 'mediodia'), cena: serviceLabelOf(organization, 'cena') }}
          services={SVC}
          showStaffSelect={isRestaurant}
          showOrders={hasOrdersFeature}
          onSave={handleSave}
          onSavePedido={savePedido}
          onDelete={handleDelete}
          onReject={rejectRes}
          onClose={() => { setShowModal(false); setEditing(null); setPreTable(null); }}
        />
      )}

      {/* ── MODAL: Configuración ── */}
      {showSettings && (
        <SettingsModal
          config={config}
          organization={organization}
          isRestaurant={isRestaurant}
          onSave={saveConfig}
          onSaveOrg={saveOrg}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* ── MODAL: Staff / Mozos ── */}
      {showStaff && (
        <StaffModal
          staff={staff}
          sectors={sectors}
          saveSectors={saveSectors}
          onStaffChange={refetchStaff}
          onClose={() => setShowStaff(false)}
        />
      )}

      {/* ── MODAL: Recursos (editor CRUD) ── */}
      {showResources && (
        <ResourceEditor
          organization={organization}
          onClose={() => setShowResources(false)}
        />
      )}

      {/* ── MODAL: Carta / Menú ── */}
      {showCarta && (
        <CartaManager onClose={() => setShowCarta(false)} />
      )}

      {/* ── MODAL: Analíticas ── */}
      {showAnalytics && (
        <AnalyticsPanel
          data={analyticsData}
          period={analyticsPeriod}
          onPeriodChange={setAnalyticsPeriod}
          analyticsMonth={analyticsMonth}
          onMonthChange={setAnalyticsMonth}
          onClose={() => setShowAnalytics(false)}
        />
      )}

      {/* ── MENU CONTEXTUAL RÁPIDO (LONG PRESS) ── */}
      {quickActionMenu && (() => {
        const getNextStates = (current) => {
          if (!current) return ['esperando_cliente', 'comiendo_entrada'];
          if (current === 'esperando_cliente') return ['comiendo_entrada'];
          if (current === 'comiendo_entrada') return ['plato_principal'];
          if (current === 'plato_principal') return ['en_postre_cafe'];
          if (current === 'en_postre_cafe') return ['sobremesa', 'esperando_cuenta'];
          if (current === 'sobremesa') return ['esperando_cuenta'];
          if (current === 'esperando_cuenta') return ['para_limpiar'];
          if (current === 'para_limpiar') return ['finalizar'];
          return [];
        };
        const nextStates = getNextStates(quickActionMenu.res.liveState);
        return (
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 40 }}
              onClick={(e) => { e.stopPropagation(); setQuickActionMenu(null); }}
              onTouchStart={(e) => { e.stopPropagation(); setQuickActionMenu(null); }}
            />
            <div style={{
              position: 'fixed', zIndex: 50,
              top: `${quickActionMenu.rect.top}px`, left: `${quickActionMenu.rect.left + quickActionMenu.rect.width / 2}px`,
              transform: 'translate(-50%, -100%)',
              marginTop: '-10px',
              background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)',
              border: `1px solid ${C.creamDeep}`, borderRadius: '12px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)', padding: '6px',
              display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '130px'
            }}>
              {nextStates.map(stateKey => {
                if (stateKey === 'finalizar') {
                  return (
                    <button key="finalizar" onClick={() => handleFinalizeQuick(quickActionMenu.res)} style={{
                      background: C.free, color: '#fff', border: 'none', padding: '10px 12px',
                      fontSize: '13px', fontWeight: 600, cursor: 'pointer', borderRadius: '8px', textAlign: 'center'
                    }}>
                      Finalizar
                    </button>
                  );
                }
                const stateObj = LIVE_STATES[stateKey];
                return (
                  <button key={stateKey} onClick={() => updateLiveState(quickActionMenu.res, stateKey)} style={{
                    background: 'transparent', border: 'none', padding: '10px 12px',
                    fontSize: '13px', fontWeight: 600, color: stateObj.color,
                    cursor: 'pointer', textAlign: 'center', borderRadius: '8px',
                  }}>
                    {stateObj.label}
                  </button>
                );
              })}
            </div>
          </>
        );
      })()}

      {/* ── MODAL: GUÍA DE INSTALACIÓN ── */}
      {showInstallGuide && (
        <div onClick={() => setShowInstallGuide(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(31,58,46,0.5)',
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 200, padding: '16px',
          animation: 'overlayIn 0.2s ease-out',
        }}>
          <div onClick={e => e.stopPropagation()} className="modal-content" style={{
            background: C.cream, borderRadius: '24px',
            padding: '28px 24px 32px', width: '100%', maxWidth: '380px',
            animation: 'modalIn 0.25s ease-out',
          }}>
            <h3 style={{
              fontFamily: '"Fraunces", serif', fontSize: '20px',
              fontStyle: 'italic', fontWeight: 600, color: C.forest,
              margin: '0 0 16px', textAlign: 'center',
            }}>
              Instalar PuntoVectra
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: C.white, borderRadius: '14px', padding: '16px', border: `1px solid ${C.creamDeep}` }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: C.espresso, marginBottom: '8px' }}>
                  iPhone / iPad (Safari)
                </div>
                <ol style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: C.muted, lineHeight: '1.6' }}>
                  <li>Tocá el botón <strong style={{ color: C.espresso }}>Compartir</strong> □↑</li>
                  <li>Desplazá y tocá <strong style={{ color: C.espresso }}>Agregar a pantalla de inicio</strong></li>
                  <li>Tocá <strong style={{ color: C.espresso }}>Agregar</strong></li>
                </ol>
              </div>
              <div style={{ background: C.white, borderRadius: '14px', padding: '16px', border: `1px solid ${C.creamDeep}` }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: C.espresso, marginBottom: '8px' }}>
                  Android (Chrome)
                </div>
                <ol style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: C.muted, lineHeight: '1.6' }}>
                  <li>Tocá los <strong style={{ color: C.espresso }}>3 puntos</strong> ▤</li>
                  <li>Tocá <strong style={{ color: C.espresso }}>Instalar app</strong></li>
                </ol>
              </div>
            </div>
            <button onClick={() => setShowInstallGuide(false)} style={{
              width: '100%', marginTop: '20px', padding: '12px',
              background: C.forest, border: 'none', borderRadius: '12px',
              color: C.cream, fontSize: '14px', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>Entendido</button>
          </div>
        </div>
      )}
    </div>
  );
}

