import { Router } from 'express';
import * as organizationService from '../services/organizationService';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Lectura pública de la organización (la página de reserva/booking es pública,
// como en la app original sobre Firebase). 'GET /:id' no exige token.
router.get('/:id', async (req, res, next) => {
  try {
    const org = await organizationService.getById(req.params.id);
    res.json({ data: org });
  } catch (error) {
    next(error);
  }
});

// A partir de acá las rutas requieren autenticación (escritura y listado).
router.use(authenticate);

router.get('/', authorize('admin', 'owner'), async (_req, res, next) => {
  try {
    const orgs = await organizationService.getAll();
    res.json({ data: orgs });
  } catch (error) {
    next(error);
  }
});

router.post('/', authorize('admin', 'owner'), async (req, res, next) => {
  try {
    const org = await organizationService.create(req.body);
    res.status(201).json({ data: org });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const org = await organizationService.update(req.params.id, req.body);
    res.json({ data: org });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const org = await organizationService.patch(req.params.id, req.body);
    res.json({ data: org });
  } catch (error) {
    next(error);
  }
});

export default router;
