import { Router } from 'express';
import * as branchService from '../services/branchService';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/:organizationId', async (req, res, next) => {
  try {
    const branches = await branchService.getByOrganization(req.params.organizationId);
    res.json({ data: branches });
  } catch (error) {
    next(error);
  }
});

router.post('/:organizationId', async (req, res, next) => {
  try {
    const branch = await branchService.create(req.params.organizationId, req.body);
    res.status(201).json({ data: branch });
  } catch (error) {
    next(error);
  }
});

router.delete('/:organizationId/:branchId', async (req, res, next) => {
  try {
    await branchService.remove(req.params.organizationId, req.params.branchId);
    res.json({ data: { success: true } });
  } catch (error) {
    next(error);
  }
});

export default router;
