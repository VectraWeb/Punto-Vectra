import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import { config } from './config';

import authRoutes from './routes/auth';
import organizationRoutes from './routes/organizations';
import branchRoutes from './routes/branches';
import resourceRoutes from './routes/resources';
import reservationRoutes from './routes/reservations';
import orderRoutes from './routes/orders';
import catalogRoutes from './routes/catalog';
import customerRoutes from './routes/customers';
import staffRoutes from './routes/staff';
import configRoutes from './routes/config';
import auditRoutes from './routes/audit';
import uploadRoutes from './routes/uploads';

import { errorHandler } from './middleware/errorHandler';

export const prisma = new PrismaClient();

const app = express();

app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

app.use('/api/auth', authRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/config', configRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/uploads', uploadRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

const start = async () => {
  try {
    await prisma.$connect();
    console.log('[DB] Connected to PostgreSQL');

    app.listen(config.port, () => {
      console.log(`[Server] Running on port ${config.port}`);
      console.log(`[Server] Environment: ${config.nodeEnv}`);
    });
  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
};

start();

export default app;
