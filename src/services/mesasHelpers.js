// mesasHelpers.js — ADAPTADOR DE COMPATIBILIDAD.
// Mantiene la API legacy (mesas) delegando en la capa genérica
// resourceService. Cualquier consumidor existente sigue funcionando sin cambios.

import {
  mesasCol,
  mesaDoc,
  buildMesasList,
  seedMesasIfNeeded,
  syncMesasWithConfig,
  subscribeMesas,
} from './resourceService';

export {
  mesasCol,
  mesaDoc,
  buildMesasList,
  seedMesasIfNeeded,
  syncMesasWithConfig,
  subscribeMesas,
};
