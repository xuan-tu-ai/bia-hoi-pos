import { Router } from 'express';
import { currentUser } from '../../middlewares/auth.js';
import { ALL, requireRole } from '../../middlewares/require-role.js';
import { idParam } from '../../lib/http.js';
import * as s from './tabs.schema.js';
import * as service from './tabs.service.js';

/** Mọi API phiên bàn: C M O (SRS 7.2). Hủy/giảm của COUNTER cần PIN — kiểm tra trong service. */
export const tabRoutes = Router();
tabRoutes.use(['/tabs', '/order-lines'], requireRole(...ALL));

// FR-02
tabRoutes.get('/tabs/summary', async (_req, res) => {
  res.json(await service.summary());
});

// FR-03
tabRoutes.post('/tabs', async (req, res) => {
  res.status(201).json(await service.openTab(currentUser(req), s.openTabSchema.parse(req.body)));
});

// FR-04
tabRoutes.get('/tabs/:id', async (req, res) => {
  res.json(await service.getTab(idParam(req)));
});
tabRoutes.post('/tabs/:id/rounds', async (req, res) => {
  res.status(201).json(await service.sendRound(currentUser(req), idParam(req), s.sendRoundSchema.parse(req.body)));
});

// FR-05
tabRoutes.post('/tabs/:id/move', async (req, res) => {
  res.json(await service.moveTab(currentUser(req), idParam(req), s.targetTableSchema.parse(req.body)));
});
tabRoutes.post('/tabs/:id/merge', async (req, res) => {
  res.json(await service.mergeTab(currentUser(req), idParam(req), s.targetTableSchema.parse(req.body)));
});

// FR-06
tabRoutes.post('/order-lines/:id/void', async (req, res) => {
  res.status(201).json(await service.voidLine(currentUser(req), idParam(req), s.voidSchema.parse(req.body)));
});
tabRoutes.post('/order-lines/:id/discount', async (req, res) => {
  res.status(201).json(await service.discountLine(currentUser(req), idParam(req), s.discountSchema.parse(req.body)));
});

// FR-07
tabRoutes.post('/tabs/:id/provisional', async (req, res) => {
  res.status(201).json(await service.printProvisional(currentUser(req), idParam(req)));
});
