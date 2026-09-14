// notificationService.js — Notificaciones centralizadas.

/**
 * Envía una notificación por canal.
 */
export async function sendNotification({ channel = 'n8n', event, recipient = null, template = null, data = {} }) {
  // In the new architecture, notifications are handled server-side
  // or via webhooks configured in the backend
  console.log(`[notifications] Event: ${event}`, data);
  return true;
}
