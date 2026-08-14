import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Save, RotateCcw, Move } from 'lucide-react';
import { C as PALETTE, LIVE_STATES, rectsOverlap } from '../utils';
import { useCleaningCountdown } from '../hooks/useCleaningTimers';

const CANVAS_W = 1600;
const CANVAS_H = 700;

const TABLE_DIMS = {
  rectangular: { w: 130, h: 65, radius: '12px' },
  round:       { w: 90, h: 90, radius: '50%' },
  square:      { w: 100, h: 100, radius: '14px' },
  'square-sm': { w: 70, h: 70, radius: '10px' },
};

// Resuelve una posición arrastrada para que no se superponga con otros sectores
// (se empuja hacia el lado que requiera menos desplazamiento)
function resolveSectorDrag(x, y, w, h, others) {
  let nx = x;
  let ny = y;
  for (let iter = 0; iter <= others.length; iter++) {
    let pushed = false;
    for (const o of others) {
      if (!rectsOverlap({ x: nx, y: ny, w, h }, o)) continue;
      const ox = Math.min(nx + w, o.x + o.w) - Math.max(nx, o.x);
      const oy = Math.min(ny + h, o.y + o.h) - Math.max(ny, o.y);
      if (ox <= oy) {
        const dRight = o.x + o.w - nx;
        const dLeft = nx + w - o.x;
        nx += dRight <= dLeft ? dRight : -dLeft;
      } else {
        const dDown = o.y + o.h - ny;
        const dUp = ny + h - o.y;
        ny += dDown <= dUp ? dDown : -dUp;
      }
      pushed = true;
      break;
    }
    if (!pushed) break;
  }
  return { x: nx, y: ny };
}

// Resuelve un redimensionado para que no se superponga: recorta el tamaño
// justo hasta el borde del otro sector (permite que se toquen)
function resolveSectorResize(x, y, w, h, handle, others) {
  let out = { x, y, w, h };
  for (let iter = 0; iter < 3; iter++) {
    let clamped = false;
    for (const o of others) {
      if (!rectsOverlap(out, o)) continue;
      const next = { ...out };
      if (handle.includes('e')) next.w = Math.max(80, Math.min(next.w, o.x - x));
      if (handle.includes('s')) next.h = Math.max(60, Math.min(next.h, o.y - y));
      if (handle.includes('w')) next.w = Math.max(80, Math.min(next.w, (x + w) - (o.x + o.w)));
      if (handle.includes('n')) next.h = Math.max(60, Math.min(next.h, (y + h) - (o.y + o.h)));
      if (next.w !== out.w || next.h !== out.h) {
        out = next;
        clamped = true;
        break;
      }
    }
    if (!clamped) break;
  }
  return out;
}

function defaultPositions(tables) {
  const cols = Math.ceil(Math.sqrt(tables.length * 1.5));
  const cellW = CANVAS_W / cols;
  const cellH = CANVAS_H / Math.ceil(tables.length / cols);
  return tables.reduce((acc, t, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const dim = TABLE_DIMS[t.shape] || TABLE_DIMS.round;
    acc[t.id] = { x: col * cellW + cellW / 2 - dim.w / 2, y: row * cellH + cellH / 2 - dim.h / 2 };
    return acc;
  }, {});
}

function tableColor(tableStatus, liveState, cleaningTimer) {
  if (cleaningTimer) {
    const pct = cleaningTimer.progress;
    if (pct > 0.66) return '#6f8d4d';
    if (pct > 0.13) return '#d4a04a';
    return '#c0392b';
  }
  if (tableStatus === 'busy' && liveState && LIVE_STATES[liveState]) return LIVE_STATES[liveState].color;
  if (tableStatus === 'busy') return PALETTE.terra;
  if (tableStatus === 'soon') return PALETTE.soon;
  if (tableStatus === 'reserved') return '#e8ddd0';
  return PALETTE.white;
}

function tableLabel(tableStatus, liveState, time) {
  if (tableStatus === 'busy' && liveState && LIVE_STATES[liveState]) return LIVE_STATES[liveState].label;
  if (tableStatus === 'busy') return 'Ocupada';
  if (tableStatus === 'soon') return 'A limpiar';
  if (tableStatus === 'reserved') return `-> ${time || ''}`;
  return 'Libre';
}

function tableTextColor(tableStatus) {
  if (tableStatus === 'free' || tableStatus === 'reserved') return PALETTE.forest;
  return '#fff';
}

const formatCountdown = (sec) => {
  const m = Math.floor(sec / 60);
  const seg = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(seg).padStart(2, '0')}`;
};

// Celda de mesa aislada: hace tick local del countdown de limpieza sin
// re-renderizar el resto del plano. Props estables permiten React.memo.
const TableShape = React.memo(function TableShape({
  t, pos, dim, s, timer, sectorColor, tableNum,
  isEditing, isEditingSectors, isMobile,
  onTableClick, onDragStart,
}) {
  const ct = useCleaningCountdown(timer?.expiresAt);
  const bg = tableColor(s.status, s.res?.liveState, ct);
  const fg = ct ? '#fff' : tableTextColor(s.status);
  // Mesa libre = sin número. El número aparece cuando el mozo toma la mesa
  // bajo su responsabilidad (reserva) y se mantiene durante la ocupación.
  const hasReservation = s.status !== 'free';
  const label = ct ? null : tableLabel(s.status, s.res?.liveState, s.res?.time);

  return (
    <div
      data-table-id={t.id}
      onPointerDown={(e) => onDragStart(t.id, e)}
      onTouchStart={(e) => { if (isEditing) onDragStart(t.id, e); }}
      onClick={() => {
        if (!isEditing && onTableClick) onTableClick(t, s);
      }}
      style={{
        position: 'absolute',
        transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
        width: dim.w,
        height: dim.h,
        background: bg,
        border: `2px solid ${s.status === 'busy' ? bg : s.status === 'soon' ? PALETTE.soon : s.status === 'reserved' ? PALETTE.terra : PALETTE.creamDeep}`,
        borderRadius: dim.radius,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: isEditing ? 'grab' : 'pointer',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none',
        WebkitTouchCallout: 'none',
        boxShadow: sectorColor
          ? `inset 0 0 0 3px ${sectorColor}, 0 2px 6px rgba(0,0,0,0.1)`
          : '0 2px 6px rgba(0,0,0,0.1)',
        transition: isEditing ? 'none' : 'background 0.3s',
        zIndex: isEditingSectors ? 1 : 10,
        pointerEvents: isEditingSectors ? 'none' : 'auto',
        willChange: isEditing ? 'transform' : 'auto',
      }}
    >
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        transform: isMobile ? 'rotate(-90deg)' : 'none',
        width: dim.h,
        height: dim.w,
      }}>
        {ct ? (
          <>
            <span style={{ fontSize: '9px', color: fg, opacity: 0.9, fontVariantNumeric: 'tabular-nums' }}>
              {formatCountdown(ct.remainingSec)}
            </span>
            <div style={{ width: dim.h - 20, height: '3px', background: 'rgba(0,0,0,0.15)', borderRadius: '2px', marginTop: '2px', overflow: 'hidden' }}>
              <div style={{ width: `${ct.progress * 100}%`, height: '100%', background: '#fff', borderRadius: '2px', transition: 'width 1s linear' }} />
            </div>
          </>
        ) : (
          <>
            <span style={{
              fontFamily: '"Fraunces", serif',
              fontSize: '16px',
              fontWeight: 700,
              color: fg,
              lineHeight: 1,
            }}>
              {hasReservation ? tableNum : ''}
            </span>
            <span style={{
              fontSize: '8px',
              color: fg,
              opacity: 0.8,
              marginTop: '3px',
              textAlign: 'center',
              maxWidth: dim.h - 10,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {label}
            </span>
          </>
        )}
      </div>
    </div>
  );
});

const SalonFloor = React.memo(function SalonFloor({
  tables, tableStatus, cleaningTimers, onTableClick, tableNums,
  positions, setPositions, saveLayout,
  isEditing, onToggleEdit,
  sectors, isEditingSectors, onToggleEditSectors, onSaveSectors,
}) {
  const [dirty, setDirty] = useState(false);
  const containerRef = useRef(null);
  const dragRef = useRef(null);
  const sectorDragRef = useRef(null);

  const [fitScale, setFitScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  );
  const pinchRef = useRef(null);
  const panRef = useRef(null);
  const lastTapRef = useRef(0);

  const effectiveScale = fitScale * zoom;

  // Refs para leer valores actuales sin re-registrar listeners de touch
  const effectiveScaleRef = useRef(effectiveScale);
  effectiveScaleRef.current = effectiveScale;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const offsetRef = useRef(offset);
  offsetRef.current = offset;

  const clampOffset = useCallback((o) => {
    const el = containerRef.current;
    if (!el) return o;
    const w = el.clientWidth || 0;
    const h = el.clientHeight || 0;
    const s = effectiveScaleRef.current;
    const visualW = (isMobile ? CANVAS_H : CANVAS_W) * s;
    const visualH = (isMobile ? CANVAS_W : CANVAS_H) * s;
    const maxX = Math.max(0, (visualW - w) / 2);
    const maxY = Math.max(0, (visualH - h) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, o.x)),
      y: Math.max(-maxY, Math.min(maxY, o.y)),
    };
  }, [isMobile]);

  const zoomAt = useCallback((factor, cx, cy) => {
    setZoom(prev => {
      const newZ = Math.min(3, Math.max(1, prev * factor));
      if (newZ === 1) {
        setOffset({ x: 0, y: 0 });
        return 1;
      }
      const k = newZ / prev;
      setOffset(prevOff => clampOffset({
        x: cx + k * (prevOff.x - cx),
        y: cy + k * (prevOff.y - cy),
      }));
      return newZ;
    });
  }, [clampOffset]);

  const resetView = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  // Wheel zoom (PC) — listener no-pasivo para poder cancelar el scroll
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (isEditing) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const k = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      zoomAt(k, cx, cy);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [isEditing, zoomAt]);

  useEffect(() => {
    if (tables.length > 0 && Object.keys(positions).length === 0) {
      setPositions(defaultPositions(tables));
    }
  }, [tables, positions, setPositions]);

  useEffect(() => {
    if (isEditing) {
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    }
  }, [isEditing]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const calcFit = () => {
      if (!containerRef.current) return;
      const containerW = containerRef.current.clientWidth;
      const containerH = containerRef.current.clientHeight;
      if (isMobile) {
        setFitScale(Math.min(containerW / CANVAS_H, containerH / CANVAS_W));
      } else {
        setFitScale(containerW / CANVAS_W);
      }
    };
    calcFit();
    window.addEventListener('resize', calcFit);
    return () => window.removeEventListener('resize', calcFit);
  }, [isMobile]);

  const handleDragStart = useCallback((tableId, e) => {
    if (!isEditing) return;
    e.preventDefault();
    e.stopPropagation();

    const el = e.currentTarget.closest('[data-table-id]');
    if (!el) return;

    const t = tables.find(tb => tb.id === tableId);
    const dim = TABLE_DIMS[t?.shape] || TABLE_DIMS.round;
    const startPos = positions[tableId] || { x: 0, y: 0 };
    const startX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const startY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;

    el.style.cursor = 'grabbing';
    el.style.zIndex = '100';
    el.style.transition = 'none';
    el.style.pointerEvents = 'none';
    el.style.willChange = 'transform';

    let rafId = null;

    const onMove = (ev) => {
      const cx = ev.clientX ?? ev.touches?.[0]?.clientX ?? 0;
      const cy = ev.clientY ?? ev.touches?.[0]?.clientY ?? 0;
      const rawDx = (cx - startX) / effectiveScale;
      const rawDy = (cy - startY) / effectiveScale;
      const dx = isMobile ? -rawDy : rawDx;
      const dy = isMobile ? rawDx : rawDy;
      const newX = startPos.x + dx;
      const newY = startPos.y + dy;

      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        el.style.transform = `translate3d(${newX}px, ${newY}px, 0)`;
      });
      dragRef.current = { tableId, x: newX, y: newY };
    };

    const onUp = () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('touchend', onUp);
      el.style.pointerEvents = '';
      el.style.zIndex = '';
      el.style.willChange = '';

      if (dragRef.current && dragRef.current.tableId === tableId) {
        const finalX = Math.max(0, Math.min(CANVAS_W - dim.w, dragRef.current.x));
        const finalY = Math.max(0, Math.min(CANVAS_H - dim.h, dragRef.current.y));
        setPositions(prev => ({ ...prev, [tableId]: { x: finalX, y: finalY } }));
        setDirty(true);
      }
      dragRef.current = null;
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('touchend', onUp);
  }, [isEditing, positions, tables, effectiveScale, isMobile, setPositions]);

  const handleTouchStart = useCallback((e) => {
    if (isEditing) return;
    if (e.touches.length === 2) {
      e.preventDefault();
      return;
    } else if (e.touches.length === 1) {
      // Doble tap → toggle zoom (funciona siempre)
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        lastTapRef.current = 0;
        const rect = containerRef.current?.getBoundingClientRect();
        const cx = e.touches[0].clientX - (rect?.left || 0);
        const cy = e.touches[0].clientY - (rect?.top || 0);
        zoomAt(zoomRef.current > 1 ? 1 / zoomRef.current : 2, cx, cy);
      } else {
        lastTapRef.current = now;
        // Pan solo con zoom activo: en vista completa el toque se deja pasar
        // para que la página pueda scrollear
        if (zoomRef.current > 1) {
          panRef.current = { x: e.touches[0].clientX - offsetRef.current.x, y: e.touches[0].clientY - offsetRef.current.y };
        }
      }
    }
  }, [isEditing, zoomAt]);

  const handleTouchMove = useCallback((e) => {
    if (isEditing) return;
    if (e.touches.length === 2) {
      e.preventDefault();
      return;
    } else if (e.touches.length === 1 && panRef.current) {
      e.preventDefault();
      setOffset(clampOffset({
        x: e.touches[0].clientX - panRef.current.x,
        y: e.touches[0].clientY - panRef.current.y,
      }));
    }
  }, [clampOffset, isEditing]);

  const handleTouchEnd = useCallback(() => {
    pinchRef.current = null;
    panRef.current = null;
  }, []);

  // Attach touch handlers as non-passive so preventDefault() works
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
    };
  }, [handleTouchStart, handleTouchMove]);

  // ── Pan con mouse en PC ────────────────────────────────────────────────
  const mousePanRef = useRef(null);

  const handleMouseDown = useCallback((e) => {
    if (isEditing || isEditingSectors || zoom <= 1) return;
    if (e.button !== 0) return;
    e.preventDefault();
    mousePanRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  }, [isEditing, isEditingSectors, zoom, offset]);

  const handleMouseMove = useCallback((e) => {
    if (!mousePanRef.current) return;
    e.preventDefault();
    setOffset(clampOffset({
      x: e.clientX - mousePanRef.current.x,
      y: e.clientY - mousePanRef.current.y,
    }));
  }, [clampOffset]);

  const handleMouseUp = useCallback(() => {
    mousePanRef.current = null;
  }, []);

  useEffect(() => {
    if (isMobile) return;
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      el.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isMobile, handleMouseDown, handleMouseMove, handleMouseUp]);

  const handleSave = useCallback(async () => {
    try {
      await saveLayout(positions);
      setDirty(false);
    } catch (err) {
      console.error('[SalonFloor] Error guardando layout:', err);
    }
  }, [positions, saveLayout]);

  const handleSectorDragStart = useCallback((sectorId, e) => {
    if (!isEditingSectors) return;
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
    const sector = (sectors || []).find(s => s.id === sectorId);
    if (!sector) return;
    const startX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const startY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    const orig = { x: sector.x, y: sector.y, w: sector.w, h: sector.h };

    let rafId = null;

    const onMove = (ev) => {
      const cx = ev.clientX ?? ev.touches?.[0]?.clientX ?? 0;
      const cy = ev.clientY ?? ev.touches?.[0]?.clientY ?? 0;
      const rawDx = (cx - startX) / effectiveScale;
      const rawDy = (cy - startY) / effectiveScale;
      const dx = isMobile ? -rawDy : rawDx;
      const dy = isMobile ? rawDx : rawDy;
      const others = sectors.filter(s => s.id !== sectorId);
      const resolved = resolveSectorDrag(orig.x + dx, orig.y + dy, orig.w, orig.h, others);
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const el = document.querySelector(`[data-sector-id="${sectorId}"]`);
        if (el) {
          el.style.left = `${resolved.x}px`;
          el.style.top = `${resolved.y}px`;
        }
      });
      sectorDragRef.current = { sectorId, dx: resolved.x - orig.x, dy: resolved.y - orig.y };
    };

    const onUp = () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('touchend', onUp);
      if (sectorDragRef.current && sectorDragRef.current.sectorId === sectorId && onSaveSectors) {
        const d = sectorDragRef.current;
        const updated = sectors.map(s => s.id === sectorId ? { ...s, x: orig.x + d.dx, y: orig.y + d.dy } : s);
        onSaveSectors(updated);
      }
      sectorDragRef.current = null;
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('touchend', onUp);
  }, [isEditingSectors, sectors, effectiveScale, onSaveSectors, isMobile]);

  const handleSectorResize = useCallback((sectorId, handle, e) => {
    if (!isEditingSectors) return;
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
    const sector = (sectors || []).find(s => s.id === sectorId);
    if (!sector) return;
    const startX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const startY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    const orig = { x: sector.x, y: sector.y, w: sector.w, h: sector.h };

    let rafId = null;

    const onMove = (ev) => {
      const cx = ev.clientX ?? ev.touches?.[0]?.clientX ?? 0;
      const cy = ev.clientY ?? ev.touches?.[0]?.clientY ?? 0;
      const rawDx = (cx - startX) / effectiveScale;
      const rawDy = (cy - startY) / effectiveScale;
      const dx = isMobile ? -rawDy : rawDx;
      const dy = isMobile ? rawDx : rawDy;
      let { x, y, w, h } = orig;

      if (handle.includes('e')) w = Math.max(80, orig.w + dx);
      if (handle.includes('w')) { w = Math.max(80, orig.w - dx); x = orig.x + (orig.w - w); }
      if (handle.includes('s')) h = Math.max(60, orig.h + dy);
      if (handle.includes('n')) { h = Math.max(60, orig.h - dy); y = orig.y + (orig.h - h); }

      const others = sectors.filter(s => s.id !== sectorId);
      const resolved = resolveSectorResize(x, y, w, h, handle, others);
      x = resolved.x; y = resolved.y; w = resolved.w; h = resolved.h;

      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const el = document.querySelector(`[data-sector-id="${sectorId}"]`);
        if (el) {
          el.style.left = `${x}px`;
          el.style.top = `${y}px`;
          el.style.width = `${w}px`;
          el.style.height = `${h}px`;
        }
      });
      sectorDragRef.current = { id: sectorId, x, y, w, h, mode: 'resize' };
    };

    const onUp = () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('touchend', onUp);
      if (sectorDragRef.current && sectorDragRef.current.id === sectorId && onSaveSectors) {
        const d = sectorDragRef.current;
        const updated = sectors.map(s => s.id === sectorId ? { ...s, x: d.x, y: d.y, w: d.w, h: d.h } : s);
        onSaveSectors(updated);
      }
      sectorDragRef.current = null;
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('touchend', onUp);
  }, [isEditingSectors, sectors, effectiveScale, onSaveSectors, isMobile]);

  const handleReset = useCallback(() => {
    setPositions(defaultPositions(tables));
    setDirty(true);
  }, [tables, setPositions, setDirty]);

  // Aristas de proximidad entre mesas: precomputadas para evitar O(n²) en cada render
  const edges = useMemo(() => {
    const out = [];
    const dims = TABLE_DIMS;
    for (let i = 0; i < tables.length; i++) {
      const a = tables[i];
      const pa = positions[a.id];
      if (!pa) continue;
      const da = dims[a.shape] || dims.round;
      for (let j = i + 1; j < tables.length; j++) {
        const b = tables[j];
        const pb = positions[b.id];
        if (!pb) continue;
        const db = dims[b.shape] || dims.round;
        const dx = (pa.x + da.w / 2) - (pb.x + db.w / 2);
        const dy = (pa.y + da.h / 2) - (pb.y + db.h / 2);
        if (dx * dx + dy * dy < 120 * 120) {
          out.push({
            key: `${a.id}-${b.id}`,
            x1: pa.x + da.w / 2, y1: pa.y + da.h / 2,
            x2: pb.x + db.w / 2, y2: pb.y + db.h / 2,
          });
        }
      }
    }
    return out;
  }, [tables, positions]);

  return (
    <div style={{ padding: '0 4px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', padding: '0 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Move size={11} color={PALETTE.muted} />
          <span style={{ fontSize: '10px', color: PALETTE.muted, fontWeight: 600 }}>
            {isEditing ? 'Arrastrá las mesas' : isEditingSectors ? 'Arrastrá los sectores' : 'Plano del salón'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={onToggleEditSectors} style={{
            background: isEditingSectors ? PALETTE.forest : PALETTE.creamDeep,
            color: isEditingSectors ? '#fff' : PALETTE.muted,
            border: 'none', borderRadius: '8px', padding: '5px 10px',
            cursor: 'pointer', fontSize: '10px', fontWeight: 600,
          }}>
            {isEditingSectors ? 'Listo' : 'Sectores'}
          </button>
          <button onClick={onToggleEdit} style={{
            background: isEditing ? PALETTE.terra : PALETTE.creamDeep,
            color: isEditing ? '#fff' : PALETTE.muted,
            border: 'none', borderRadius: '8px', padding: '5px 10px',
            cursor: 'pointer', fontSize: '10px', fontWeight: 600,
          }}>
            {isEditing ? 'Listo' : 'Mesas'}
          </button>
          {isEditing && (
            <>
              <button onClick={handleReset} style={{
                background: PALETTE.creamDeep, border: 'none', borderRadius: '8px', padding: '5px 6px',
                cursor: 'pointer', color: PALETTE.muted,
              }}>
                <RotateCcw size={11} />
              </button>
              {dirty && (
                <button onClick={handleSave} style={{
                  background: PALETTE.forest, border: 'none', borderRadius: '8px', padding: '5px 10px',
                  cursor: 'pointer', color: PALETTE.cream, fontSize: '10px', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: '3px',
                }}>
                  <Save size={10} /> Guardar
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div
        ref={containerRef}
        onTouchEnd={handleTouchEnd}
        style={{
          width: '100%',
          maxWidth: isMobile ? '600px' : '1500px',
          margin: '0 auto',
          aspectRatio: isMobile ? `${CANVAS_H} / ${CANVAS_W}` : `${CANVAS_W} / ${CANVAS_H}`,
          background: PALETTE.creamDeep,
          borderRadius: '10px',
          overflow: 'hidden',
          touchAction: isMobile && zoom <= 1 ? 'pan-y' : 'none',
          position: 'relative',
          cursor: (!isEditing && !isEditingSectors && zoom > 1) ? 'grab' : 'default',
        }}
      >
        {/* Botones de zoom flotantes (solo PC) */}
        {!isEditing && !isEditingSectors && !isMobile && (
          <div style={{
            position: 'absolute', right: '10px', top: '10px', zIndex: 30,
            display: 'flex', flexDirection: 'column', gap: '4px',
          }}>
            <button
              onClick={() => {
                const rect = containerRef.current?.getBoundingClientRect();
                const cx = (rect?.left || 0) + (rect?.width || 0) / 2;
                const cy = (rect?.top || 0) + (rect?.height || 0) / 2;
                zoomAt(1.35, cx, cy);
              }}
              title="Acercar"
              style={{
                width: '34px', height: '34px', borderRadius: '9px', border: 'none',
                background: 'rgba(255,255,255,0.92)', color: PALETTE.forest,
                cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center',
                justifyContent: 'center', backdropFilter: 'blur(4px)',
              }}
            >+</button>
            <button
              onClick={() => {
                const rect = containerRef.current?.getBoundingClientRect();
                const cx = (rect?.left || 0) + (rect?.width || 0) / 2;
                const cy = (rect?.top || 0) + (rect?.height || 0) / 2;
                zoomAt(1 / 1.35, cx, cy);
              }}
              title="Alejar"
              style={{
                width: '34px', height: '34px', borderRadius: '9px', border: 'none',
                background: 'rgba(255,255,255,0.92)', color: PALETTE.forest,
                cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center',
                justifyContent: 'center', backdropFilter: 'blur(4px)',
              }}
            >−</button>
            {zoom > 1 && (
              <button
                onClick={resetView}
                title="Restablecer vista"
                style={{
                  width: '34px', height: '34px', borderRadius: '9px', border: 'none',
                  background: 'rgba(255,255,255,0.92)', color: PALETTE.terra,
                  cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                  fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', backdropFilter: 'blur(4px)',
                }}
              >⟲</button>
            )}
          </div>
        )}
        <div data-canvas style={{
          position: 'absolute',
          top: isMobile ? '50%' : 0,
          left: isMobile ? '50%' : 0,
          width: CANVAS_W,
          height: CANVAS_H,
          transform: isMobile
            ? `translate(${offset.x}px, ${offset.y}px) translate(-50%, -50%) rotate(90deg) scale(${effectiveScale})`
            : `translate(${offset.x}px, ${offset.y}px) scale(${effectiveScale})`,
          transformOrigin: isMobile ? 'center' : 'top left',
        }}>
          <svg width={CANVAS_W} height={CANVAS_H} style={{ position: 'absolute', top: 0, left: 0 }}>
            <defs>
              <pattern id="floor" patternUnits="userSpaceOnUse" width="40" height="40">
                <rect width="40" height="40" fill={PALETTE.creamDeep} />
                <rect width="20" height="20" fill="#e2d9cc" />
                <rect x="20" y="20" width="20" height="20" fill="#e2d9cc" />
              </pattern>
            </defs>

            <rect x="30" y="30" width={CANVAS_W - 60} height={CANVAS_H - 60} fill="url(#floor)" rx="4" />
            <rect x="30" y="30" width={CANVAS_W - 60} height={CANVAS_H - 60}
              fill="none" stroke={PALETTE.espresso} strokeWidth="6" rx="4" />

            <rect x="30" y="30" width="150" height={CANVAS_H - 60} fill="#ddd5c8" stroke={PALETTE.espresso} strokeWidth="4" rx="2" opacity="0.45" />
            <text x="60" y={CANVAS_H / 2} fontSize="14" fill={PALETTE.muted} fontFamily="inherit" fontWeight="700" opacity="0.6" transform={`rotate(-90, 80, ${CANVAS_H / 2})`} textAnchor="middle">Barra</text>

            <rect x={(CANVAS_W - 200) / 2} y={CANVAS_H - 100} width="200" height="70" fill="#ddd5c8" stroke={PALETTE.espresso} strokeWidth="3" rx="4" opacity="0.45" />
            <text x={CANVAS_W / 2} y={CANVAS_H - 58} fontSize="12" fill={PALETTE.muted} fontFamily="inherit" fontWeight="600" textAnchor="middle" opacity="0.6">Baños</text>

            <rect x={CANVAS_W - 30 - 10} y="30" width="10" height={CANVAS_H - 60} fill="none" stroke={PALETTE.espresso} strokeWidth="0" />
            <rect x={CANVAS_W - 50} y="30" width="30" height="520" fill="none" stroke={PALETTE.espresso} strokeWidth="2" strokeDasharray="10 6" opacity="0.35" rx="2" />
            <text x={CANVAS_W - 35} y="290" fontSize="11" fill={PALETTE.muted} fontFamily="inherit" fontWeight="600" opacity="0.45" textAnchor="middle" transform={`rotate(-90, ${CANVAS_W - 35}, 290)`}>Ventanal</text>

            <line x1={CANVAS_W - 30} y1="620" x2={CANVAS_W - 30} y2="740" stroke={PALETTE.creamDeep} strokeWidth="10" />
            <path d={`M ${CANVAS_W - 30} 740 Q ${CANVAS_W - 120} 740 ${CANVAS_W - 120} 680`} fill="none" stroke={PALETTE.espresso} strokeWidth="2" strokeDasharray="6 4" opacity="0.5" />
            <line x1={CANVAS_W - 30} y1="740" x2={CANVAS_W - 120} y2="740" stroke={PALETTE.espresso} strokeWidth="3" opacity="0.6" />
            <text x={CANVAS_W - 80} y="720" fontSize="11" fill={PALETTE.muted} fontFamily="inherit" fontWeight="600" opacity="0.7" textAnchor="middle">Entrada</text>

            {edges.map(edge => (
              <line key={edge.key}
                x1={edge.x1} y1={edge.y1} x2={edge.x2} y2={edge.y2}
                stroke={PALETTE.cream} strokeWidth="1" strokeDasharray="4" opacity="0.5"
              />
            ))}
          </svg>

          {(sectors || []).map(sec => {
            const HANDLE_SIZE = 10;
            const hs = HANDLE_SIZE / 2;
            const handles = [
              { key: 'nw', cursor: 'nw-resize', left: -hs, top: -hs },
              { key: 'n', cursor: 'n-resize', left: sec.w / 2 - hs, top: -hs },
              { key: 'ne', cursor: 'ne-resize', left: sec.w - hs, top: -hs },
              { key: 'e', cursor: 'e-resize', left: sec.w - hs, top: sec.h / 2 - hs },
              { key: 'se', cursor: 'se-resize', left: sec.w - hs, top: sec.h - hs },
              { key: 's', cursor: 's-resize', left: sec.w / 2 - hs, top: sec.h - hs },
              { key: 'sw', cursor: 'sw-resize', left: -hs, top: sec.h - hs },
              { key: 'w', cursor: 'w-resize', left: -hs, top: sec.h / 2 - hs },
            ];

            return (
              <div
                key={sec.id}
                data-sector-id={sec.id}
                onPointerDown={(e) => handleSectorDragStart(sec.id, e)}
                onTouchStart={(e) => { if (isEditingSectors) handleSectorDragStart(sec.id, e); }}
                style={{
                  position: 'absolute',
                  left: sec.x, top: sec.y, width: sec.w, height: sec.h,
                  background: `${sec.color}33`,
                  border: `2.5px ${isEditingSectors ? 'dashed' : 'solid'} ${sec.color}88`,
                  borderRadius: '8px',
                  cursor: isEditingSectors ? 'move' : 'default',
                  zIndex: isEditingSectors ? 20 : 1,
                  touchAction: 'none',
                  pointerEvents: isEditingSectors ? 'auto' : 'none',
                }}
              >
                <span style={{
                  position: 'absolute', top: '6px', left: '10px',
                  fontSize: '12px', fontWeight: 700, color: sec.color,
                  fontFamily: 'inherit', opacity: 0.85, userSelect: 'none',
                  pointerEvents: 'none',
                }}>{sec.name}</span>

          {isEditingSectors && handles.map(h => {
                    const coarsePointer = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
                    const hSize = coarsePointer ? 22 : 10;
                    const hStyle = {
                      position: 'absolute',
                      left: h.left - (hSize - 10) / 2,
                      top: h.top - (hSize - 10) / 2,
                      width: hSize, height: hSize,
                      background: sec.color,
                      borderRadius: '50%',
                      cursor: h.cursor,
                      zIndex: 25,
                      border: '2px solid #fff',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                      touchAction: 'none',
                    };
                    return (
                      <div
                        key={h.key}
                        onPointerDown={(e) => handleSectorResize(sec.id, h.key, e)}
                        onTouchStart={(e) => handleSectorResize(sec.id, h.key, e)}
                        style={hStyle}
                      />
                    );
                  })}
              </div>
            );
          })}

          {tables.map((t) => {
            const pos = positions[t.id] || { x: 0, y: 0 };
            const s = tableStatus(t.id) || { status: 'free' };
            const timer = cleaningTimers?.[t.id] || null;
            const dim = TABLE_DIMS[t.shape] || TABLE_DIMS.round;
            const secFor = (sectors || []).find(sec => {
              const p = positions[t.id];
              return p && rectsOverlap(sec, { x: p.x, y: p.y, w: dim.w, h: dim.h });
            }) || null;

            return (
              <TableShape
                key={t.id}
                t={t}
                pos={pos}
                dim={dim}
                s={s}
                timer={timer}
                sectorColor={secFor ? secFor.color : null}
                tableNum={tableNums[t.id] || ''}
                isEditing={isEditing}
                isEditingSectors={isEditingSectors}
                isMobile={isMobile}
                onTableClick={onTableClick}
                onDragStart={handleDragStart}
              />
            );
          })}
        </div>
      </div>

      {/* ── LEYENDA DE COLORES ── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '6px 16px',
        padding: '14px 20px', marginTop: '8px',
        background: PALETTE.white, borderRadius: '14px',
        border: `1px solid ${PALETTE.creamDeep}`,
        justifyContent: 'center',
      }}>
        {Object.entries(LIVE_STATES).map(([key, state]) => (
          <div key={key} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: '12px', color: PALETTE.espresso, fontWeight: 500,
          }}>
            <span style={{
              width: '12px', height: '12px', borderRadius: '50%',
              background: state.color, flexShrink: 0,
              boxShadow: `0 0 0 2px ${PALETTE.white}, 0 0 0 3px ${state.color}33`,
            }} />
            {state.label}
          </div>
        ))}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          fontSize: '12px', color: PALETTE.espresso, fontWeight: 500,
        }}>
          <span style={{
            width: '12px', height: '12px', borderRadius: '50%',
            background: PALETTE.free, flexShrink: 0,
            boxShadow: `0 0 0 2px ${PALETTE.white}, 0 0 0 3px ${PALETTE.free}33`,
          }} />
          Libre
        </div>
      </div>
    </div>
  );
});

export default SalonFloor;
