import { Router } from 'express';
import * as auditService from '../services/auditService';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/:organizationId', async (req, res, next) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const logs = await auditService.getByOrganization(req.params.organizationId, limit);
    res.json({ data: logs });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const log = await auditService.create(req.body);
    res.status(201).json({ data: log });
  } catch (error) {
    next(error);
  }
});

export default router;
