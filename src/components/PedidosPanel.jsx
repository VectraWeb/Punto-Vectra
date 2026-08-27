import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { C, PEDIDO_ESTADOS, notificarN8N } from '../utils';
import { XCircle, MessageCircle, Check, AlertCircle, Trash2 } from 'lucide-react';
import PedidoStateModal from './PedidoStateModal';
import PedidoConfirmModal from './PedidoConfirmModal';

const inp = {
  width: '100%', padding: '10px 12px', fontSize: '13px',
  background: C.white, border: `1.5px solid ${C.creamDeep}`,
  borderRadius: '10px', color: C.espresso, outline: 'none',
  fontFamily: 'inherit', resize: 'vertical',
};

// ── Pedido card ─────────────────────────────────────────────────────────────
const cleanPhone = (p) => String(p || '')
  .replace(/@s\.whatsapp\.net$/i, '')
  .replace(/[^0-9]/g, '');

function PedidoCard({ p, onConfirm, onStartReject, rejectingId, rejectReason, onRejectReasonChange, onReject, onCancelReject, deleteConfirmId, onDeleteRequest, onDelete, onCancelDelete, onOpenStateModal }) {
  const estado = p.pedidoEstado || 'pendiente';
  const estadoCfg = PEDIDO_ESTADOS[estado] || PEDIDO_ESTADOS.pendiente;
  const Icon = estadoCfg.icon;
  const isPending = estado === 'pendiente';
  const isCancelled = estado === 'cancelado';
  const isDeleteConfirming = deleteConfirmId === p.id;

  return (
    <div
      onClick={() => { if (!isPending) onOpenStateModal(p); }}
      style={{
        background: C.white, borderRadius: '12px', padding: '12px',
        borderLeft: `4px solid ${estadoCfg.color}`,
        boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
        cursor: isPending ? 'default' : 'pointer',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '6px' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: C.espresso }}>
            {p.customerName || 'Sin nombre'}
          </div>
          <div style={{ fontSize: '11px', color: C.muted, marginTop: '2px' }}>
            {p.time ? `${p.time} · ` : ''}
            {p.modalidad === 'envio'
              ? `Envío${p.direccion ? ` a ${p.direccion}` : ' a domicilio'}`
              : 'Retiro en el local'}
            {cleanPhone(p.customerPhone) ? ` · ${cleanPhone(p.customerPhone)}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            background: estadoCfg.color + '18', color: estadoCfg.color,
            padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700,
          }}>
            <Icon size={11} />
            {estadoCfg.label}
          </div>
          {isDeleteConfirming ? (
            <button onClick={(e) => { e.stopPropagation(); onCancelDelete(); }} title="Cancelar" style={{
              padding: '5px', borderRadius: '6px', border: 'none', cursor: 'pointer',
              background: C.creamDeep, color: C.muted, fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <XCircle size={13} />
            </button>
          ) : (
            <button onClick={(e) => { e.stopPropagation(); onDeleteRequest(p.id); }} title="Borrar pedido" style={{
              padding: '5px', borderRadius: '6px', border: 'none', cursor: 'pointer',
              background: C.creamDeep, color: C.muted, fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Confirmación de borrado */}
      {isDeleteConfirming && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
          background: '#fef2f2', borderRadius: '8px', padding: '6px 10px',
          marginTop: '4px',
        }}>
          <span style={{ fontSize: '11px', color: '#991b1b', fontWeight: 600 }}>¿Borrar este pedido?</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={(e) => { e.stopPropagation(); onDelete(p.id); }} style={{
              padding: '5px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer',
              background: '#991b1b', color: '#fff', fontSize: '11px', fontWeight: 700, fontFamily: 'inherit',
            }}>
              Sí, borrar
            </button>
            <button onClick={(e) => { e.stopPropagation(); onCancelDelete(); }} style={{
              padding: '5px 10px', borderRadius: '6px', border: '1px solid #e5c9c4', cursor: 'pointer',
              background: C.white, color: '#991b1b', fontSize: '11px', fontWeight: 600, fontFamily: 'inherit',
            }}>
              No
            </button>
          </div>
        </div>
      )}

      {/* Detalle */}
      {p.notes && p.notes !== 'Reservado vía WhatsApp Bot' && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: '6px',
          background: C.creamDeep, borderRadius: '8px', padding: '8px 10px',
          marginTop: '4px',
        }}>
          <MessageCircle size={13} style={{ color: C.muted, flexShrink: 0, marginTop: '1px' }} />
          <span style={{ fontSize: '11px', color: C.espresso, lineHeight: '1.4' }}>{p.notes}</span>
        </div>
      )}

      {/* Motivo rechazo */}
      {isCancelled && p.pedidoRechazoMotivo && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: '6px',
          background: '#fef2f2', borderRadius: '8px', padding: '8px 10px',
          marginTop: '4px',
        }}>
          <AlertCircle size={13} style={{ color: '#991b1b', flexShrink: 0, marginTop: '1px' }} />
          <span style={{ fontSize: '11px', color: '#991b1b', lineHeight: '1.4' }}>
            <strong>Motivo:</strong> {p.pedidoRechazoMotivo}
          </span>
        </div>
      )}

      {/* Acciones pendientes */}
      {isPending && rejectingId !== p.id && (
        <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
          <button onClick={(e) => { e.stopPropagation(); onConfirm(p); }} style={{
            flex: 1, padding: '7px 10px', borderRadius: '8px', border: 'none',
            background: C.forest, cursor: 'pointer', fontSize: '11px', fontWeight: 600,
            color: C.cream, fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
          }}>
            <Check size={13} /> Confirmar
          </button>
          <button onClick={(e) => { e.stopPropagation(); onStartReject(p.id); }} style={{
            flex: 1, padding: '7px 10px', borderRadius: '8px', border: `1px solid ${C.terraSoft}`,
            background: '#fef2f2', cursor: 'pointer', fontSize: '11px', fontWeight: 600,
            color: '#991b1b', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
          }}>
            <XCircle size={13} /> Rechazar
          </button>
        </div>
      )}

      {/* Formulario rechazo */}
      {isPending && rejectingId === p.id && (
        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <textarea
            value={rejectReason}
            onChange={e => onRejectReasonChange(e.target.value)}
            placeholder="Motivo del rechazo..."
            rows={2}
            style={inp}
            autoFocus
          />
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={(e) => { e.stopPropagation(); onReject(p.id); }} disabled={!rejectReason.trim()} style={{
              flex: 1, padding: '7px', borderRadius: '8px', border: 'none',
              background: rejectReason.trim() ? '#991b1b' : C.creamDeep,
              cursor: rejectReason.trim() ? 'pointer' : 'not-allowed',
              fontSize: '11px', fontWeight: 600,
              color: rejectReason.trim() ? '#fff' : C.muted, fontFamily: 'inherit',
            }}>
              Confirmar rechazo
            </button>
            <button onClick={(e) => { e.stopPropagation(); onCancelReject(); }} style={{
              padding: '7px 12px', borderRadius: '8px', border: `1px solid ${C.creamDeep}`,
              background: C.cream, cursor: 'pointer', fontSize: '11px', fontWeight: 600,
              color: C.muted, fontFamily: 'inherit',
            }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      </div>
  );
}

// ── Acordeón ────────────────────────────────────────────────────────────────
function AccordionSection({ title, count, expanded, onToggle, accentColor, children }) {
  return (
    <div>
      <button onClick={onToggle} style={{
        width: '100%', padding: '12px 14px', borderRadius: expanded ? '14px 14px 0 0' : '14px',
        border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: expanded ? accentColor : C.creamDeep,
        color: expanded ? C.cream : C.espresso,
      }}>
        <div style={{ fontSize: '15px', fontWeight: 700 }}>{title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            background: expanded ? C.cream : (accentColor + '30'),
            color: expanded ? accentColor : C.espresso,
            padding: '4px 10px', borderRadius: '8px',
            fontSize: '12px', fontWeight: 700,
          }}>
            {count}
          </div>
          <div style={{
            width: '24px', height: '24px', borderRadius: '50%',
            background: expanded ? C.cream : (accentColor + '30'),
            color: expanded ? accentColor : C.espresso,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '10px', fontWeight: 700,
            transform: expanded ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s',
          }}>▼</div>
        </div>
      </button>
      {expanded && (
        <div style={{
          padding: children && children.length > 0 ? '8px 0 0' : '0',
          display: 'flex', flexDirection: 'column', gap: '6px',
        }}>
          {children && children.length > 0
            ? children
            : <div style={{ padding: '16px', textAlign: 'center', color: C.muted, fontSize: '12px', background: C.creamDeep, borderRadius: '0 0 12px 12px' }}>
                No hay pedidos en esta categoría
              </div>
          }
        </div>
      )}
    </div>
  );
}

// ── Panel principal ─────────────────────────────────────────────────────────
export default function PedidosPanel({ date, service }) {
  const [pedidos, setPedidos] = useState([]);
  const [expandedSection, setExpandedSection] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [stateModalPedido, setStateModalPedido] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);

  useEffect(() => {
    const q = query(
      collection(db, 'pedidos'),
      where('date', '==', date),
      where('source', 'in', ['whatsapp_bot', 'cliente_web', 'staff']),
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (!service) { setPedidos(data); return; }
      setPedidos(data.filter(p => !p.service || p.service === service));
    }, (err) => console.error('[Pedidos] Firestore error:', err));
    return unsub;
  }, [date, service]);

  const allPedidos = pedidos;
  const pendientes = pedidos.filter(p => (p.pedidoEstado || 'pendiente') === 'pendiente');
  const entregados = pedidos.filter(p => p.pedidoEstado === 'entregado');

  const toggleSection = (key) => {
    setExpandedSection(prev => prev === key ? null : key);
    setRejectingId(null);
    setRejectReason('');
    setDeleteConfirmId(null);
  };

  const handleConfirmTime = async (pedido, { prepMin, envioMin, totalMin }) => {
    try {
      await updateDoc(doc(db, 'pedidos', pedido.id), {
        pedidoEstado: 'en_preparacion',
        tiempoPreparacionMin: prepMin,
        tiempoEnvioMin: envioMin,
        tiempoTotalMin: totalMin,
        confirmadoAt: serverTimestamp(),
      });
      notificarN8N({
        evento: 'solicitud_confirmada',
        document_id: pedido.id,
        tipo: 'pedido',
        tiempo_preparacion_min: prepMin,
        tiempo_envio_min: envioMin,
        tiempo_total_min: totalMin,
      });
      setConfirmTarget(null);
    } catch (err) {
      console.error('[Pedidos] Error confirmando:', err);
    }
  };

  const rejectPedido = async (id) => {
    if (!rejectReason.trim()) return;
    try {
      await updateDoc(doc(db, 'pedidos', id), {
        pedidoEstado: 'cancelado',
        pedidoRechazoMotivo: rejectReason.trim(),
      });
      notificarN8N({
        evento: 'solicitud_rechazada',
        document_id: id,
        tipo: 'pedido',
        motivo: rejectReason.trim(),
      });
      setRejectingId(null);
      setRejectReason('');
    } catch (err) {
      console.error('[Pedidos] Error rechazando:', err);
    }
  };

  const deletePedido = async (id) => {
    try {
      await deleteDoc(doc(db, 'pedidos', id));
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('[Pedidos] Error borrando:', err);
    }
  };

  const renderPedidos = (lista) => lista.map(p => (
    <PedidoCard
      key={p.id}
      p={p}
      onConfirm={setConfirmTarget}
      onStartReject={(id) => { setRejectingId(id); setRejectReason(''); }}
      rejectingId={rejectingId}
      rejectReason={rejectReason}
      onRejectReasonChange={setRejectReason}
      onReject={rejectPedido}
      onCancelReject={() => { setRejectingId(null); setRejectReason(''); }}
      deleteConfirmId={deleteConfirmId}
      onDeleteRequest={setDeleteConfirmId}
      onDelete={deletePedido}
      onCancelDelete={() => setDeleteConfirmId(null)}
      onOpenStateModal={setStateModalPedido}
    />
  ));

  return (
    <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <AccordionSection title="Todos" count={allPedidos.length} expanded={expandedSection === 'todos'} onToggle={() => toggleSection('todos')} accentColor={C.forest}>
        {renderPedidos(allPedidos)}
      </AccordionSection>

      <AccordionSection title="Pendientes" count={pendientes.length} expanded={expandedSection === 'pendientes'} onToggle={() => toggleSection('pendientes')} accentColor={C.forest}>
        {renderPedidos(pendientes)}
      </AccordionSection>

      <AccordionSection title="Entregados" count={entregados.length} expanded={expandedSection === 'entregados'} onToggle={() => toggleSection('entregados')} accentColor={C.forest}>
        {renderPedidos(entregados)}
      </AccordionSection>

      {stateModalPedido && (
        <PedidoStateModal
          pedido={stateModalPedido}
          onSelect={(key) => {
            if (key === 'en_preparacion') {
              setConfirmTarget(stateModalPedido);
            } else {
              updatePedidoEstado(stateModalPedido.id, key);
            }
            setStateModalPedido(null);
          }}
          onClose={() => setStateModalPedido(null)}
        />
      )}

      {confirmTarget && (
        <PedidoConfirmModal
          pedido={confirmTarget}
          onConfirm={(times) => handleConfirmTime(confirmTarget, times)}
          onClose={() => setConfirmTarget(null)}
        />
      )}
    </div>
  );
}

async function updatePedidoEstado(id, newEstado) {
  try {
    await updateDoc(doc(db, 'pedidos', id), { pedidoEstado: newEstado });
    if (newEstado === 'cancelado') {
      notificarN8N({
        evento: 'solicitud_rechazada',
        document_id: id,
        tipo: 'pedido',
        motivo: '',
      });
    }
  } catch (err) {
    console.error('[Pedidos] Error updating estado:', err);
  }
}
