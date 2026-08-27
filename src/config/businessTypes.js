// businessTypes.js — Configuración centralizada de tipos de negocio.
// Un negocio es una "organization" con businessType; cada tipo define las
// etiquetas visibles, el label del recurso reservable y los campos que se
// piden al crear una reserva (bookingFields).

export const BUSINESS_TYPES = {
  restaurant: {
    label: 'Restaurante',
    resourceLabel: 'Mesa',
    resourcePlural: 'Mesas',
    article: { singular: 'la', plural: 'las', fem: true },
    reserveAction: 'Reservar mesa',
    reserveHint: 'Elegí fecha, horario y comensales',
    resourceType: 'table',
    hasWaiters: true,
    hasSectors: true,
    hasOrders: true,
    serviceLabels: { mediodia: 'Mediodía', cena: 'Cena' },
    defaultResourceSeed: { count: 6, capacity: 4 },
    terminology: { reservation: 'Reserva', order: 'Pedido', customer: 'Cliente' },
    features: { reservations: true, orders: true, catalog: true, payments: true, inventory: false, employees: true, waitlist: true },
    defaultBookingFields: [
      { name: 'guests', label: 'Cantidad de personas', type: 'number', required: true },
      { name: 'occasion', label: 'Ocasión', type: 'select', required: false, options: ['Ninguna', 'Cumpleaños', 'Aniversario', 'Negocios'] },
    ],
  },

  salon: {
    label: 'Peluquería',
    resourceLabel: 'Profesional',
    resourcePlural: 'Profesionales',
    article: { singular: 'el', plural: 'los', fem: false },
    reserveAction: 'Reservar turno',
    reserveHint: 'Elegí profesional, fecha y horario',
    resourceType: 'professional',
    hasWaiters: false,
    hasSectors: false,
    hasOrders: false,
    serviceLabels: { mediodia: 'Mañana', cena: 'Tarde' },
    defaultResourceSeed: { count: 3, capacity: 1 },
    terminology: { reservation: 'Turno', order: 'Servicio', customer: 'Cliente' },
    features: { reservations: true, orders: false, catalog: true, payments: true, inventory: false, employees: false, waitlist: true },
    defaultBookingFields: [
      { name: 'service', label: 'Servicio', type: 'select', required: true, options: ['Corte', 'Color', 'Peinado', 'Barba'] },
      { name: 'duration', label: 'Duración (min)', type: 'number', required: false },
    ],
  },

  sports: {
    label: 'Complejo Deportivo',
    resourceLabel: 'Cancha',
    resourcePlural: 'Canchas',
    article: { singular: 'la', plural: 'las', fem: true },
    reserveAction: 'Reservar cancha',
    reserveHint: 'Elegí cancha, fecha y horario',
    resourceType: 'court',
    hasWaiters: false,
    hasSectors: false,
    hasOrders: false,
    serviceLabels: { mediodia: 'Mañana', cena: 'Tarde' },
    defaultResourceSeed: { count: 3, capacity: 10 },
    terminology: { reservation: 'Reserva', order: 'Pedido', customer: 'Cliente' },
    features: { reservations: true, orders: false, catalog: true, payments: true, inventory: false, employees: false, waitlist: true },
    defaultBookingFields: [
      { name: 'players', label: 'Cantidad de jugadores', type: 'number', required: false },
      { name: 'sport', label: 'Deporte', type: 'select', required: false, options: ['Fútbol', 'Padel', 'Tenis', 'Básquet'] },
    ],
  },

  hotel: {
    label: 'Hotel',
    resourceLabel: 'Habitación',
    resourcePlural: 'Habitaciones',
    article: { singular: 'la', plural: 'las', fem: true },
    reserveAction: 'Reservar habitación',
    reserveHint: 'Elegí habitación, fecha y horario',
    resourceType: 'room',
    hasWaiters: false,
    hasSectors: false,
    hasOrders: false,
    serviceLabels: { mediodia: 'Mañana', cena: 'Tarde' },
    defaultResourceSeed: { count: 4, capacity: 2 },
    terminology: { reservation: 'Estadía', order: 'Consumo', customer: 'Huésped' },
    features: { reservations: true, orders: true, catalog: true, payments: true, inventory: false, employees: false, waitlist: true },
    defaultBookingFields: [
      { name: 'guests', label: 'Cantidad de huéspedes', type: 'number', required: true },
      { name: 'beds', label: 'Camas', type: 'number', required: false },
    ],
  },

  coworking: {
    label: 'Coworking',
    resourceLabel: 'Espacio',
    resourcePlural: 'Espacios',
    article: { singular: 'el', plural: 'los', fem: false },
    reserveAction: 'Reservar espacio',
    reserveHint: 'Elegí espacio, fecha y horario',
    resourceType: 'space',
    hasWaiters: false,
    hasSectors: false,
    hasOrders: false,
    serviceLabels: { mediodia: 'Mañana', cena: 'Tarde' },
    defaultResourceSeed: { count: 4, capacity: 4 },
    terminology: { reservation: 'Reserva', order: 'Servicio', customer: 'Miembro' },
    features: { reservations: true, orders: false, catalog: true, payments: true, inventory: false, employees: false, waitlist: true },
    defaultBookingFields: [
      { name: 'guests', label: 'Cantidad de personas', type: 'number', required: false },
      { name: 'purpose', label: 'Motivo', type: 'text', required: false },
    ],
  },

  healthcare: {
    label: 'Consultorio',
    resourceLabel: 'Profesional',
    resourcePlural: 'Profesionales',
    article: { singular: 'el', plural: 'los', fem: false },
    reserveAction: 'Reservar turno',
    reserveHint: 'Elegí profesional, fecha y horario',
    resourceType: 'professional',
    hasWaiters: false,
    hasSectors: false,
    hasOrders: false,
    serviceLabels: { mediodia: 'Mañana', cena: 'Tarde' },
    defaultResourceSeed: { count: 2, capacity: 1 },
    terminology: { reservation: 'Turno', order: 'Consulta', customer: 'Paciente' },
    features: { reservations: true, orders: false, catalog: true, payments: false, inventory: false, employees: false, waitlist: true },
    defaultBookingFields: [
      { name: 'service', label: 'Servicio', type: 'select', required: true, options: ['Consulta', 'Control', 'Urgencia'] },
      { name: 'reason', label: 'Motivo de consulta', type: 'text', required: false },
    ],
  },

  custom: {
    label: 'Personalizado',
    resourceLabel: 'Recurso',
    resourcePlural: 'Recursos',
    article: { singular: 'el', plural: 'los', fem: false },
    reserveAction: 'Reservar recurso',
    reserveHint: 'Elegí recurso, fecha y horario',
    resourceType: 'custom',
    hasWaiters: false,
    hasSectors: false,
    hasOrders: false,
    serviceLabels: { mediodia: 'Mañana', cena: 'Tarde' },
    defaultResourceSeed: { count: 3, capacity: 4 },
    terminology: { reservation: 'Reserva', order: 'Pedido', customer: 'Cliente' },
    features: { reservations: true, orders: false, catalog: true, payments: false, inventory: false, employees: false, waitlist: true },
    defaultBookingFields: [
      { name: 'guests', label: 'Cantidad de personas', type: 'number', required: false },
    ],
  },
};

export const DEFAULT_BUSINESS_TYPE = 'restaurant';
export const DEFAULT_ORG_ID = 'default';

// Organización por defecto: garantiza que la app siga funcionando como
// restaurante aunque no exista el documento organizations/default en Firestore.
export const DEFAULT_ORGANIZATION = {
  id: DEFAULT_ORG_ID,
  name: 'Andi',
  businessType: DEFAULT_BUSINESS_TYPE,
  logo: '',
  configuration: {},
  bookingFields: BUSINESS_TYPES[DEFAULT_BUSINESS_TYPE].defaultBookingFields,
  closedDates: [],
  createdAt: null,
};

export function getBusinessType(type) {
  return BUSINESS_TYPES[type] || BUSINESS_TYPES[DEFAULT_BUSINESS_TYPE];
}

// Resuelve el label de recurso según la organización (o el default).
export function resourceLabelOf(organization) {
  const t = getBusinessType(organization?.businessType);
  if (organization?.configuration?.resourceLabel) return organization.configuration.resourceLabel;
  return t.resourceLabel;
}

export function resourcePluralOf(organization) {
  const t = getBusinessType(organization?.businessType);
  if (organization?.configuration?.resourcePlural) return organization.configuration.resourcePlural;
  return t.resourcePlural;
}

// Artículos según género del recurso (ej: "la mesa" / "el profesional").
export function articleOf(organization) {
  return getBusinessType(organization?.businessType).article || { singular: 'el', plural: 'los', fem: false };
}

// Acción de reserva visible (botones/links públicos).
export function reserveActionOf(organization) {
  const t = getBusinessType(organization?.businessType);
  if (organization?.configuration?.reserveAction) return organization.configuration.reserveAction;
  return t.reserveAction;
}

// Label visible de un servicio/turno según el rubro (restaurante: Mediodía/Cena;
// resto: Mañana/Tarde).
export function serviceLabelOf(organization, serviceKey) {
  const t = getBusinessType(organization?.businessType);
  return (t.serviceLabels && t.serviceLabels[serviceKey]) || serviceKey;
}

// ¿El rubro usa comensales/personas como campo base del formulario público?
export function businessUsesGuests(organization) {
  const fields = bookingFieldsOf(organization);
  return fields.some(f => f && f.name === 'guests');
}

// ¿El rubro tiene pedidos de comida?
export function businessHasOrders(organization) {
  return featureEnabled(organization, 'orders');
}

// Terminología del rubro (todas las vistas consumen esto).
export function terminologyOf(organization) {
  const t = getBusinessType(organization?.businessType);
  return {
    resource: resourceLabelOf(organization),
    resourcePlural: resourcePluralOf(organization),
    reservation: t.terminology?.reservation || 'Reserva',
    order: t.terminology?.order || 'Pedido',
    customer: t.terminology?.customer || 'Cliente',
  };
}

// Feature flags: la organización puede sobreescribir en configuration.features.
export function featureEnabled(organization, feature) {
  const t = getBusinessType(organization?.businessType);
  const base = t.features || {};
  const override = organization?.configuration?.features?.[feature];
  return override !== undefined ? Boolean(override) : Boolean(base[feature]);
}

// Plantilla inicial de recursos para un negocio nuevo.
export function defaultResourceSeedOf(organization) {
  return getBusinessType(organization?.businessType).defaultResourceSeed || { count: 3, capacity: 1 };
}

// El tipo de recurso reservable que genera un negocio (ej: restaurant → table).
export function resourceTypeOf(organization) {
  const t = getBusinessType(organization?.businessType);
  if (organization?.configuration?.resourceType) return organization.configuration.resourceType;
  return t.resourceType || 'table';
}

// Campos de reserva configurables por organización.
export function bookingFieldsOf(organization) {
  if (Array.isArray(organization?.bookingFields) && organization.bookingFields.length > 0) {
    return organization.bookingFields;
  }
  return getBusinessType(organization?.businessType).defaultBookingFields;
}

// Campos que ya cubre el formulario base de reserva (no se duplican como
// campos personalizados en DynamicFields).
export const CORE_BOOKING_FIELD_NAMES = new Set([
  'guests', 'partySize', 'notes', 'phone', 'customerName', 'staffId', 'tableId', 'resourceId', 'time', 'date',
]);
