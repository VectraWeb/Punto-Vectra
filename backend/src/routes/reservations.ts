import { Router } from 'express';
import * as reservationService from '../services/reservationService';
import { authenticate } from '../middleware/auth';

const router = Router();

// El formulario público de reserva crea reservas pendientes sin token
// (como el acceso anónimo de Firebase).
router.post('/', async (req, res, next) => {
  try {
    const reservation = await reservationService.create(req.body);
    res.status(201).json({ data: reservation });
  } catch (error) {
    next(error);
  }
});

router.post('/check-availability', async (req, res, next) => {
  try {
    const result = await reservationService.checkAvailability(req.body);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const reservations = await reservationService.getAll({
      organizationId: req.query.organizationId as string,
      date: req.query.date as string,
      service: req.query.service as string,
    });
    res.json({ data: reservations });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const reservation = await reservationService.getById(req.params.id);
    res.json({ data: reservation });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const reservation = await reservationService.update(req.params.id, req.body);
    res.json({ data: reservation });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    const reservation = await reservationService.updateStatus(
      req.params.id,
      req.body.status,
      req.body.estado
    );
    res.json({ data: reservation });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await reservationService.remove(req.params.id);
    res.json({ data: { success: true } });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/cancel', async (req, res, next) => {
  try {
    await reservationService.cancel(req.params.id, req.body.motivo);
    res.json({ data: { success: true } });
  } catch (error) {
    next(error);
  }
});

router.post('/analytics', async (req, res, next) => {
  try {
    const result = await reservationService.getAnalytics(
      req.body.organizationId,
      req.body.dates
    );
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
