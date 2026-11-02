// CRUD danh mục cho web quản trị (FR-11..FR-15). Ghi: chỉ Chủ quán; đọc thực đơn,
// trạm in, vòi: mọi nhân viên (App quầy cần để hiển thị).

import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';
import { z } from 'zod';
import { ROLES, minuteToHhmm, parseHhmm } from '@biahoi/shared';
import type { Prisma } from '@prisma/client';
import { anyStaff, findStaffByPin, hashSecret, ownerOnly } from '../lib/auth';
import { AppError, badRequest, conflict, notFound } from '../lib/errors';
import { printToStation } from '../services/printing';
import { audit, prisma } from '../lib/prisma';
import { idParam, positiveVnd } from '../lib/validate';

const name = z.string().trim().min(1).max(100);
const sortOrder = z.number().int().min(0).max(100_000);
const optionalId = z.number().int().positive().nullable();

/** Phần chung của một danh mục đơn giản: model Prisma và lược đồ dữ liệu. */
interface SimpleCrud<C extends z.ZodTypeAny> {
  path: string;
  entity: string;
  label: string;
  schema: C;
  // Delegate của Prisma khác kiểu cho từng model; chỉ dùng các hàm chung dưới đây.
  delegate: {
    findMany(args: object): Promise<unknown[]>;
    findUnique(args: { where: { id: number } }): Promise<unknown | null>;
    create(args: { data: z.infer<C> }): Promise<{ id: number }>;
    update(args: { where: { id: number }; data: Partial<z.infer<C>> }): Promise<{ id: number }>;
    delete(args: { where: { id: number } }): Promise<unknown>;
  };
  orderBy?: object;
  /** null = không đăng ký GET danh sách vì route đó đã có ở chỗ khác */
  read: preHandlerAsyncHookHandler | null;
}

function registerSimpleCrud<C extends z.AnyZodObject>(app: FastifyInstance, def: SimpleCrud<C>) {
  const { path, entity, label, schema, delegate } = def;

  if (def.read) app.get(path, { preHandler: def.read }, () => delegate.findMany({ orderBy: def.orderBy ?? { id: 'asc' } }));

  app.post(path, { preHandler: ownerOnly }, async (req, reply) => {
    const data = schema.parse(req.body);
    const created = await delegate.create({ data });
    await audit(prisma, req.user.sub, 'CREATE', entity, created.id, data);
    reply.code(201);
    return created;
  });

  app.patch(`${path}/:id`, { preHandler: ownerOnly }, async (req) => {
    const { id } = idParam.parse(req.params);
    const data = schema.partial().parse(req.body);
    if (!(await delegate.findUnique({ where: { id } }))) throw notFound(label);
    const updated = await delegate.update({ where: { id }, data });
    await audit(prisma, req.user.sub, 'UPDATE', entity, id, data);
    return updated;
  });

  app.delete(`${path}/:id`, { preHandler: ownerOnly }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    if (!(await delegate.findUnique({ where: { id } }))) throw notFound(label);
    await delegate.delete({ where: { id } }); // còn dữ liệu tham chiếu → lỗi P2003 → 409
    await audit(prisma, req.user.sub, 'DELETE', entity, id);
    reply.code(204);
  });
}

const menuItemSchema = z.object({
  groupId: z.number().int().positive(),
  name,
  shortcut: z.string().trim().toLowerCase().min(1).max(10).nullable().optional(),
  price: positiveVnd,
  unit: z.string().trim().min(1).max(20),
  stationId: optionalId.optional(),
  beerVolumeMl: z.number().int().min(50).max(20_000).nullable().optional(),
  defaultTapId: optionalId.optional(),
  available: z.boolean().optional(),
  sortOrder: sortOrder.optional(),
});

const tableSchema = z.object({ areaId: z.number().int().positive(), code: z.string().trim().min(1).max(20), sortOrder: sortOrder.optional() });

const staffSchema = z.object({
  name,
  role: z.enum(ROLES),
  pin: z.string().regex(/^\d{4,6}$/, 'PIN gồm 4–6 chữ số'),
  email: z.string().trim().toLowerCase().email().nullable().optional(),
  password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự').max(100).optional(),
  active: z.boolean().optional(),
});

const happyHourSchema = z.object({
  name,
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  start: z.string(),
  end: z.string(),
  active: z.boolean().optional(),
  prices: z.array(z.object({ itemId: z.number().int().positive(), price: positiveVnd })).max(200),
});

const safeStaff = { id: true, name: true, role: true, email: true, active: true, createdAt: true } satisfies Prisma.StaffSelect;

function hhmmToMinute(value: string, field: string): number {
  try {
    return parseHhmm(value);
  } catch {
    throw badRequest('INVALID_TIME', `${field} phải có dạng HH:mm`);
  }
}

function presentHappyHour<T extends { startMinute: number; endMinute: number }>(h: T) {
  return { ...h, start: minuteToHhmm(h.startMinute), end: minuteToHhmm(h.endMinute) };
}

export async function catalogRoutes(app: FastifyInstance) {
  registerSimpleCrud(app, {
    path: '/menu-groups',
    entity: 'menu_group',
    label: 'nhóm món',
    schema: z.object({ name, sortOrder: sortOrder.optional() }),
    delegate: prisma.menuGroup,
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    read: anyStaff,
  });
  registerSimpleCrud(app, {
    path: '/print-stations',
    entity: 'print_station',
    label: 'trạm in',
    schema: z.object({
      name,
      printerName: z.string().trim().min(1).max(200),
      // BROWSER: App quầy in ra máy in mặc định; NETWORK: backend gửi thẳng tới máy in mạng (host:port)
      connection: z.enum(['BROWSER', 'NETWORK']).optional(),
      host: z.string().trim().max(100).regex(/^[A-Za-z0-9.:_-]+$/, 'Địa chỉ máy in không hợp lệ').nullable().optional(),
      port: z.number().int().min(1).max(65535).optional(),
    }),
    delegate: prisma.printStation,
    read: anyStaff,
  });

  // In thử một phiếu tới máy in mạng của trạm
  app.post('/print-stations/:id/test', { preHandler: ownerOnly }, async (req) => {
    const { id } = idParam.parse(req.params);
    const station = await prisma.printStation.findUnique({ where: { id } });
    if (!station) throw notFound('trạm in');
    if (station.connection !== 'NETWORK') throw badRequest('NOT_NETWORK', 'Trạm này in ở máy quầy (qua trình duyệt), không in thử từ máy chủ được');
    try {
      await printToStation(station, [
        { kind: 'text', text: 'IN THỬ', size: 30, bold: true, align: 'center' },
        { kind: 'text', text: station.name, size: 26, align: 'center' },
        { kind: 'rule' },
        { kind: 'item', qty: '1', name: 'Bia hơi cốc 0,5L', note: 'Tiếng Việt có dấu: ắ ằ ẳ ẵ ặ ơ ư đ' },
        { kind: 'text', text: `${station.host}:${station.port}`, size: 20, align: 'center' },
      ]);
    } catch (e) {
      throw new AppError(502, 'PRINTER_UNREACHABLE', (e as Error).message);
    }
    await audit(prisma, req.user.sub, 'PRINT_TEST', 'print_station', id);
    return { ok: true };
  });
  registerSimpleCrud(app, {
    path: '/areas',
    entity: 'area',
    label: 'khu',
    schema: z.object({ name, sortOrder: sortOrder.optional() }),
    delegate: prisma.area,
    read: null, // GET /areas ở routes/tables.ts
  });
  registerSimpleCrud(app, {
    path: '/taps',
    entity: 'tap',
    label: 'vòi',
    schema: z.object({ name, sortOrder: sortOrder.optional() }),
    delegate: prisma.tap,
    read: null, // GET /taps ở routes/kegs.ts
  });

  // ---- FR-11: món ----
  app.get('/menu-items', { preHandler: anyStaff }, async (req) => {
    const { includeInactive } = z.object({ includeInactive: z.enum(['true', 'false']).optional() }).parse(req.query);
    return prisma.menuItem.findMany({
      where: includeInactive === 'true' ? {} : { active: true },
      orderBy: [{ groupId: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
    });
  });

  app.post('/menu-items', { preHandler: ownerOnly }, async (req, reply) => {
    const data = menuItemSchema.parse(req.body);
    const item = await prisma.menuItem.create({ data });
    await audit(prisma, req.user.sub, 'CREATE', 'menu_item', item.id, data);
    reply.code(201);
    return item;
  });

  // Đổi giá không ảnh hưởng lượt đã gửi vì order_line lưu đơn giá lúc gửi.
  app.patch('/menu-items/:id', { preHandler: ownerOnly }, async (req) => {
    const { id } = idParam.parse(req.params);
    const data = menuItemSchema.partial().parse(req.body);
    const before = await prisma.menuItem.findUnique({ where: { id } });
    if (!before || !before.active) throw notFound('món');
    const item = await prisma.menuItem.update({ where: { id }, data });
    await audit(prisma, req.user.sub, 'UPDATE', 'menu_item', id, { before: { price: before.price, available: before.available }, changes: data });
    return item;
  });

  // Xóa mềm: món đã bán vẫn phải giữ để báo cáo.
  app.delete('/menu-items/:id', { preHandler: ownerOnly }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const item = await prisma.menuItem.findUnique({ where: { id } });
    if (!item || !item.active) throw notFound('món');
    await prisma.menuItem.update({ where: { id }, data: { active: false, available: false, shortcut: null } });
    await audit(prisma, req.user.sub, 'DELETE', 'menu_item', id);
    reply.code(204);
  });

  // ---- FR-12: bàn ----
  app.get('/tables', { preHandler: anyStaff }, () =>
    prisma.diningTable.findMany({ where: { active: true }, orderBy: [{ areaId: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }] }),
  );

  app.post('/tables', { preHandler: ownerOnly }, async (req, reply) => {
    const data = tableSchema.parse(req.body);
    const table = await prisma.diningTable.create({ data });
    await audit(prisma, req.user.sub, 'CREATE', 'dining_table', table.id, data);
    reply.code(201);
    return table;
  });

  app.patch('/tables/:id', { preHandler: ownerOnly }, async (req) => {
    const { id } = idParam.parse(req.params);
    const data = tableSchema.partial().parse(req.body);
    const table = await prisma.diningTable.findUnique({ where: { id } });
    if (!table || !table.active) throw notFound('bàn');
    const updated = await prisma.diningTable.update({ where: { id }, data });
    await audit(prisma, req.user.sub, 'UPDATE', 'dining_table', id, data);
    return updated;
  });

  // FR-12 AC: không xóa được bàn đang có phiên mở. Bàn đã có lịch sử thì xóa mềm.
  app.delete('/tables/:id', { preHandler: ownerOnly }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const table = await prisma.diningTable.findUnique({ where: { id }, include: { _count: { select: { tabs: true } } } });
    if (!table || !table.active) throw notFound('bàn');
    if (table.currentTabId) throw conflict('TABLE_HAS_OPEN_TAB', 'Bàn đang có phiên mở, không thể xóa');
    if (table._count.tabs > 0) {
      // Giải phóng mã bàn để tạo lại được bàn cùng tên.
      await prisma.diningTable.update({ where: { id }, data: { active: false, code: `${table.code}#${table.id}` } });
    } else {
      await prisma.diningTable.delete({ where: { id } });
    }
    await audit(prisma, req.user.sub, 'DELETE', 'dining_table', id, { code: table.code });
    reply.code(204);
  });

  // ---- FR-13: nhân viên ----
  app.get('/staff', { preHandler: ownerOnly }, () => prisma.staff.findMany({ select: safeStaff, orderBy: { id: 'asc' } }));

  async function assertPinFree(pin: string, excludeId?: number) {
    if (await findStaffByPin(pin, excludeId)) throw conflict('PIN_TAKEN', 'PIN đã được dùng cho nhân viên khác');
  }

  app.post('/staff', { preHandler: ownerOnly }, async (req, reply) => {
    const { pin, password, ...rest } = staffSchema.parse(req.body);
    if (rest.role === 'COUNTER' && (rest.email || password)) {
      throw badRequest('COUNTER_NO_WEB', 'Nhân viên quầy không có tài khoản web');
    }
    await assertPinFree(pin);
    const staff = await prisma.staff.create({
      data: { ...rest, pinHash: await hashSecret(pin), passwordHash: password ? await hashSecret(password) : null },
      select: safeStaff,
    });
    await audit(prisma, req.user.sub, 'CREATE', 'staff', staff.id, { ...rest });
    reply.code(201);
    return staff;
  });

  app.patch('/staff/:id', { preHandler: ownerOnly }, async (req) => {
    const { id } = idParam.parse(req.params);
    const { pin, password, ...rest } = staffSchema.partial().parse(req.body);
    const before = await prisma.staff.findUnique({ where: { id } });
    if (!before) throw notFound('nhân viên');
    if (id === req.user.sub && (rest.active === false || (rest.role && rest.role !== 'OWNER'))) {
      throw badRequest('SELF_LOCKOUT', 'Không thể tự khóa hoặc hạ quyền tài khoản đang đăng nhập');
    }
    if (pin) await assertPinFree(pin, id);
    const data: Prisma.StaffUpdateInput = { ...rest };
    if (pin) data.pinHash = await hashSecret(pin);
    if (password) data.passwordHash = await hashSecret(password);
    if ((rest.role ?? before.role) === 'COUNTER') {
      data.email = null;
      data.passwordHash = null;
    }
    const staff = await prisma.staff.update({ where: { id }, data, select: safeStaff });
    await audit(prisma, req.user.sub, 'UPDATE', 'staff', id, { ...rest, pinChanged: !!pin, passwordChanged: !!password });
    return staff;
  });

  // Không có DELETE /staff: dữ liệu bán hàng tham chiếu tới nhân viên, dùng active = false.

  // ---- FR-15: giờ vàng ----
  app.get('/happy-hours', { preHandler: anyStaff }, async () => {
    const rows = await prisma.happyHour.findMany({ orderBy: { id: 'asc' }, include: { prices: true } });
    return rows.map(presentHappyHour);
  });

  app.post('/happy-hours', { preHandler: ownerOnly }, async (req, reply) => {
    const { start, end, prices, ...rest } = happyHourSchema.parse(req.body);
    const row = await prisma.happyHour.create({
      data: { ...rest, startMinute: hhmmToMinute(start, 'Giờ bắt đầu'), endMinute: hhmmToMinute(end, 'Giờ kết thúc'), prices: { create: prices } },
      include: { prices: true },
    });
    await audit(prisma, req.user.sub, 'CREATE', 'happy_hour', row.id, { start, end, prices, ...rest });
    reply.code(201);
    return presentHappyHour(row);
  });

  app.patch('/happy-hours/:id', { preHandler: ownerOnly }, async (req) => {
    const { id } = idParam.parse(req.params);
    const { start, end, prices, ...rest } = happyHourSchema.partial().parse(req.body);
    if (!(await prisma.happyHour.findUnique({ where: { id } }))) throw notFound('khung giờ vàng');
    const row = await prisma.$transaction(async (tx) => {
      if (prices) {
        await tx.happyHourPrice.deleteMany({ where: { happyHourId: id } });
        await tx.happyHourPrice.createMany({ data: prices.map((p) => ({ ...p, happyHourId: id })) });
      }
      return tx.happyHour.update({
        where: { id },
        data: {
          ...rest,
          ...(start !== undefined ? { startMinute: hhmmToMinute(start, 'Giờ bắt đầu') } : {}),
          ...(end !== undefined ? { endMinute: hhmmToMinute(end, 'Giờ kết thúc') } : {}),
        },
        include: { prices: true },
      });
    });
    await audit(prisma, req.user.sub, 'UPDATE', 'happy_hour', id, { start, end, prices, ...rest });
    return presentHappyHour(row);
  });

  // Xóa khung giờ vàng đã từng áp dụng sẽ bị chặn (order_line tham chiếu) → tắt bằng active = false.
  app.delete('/happy-hours/:id', { preHandler: ownerOnly }, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    if (!(await prisma.happyHour.findUnique({ where: { id } }))) throw notFound('khung giờ vàng');
    await prisma.happyHour.delete({ where: { id } });
    await audit(prisma, req.user.sub, 'DELETE', 'happy_hour', id);
    reply.code(204);
  });
}
