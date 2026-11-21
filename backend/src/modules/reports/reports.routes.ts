import { Router } from 'express';
import { MANAGERS, OWNER, requireRole } from '../../middlewares/require-role.js';
import * as s from './reports.schema.js';
import * as service from './reports.service.js';

export const reportRoutes = Router();

// FR-16 (M O)
reportRoutes.get('/reports/today', requireRole(...MANAGERS), async (_req, res) => {
  res.json(await service.today());
});

// FR-17 (O)
reportRoutes.get('/reports/keg-loss', requireRole(...OWNER), async (req, res) => {
  res.json(await service.kegLoss(s.kegLossQuery.parse(req.query)));
});

// FR-18 (M O)
reportRoutes.get('/reports/voids', requireRole(...MANAGERS), async (req, res) => {
  res.json(await service.voids(s.voidsQuery.parse(req.query)));
});

// FR-19 (O)
reportRoutes.get('/reports/top-items', requireRole(...OWNER), async (req, res) => {
  res.json(await service.topItems(s.topItemsQuery.parse(req.query)));
});
reportRoutes.get('/reports/hourly', requireRole(...OWNER), async (req, res) => {
  res.json(await service.hourly(s.hourlyQuery.parse(req.query)));
});
