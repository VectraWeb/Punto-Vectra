import { Router } from 'express';
import * as configService from '../services/configService';
import { authenticate } from '../middleware/auth';

const router = Router();

// La vista pública del cliente lee la config sin token (como en Firebase).
router.get('/:id', async (req, res, next) => {
  try {
    const config = await configService.getById(req.params.id);
    res.json({ data: config });
  } catch (error) {
    next(error);
  }
});

router.use(authenticate);

router.post('/:id', async (req, res, next) => {
  try {
    const config = await configService.create(req.params.id, req.body);
    res.status(201).json({ data: config });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const config = await configService.update(req.params.id, req.body);
    res.json({ data: config });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const config = await configService.patch(req.params.id, req.body);
    res.json({ data: config });
  } catch (error) {
    next(error);
  }
});

export default router;
