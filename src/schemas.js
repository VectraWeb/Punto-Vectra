/**
 * @typedef {Object} Reservation
 * @property {string} id - ID único de la reserva.
 * @property {string} customerName - Nombre del cliente.
 * @property {string} [phone] - Teléfono de contacto (opcional).
 * @property {number} partySize - Cantidad de personas.
 * @property {string} tableId - ID de la mesa asignada (ej. "m1").
 * @property {string} time - Horario de la reserva (formato "HH:mm").
 * @property {number} duration - Duración en minutos.
 * @property {string} service - Tipo de servicio ("mediodia" | "cena").
 * @property {string} [notes] - Notas o pedidos especiales (opcional).
 * @property {string|null} liveState - Estado actual del mozo (ej. "esperando_cliente", "plato_principal").
 * @property {any} createdAt - Timestamp de creación (Firebase ServerTimestamp).
 * @property {any} updatedAt - Timestamp de última actualización (Firebase ServerTimestamp).
 */

/**
 * @typedef {Object} Table
 * @property {string} id - ID único de la mesa (ej. "m1").
 * @property {string} name - Nombre visible de la mesa (ej. "Mesa 1").
 * @property {number} capacity - Capacidad máxima de comensales.
 * @property {string} [status] - Estado derivado (opcional en DB: "free" | "busy" | "soon").
 */

/**
 * @typedef {Object} MesaTipo
 * @property {number} id - Identificador único del tipo.
 * @property {number} capacidad - Capacidad de comensales.
 * @property {'redonda'|'rectangular'|'cuadrada'} forma - Forma de la mesa.
 * @property {number} cantidad - Cuántas mesas de este tipo.
 */

/**
 * @typedef {MesaTipo[]} RestaurantConfig
 */
