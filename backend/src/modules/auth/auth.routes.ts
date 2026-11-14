import { Router } from 'express';
import { authenticate, currentUser } from '../../middlewares/auth.js';
import { loginSchema } from './auth.schema.js';
import * as service from './auth.service.js';

export const authRoutes = Router();

// FR-01
authRoutes.post('/auth/login', async (req, res) => {
  res.json(await service.login(loginSchema.parse(req.body)));
});

authRoutes.get('/auth/me', authenticate, (req, res) => {
  res.json(currentUser(req));
});
