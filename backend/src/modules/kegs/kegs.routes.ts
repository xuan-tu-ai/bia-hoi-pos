import { Router } from 'express';
import { currentUser } from '../../middlewares/auth.js';
import { ALL, MANAGERS, requireRole } from '../../middlewares/require-role.js';
import { idParam } from '../../lib/http.js';
import { changeKegSchema, listKegsQuery, receiveKegsSchema } from './kegs.schema.js';
import * as service from './kegs.service.js';

export const kegRoutes = Router();

// FR-10
kegRoutes.get('/taps', requireRole(...ALL), async (_req, res) => {
  res.json(await service.listTaps());
});
kegRoutes.post('/taps/:id/change-keg', requireRole(...ALL), async (req, res) => {
  const body = changeKegSchema.parse(req.body);
  res.json(await service.changeKeg(currentUser(req), idParam(req), body.kegId));
});

// FR-14
kegRoutes.get('/kegs', requireRole(...MANAGERS), async (req, res) => {
  res.json(await service.listKegs(listKegsQuery.parse(req.query)));
});
kegRoutes.post('/kegs', requireRole(...MANAGERS), async (req, res) => {
  res.status(201).json(await service.receiveKegs(currentUser(req), receiveKegsSchema.parse(req.body)));
});
