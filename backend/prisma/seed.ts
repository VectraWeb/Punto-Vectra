import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'admin@puntovectra.com';
const ADMIN_PASSWORD = 'admin123';

async function main() {
  // Organización por defecto: el frontend usa org 'default' como fallback.
  const org = await prisma.organization.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      name: 'PuntoVectra',
      businessType: 'restaurant',
      configuration: {},
      bookingFields: [],
      closedDates: [],
    },
  });
  console.log('[seed] Organización default OK:', org.id);

  // Config global ligada a la org default.
  const config = await prisma.config.upsert({
    where: { id: 'restaurant' },
    update: { organizationId: 'default' },
    create: {
      id: 'restaurant',
      organizationId: 'default',
      mesaTipos: [],
      sectors: [],
      positions: {},
      groups: [],
      groupOwners: {},
      businessType: 'restaurant',
      organizationName: 'Andi',
      resourceLabel: 'mesa',
      resourcePlural: 'mesas',
    },
  });
  console.log('[seed] Config restaurante OK:', config.id);

  // Sucursal principal de la org default.
  await prisma.branch.upsert({
    where: { organizationId_id: { organizationId: 'default', id: 'main' } },
    update: {},
    create: {
      id: 'main',
      organizationId: 'default',
      name: 'Sucursal principal',
    },
  });
  console.log('[seed] Branch main OK');

  // Usuario admin inicial (idempotente: si ya existe no lo duplica).
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    // Si el usuario ya existe no se toca (para no pisar su organización).
    update: {},
    create: {
      email: ADMIN_EMAIL,
      passwordHash,
      name: 'Administrador',
      role: 'owner',
      organizationId: 'default',
      branchId: 'main',
    },
  });
  console.log('[seed] Usuario admin OK:', ADMIN_EMAIL);

  // 10 mesas iniciales (solo si la org todavía no tiene recursos).
  const resourceCount = await prisma.resource.count({ where: { organizationId: 'default' } });
  if (resourceCount === 0) {
    await prisma.resource.createMany({
      data: Array.from({ length: 10 }, (_, i) => ({
        organizationId: 'default',
        branchId: 'main',
        name: `Mesa ${i + 1}`,
        type: 'table',
        capacity: 4,
        status: 'active',
        shape: 'square',
        number: i + 1,
        generated: false,
      })),
    });
    console.log('[seed] 10 mesas creadas');
  } else {
    console.log('[seed] Mesas existentes, no se crean:', resourceCount);
  }

  // Carta demo (solo si está vacía).
  const catalogCount = await prisma.catalogItem.count({ where: { organizationId: 'default' } });
  if (catalogCount === 0) {
    await prisma.catalogItem.createMany({
      data: [
        { organizationId: 'default', name: 'Coca-Cola', price: 2500, categoryId: 'Bebidas', type: 'product', active: true },
        { organizationId: 'default', name: 'Agua', price: 1500, categoryId: 'Bebidas', type: 'product', active: true },
        { organizationId: 'default', name: 'Cerveza', price: 3500, categoryId: 'Bebidas', type: 'product', active: true },
        { organizationId: 'default', name: 'Vacío', price: 18000, categoryId: 'Parrilla', type: 'product', active: true },
        { organizationId: 'default', name: 'Chorizo', price: 9000, categoryId: 'Parrilla', type: 'product', active: true },
        { organizationId: 'default', name: 'Fideos blancos', price: 12000, categoryId: 'Pastas', type: 'product', active: true },
        { organizationId: 'default', name: 'Ensalada mixta', price: 8000, categoryId: 'Ensaladas', type: 'product', active: true },
      ],
    });
    console.log('[seed] Carta demo creada');
  } else {
    console.log('[seed] Carta existente, no se crea:', catalogCount);
  }
}

main()
  .catch((e) => {
    console.error('[seed] Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());