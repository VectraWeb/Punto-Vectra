// mesasHelpers.js — ADAPTADOR DE COMPATIBILIDAD.
// Mantiene la API legacy (mesas) delegando en la capa genérica
// resourceService.

import {
  getResources,
  seedResourcesIfNeeded,
  syncResourcesWithConfig,
  subscribeResources,
} from './resourceService';

export const mesasCol = () => null;
export const mesaDoc = (id) => null;

export const buildMesasList = (config) => {
  const { buildResources } = require('../utils');
  return buildResources(config, { type: 'table' });
};

export async function seedMesasIfNeeded(config) {
  return seedResourcesIfNeeded(config, { resourceType: 'table' });
}

export async function syncMesasWithConfig(config) {
  return syncResourcesWithConfig(config, { resourceType: 'table' });
}

export function subscribeMesas(callback) {
  return subscribeResources((resources) => {
    callback(resources);
  }, { type: 'table' });
}
