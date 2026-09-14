import { Router } from 'express';
import * as authService from '../services/authService';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.post('/register', async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', (_req, res) => {
  res.json({ data: { message: 'Logged out' } });
});

router.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const result = await authService.getMe(req.user!.id);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

router.post('/staff-pin', async (req, res, next) => {
  try {
    const result = await authService.staffPinLogin(req.body.pin);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
