import { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { C, inp, SERVICES, serviceFromTime } from '../utils';
import { Overlay, Field } from './ui';
import PhoneField from './PhoneField';

export default function ResModal({ editing, initialMode, preTable, tables, service, tableStatus, staff, tableNums, ownerByTable, mozoTableIds, onSave, onSavePedido, onDelete, onReject, onClose }) {
  const [mode, setMode] = useState(initialMode === 'pedido' ? 'pedido' : 'reserva');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [form, setForm] = useState(() => {
    const base = editing ? { ...editing } : {
      customerName: '', phone: '', partySize: 2,
      tableId: preTable?.id || '',
      time: new Date().toTimeString().slice(0, 5),
      notes: '',
      staffId: '',
    };
    // Al abrir desde una mesa del plano, auto-asignar el mozo dueño de esa mesa.
    if (base.tableId && !base.staffId && !editing) {
      const ownerId = ownerByTable[base.tableId];
      if (ownerId) base.staffId = ownerId;
    }
    return base;
  });
  // Form de pedido (staff)
  const [pedidoForm, setPedidoForm] = useState({
    customerName: '', phone: '', modalidad: 'retiro', direccion: '',
    details: '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setPedido = (k, v) => setPedidoForm(f => ({ ...f, [k]: v }));

  const valid = form.customerName.trim() && form.time && form.partySize > 0;
  const validPedido = pedidoForm.customerName.trim().length >= 2
    && pedidoForm.phone.trim().length >= 6
    && pedidoForm.details.trim().length >= 3
    && (pedidoForm.modalidad === 'retiro' || pedidoForm.direccion.trim().length >= 4);
  const svcForTime = serviceFromTime(form.time, service);
  const timeInOtherService = form.time && svcForTime !== service;

  // Al asignar un mozo, auto-seleccionar su primera mesa libre SOLO si el
  // usuario aún no eligió mesa, o si la mesa elegida no pertenece al mozo.
  // Nunca pisar una mesa que el usuario ya seleccionó de forma explícita.
  const handleStaffChange = (v) => {
    set('staffId', v);
    if (!v) return;
    if (form.tableId && ownerByTable[form.tableId] === v) return;
    for (const id of mozoTableIds[v] || []) {
      const t = tables.find(tbl => tbl.id === id);
      if (!t || t.capacity < form.partySize) continue;
      const st = tableStatus(id);
      if (st.status === 'free' || st.status === 'soon') {
        set('tableId', id);
        return;
      }
    }
  };

  return (
    <Overlay onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontFamily: '"Fraunces", serif', fontSize: '22px', fontStyle: 'italic', fontWeight: 600, color: C.forest, margin: 0 }}>
          {editing ? 'Editar reserva' : 'Nueva entrada'}
        </h3>
        <button onClick={onClose} style={{ background: C.creamDeep, border: 'none', borderRadius: '10px', padding: '8px', cursor: 'pointer', color: C.muted }}>
          <X size={18} />
        </button>
      </div>

      {/* Toggle Reservas / Pedidos */}
      {!editing && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
          <button onClick={() => setMode('reserva')} style={{
            flex: 1, padding: '10px', borderRadius: '10px', border: 'none', cursor: 'pointer',
            background: mode === 'reserva' ? C.forest : C.creamDeep,
            color: mode === 'reserva' ? C.white : C.muted,
            fontSize: '14px', fontWeight: 700, fontFamily: 'inherit',
          }}>
            Reservas
          </button>
          <button onClick={() => setMode('pedido')} style={{
            flex: 1, padding: '10px', borderRadius: '10px', border: 'none', cursor: 'pointer',
            background: mode === 'pedido' ? C.forest : C.creamDeep,
            color: mode === 'pedido' ? C.white : C.muted,
            fontSize: '14px', fontWeight: 700, fontFamily: 'inherit',
          }}>
            Pedidos
          </button>
        </div>
      )}

      {mode === 'reserva' ? (
        <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <Field label="Nombre">
          <input value={form.customerName} onChange={e => set('customerName', e.target.value)}
            placeholder="Nombre del cliente" style={inp} autoFocus />
        </Field>

        <PhoneField
          label="Teléfono (opcional)"
          value={form.phone}
          onChange={v => set('phone', v)}
          placeholder="11 5555-1234"
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Field label="Comensales">
            <select value={form.partySize} onChange={e => set('partySize', parseInt(e.target.value))} style={inp}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => <option key={n} value={n}>{n} personas</option>)}
            </select>
          </Field>
          {staff.length > 0 && (
            <Field label="Mozo asignado">
              <select value={form.staffId} onChange={e => handleStaffChange(e.target.value)} style={inp}>
                <option value="">— sin asignar —</option>
                {staff.filter(s => s.active !== false).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Field label="Mesa">
            <select value={form.tableId} onChange={e => set('tableId', e.target.value)} style={inp}>
              <option value="">— elegir —</option>
               {tables.filter(t => {
                  const s = tableStatus(t.id);
                  const isCurrentRes = editing && editing.tableId === t.id;
                  const matchesMozo = !form.staffId || ownerByTable[t.id] === form.staffId;
                  return (s.status === 'free' || s.status === 'soon' || isCurrentRes) && t.capacity >= form.partySize && matchesMozo;
                }).map(t => {
                  const num = tableNums[t.id];
                  return (
                    <option key={t.id} value={t.id}>
                      {num ? `Mesa ${num}` : t.name} ({t.capacity}p)
                    </option>
                  );
                })}
            </select>
          </Field>
          <Field label="Horario">
            <input type="time" value={form.time} onChange={e => set('time', e.target.value)} style={inp} />
          </Field>
        </div>

        {timeInOtherService && (
          <div style={{
            fontSize: '12px', background: C.soon + '22', color: C.espresso,
            border: `1px solid ${C.soon}66`, borderRadius: '10px', padding: '10px 12px',
          }}>
            El horario <strong>{form.time}</strong> corresponde al servicio de <strong>{SERVICES[svcForTime].name}</strong>. La reserva se guardará en <strong>{SERVICES[svcForTime].name}</strong>.
          </div>
        )}

        <Field label="Notas (opcional)">
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
            placeholder="Alergias, pedidos especiales..." rows={2}
            style={{ ...inp, resize: 'vertical' }} />
        </Field>
      </div>
        </>
      ) : (
      <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <Field label="Nombre">
          <input value={pedidoForm.customerName} onChange={e => setPedido('customerName', e.target.value)}
            placeholder="Nombre del cliente" style={inp} autoFocus />
        </Field>

        <PhoneField
          label="Teléfono"
          value={pedidoForm.phone}
          onChange={v => setPedido('phone', v)}
          placeholder="11 5555-1234"
        />

        <Field label="Detalle del pedido">
          <textarea value={pedidoForm.details} onChange={e => setPedido('details', e.target.value)}
            placeholder="¿Qué querés? Ej: 2 cafés con leche, 1 medialunas, 1 tostado..."
            rows={3} style={{ ...inp, resize: 'vertical' }} />
        </Field>

        <Field label="¿Retiro o envío?">
          <div style={{ display: 'flex', gap: '8px' }}>
            {[['retiro', 'Retiro en el local'], ['envio', 'Envío a domicilio']].map(([key, label]) => (
              <button key={key} type="button" onClick={() => setPedido('modalidad', key)} style={{
                flex: 1, padding: '12px 10px', borderRadius: '12px',
                border: `1.5px solid ${pedidoForm.modalidad === key ? C.forest : C.creamDeep}`,
                background: pedidoForm.modalidad === key ? `${C.forest}14` : C.white,
                color: pedidoForm.modalidad === key ? C.forest : C.muted,
                fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {label}
              </button>
            ))}
          </div>
        </Field>

        {pedidoForm.modalidad === 'envio' && (
          <Field label="Dirección de entrega">
            <input value={pedidoForm.direccion} onChange={e => setPedido('direccion', e.target.value)}
              placeholder="Calle y número" style={inp} />
          </Field>
        )}
      </div>
      </>
      )}

      <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
        {editing && mode === 'reserva' && onReject && (
          rejecting ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 2 }}>
              <input
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Motivo del rechazo..."
                style={inp}
                autoFocus
              />
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  disabled={!rejectReason.trim()}
                  onClick={async () => {
                    if (!rejectReason.trim()) return;
                    try {
                      await onReject(editing, rejectReason);
                      onClose();
                    } catch {
                      setRejecting(false);
                    }
                  }}
                  style={{
                    flex: 1, padding: '10px 12px', background: rejectReason.trim() ? '#e06060' : C.creamDeep,
                    border: 'none', borderRadius: '10px', cursor: rejectReason.trim() ? 'pointer' : 'not-allowed',
                    color: rejectReason.trim() ? '#fff' : C.muted, fontSize: '12px', fontWeight: 600, fontFamily: 'inherit',
                  }}
                >
                  Rechazar y avisar al cliente
                </button>
                <button onClick={() => { setRejecting(false); setRejectReason(''); }} style={{
                  padding: '10px 12px', background: C.creamDeep, border: 'none',
                  borderRadius: '10px', cursor: 'pointer', fontSize: '12px', color: C.muted, fontFamily: 'inherit',
                }}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setRejecting(true)} style={{
              padding: '14px', background: 'transparent', border: `1.5px solid #e06060`,
              borderRadius: '12px', cursor: 'pointer', color: '#e06060',
              fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
            }}>
              Rechazar
            </button>
          )
        )}
        {editing && (
          confirmDelete ? (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: '#e06060', fontWeight: 600 }}>¿Eliminar?</span>
              <button onClick={() => onDelete(editing)} style={{
                padding: '10px 14px', background: '#e06060', border: 'none',
                borderRadius: '10px', cursor: 'pointer', color: '#fff', fontSize: '12px', fontWeight: 600,
              }}>Sí</button>
              <button onClick={() => setConfirmDelete(false)} style={{
                padding: '10px 14px', background: C.creamDeep, border: 'none',
                borderRadius: '10px', cursor: 'pointer', fontSize: '12px', color: C.muted,
              }}>No</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} style={{
              padding: '14px', background: 'transparent', border: `1.5px solid #e06060`,
              borderRadius: '12px', cursor: 'pointer', color: '#e06060',
            }}>
              <Trash2 size={18} />
            </button>
          )
        )}
        {mode === 'reserva' ? (
          <button onClick={() => {
            if (!valid) return;
            const staffMember = staff.find(s => s.id === form.staffId);
            onSave({ ...form, service: svcForTime, staffName: staffMember?.name || '' });
          }} style={{
            flex: 1, padding: '14px', background: valid ? C.terra : C.creamDeep,
            border: 'none', borderRadius: '12px', cursor: valid ? 'pointer' : 'not-allowed',
            color: valid ? C.white : C.muted, fontSize: '15px', fontWeight: 600,
          }}>
            {editing ? 'Guardar cambios' : 'Confirmar reserva'}
          </button>
        ) : (
          <button onClick={() => {
            if (!validPedido) return;
            onSavePedido({ ...pedidoForm });
          }} style={{
            flex: 1, padding: '14px', background: validPedido ? C.terra : C.creamDeep,
            border: 'none', borderRadius: '12px', cursor: validPedido ? 'pointer' : 'not-allowed',
            color: validPedido ? C.white : C.muted, fontSize: '15px', fontWeight: 600,
          }}>
            Confirmar pedido
          </button>
        )}
      </div>
    </Overlay>
  );
}
