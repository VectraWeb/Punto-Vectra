import { Router } from 'express';
import * as catalogService from '../services/catalogService';
import { authenticate } from '../middleware/auth';

const router = Router();

// La carta/menú es de lectura pública (la usa la vista de cliente).
router.get('/:organizationId', async (req, res, next) => {
  try {
    const type = req.query.type as string | undefined;
    const activeOnly = req.query.activeOnly === 'true';
    const items = await catalogService.getByOrganization(req.params.organizationId, type, activeOnly);
    res.json({ data: items });
  } catch (error) {
    next(error);
  }
});

router.use(authenticate);

router.get('/item/:id', async (req, res, next) => {
  try {
    const item = await catalogService.getById(req.params.id);
    res.json({ data: item });
  } catch (error) {
    next(error);
  }
});

router.post('/:organizationId', async (req, res, next) => {
  try {
    const item = await catalogService.create(req.params.organizationId, req.body);
    res.status(201).json({ data: item });
  } catch (error) {
    next(error);
  }
});

router.put('/item/:id', async (req, res, next) => {
  try {
    const item = await catalogService.update(req.params.id, req.body);
    res.json({ data: item });
  } catch (error) {
    next(error);
  }
});

router.delete('/item/:id', async (req, res, next) => {
  try {
    await catalogService.remove(req.params.id);
    res.json({ data: { success: true } });
  } catch (error) {
    next(error);
  }
});

export default router;
