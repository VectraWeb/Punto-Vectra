import { Router } from 'express';
import * as resourceService from '../services/resourceService';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/:organizationId', async (req, res, next) => {
  try {
    const type = req.query.type as string | undefined;
    const resources = await resourceService.getByOrganization(req.params.organizationId, type);
    res.json({ data: resources });
  } catch (error) {
    next(error);
  }
});

router.get('/:organizationId/:id', async (req, res, next) => {
  try {
    const resource = await resourceService.getById(req.params.organizationId, req.params.id);
    res.json({ data: resource });
  } catch (error) {
    next(error);
  }
});

router.post('/:organizationId', async (req, res, next) => {
  try {
    const resource = await resourceService.create(req.params.organizationId, req.body);
    res.status(201).json({ data: resource });
  } catch (error) {
    next(error);
  }
});

router.put('/:organizationId/:id', async (req, res, next) => {
  try {
    const resource = await resourceService.update(req.params.organizationId, req.params.id, req.body);
    res.json({ data: resource });
  } catch (error) {
    next(error);
  }
});

router.delete('/:organizationId/:id', async (req, res, next) => {
  try {
    await resourceService.remove(req.params.organizationId, req.params.id);
    res.json({ data: { success: true } });
  } catch (error) {
    next(error);
  }
});

router.post('/:organizationId/seed', async (req, res, next) => {
  try {
    const created = await resourceService.seed(req.params.organizationId, req.body.resources || []);
    res.json({ data: created });
  } catch (error) {
    next(error);
  }
});

export default router;
