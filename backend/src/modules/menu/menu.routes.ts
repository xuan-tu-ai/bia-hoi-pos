import { Router } from 'express';
import { currentUser } from '../../middlewares/auth.js';
import { ALL, OWNER, requireRole } from '../../middlewares/require-role.js';
import { idParam } from '../../lib/http.js';
import * as s from './menu.schema.js';
import * as service from './menu.service.js';

export const menuRoutes = Router();

// FR-04: thực đơn cho màn gọi món
menuRoutes.get('/menu', requireRole(...ALL), async (_req, res) => {
  res.json(await service.getMenu());
});

// FR-11: quản trị (chỉ chủ quán)
menuRoutes.get('/menu-groups', requireRole(...OWNER), async (_req, res) => {
  res.json(await service.listGroups());
});
menuRoutes.post('/menu-groups', requireRole(...OWNER), async (req, res) => {
  res.status(201).json(await service.createGroup(currentUser(req).id, s.groupSchema.parse(req.body)));
});
menuRoutes.patch('/menu-groups/:id', requireRole(...OWNER), async (req, res) => {
  res.json(await service.updateGroup(currentUser(req).id, idParam(req), s.updateGroupSchema.parse(req.body)));
});

menuRoutes.get('/menu-items', requireRole(...OWNER), async (req, res) => {
  res.json(await service.listItems(s.listItemsQuery.parse(req.query)));
});
menuRoutes.post('/menu-items', requireRole(...OWNER), async (req, res) => {
  res.status(201).json(await service.createItem(currentUser(req).id, s.createItemSchema.parse(req.body)));
});
menuRoutes.patch('/menu-items/:id', requireRole(...OWNER), async (req, res) => {
  res.json(await service.updateItem(currentUser(req).id, idParam(req), s.updateItemSchema.parse(req.body)));
});

menuRoutes.get('/kitchen-stations', requireRole(...OWNER), async (_req, res) => {
  res.json(await service.listStations());
});
menuRoutes.post('/kitchen-stations', requireRole(...OWNER), async (req, res) => {
  res.status(201).json(await service.createStation(currentUser(req).id, s.stationSchema.parse(req.body)));
});
menuRoutes.patch('/kitchen-stations/:id', requireRole(...OWNER), async (req, res) => {
  res.json(await service.updateStation(currentUser(req).id, idParam(req), s.updateStationSchema.parse(req.body)));
});
