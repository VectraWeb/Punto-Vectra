import { Router } from 'express';
import * as customerService from '../services/customerService';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/:organizationId', async (req, res, next) => {
  try {
    const customers = await customerService.getByOrganization(req.params.organizationId);
    res.json({ data: customers });
  } catch (error) {
    next(error);
  }
});

router.get('/item/:id', async (req, res, next) => {
  try {
    const customer = await customerService.getById(req.params.id);
    res.json({ data: customer });
  } catch (error) {
    next(error);
  }
});

router.post('/get-or-create', async (req, res, next) => {
  try {
    const customer = await customerService.getOrCreate(req.body);
    res.json({ data: customer });
  } catch (error) {
    next(error);
  }
});

router.put('/item/:id', async (req, res, next) => {
  try {
    const customer = await customerService.update(req.params.id, req.body);
    res.json({ data: customer });
  } catch (error) {
    next(error);
  }
});

router.delete('/item/:id', async (req, res, next) => {
  try {
    await customerService.remove(req.params.id);
    res.json({ data: { success: true } });
  } catch (error) {
    next(error);
  }
});

export default router;
