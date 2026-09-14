import { prisma } from '../index';

const DEFAULT_ID = 'restaurant';

export async function getById(id: string) {
  const config = await prisma.config.findFirst({
    where: { OR: [{ id }, { organizationId: id }] },
  });
  if (!config) {
    return { id: DEFAULT_ID, data: {}, createdAt: null, updatedAt: null };
  }
  return config;
}

function pickData(data: any) {
  return {
    mesaTipos: data.mesaTipos ?? [],
    sectors: data.sectors ?? [],
    positions: data.positions ?? {},
    groups: data.groups ?? [],
    groupOwners: data.groupOwners ?? {},
    businessType: data.businessType ?? null,
    organizationName: data.organizationName ?? null,
    resourceLabel: data.resourceLabel ?? null,
    resourcePlural: data.resourcePlural ?? null,
  };
}

export async function create(id: string, data: any) {
  const existing = await prisma.config.findFirst({
    where: { OR: [{ id }, { organizationId: id }] },
  });
  if (existing) {
    throw new Error('Config already exists');
  }

  return prisma.config.create({
    data: {
      id,
      organizationId: id,
      ...pickData(data),
    },
  });
}

export async function update(id: string, data: any) {
  const existing = await prisma.config.findFirst({
    where: { OR: [{ id }, { organizationId: id }] },
  });

  const payload = pickData(data);

  if (existing) {
    return prisma.config.update({
      where: { id: existing.id },
      data: payload,
    });
  }

  return prisma.config.create({
    data: {
      id,
      organizationId: id,
      ...payload,
    },
  });
}

export async function patch(id: string, data: any) {
  const existing = await prisma.config.findFirst({
    where: { OR: [{ id }, { organizationId: id }] },
  });

  if (existing) {
    const current = existing as any;
    return prisma.config.update({
      where: { id: existing.id },
      data: {
        mesaTipos: data.mesaTipos ?? current.mesaTipos ?? [],
        sectors: data.sectors ?? current.sectors ?? [],
        positions: data.positions ?? current.positions ?? {},
        groups: data.groups ?? current.groups ?? [],
        groupOwners: data.groupOwners ?? current.groupOwners ?? {},
        businessType: data.businessType ?? current.businessType,
        organizationName: data.organizationName ?? current.organizationName,
        resourceLabel: data.resourceLabel ?? current.resourceLabel,
        resourcePlural: data.resourcePlural ?? current.resourcePlural,
      },
    });
  }

  return prisma.config.create({
    data: {
      id,
      organizationId: id,
      ...pickData(data),
    },
  });
}