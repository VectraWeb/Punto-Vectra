// migrations.js — Migraciones — en la nueva arquitectura las migraciones
// se manejan con Prisma en el backend.

export async function migrateReservationsToGeneric() {
  console.log('[migrations] Las migraciones se manejan en el backend con Prisma.');
  return 0;
}

export async function migrateMesasToResources() {
  console.log('[migrations] Las migraciones se manejan en el backend con Prisma.');
  return 0;
}
