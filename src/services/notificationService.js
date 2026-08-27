// notificationService.js — Notificaciones centralizadas (Evento → Datos →
// Plantilla → Canal). Hoy el canal disponible es n8n/WhatsApp; la interfaz
// permite agregar in-app, email y SMS sin tocar la lógica de dominio.

import { notificarN8N } from '../utils';

const TEMPLATES = {
  'reservation.created': {
    n8n: (data) => ({ evento: 'reserva_creada', ...data }),
  },
  'reservation.confirmed': {
    n8n: (data) => ({ evento: 'solicitud_confirmada', document_id: data.id, tipo: 'reserva' }),
  },
  'reservation.cancelled': {
    n8n: (data) => ({ evento: 'reserva_cancelada', document_id: data.id, tipo: 'reserva' }),
  },
  'order.created': {
    n8n: (data) => ({ evento: 'pedido_creado', document_id: data.id, tipo: 'pedido' }),
  },
};

/**
 * Envía una notificación por canal. No lanza: los errores se registran.
 * @param {Object} opts { channel, event, recipient?, template?, data }
 */
export async function sendNotification({ channel = 'n8n', event, recipient = null, template = null, data = {} }) {
  try {
    if (channel === 'n8n') {
      const tpl = TEMPLATES[template || event];
      const payload = tpl ? tpl(data) : { evento: event, ...data };
      await notificarN8N(payload);
      return true;
    }
    if (channel === 'inapp') {
      // Canal futuro: se emite como evento para la capa UI.
      const { emitDomainEvent } = await import('../core/events');
      emitDomainEvent('notification.inapp', { event, recipient, data });
      return true;
    }
    console.warn(`[notifications] Canal desconocido: ${channel}`);
    return false;
  } catch (e) {
    console.warn('[notifications] Error enviando notificación:', e);
    return false;
  }
}
