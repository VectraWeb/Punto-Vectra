import { Router } from 'express';
import * as staffService from '../services/staffService';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const organizationId =
      (req.query.organizationId as string) || (req as any).user?.organizationId;
    if (!organizationId) {
      res.json({ data: [] });
      return;
    }
    const staff = await staffService.getByOrganization(organizationId);
    res.json({ data: staff });
  } catch (error) {
    next(error);
  }
});

router.get('/:organizationId', async (req, res, next) => {
  try {
    const staff = await staffService.getByOrganization(req.params.organizationId);
    res.json({ data: staff });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const organizationId =
      req.body.organizationId || (req as any).user?.organizationId;
    const member = await staffService.create(organizationId, req.body);
    res.status(201).json({ data: member });
  } catch (error) {
    next(error);
  }
});

router.post('/:organizationId', async (req, res, next) => {
  try {
    const member = await staffService.create(req.params.organizationId, req.body);
    res.status(201).json({ data: member });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const member = await staffService.update(req.params.id, req.body);
    res.json({ data: member });
  } catch (error) {
    next(error);
  }
});

router.put('/item/:id', async (req, res, next) => {
  try {
    const member = await staffService.update(req.params.id, req.body);
    res.json({ data: member });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await staffService.remove(req.params.id);
    res.json({ data: { success: true } });
  } catch (error) {
    next(error);
  }
});

router.delete('/item/:id', async (req, res, next) => {
  try {
    await staffService.remove(req.params.id);
    res.json({ data: { success: true } });
  } catch (error) {
    next(error);
  }
});

export default router;