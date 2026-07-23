import React, { useState, useEffect, useCallback, useRef } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Save, RotateCcw, Move } from 'lucide-react';
import { C as PALETTE, LIVE_STATES } from '../utils';

const CANVAS_W = 1600;
const CANVAS_H = 700;

const TABLE_DIMS = {
  rectangular: { w: 130, h: 65, radius: '12px' },
  round:       { w: 90, h: 90, radius: '50%' },
  square:      { w: 100, h: 100, radius: '14px' },
};

const layoutRef = () => doc(db, 'config', 'salon-layout');

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

const SalonFloor = React.memo(function SalonFloor({
  tables, tableStatus, cleaningTimers, onTableClick,
  isEditing, onToggleEdit, onSaveLayout,
  sectors, isEditingSectors, onToggleEditSectors, onSaveSectors,
}) {
  const [positions, setPositions] = useState({});
  const [dirty, setDirty] = useState(false);
  const containerRef = useRef(null);
  const dragRef = useRef(null);
  const sectorDragRef = useRef(null);

  const [fitScale, setFitScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const pinchRef = useRef(null);
  const panRef = useRef(null);

  useEffect(() => {
    const unsub = onSnapshot(layoutRef(), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.positions) setPositions(data.positions);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (tables.length > 0 && Object.keys(positions).length === 0) {
      setPositions(defaultPositions(tables));
    }
  }, [tables]);

  useEffect(() => {
    if (isEditing) {
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    }
  }, [isEditing]);

  useEffect(() => {
    const calcFit = () => {
      if (!containerRef.current) return;
      const containerW = containerRef.current.clientWidth;
      setFitScale(containerW / CANVAS_W);
    };
    calcFit();
    window.addEventListener('resize', calcFit);
    return () => window.removeEventListener('resize', calcFit);
  }, []);

  const effectiveScale = fitScale * zoom;

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
      const dx = (cx - startX) / effectiveScale;
      const dy = (cy - startY) / effectiveScale;
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
  }, [isEditing, positions, tables, effectiveScale]);

  const handleTouchStart = useCallback((e) => {
    if (isEditing) return;
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { dist: Math.sqrt(dx * dx + dy * dy), zoom };
    } else if (e.touches.length === 1 && zoom > 1) {
      panRef.current = { x: e.touches[0].clientX - offset.x, y: e.touches[0].clientY - offset.y };
    }
  }, [zoom, offset, isEditing]);

  const handleTouchMove = useCallback((e) => {
    if (isEditing) return;
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ratio = dist / pinchRef.current.dist;
      setZoom(Math.min(Math.max(pinchRef.current.zoom * ratio, 1), 3));
    } else if (e.touches.length === 1 && panRef.current) {
      e.preventDefault();
      setOffset({ x: e.touches[0].clientX - panRef.current.x, y: e.touches[0].clientY - panRef.current.y });
    }
  }, []);

  const handleTouchEnd = useCallback(() => { pinchRef.current = null; panRef.current = null; }, []);

  const handleSave = useCallback(async () => {
    try {
      await setDoc(layoutRef(), { positions, updatedAt: new Date().toISOString() }, { merge: true });
      setDirty(false);
      if (onSaveLayout) onSaveLayout();
    } catch (err) {
      console.error('[SalonFloor] Error guardando layout:', err);
    }
  }, [positions, onSaveLayout]);

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
      const dx = (cx - startX) / effectiveScale;
      const dy = (cy - startY) / effectiveScale;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const el = document.querySelector(`[data-sector-id="${sectorId}"]`);
        if (el) {
          el.style.left = `${orig.x + dx}px`;
          el.style.top = `${orig.y + dy}px`;
        }
      });
      sectorDragRef.current = { sectorId, dx, dy };
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
  }, [isEditingSectors, sectors, effectiveScale, onSaveSectors]);

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
      const dx = (cx - startX) / effectiveScale;
      const dy = (cy - startY) / effectiveScale;
      let { x, y, w, h } = orig;

      if (handle.includes('e')) w = Math.max(80, orig.w + dx);
      if (handle.includes('w')) { w = Math.max(80, orig.w - dx); x = orig.x + (orig.w - w); }
      if (handle.includes('s')) h = Math.max(60, orig.h + dy);
      if (handle.includes('n')) { h = Math.max(60, orig.h - dy); y = orig.y + (orig.h - h); }

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
  }, [isEditingSectors, sectors, effectiveScale, onSaveSectors]);

  const handleReset = useCallback(() => {
    setPositions(defaultPositions(tables));
    setDirty(true);
  }, [tables]);

  const scaleFont = (size) => Math.max(6, Math.round(size * fitScale));

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
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          width: '100%',
          maxWidth: '1500px',
          margin: '0 auto',
          aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
          background: PALETTE.creamDeep,
          borderRadius: '10px',
          overflow: 'hidden',
          touchAction: 'none',
          position: 'relative',
        }}
      >
        <div data-canvas style={{
          position: 'absolute',
          top: 0, left: 0,
          width: CANVAS_W,
          height: CANVAS_H,
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${fitScale * zoom})`,
          transformOrigin: 'top left',
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

            {tables.map((t) => {
              const pos = positions[t.id];
              if (!pos) return null;
              const dim = TABLE_DIMS[t.shape] || TABLE_DIMS.round;
              const cx = pos.x + dim.w / 2;
              const cy = pos.y + dim.h / 2;
              return tables.filter(t2 => {
                if (t2.id <= t.id) return false;
                const p2 = positions[t2.id];
                if (!p2) return false;
                const dim2 = TABLE_DIMS[t2.shape] || TABLE_DIMS.round;
                const dx = cx - (p2.x + dim2.w / 2);
                const dy = cy - (p2.y + dim2.h / 2);
                return Math.sqrt(dx * dx + dy * dy) < 120;
              }).map(t2 => {
                const p2 = positions[t2.id];
                const dim2 = TABLE_DIMS[t2.shape] || TABLE_DIMS.round;
                return (
                  <line key={`${t.id}-${t2.id}`}
                    x1={cx} y1={cy} x2={p2.x + dim2.w / 2} y2={p2.y + dim2.h / 2}
                    stroke={PALETTE.cream} strokeWidth="1" strokeDasharray="4" opacity="0.5"
                  />
                );
              });
            })}
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
                    const isMobile = window.matchMedia('(pointer: coarse)').matches;
                    const hSize = isMobile ? 22 : 10;
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
            const s = tableStatus(t.id);
            const ct = cleaningTimers?.[t.id] || null;
            const bg = tableColor(s.status, s.res?.liveState, ct);
            const fg = ct ? '#fff' : tableTextColor(s.status);
            const label = ct ? null : tableLabel(s.status, s.res?.liveState, s.res?.time);
            const dim = TABLE_DIMS[t.shape] || TABLE_DIMS.round;

            const formatCountdown = (sec) => {
              const m = Math.floor(sec / 60);
              const seg = sec % 60;
              return `${String(m).padStart(2, '0')}:${String(seg).padStart(2, '0')}`;
            };

            return (
              <div
                key={t.id}
                data-table-id={t.id}
                onPointerDown={(e) => handleDragStart(t.id, e)}
                onTouchStart={(e) => { if (isEditing) handleDragStart(t.id, e); }}
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
                  boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                  transition: isEditing ? 'none' : 'background 0.3s',
                  zIndex: isEditingSectors ? 1 : 10,
                  pointerEvents: isEditingSectors ? 'none' : 'auto',
                  willChange: isEditing ? 'transform' : 'auto',
                }}
              >
                <span style={{
                  fontFamily: '"Fraunces", serif',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: fg,
                  lineHeight: 1,
                }}>
                  {t.name}
                </span>
                {ct ? (
                  <>
                    <span style={{ fontSize: '9px', color: fg, opacity: 0.9, marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
                      {formatCountdown(ct.remainingSec)}
                    </span>
                    <div style={{ width: dim.w - 20, height: '3px', background: 'rgba(0,0,0,0.15)', borderRadius: '2px', marginTop: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${ct.progress * 100}%`, height: '100%', background: '#fff', borderRadius: '2px', transition: 'width 1s linear' }} />
                    </div>
                  </>
                ) : (
                  <>
                    <span style={{
                      fontSize: '8px',
                      color: fg,
                      opacity: 0.8,
                      marginTop: '1px',
                      textAlign: 'center',
                      maxWidth: dim.w - 10,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {label}
                    </span>
                    <span style={{
                      fontSize: '7px',
                      color: fg,
                      opacity: 0.5,
                      marginTop: '1px',
                    }}>
                      {t.capacity}p
                    </span>
                  </>
                )}
              </div>
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
