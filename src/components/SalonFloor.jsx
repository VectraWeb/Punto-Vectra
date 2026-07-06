import React, { useState, useEffect, useCallback, useRef } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Save, RotateCcw, Move } from 'lucide-react';

const PALETTE = {
  cream:      '#f5efe6',
  creamDeep:  '#ebe3d5',
  forest:     '#7a3a1e',
  forestSoft: '#9B4B2A',
  terra:      '#c4602f',
  terraSoft:  '#e09368',
  espresso:   '#2a1f1a',
  muted:      '#8b7d6b',
  free:       '#6f8d4d',
  soon:       '#d4a04a',
  white:      '#fffdf8',
};

const LIVE_STATES = {
  esperando_cliente:  { label: 'Esperando',       color: '#4a90d9' },
  comiendo_entrada:   { label: 'Entrada',          color: '#c4602f' },
  plato_principal:    { label: 'Principal',        color: '#7b1f2e' },
  en_postre_cafe:     { label: 'Postre / Cafe',    color: '#c49a35' },
  sobremesa:          { label: 'Sobremesa',        color: '#6b8e7b' },
  esperando_cuenta:   { label: 'Cuenta',           color: '#9b59b6' },
  para_limpiar:       { label: 'A limpiar',        color: '#e67e22' },
};

const CANVAS_W = 1400;
const CANVAS_H = 800;

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

function tableColor(tableStatus, liveState) {
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

export default function SalonFloor({
  tables, tableStatus, onTableClick,
  isEditing, onToggleEdit, onSaveLayout,
}) {
  const [positions, setPositions] = useState({});
  const [dirty, setDirty] = useState(false);
  const containerRef = useRef(null);
  const dragRef = useRef(null);

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

  const handlePointerDown = useCallback((tableId, e) => {
    if (!isEditing) return;
    e.preventDefault();
    e.stopPropagation();

    const el = e.currentTarget.closest('[data-table-id]');
    if (!el) return;

    const t = tables.find(tb => tb.id === tableId);
    const dim = TABLE_DIMS[t?.shape] || TABLE_DIMS.round;
    const startPos = positions[tableId] || { x: 0, y: 0 };
    const startX = e.clientX;
    const startY = e.clientY;

    el.style.cursor = 'grabbing';
    el.style.zIndex = '100';
    el.style.transition = 'none';
    el.style.pointerEvents = 'none';

    const onMove = (ev) => {
      const dx = (ev.clientX - startX) / effectiveScale;
      const dy = (ev.clientY - startY) / effectiveScale;
      el.style.transform = `translate(${startPos.x + dx}px, ${startPos.y + dy}px)`;
      dragRef.current = { tableId, x: startPos.x + dx, y: startPos.y + dy };
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      el.style.pointerEvents = '';
      el.style.zIndex = '';

      if (dragRef.current && dragRef.current.tableId === tableId) {
        const finalX = Math.max(0, Math.min(CANVAS_W - dim.w, dragRef.current.x));
        const finalY = Math.max(0, Math.min(CANVAS_H - dim.h, dragRef.current.y));
        setPositions(prev => ({ ...prev, [tableId]: { x: finalX, y: finalY } }));
        setDirty(true);
      }
      dragRef.current = null;
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [isEditing, positions, tables, effectiveScale]);

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { dist: Math.sqrt(dx * dx + dy * dy), zoom };
    } else if (e.touches.length === 1 && zoom > 1) {
      panRef.current = { x: e.touches[0].clientX - offset.x, y: e.touches[0].clientY - offset.y };
    }
  }, [zoom, offset]);

  const handleTouchMove = useCallback((e) => {
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

  const handleReset = useCallback(() => {
    setPositions(defaultPositions(tables));
    setDirty(true);
  }, [tables]);

  const scaleFont = (size) => Math.max(6, Math.round(size * fitScale));

  return (
    <div style={{ padding: '0 8px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', padding: '0 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Move size={11} color={PALETTE.muted} />
          <span style={{ fontSize: '10px', color: PALETTE.muted, fontWeight: 600 }}>
            {isEditing ? 'Arrastrá las mesas' : 'Plano del salón'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={onToggleEdit} style={{
            background: isEditing ? PALETTE.terra : PALETTE.creamDeep,
            color: isEditing ? '#fff' : PALETTE.muted,
            border: 'none', borderRadius: '8px', padding: '5px 10px',
            cursor: 'pointer', fontSize: '10px', fontWeight: 600,
          }}>
            {isEditing ? 'Listo' : 'Editar'}
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

          {tables.map((t) => {
            const pos = positions[t.id] || { x: 0, y: 0 };
            const s = tableStatus(t.id);
            const bg = tableColor(s.status, s.res?.liveState);
            const fg = tableTextColor(s.status);
            const label = tableLabel(s.status, s.res?.liveState, s.res?.time);
            const dim = TABLE_DIMS[t.shape] || TABLE_DIMS.round;

            return (
              <div
                key={t.id}
                data-table-id={t.id}
                onPointerDown={(e) => handlePointerDown(t.id, e)}
                onClick={() => {
                  if (!isEditing && onTableClick) onTableClick(t, s);
                }}
                style={{
                  position: 'absolute',
                  transform: `translate(${pos.x}px, ${pos.y}px)`,
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
                  touchAction: 'none',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                  transition: isEditing ? 'none' : 'background 0.3s',
                  zIndex: 10,
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
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
