import { Router } from 'express';
import { currentUser } from '../../middlewares/auth.js';
import { ALL, OWNER, requireRole } from '../../middlewares/require-role.js';
import { idParam } from '../../lib/http.js';
import * as s from './areas.schema.js';
import * as service from './areas.service.js';

export const areaRoutes = Router();

// FR-02, FR-12
areaRoutes.get('/areas', requireRole(...ALL), async (req, res) => {
  const q = s.listAreasQuery.parse(req.query);
  res.json(await service.listAreas(q.include === 'tables'));
});

areaRoutes.post('/areas', requireRole(...OWNER), async (req, res) => {
  res.status(201).json(await service.createArea(currentUser(req).id, s.createAreaSchema.parse(req.body)));
});

areaRoutes.patch('/areas/:id', requireRole(...OWNER), async (req, res) => {
  res.json(await service.updateArea(currentUser(req).id, idParam(req), s.updateAreaSchema.parse(req.body)));
});

areaRoutes.delete('/areas/:id', requireRole(...OWNER), async (req, res) => {
  await service.deleteArea(currentUser(req).id, idParam(req));
  res.status(204).end();
});

areaRoutes.post('/tables', requireRole(...OWNER), async (req, res) => {
  res.status(201).json(await service.createTable(currentUser(req).id, s.createTableSchema.parse(req.body)));
});

areaRoutes.patch('/tables/:id', requireRole(...OWNER), async (req, res) => {
  res.json(await service.updateTable(currentUser(req).id, idParam(req), s.updateTableSchema.parse(req.body)));
});

areaRoutes.delete('/tables/:id', requireRole(...OWNER), async (req, res) => {
  await service.deleteTable(currentUser(req).id, idParam(req));
  res.status(204).end();
});
