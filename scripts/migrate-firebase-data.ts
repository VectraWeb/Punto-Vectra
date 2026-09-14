/**
 * Firebase to PostgreSQL Migration Script
 * 
 * This script migrates data from Firebase Firestore to PostgreSQL.
 * 
 * Usage:
 * 1. Export your Firebase data to JSON files
 * 2. Place the JSON files in a ./data directory
 * 3. Run: npx tsx scripts/migrate-firebase-data.ts
 * 
 * Required JSON files:
 * - organizations.json
 * - users.json
 * - branches.json
 * - resources.json (or mesas.json)
 * - reservations.json
 * - pedidos.json (orders)
 * - catalog.json
 * - customers.json
 * - staff.json
 * - config.json
 * - auditLogs.json
 * - mesasReservadas.json (resource locks)
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface FirebaseDoc {
  id: string;
  [key: string]: any;
}

function loadJsonFile(filename: string): FirebaseDoc[] {
  const filePath = path.join(__dirname, 'data', filename);
  if (!fs.existsSync(filePath)) {
    console.warn(`[Migration] File not found: ${filePath}`);
    return [];
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  
  // Handle both array format and object format
  if (Array.isArray(data)) {
    return data;
  }
  if (typeof data === 'object' && data !== null) {
    return Object.entries(data).map(([id, value]) => ({
      id,
      ...(typeof value === 'object' ? value : {}),
    }));
  }
  return [];
}

async function migrateOrganizations() {
  console.log('[Migration] Migrating organizations...');
  const docs = loadJsonFile('organizations.json');
  
  for (const doc of docs) {
    try {
      await prisma.organization.upsert({
        where: { id: doc.id },
        create: {
          id: doc.id,
          name: doc.name || 'Andi',
          businessType: doc.businessType || 'restaurant',
          logo: doc.logo || '',
          ownerUid: doc.ownerUid,
          configuration: doc.configuration || {},
          bookingFields: doc.bookingFields || [],
          closedDates: doc.closedDates || [],
        },
        update: {
          name: doc.name,
          businessType: doc.businessType,
          logo: doc.logo,
          ownerUid: doc.ownerUid,
          configuration: doc.configuration,
          bookingFields: doc.bookingFields,
          closedDates: doc.closedDates,
        },
      });
      console.log(`  ✓ Organization: ${doc.id}`);
    } catch (error) {
      console.error(`  ✗ Organization ${doc.id}:`, error.message);
    }
  }
}

async function migrateUsers() {
  console.log('[Migration] Migrating users...');
  const docs = loadJsonFile('users.json');
  
  for (const doc of docs) {
    try {
      await prisma.user.upsert({
        where: { uid: doc.id },
        create: {
          uid: doc.id,
          organizationId: doc.organizationId || 'default',
          email: doc.email || '',
          passwordHash: 'migrated-password-hash',
          role: doc.role || 'owner',
          permissions: doc.permissions || {},
        },
        update: {
          organizationId: doc.organizationId,
          email: doc.email,
          role: doc.role,
          permissions: doc.permissions,
        },
      });
      console.log(`  ✓ User: ${doc.id}`);
    } catch (error) {
      console.error(`  ✗ User ${doc.id}:`, error.message);
    }
  }
}

async function migrateBranches() {
  console.log('[Migration] Migrating branches...');
  const docs = loadJsonFile('branches.json');
  
  for (const doc of docs) {
    try {
      const orgId = doc.organizationId || 'default';
      await prisma.branch.upsert({
        where: { organizationId_id: { organizationId: orgId, id: doc.id } },
        create: {
          id: doc.id,
          organizationId: orgId,
          name: doc.name || 'Sucursal principal',
          address: doc.address || {},
          timezone: doc.timezone || 'America/Argentina/Buenos_Aires',
          businessHours: doc.businessHours || {},
          settings: doc.settings || {},
        },
        update: {
          name: doc.name,
          address: doc.address,
          timezone: doc.timezone,
          businessHours: doc.businessHours,
          settings: doc.settings,
        },
      });
      console.log(`  ✓ Branch: ${doc.id}`);
    } catch (error) {
      console.error(`  ✗ Branch ${doc.id}:`, error.message);
    }
  }
}

async function migrateResources() {
  console.log('[Migration] Migrating resources...');
  
  // Try resources first, then fall back to mesas
  let docs = loadJsonFile('resources.json');
  if (docs.length === 0) {
    docs = loadJsonFile('mesas.json');
  }
  
  for (const doc of docs) {
    try {
      const orgId = doc.organizationId || 'default';
      await prisma.resource.upsert({
        where: { organizationId_id: { organizationId: orgId, id: doc.id } },
        create: {
          id: doc.id,
          organizationId: orgId,
          name: doc.name || `Recurso ${doc.id}`,
          type: doc.type || 'table',
          capacity: doc.capacity || 0,
          status: doc.status || 'active',
          position: doc.position || null,
          width: doc.width || 0,
          height: doc.height || 0,
          shape: doc.shape || 'rectangular',
          metadata: doc.metadata || {},
          number: doc.number,
          generated: doc.generated !== false,
        },
        update: {
          name: doc.name,
          type: doc.type,
          capacity: doc.capacity,
          status: doc.status,
          position: doc.position,
          shape: doc.shape,
          metadata: doc.metadata,
          number: doc.number,
          generated: doc.generated,
        },
      });
      console.log(`  ✓ Resource: ${doc.id}`);
    } catch (error) {
      console.error(`  ✗ Resource ${doc.id}:`, error.message);
    }
  }
}

async function migrateReservations() {
  console.log('[Migration] Migrating reservations...');
  const docs = loadJsonFile('reservations.json');
  
  for (const doc of docs) {
    try {
      await prisma.reservation.upsert({
        where: { id: doc.id },
        create: {
          id: doc.id,
          organizationId: doc.organizationId || 'default',
          branchId: doc.branchId || 'main',
          customerId: doc.customerId || null,
          customerName: doc.customerName || '',
          phone: doc.phone || doc.customerPhone || '',
          customerPhone: doc.customerPhone || '',
          resourceId: doc.resourceId || doc.tableId || doc.mesa_id || null,
          mesaId: doc.mesa_id || doc.tableId || null,
          mesa: doc.mesa || null,
          service: doc.service || '',
          date: doc.date || '',
          time: doc.time || '',
          duration: doc.duration || null,
          partySize: doc.partySize || null,
          notes: doc.notes || '',
          status: doc.status || 'pending',
          estado: doc.estado || 'pendiente',
          liveState: doc.liveState || null,
          stateLog: doc.stateLog || [],
          staffId: doc.staffId || null,
          staffName: doc.staffName || null,
          source: doc.source || 'web',
          metadata: doc.metadata || {},
          startedAt: doc.startedAt ? new Date(doc.startedAt) : null,
          leftAt: doc.leftAt ? new Date(doc.leftAt) : null,
          cleaningStartedAt: doc.cleaningStartedAt ? new Date(doc.cleaningStartedAt) : null,
          cleaningCompletedAt: doc.cleaningCompletedAt ? new Date(doc.cleaningCompletedAt) : null,
          rechazoMotivo: doc.rechazoMotivo || null,
          canceladoMotivo: doc.canceladoMotivo || null,
        },
        update: {
          organizationId: doc.organizationId,
          branchId: doc.branchId,
          customerId: doc.customerId,
          customerName: doc.customerName,
          phone: doc.phone || doc.customerPhone,
          resourceId: doc.resourceId || doc.tableId || doc.mesa_id,
          service: doc.service,
          date: doc.date,
          time: doc.time,
          status: doc.status,
          estado: doc.estado,
          liveState: doc.liveState,
          stateLog: doc.stateLog,
        },
      });
      console.log(`  ✓ Reservation: ${doc.id}`);
    } catch (error) {
      console.error(`  ✗ Reservation ${doc.id}:`, error.message);
    }
  }
}

async function migrateOrders() {
  console.log('[Migration] Migrating orders (pedidos)...');
  const docs = loadJsonFile('pedidos.json');
  
  for (const doc of docs) {
    try {
      await prisma.order.upsert({
        where: { id: doc.id },
        create: {
          id: doc.id,
          organizationId: doc.organizationId || 'default',
          branchId: doc.branchId || 'main',
          customerId: doc.customerId || null,
          customerName: doc.customerName || '',
          phone: doc.phone || doc.customerPhone || '',
          customerPhone: doc.customerPhone || '',
          reservationId: doc.reservationId || null,
          resourceId: doc.resourceId || null,
          items: doc.items || [],
          status: doc.status || 'created',
          pedidoEstado: doc.pedidoEstado || 'pendiente',
          totals: doc.totals || {},
          modalidad: doc.modalidad || null,
          direccion: doc.direccion || '',
          notes: doc.notes || '',
          tipo: doc.tipo || 'pedido',
          date: doc.date || '',
          service: doc.service || '',
          source: doc.source || 'web',
          metadata: doc.metadata || {},
        },
        update: {
          status: doc.status,
          pedidoEstado: doc.pedidoEstado,
          items: doc.items,
          totals: doc.totals,
        },
      });
      console.log(`  ✓ Order: ${doc.id}`);
    } catch (error) {
      console.error(`  ✗ Order ${doc.id}:`, error.message);
    }
  }
}

async function migrateCatalog() {
  console.log('[Migration] Migrating catalog...');
  const docs = loadJsonFile('catalog.json');
  
  for (const doc of docs) {
    try {
      await prisma.catalogItem.upsert({
        where: { id: doc.id },
        create: {
          id: doc.id,
          organizationId: doc.organizationId || 'default',
          branchId: doc.branchId || null,
          type: doc.type || 'product',
          name: doc.name || '',
          description: doc.description || '',
          categoryId: doc.categoryId || null,
          price: doc.price || 0,
          duration: doc.duration || null,
          active: doc.active !== false,
          metadata: doc.metadata || {},
        },
        update: {
          name: doc.name,
          description: doc.description,
          price: doc.price,
          duration: doc.duration,
          active: doc.active,
          metadata: doc.metadata,
        },
      });
      console.log(`  ✓ Catalog item: ${doc.id}`);
    } catch (error) {
      console.error(`  ✗ Catalog item ${doc.id}:`, error.message);
    }
  }
}

async function migrateCustomers() {
  console.log('[Migration] Migrating customers...');
  const docs = loadJsonFile('customers.json');
  
  for (const doc of docs) {
    try {
      const phone = (doc.phone || '').replace(/[^0-9]/g, '');
      await prisma.customer.upsert({
        where: { organizationId_phone: { organizationId: doc.organizationId || 'default', phone } },
        create: {
          id: doc.id,
          organizationId: doc.organizationId || 'default',
          branchId: doc.branchId || null,
          name: doc.name || '',
          phone,
          email: doc.email || '',
          contact: doc.contact || {},
          tags: doc.tags || [],
          notes: doc.notes || '',
          preferences: doc.preferences || {},
          stats: doc.stats || {},
        },
        update: {
          name: doc.name,
          email: doc.email,
          contact: doc.contact,
          tags: doc.tags,
          notes: doc.notes,
          preferences: doc.preferences,
          stats: doc.stats,
        },
      });
      console.log(`  ✓ Customer: ${doc.id}`);
    } catch (error) {
      console.error(`  ✗ Customer ${doc.id}:`, error.message);
    }
  }
}

async function migrateStaff() {
  console.log('[Migration] Migrating staff...');
  const docs = loadJsonFile('staff.json');
  
  for (const doc of docs) {
    try {
      await prisma.staff.upsert({
        where: { id: doc.id },
        create: {
          id: doc.id,
          organizationId: doc.organizationId || 'default',
          name: doc.name || '',
          active: doc.active !== false,
          assignedTables: doc.assignedTables || [],
        },
        update: {
          name: doc.name,
          active: doc.active,
          assignedTables: doc.assignedTables,
        },
      });
      console.log(`  ✓ Staff: ${doc.id}`);
    } catch (error) {
      console.error(`  ✗ Staff ${doc.id}:`, error.message);
    }
  }
}

async function migrateConfig() {
  console.log('[Migration] Migrating config...');
  const docs = loadJsonFile('config.json');
  
  for (const doc of docs) {
    try {
      await prisma.config.upsert({
        where: { id: doc.id },
        create: {
          id: doc.id,
          organizationId: doc.organizationId || null,
          mesaTipos: doc.mesaTipos || [],
          sectors: doc.sectors || [],
          positions: doc.positions || {},
          groups: doc.groups || [],
          groupOwners: doc.groupOwners || {},
          businessType: doc.businessType || null,
          organizationName: doc.organizationName || null,
          resourceLabel: doc.resourceLabel || null,
          resourcePlural: doc.resourcePlural || null,
        },
        update: {
          mesaTipos: doc.mesaTipos,
          sectors: doc.sectors,
          positions: doc.positions,
          groups: doc.groups,
          groupOwners: doc.groupOwners,
          businessType: doc.businessType,
          organizationName: doc.organizationName,
          resourceLabel: doc.resourceLabel,
          resourcePlural: doc.resourcePlural,
        },
      });
      console.log(`  ✓ Config: ${doc.id}`);
    } catch (error) {
      console.error(`  ✗ Config ${doc.id}:`, error.message);
    }
  }
}

async function migrateAuditLogs() {
  console.log('[Migration] Migrating audit logs...');
  const docs = loadJsonFile('auditLogs.json');
  
  for (const doc of docs) {
    try {
      await prisma.auditLog.create({
        data: {
          id: doc.id,
          organizationId: doc.organizationId || 'default',
          actorId: doc.actorId || null,
          action: doc.action || '',
          entityType: doc.entityType || 'generic',
          entityId: doc.entityId || null,
          previousData: doc.previousData || null,
          newData: doc.newData || null,
          metadata: doc.metadata || null,
          createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
        },
      });
      console.log(`  ✓ Audit log: ${doc.id}`);
    } catch (error) {
      console.error(`  ✗ Audit log ${doc.id}:`, error.message);
    }
  }
}

async function migrateResourceLocks() {
  console.log('[Migration] Migrating resource locks...');
  const docs = loadJsonFile('mesasReservadas.json');
  
  for (const doc of docs) {
    try {
      await prisma.resourceLock.upsert({
        where: { id: doc.id },
        create: {
          id: doc.id,
          organizationId: doc.organizationId || 'default',
          reservationId: doc.reservationId || '',
          time: doc.time || '',
          partySize: doc.partySize || null,
        },
        update: {
          reservationId: doc.reservationId,
          time: doc.time,
          partySize: doc.partySize,
        },
      });
      console.log(`  ✓ Resource lock: ${doc.id}`);
    } catch (error) {
      console.error(`  ✗ Resource lock ${doc.id}:`, error.message);
    }
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Firebase to PostgreSQL Migration');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  // Create data directory if it doesn't exist
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('[Migration] Created data directory:', dataDir);
    console.log('[Migration] Please place your Firebase export JSON files in this directory.');
    console.log('[Migration] Required files: organizations.json, users.json, etc.');
    console.log('');
    console.log('[Migration] To export from Firebase:');
    console.log('  1. Go to Firebase Console > Firestore Database');
    console.log('  2. Export each collection to JSON');
    console.log('  3. Place the files in:', dataDir);
    console.log('');
    return;
  }

  try {
    await migrateOrganizations();
    await migrateUsers();
    await migrateBranches();
    await migrateResources();
    await migrateReservations();
    await migrateOrders();
    await migrateCatalog();
    await migrateCustomers();
    await migrateStaff();
    await migrateConfig();
    await migrateAuditLogs();
    await migrateResourceLocks();

    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Migration completed successfully!');
    console.log('═══════════════════════════════════════════════════════════');
  } catch (error) {
    console.error('');
    console.error('═══════════════════════════════════════════════════════════');
    console.error('  Migration failed:', error.message);
    console.error('═══════════════════════════════════════════════════════════');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
