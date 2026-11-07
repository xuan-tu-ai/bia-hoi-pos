import { Router } from 'express';
import { currentUser } from '../../middlewares/auth.js';
import { ALL, MANAGERS, requireRole } from '../../middlewares/require-role.js';
import { idParam } from '../../lib/http.js';
import { closeShiftSchema, openShiftSchema } from './shifts.schema.js';
import * as service from './shifts.service.js';

export const shiftRoutes = Router();

// FR-09
shiftRoutes.post('/shifts/open', requireRole(...ALL), async (req, res) => {
  const body = openShiftSchema.parse(req.body);
  res.status(201).json(await service.openShift(currentUser(req), body.openingCash));
});

shiftRoutes.get('/shifts/current', requireRole(...ALL), async (_req, res) => {
  res.json(await service.currentShift());
});

shiftRoutes.post('/shifts/:id/close', requireRole(...MANAGERS), async (req, res) => {
  const body = closeShiftSchema.parse(req.body);
  res.json(await service.closeShift(currentUser(req), idParam(req), body.countedCash));
});

shiftRoutes.get('/shifts', requireRole(...MANAGERS), async (_req, res) => {
  res.json(await service.listShifts());
});
