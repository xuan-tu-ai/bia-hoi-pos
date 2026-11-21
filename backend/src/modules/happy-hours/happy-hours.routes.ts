import { Router } from 'express';
import { currentUser } from '../../middlewares/auth.js';
import { OWNER, requireRole } from '../../middlewares/require-role.js';
import { idParam } from '../../lib/http.js';
import { createHappyHourSchema, updateHappyHourSchema } from './happy-hours.schema.js';
import * as service from './happy-hours.service.js';

export const happyHourRoutes = Router();
happyHourRoutes.use('/happy-hours', requireRole(...OWNER));

// FR-15
happyHourRoutes.get('/happy-hours', async (_req, res) => {
  res.json(await service.listHappyHours());
});
happyHourRoutes.post('/happy-hours', async (req, res) => {
  res.status(201).json(await service.createHappyHour(currentUser(req).id, createHappyHourSchema.parse(req.body)));
});
happyHourRoutes.patch('/happy-hours/:id', async (req, res) => {
  res.json(await service.updateHappyHour(currentUser(req).id, idParam(req), updateHappyHourSchema.parse(req.body)));
});
happyHourRoutes.delete('/happy-hours/:id', async (req, res) => {
  await service.deleteHappyHour(currentUser(req).id, idParam(req));
  res.status(204).end();
});
