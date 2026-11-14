import { Router } from 'express';
import { currentUser } from '../../middlewares/auth.js';
import { OWNER, requireRole } from '../../middlewares/require-role.js';
import { idParam } from '../../lib/http.js';
import { createStaffSchema, updateStaffSchema } from './staff.schema.js';
import * as service from './staff.service.js';

export const staffRoutes = Router();

// FR-13
staffRoutes.get('/staff', requireRole(...OWNER), async (_req, res) => {
  res.json(await service.listStaff());
});
staffRoutes.post('/staff', requireRole(...OWNER), async (req, res) => {
  res.status(201).json(await service.createStaff(currentUser(req).id, createStaffSchema.parse(req.body)));
});
staffRoutes.patch('/staff/:id', requireRole(...OWNER), async (req, res) => {
  res.json(await service.updateStaff(currentUser(req).id, idParam(req), updateStaffSchema.parse(req.body)));
});
