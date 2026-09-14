import { Router } from 'express';
import * as orderService from '../services/orderService';
import { authenticate } from '../middleware/auth';

const router = Router();

// El formulario público de pedidos crea pedidos sin token (acceso anónimo).
router.post('/', async (req, res, next) => {
  try {
    const order = await orderService.create(req.body);
    res.status(201).json({ data: order });
  } catch (error) {
    next(error);
  }
});

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const orders = await orderService.getAll({
      organizationId: req.query.organizationId as string,
      date: req.query.date as string,
      service: req.query.service as string,
    });
    res.json({ data: orders });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const order = await orderService.getById(req.params.id);
    res.json({ data: order });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const order = await orderService.create(req.body);
    res.status(201).json({ data: order });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    const order = await orderService.updateStatus(
      req.params.id,
      req.body.status,
      req.body.pedidoEstado
    );
    res.json({ data: order });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const order = await orderService.update(req.params.id, req.body);
    res.json({ data: order });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await orderService.remove(req.params.id);
    res.json({ data: { success: true } });
  } catch (error) {
    next(error);
  }
});

export default router;
