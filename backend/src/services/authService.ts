import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';
import { config } from '../config';
import { appError } from '../middleware/errorHandler';
import { AuthUser } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

interface RegisterInput {
  email: string;
  password: string;
  businessType?: string;
  name: string;
  resourceLabel?: string;
  resourcePlural?: string;
  resourceCount?: number;
  capacity?: number;
}

interface LoginInput {
  email: string;
  password: string;
}

export async function register(data: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    throw appError('EMAIL_EXISTS', 'Email already registered', 409);
  }

  const passwordHash = await bcrypt.hash(data.password, 12);

  const orgId = `org_${uuidv4()}`;

  const organization = await prisma.organization.create({
    data: {
      id: orgId,
      name: data.name,
      businessType: data.businessType || 'restaurant',
      configuration: {
        resourceLabel: data.resourceLabel || 'Mesa',
        resourcePlural: data.resourcePlural || 'Mesas',
        resourceType: getBusinessTypeConfig(data.businessType || 'restaurant').resourceType,
      },
      bookingFields: getBusinessTypeConfig(data.businessType || 'restaurant').defaultBookingFields,
    },
  });

  await prisma.branch.create({
    data: {
      id: 'main',
      organizationId: orgId,
      name: 'Sucursal principal',
      timezone: 'America/Argentina/Buenos_Aires',
    },
  });

  const resourceCount = data.resourceCount || 3;
  const capacity = data.capacity || 1;
  const type = getBusinessTypeConfig(data.businessType || 'restaurant').resourceType;
  const label = data.resourceLabel || 'Mesa';
  const resources = [];
  for (let i = 1; i <= resourceCount; i++) {
    resources.push({
      organizationId: orgId,
      branchId: 'main',
      name: `${label} ${i}`,
      type,
      capacity,
      status: 'active',
      shape: getShapeByType(type),
      number: i,
      generated: true,
    });
  }
  await prisma.resource.createMany({ data: resources });

  const user = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash,
      name: data.name,
      role: 'owner',
      organizationId: orgId,
      branchId: 'main',
    },
  });

  const configResources = resources;

  const configLabel = data.resourceLabel || 'Mesa';
  const configPlural = data.resourcePlural || 'Mesas';

  await prisma.config.create({
    data: {
      id: orgId,
      organizationId: orgId,
      mesaTipos: [
        {
          nombre: configLabel,
          cantidad: configResources.length,
          capacidad: data.capacity || 1,
        },
      ],
      sectors: [],
      positions: {},
      groups: [],
      groupOwners: {},
      businessType: data.businessType || 'restaurant',
      organizationName: data.name,
      resourceLabel: configLabel.toLowerCase(),
      resourcePlural: configPlural.toLowerCase(),
    },
  });

  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    branchId: user.branchId || undefined,
  };

  const token = jwt.sign(authUser, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as string,
  });

  return {
    token,
    user: authUser,
    organization,
  };
}

export async function login(data: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user) {
    throw appError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
  }

  if (!user.active) {
    throw appError('ACCOUNT_DISABLED', 'Account is disabled', 403);
  }

  const valid = await bcrypt.compare(data.password, user.passwordHash);
  if (!valid) {
    throw appError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
  }

  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    branchId: user.branchId || undefined,
  };

  const token = jwt.sign(authUser, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as string,
  });

  const organization = await prisma.organization.findUnique({
    where: { id: user.organizationId },
  });

  return {
    token,
    user: authUser,
    organization,
  };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw appError('USER_NOT_FOUND', 'User not found', 404);
  }

  const organization = await prisma.organization.findUnique({
    where: { id: user.organizationId },
  });

  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    branchId: user.branchId || undefined,
  };

  return {
    user: authUser,
    organization,
  };
}

export async function staffPinLogin(pin: string) {
  if (pin !== config.staffPin) {
    throw appError('INVALID_PIN', 'Invalid staff PIN', 401);
  }

  return {
    token: null,
    message: 'PIN validated',
  };
}

function getBusinessTypeConfig(businessType: string) {
  const configs: Record<string, { resourceType: string; defaultBookingFields: any[] }> = {
    restaurant: {
      resourceType: 'table',
      defaultBookingFields: [
        { name: 'guests', label: 'Cantidad de personas', type: 'number', required: true },
        { name: 'occasion', label: 'Ocasión', type: 'select', required: false, options: ['Ninguna', 'Cumpleaños', 'Aniversario', 'Negocios'] },
      ],
    },
    salon: {
      resourceType: 'professional',
      defaultBookingFields: [
        { name: 'service', label: 'Servicio', type: 'select', required: true, options: ['Corte', 'Color', 'Peinado', 'Barba'] },
        { name: 'duration', label: 'Duración (min)', type: 'number', required: false },
      ],
    },
    sports: {
      resourceType: 'court',
      defaultBookingFields: [
        { name: 'players', label: 'Cantidad de jugadores', type: 'number', required: false },
        { name: 'sport', label: 'Deporte', type: 'select', required: false, options: ['Fútbol', 'Padel', 'Tenis', 'Básquet'] },
      ],
    },
    hotel: {
      resourceType: 'room',
      defaultBookingFields: [
        { name: 'guests', label: 'Cantidad de huéspedes', type: 'number', required: true },
        { name: 'beds', label: 'Camas', type: 'number', required: false },
      ],
    },
    coworking: {
      resourceType: 'space',
      defaultBookingFields: [
        { name: 'guests', label: 'Cantidad de personas', type: 'number', required: false },
        { name: 'purpose', label: 'Motivo', type: 'text', required: false },
      ],
    },
    healthcare: {
      resourceType: 'professional',
      defaultBookingFields: [
        { name: 'service', label: 'Servicio', type: 'select', required: true, options: ['Consulta', 'Control', 'Urgencia'] },
        { name: 'reason', label: 'Motivo de consulta', type: 'text', required: false },
      ],
    },
    custom: {
      resourceType: 'custom',
      defaultBookingFields: [
        { name: 'guests', label: 'Cantidad de personas', type: 'number', required: false },
      ],
    },
  };

  return configs[businessType] || configs.custom;
}

function getShapeByType(type: string): string {
  const shapes: Record<string, string> = {
    table: 'round',
    court: 'rectangular',
    room: 'rectangular',
    professional: 'round',
    space: 'rectangular',
    chair: 'square-sm',
    box: 'square',
    custom: 'rectangular',
  };
  return shapes[type] || 'rectangular';
}
