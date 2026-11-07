import { Router } from 'express';
import { currentUser } from '../../middlewares/auth.js';
import { ALL, requireRole } from '../../middlewares/require-role.js';
import { idParam } from '../../lib/http.js';
import { paySchema, vietqrQuery } from './payments.schema.js';
import * as service from './payments.service.js';

export const paymentRoutes = Router();

// FR-08
paymentRoutes.get('/tabs/:id/vietqr', requireRole(...ALL), async (req, res) => {
  const q = vietqrQuery.parse(req.query);
  res.json(await service.getVietQr(idParam(req), q.amount));
});

paymentRoutes.post('/tabs/:id/pay', requireRole(...ALL), async (req, res) => {
  res.json(await service.pay(currentUser(req), idParam(req), paySchema.parse(req.body)));
});
