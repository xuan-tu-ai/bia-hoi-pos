import bcrypt from 'bcryptjs';
import type { VercelResponse } from '@vercel/node';
import { getSql } from './_db.js';
import type { TokenUser } from './_auth.js';

function err(res: VercelResponse, status: number, code: string, message: string) {
  return res.status(status).json({ error: { code, message } });
}

function requireOwner(authUser: TokenUser, res: VercelResponse): boolean {
  if (authUser.role !== 'OWNER') {
    err(res, 403, 'FORBIDDEN', 'Chỉ Chủ quán mới được phép thực hiện thao tác này.');
    return false;
  }
  return true;
}

function requireManagerOrOwner(authUser: TokenUser, res: VercelResponse): boolean {
  if (authUser.role !== 'OWNER' && authUser.role !== 'SHIFT_MANAGER') {
    err(res, 403, 'FORBIDDEN', 'Chỉ Quản lý ca hoặc Chủ quán mới được phép thực hiện thao tác này.');
    return false;
  }
  return true;
}

const roleToDb: Record<string, 'COUNTER' | 'SHIFT_MANAGER' | 'OWNER'> = {
  'Nhân viên quầy': 'COUNTER',
  'Quản lý ca': 'SHIFT_MANAGER',
  'Chủ quán': 'OWNER',
  COUNTER: 'COUNTER',
  SHIFT_MANAGER: 'SHIFT_MANAGER',
  OWNER: 'OWNER'
};

const roleToLabel: Record<string, string> = {
  COUNTER: 'Nhân viên quầy',
  SHIFT_MANAGER: 'Quản lý ca',
  OWNER: 'Chủ quán'
};

export async function handleCounterAndAdmin(
  path: string,
  method: string,
  body: Record<string, any>,
  authUser: TokenUser,
  res: VercelResponse
): Promise<boolean> {
  const sql = getSql();

  // --- SHIFTS ---
  if (path === '/shifts/current' && method === 'GET') {
    const openShifts = await sql`
      SELECT sh.id, sh."staffId", st."fullName" AS "staffName", sh."openedAt", sh."openingCash"
      FROM "Shift" sh
      JOIN "Staff" st ON st.id = sh."staffId"
      WHERE sh."closedAt" IS NULL
      ORDER BY sh."openedAt" DESC
      LIMIT 1
    `;
    const active = openShifts[0];
    if (!active) {
      const latest = await sql`
        SELECT sh.id, st."fullName" AS "staffName", sh."openedAt", sh."closedAt", sh."openingCash", sh."countedCash", sh."cashSales", sh."transferSales"
        FROM "Shift" sh
        JOIN "Staff" st ON st.id = sh."staffId"
        ORDER BY sh."openedAt" DESC
        LIMIT 1
      `;
      res.status(200).json({ current: null, lastClosed: latest[0] ?? null });
      return true;
    }

    const sales = await sql`
      SELECT p.method, COALESCE(SUM(p.amount), 0)::int AS total, COUNT(DISTINCT p."tabId")::int AS bills
      FROM "Payment" p
      WHERE p."createdAt" >= ${active.openedAt}
      GROUP BY p.method
    `;
    const billCountRow = await sql`
      SELECT COUNT(*)::int AS bills
      FROM "Tab"
      WHERE status = 'PAID' AND "closedAt" >= ${active.openedAt}
    `;
    const cashSales = Number(sales.find((s) => s.method === 'CASH')?.total ?? 0);
    const transferSales = Number(sales.find((s) => s.method === 'TRANSFER')?.total ?? 0);

    res.status(200).json({
      current: {
        id: Number(active.id),
        staffName: String(active.staffName),
        openedAt: new Date(active.openedAt as string).toISOString(),
        openingCash: Number(active.openingCash),
        cashSales,
        transferSales,
        bills: Number(billCountRow[0]?.bills ?? 0)
      },
      lastClosed: null
    });
    return true;
  }

  if (path === '/shifts/open' && method === 'POST') {
    const existing = await sql`SELECT id FROM "Shift" WHERE "closedAt" IS NULL LIMIT 1`;
    if (existing.length > 0) {
      err(res, 409, 'SHIFT_ALREADY_OPEN', 'Đã có ca đang mở.');
      return true;
    }
    const openingCash = Math.max(0, Number(body.openingCash || 0));
    const inserted = await sql`
      INSERT INTO "Shift" ("staffId", "openingCash")
      VALUES (${authUser.id}, ${openingCash})
      RETURNING id, "openedAt", "openingCash"
    `;
    await sql`
      INSERT INTO "AuditLog" ("actorId", action, entity, "entityId", payload)
      VALUES (${authUser.id}, 'SHIFT_OPENED', 'Shift', ${inserted[0].id}, ${JSON.stringify({ openingCash })}::jsonb)
    `;
    res.status(201).json(inserted[0]);
    return true;
  }

  const closeShiftMatch = path.match(/^\/shifts\/(\d+)\/close$/);
  if (closeShiftMatch && method === 'POST') {
    if (!requireManagerOrOwner(authUser, res)) return true;
    const shiftId = Number(closeShiftMatch[1]);
    const shifts = await sql`SELECT id, "openedAt" FROM "Shift" WHERE id = ${shiftId} AND "closedAt" IS NULL LIMIT 1`;
    if (shifts.length === 0) {
      err(res, 404, 'SHIFT_NOT_FOUND', 'Không tìm thấy ca đang mở.');
      return true;
    }
    const shift = shifts[0];
    const sales = await sql`
      SELECT p.method, COALESCE(SUM(p.amount), 0)::int AS total
      FROM "Payment" p
      WHERE p."createdAt" >= ${shift.openedAt}
      GROUP BY p.method
    `;
    const cashSales = Number(sales.find((s) => s.method === 'CASH')?.total ?? 0);
    const transferSales = Number(sales.find((s) => s.method === 'TRANSFER')?.total ?? 0);
    const countedCash = Math.max(0, Number(body.countedCash || 0));

    await sql`
      UPDATE "Shift"
      SET "closedAt" = NOW(), "closedById" = ${authUser.id}, "countedCash" = ${countedCash},
          "cashSales" = ${cashSales}, "transferSales" = ${transferSales}
      WHERE id = ${shiftId}
    `;
    await sql`
      INSERT INTO "AuditLog" ("actorId", action, entity, "entityId", payload)
      VALUES (${authUser.id}, 'SHIFT_CLOSED', 'Shift', ${shiftId}, ${JSON.stringify({ countedCash, cashSales, transferSales })}::jsonb)
    `;
    res.status(200).json({ id: shiftId, countedCash, cashSales, transferSales });
    return true;
  }

  // --- TAPS ---
  if (path === '/taps' && method === 'GET') {
    const taps = await sql`
      SELECT t.id, t.name, k.id AS "kegId", k.code AS "kegCode", k."beerName", k."capacityMl",
             COALESCE((
               SELECT SUM(ol.qty * COALESCE(mi."beerVolumeMl", 0))
               FROM "OrderLine" ol
               JOIN "MenuItem" mi ON mi.id = ol."menuItemId"
               WHERE ol."kegId" = k.id
             ), 0)::int AS "soldMl"
      FROM "Tap" t
      LEFT JOIN "Keg" k ON k.id = t."currentKegId"
      ORDER BY t."sortOrder", t.id
    `;
    const availableKegs = await sql`
      SELECT id, code, "beerName", "capacityMl"
      FROM "Keg"
      WHERE status = 'IN_STOCK'
      ORDER BY "receivedAt" ASC, id ASC
    `;
    res.status(200).json({
      taps: taps.map((t) => ({
        id: Number(t.id),
        name: String(t.name),
        kegId: t.kegId ? Number(t.kegId) : null,
        kegCode: t.kegCode ? String(t.kegCode) : null,
        beerName: t.beerName ? String(t.beerName) : null,
        capacityMl: t.capacityMl ? Number(t.capacityMl) : 50000,
        soldMl: Number(t.soldMl || 0)
      })),
      availableKegs: availableKegs.map((k) => ({
        id: Number(k.id),
        code: String(k.code),
        beerName: String(k.beerName),
        capacityMl: Number(k.capacityMl)
      }))
    });
    return true;
  }

  const changeKegMatch = path.match(/^\/taps\/(\d+)\/change-keg$/);
  if (changeKegMatch && method === 'POST') {
    const tapId = Number(changeKegMatch[1]);
    const newKegId = Number(body.kegId);
    const tapRows = await sql`SELECT id, name, "currentKegId" FROM "Tap" WHERE id = ${tapId} LIMIT 1`;
    if (tapRows.length === 0) {
      err(res, 404, 'TAP_NOT_FOUND', 'Không tìm thấy vòi bia.');
      return true;
    }
    const newKegRows = await sql`SELECT id, code, "beerName" FROM "Keg" WHERE id = ${newKegId} AND status = 'IN_STOCK' LIMIT 1`;
    if (newKegRows.length === 0) {
      err(res, 400, 'KEG_NOT_AVAILABLE', 'Keg không tồn tại hoặc không ở trạng thái trong kho.');
      return true;
    }

    const oldKegId = tapRows[0].currentKegId ? Number(tapRows[0].currentKegId) : null;
    if (oldKegId) {
      const soldRows = await sql`
        SELECT COALESCE(SUM(ol.qty * COALESCE(mi."beerVolumeMl", 0)), 0)::int AS sold_ml
        FROM "OrderLine" ol
        JOIN "MenuItem" mi ON mi.id = ol."menuItemId"
        WHERE ol."kegId" = ${oldKegId}
      `;
      const soldMl = Math.max(0, Number(soldRows[0]?.sold_ml ?? 0));
      await sql`
        UPDATE "Keg"
        SET status = 'EMPTY', "emptiedAt" = NOW(), "soldMl" = ${soldMl}
        WHERE id = ${oldKegId}
      `;
    }

    await sql`
      UPDATE "Keg"
      SET status = 'TAPPED', "tapId" = ${tapId}, "tappedAt" = NOW()
      WHERE id = ${newKegId}
    `;
    await sql`UPDATE "Tap" SET "currentKegId" = ${newKegId} WHERE id = ${tapId}`;
    await sql`
      INSERT INTO "AuditLog" ("actorId", action, entity, "entityId", payload)
      VALUES (${authUser.id}, 'TAP_KEG_CHANGED', 'Tap', ${tapId}, ${JSON.stringify({ oldKegId, newKegId })}::jsonb)
    `;

    res.status(200).json({ ok: true });
    return true;
  }

  // --- ADMIN: MENU ITEMS ---
  if (path === '/menu-items' && method === 'GET') {
    const rows = await sql`
      SELECT mi.id, mi.name, mi.shortcut, mg.name AS category, mi.price, mi.unit,
             ks.name AS station, mi."beerVolumeMl", COALESCE(t.name, '—') AS tap,
             mi.available, mi.active
      FROM "MenuItem" mi
      JOIN "MenuGroup" mg ON mg.id = mi."groupId"
      JOIN "KitchenStation" ks ON ks.id = mi."stationId"
      LEFT JOIN "Tap" t ON t.id = mi."defaultTapId"
      ORDER BY mg."sortOrder", mi."sortOrder", mi.id
    `;
    res.status(200).json(rows.map((r) => ({
      id: Number(r.id),
      name: String(r.name),
      shortcut: String(r.shortcut),
      category: String(r.category),
      price: Number(r.price),
      unit: String(r.unit),
      station: String(r.station),
      isDraftBeer: r.beerVolumeMl !== null ? 'Có' : 'Không',
      volume: r.beerVolumeMl ?? '',
      tap: r.tap === '—' ? '' : String(r.tap),
      status: !r.active ? 'Ẩn' : r.available ? 'Còn món' : 'Hết món'
    })));
    return true;
  }

  if (path === '/menu-items' && method === 'POST') {
    if (!requireOwner(authUser, res)) return true;
    const groups = await sql`SELECT id FROM "MenuGroup" WHERE name = ${String(body.category || '')} LIMIT 1`;
    const stations = await sql`SELECT id FROM "KitchenStation" WHERE name = ${String(body.station || '')} LIMIT 1`;
    const fallbackGroup = groups[0] ?? (await sql`SELECT id FROM "MenuGroup" ORDER BY id LIMIT 1`)[0];
    const fallbackStation = stations[0] ?? (await sql`SELECT id FROM "KitchenStation" ORDER BY id LIMIT 1`)[0];
    const taps = body.tap ? await sql`SELECT id FROM "Tap" WHERE name = ${String(body.tap)} LIMIT 1` : [];
    const isDraft = body.isDraftBeer === 'Có';
    const volume = isDraft && Number(body.volume) > 0 ? Number(body.volume) : null;
    const status = String(body.status || 'Còn món');
    const inserted = await sql`
      INSERT INTO "MenuItem" ("groupId", name, shortcut, price, unit, "stationId", "beerVolumeMl", "defaultTapId", available, active)
      VALUES (${fallbackGroup.id}, ${String(body.name)}, ${String(body.shortcut)}, ${Number(body.price || 0)}, ${String(body.unit || 'phần')}, ${fallbackStation.id}, ${volume}, ${taps[0]?.id ?? null}, ${status === 'Còn món'}, ${status !== 'Ẩn'})
      RETURNING id
    `;
    res.status(201).json(inserted[0]);
    return true;
  }

  const menuItemMatch = path.match(/^\/menu-items\/(\d+)$/);
  if (menuItemMatch && method === 'PATCH') {
    if (!requireOwner(authUser, res)) return true;
    const id = Number(menuItemMatch[1]);
    const groups = await sql`SELECT id FROM "MenuGroup" WHERE name = ${String(body.category || '')} LIMIT 1`;
    const stations = await sql`SELECT id FROM "KitchenStation" WHERE name = ${String(body.station || '')} LIMIT 1`;
    const taps = body.tap ? await sql`SELECT id FROM "Tap" WHERE name = ${String(body.tap)} LIMIT 1` : [];
    const isDraft = body.isDraftBeer === 'Có';
    const volume = isDraft && Number(body.volume) > 0 ? Number(body.volume) : null;
    const status = String(body.status || 'Còn món');
    await sql`
      UPDATE "MenuItem"
      SET name = COALESCE(${body.name ?? null}, name),
          shortcut = COALESCE(${body.shortcut ?? null}, shortcut),
          price = COALESCE(${body.price != null ? Number(body.price) : null}, price),
          "groupId" = COALESCE(${groups[0]?.id ?? null}, "groupId"),
          "stationId" = COALESCE(${stations[0]?.id ?? null}, "stationId"),
          "beerVolumeMl" = ${volume},
          "defaultTapId" = ${taps[0]?.id ?? null},
          available = ${status === 'Còn món'},
          active = ${status !== 'Ẩn'}
      WHERE id = ${id}
    `;
    res.status(200).json({ id });
    return true;
  }

  // --- ADMIN: MENU GROUPS ---
  if (path === '/menu-groups' && method === 'GET') {
    const rows = await sql`
      SELECT mg.id, mg.name, mg."sortOrder" AS "order", COUNT(mi.id)::int AS count
      FROM "MenuGroup" mg
      LEFT JOIN "MenuItem" mi ON mi."groupId" = mg.id AND mi.active = true
      GROUP BY mg.id
      ORDER BY mg."sortOrder", mg.id
    `;
    res.status(200).json(rows.map((r) => ({ ...r, status: 'Đang dùng' })));
    return true;
  }

  if (path === '/menu-groups' && method === 'POST') {
    if (!requireOwner(authUser, res)) return true;
    const inserted = await sql`
      INSERT INTO "MenuGroup" (name, "sortOrder")
      VALUES (${String(body.name)}, ${Number(body.order || 0)})
      RETURNING id
    `;
    res.status(201).json(inserted[0]);
    return true;
  }

  const groupMatch = path.match(/^\/menu-groups\/(\d+)$/);
  if (groupMatch && method === 'PATCH') {
    if (!requireOwner(authUser, res)) return true;
    const id = Number(groupMatch[1]);
    await sql`
      UPDATE "MenuGroup" SET name = ${String(body.name)}, "sortOrder" = ${Number(body.order || 0)} WHERE id = ${id}
    `;
    res.status(200).json({ id });
    return true;
  }

  // --- ADMIN: KITCHEN STATIONS ---
  if (path === '/kitchen-stations' && method === 'GET') {
    const rows = await sql`
      SELECT ks.id, ks.name, COUNT(mi.id)::int AS count
      FROM "KitchenStation" ks
      LEFT JOIN "MenuItem" mi ON mi."stationId" = ks.id AND mi.active = true
      GROUP BY ks.id
      ORDER BY ks."sortOrder", ks.id
    `;
    res.status(200).json(rows.map((r) => ({ ...r, status: 'Đang dùng' })));
    return true;
  }

  if (path === '/kitchen-stations' && method === 'POST') {
    if (!requireOwner(authUser, res)) return true;
    const inserted = await sql`INSERT INTO "KitchenStation" (name) VALUES (${String(body.name)}) RETURNING id`;
    res.status(201).json(inserted[0]);
    return true;
  }

  const stationMatch = path.match(/^\/kitchen-stations\/(\d+)$/);
  if (stationMatch && method === 'PATCH') {
    if (!requireOwner(authUser, res)) return true;
    const id = Number(stationMatch[1]);
    await sql`UPDATE "KitchenStation" SET name = ${String(body.name)} WHERE id = ${id}`;
    res.status(200).json({ id });
    return true;
  }

  // --- ADMIN: AREAS & TABLES ---
  if (path === '/admin-areas' && method === 'GET') {
    const rows = await sql`
      SELECT a.id, a.name, a."sortOrder" AS "order", a.active, COUNT(dt.id)::int AS tables
      FROM "Area" a
      LEFT JOIN "DiningTable" dt ON dt."areaId" = a.id AND dt.active = true
      GROUP BY a.id
      ORDER BY a."sortOrder", a.id
    `;
    res.status(200).json(rows.map((r) => ({
      id: Number(r.id),
      name: String(r.name),
      tables: Number(r.tables),
      order: Number(r.order),
      status: r.active ? 'Đang dùng' : 'Đã ẩn'
    })));
    return true;
  }

  if (path === '/admin-areas' && method === 'POST') {
    if (!requireOwner(authUser, res)) return true;
    const inserted = await sql`
      INSERT INTO "Area" (name, "sortOrder") VALUES (${String(body.name)}, ${Number(body.order || 0)}) RETURNING id
    `;
    res.status(201).json(inserted[0]);
    return true;
  }

  const areaMatch = path.match(/^\/admin-areas\/(\d+)$/);
  if (areaMatch && method === 'PATCH') {
    if (!requireOwner(authUser, res)) return true;
    const id = Number(areaMatch[1]);
    await sql`UPDATE "Area" SET name = ${String(body.name)}, "sortOrder" = ${Number(body.order || 0)} WHERE id = ${id}`;
    res.status(200).json({ id });
    return true;
  }

  if (path === '/tables' && method === 'GET') {
    const rows = await sql`
      SELECT dt.id, dt.code, a.name AS area, dt."sortOrder", dt.active,
             EXISTS(SELECT 1 FROM "Tab" t WHERE t."tableId" = dt.id AND t.status = 'OPEN' AND t."closedAt" IS NULL) AS occupied
      FROM "DiningTable" dt
      JOIN "Area" a ON a.id = dt."areaId"
      ORDER BY dt."sortOrder", dt.id
    `;
    res.status(200).json(rows.map((r) => ({
      id: Number(r.id),
      name: `Bàn ${r.code}`,
      code: String(r.code),
      area: String(r.area),
      capacity: 6,
      status: !r.active ? 'Đã ẩn' : r.occupied ? 'Đang phục vụ' : 'Trống'
    })));
    return true;
  }

  if (path === '/tables' && method === 'POST') {
    if (!requireOwner(authUser, res)) return true;
    const areaRows = await sql`SELECT id FROM "Area" WHERE name = ${String(body.area || '')} LIMIT 1`;
    const area = areaRows[0] ?? (await sql`SELECT id FROM "Area" ORDER BY id LIMIT 1`)[0];
    const code = String(body.code || body.name || '').replace(/^Bàn\s*/i, '').trim();
    const inserted = await sql`
      INSERT INTO "DiningTable" ("areaId", code, "sortOrder")
      VALUES (${area.id}, ${code}, ${Number(code) || 99})
      RETURNING id
    `;
    res.status(201).json(inserted[0]);
    return true;
  }

  const tableMatch = path.match(/^\/tables\/(\d+)$/);
  if (tableMatch && method === 'PATCH') {
    if (!requireOwner(authUser, res)) return true;
    const id = Number(tableMatch[1]);
    const areaRows = await sql`SELECT id FROM "Area" WHERE name = ${String(body.area || '')} LIMIT 1`;
    const code = String(body.code || body.name || '').replace(/^Bàn\s*/i, '').trim();
    await sql`
      UPDATE "DiningTable"
      SET code = COALESCE(${code || null}, code),
          "areaId" = COALESCE(${areaRows[0]?.id ?? null}, "areaId")
      WHERE id = ${id}
    `;
    res.status(200).json({ id });
    return true;
  }

  // --- ADMIN: STAFF ---
  if (path === '/staff' && method === 'GET') {
    if (!requireOwner(authUser, res)) return true;
    const rows = await sql`
      SELECT id, "fullName", email, role, active
      FROM "Staff"
      ORDER BY id ASC
    `;
    res.status(200).json(rows.map((r) => ({
      id: Number(r.id),
      name: String(r.fullName),
      email: String(r.email),
      role: roleToLabel[String(r.role)] || String(r.role),
      status: r.active ? 'Hoạt động' : 'Đã khóa'
    })));
    return true;
  }

  if (path === '/staff' && method === 'POST') {
    if (!requireOwner(authUser, res)) return true;
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '123456');
    const role = roleToDb[String(body.role || 'COUNTER')] ?? 'COUNTER';
    const active = body.status !== 'Đã khóa';
    const passwordHash = await bcrypt.hash(password, 10);
    const pinHash = body.pin ? await bcrypt.hash(String(body.pin), 10) : null;

    const inserted = await sql`
      INSERT INTO "Staff" ("fullName", email, "passwordHash", role, "pinHash", active)
      VALUES (${String(body.name)}, ${email}, ${passwordHash}, ${role}, ${pinHash}, ${active})
      RETURNING id
    `;
    res.status(201).json(inserted[0]);
    return true;
  }

  const staffMatch = path.match(/^\/staff\/(\d+)$/);
  if (staffMatch && method === 'PATCH') {
    if (!requireOwner(authUser, res)) return true;
    const id = Number(staffMatch[1]);
    const role = roleToDb[String(body.role || 'COUNTER')] ?? 'COUNTER';
    const active = body.status !== 'Đã khóa';

    if (id === authUser.id && !active) {
      err(res, 400, 'SELF_LOCK', 'Không thể tự khóa tài khoản đang đăng nhập.');
      return true;
    }
    if (role !== 'OWNER' || !active) {
      const otherOwners = await sql`
        SELECT COUNT(*)::int AS cnt FROM "Staff" WHERE role = 'OWNER' AND active = true AND id <> ${id}
      `;
      if ((otherOwners[0]?.cnt ?? 0) === 0) {
        err(res, 400, 'LAST_OWNER', 'Phải còn ít nhất 1 Chủ quán đang hoạt động.');
        return true;
      }
    }

    const passwordHash = body.password ? await bcrypt.hash(String(body.password), 10) : null;
    const pinHash = body.pin ? await bcrypt.hash(String(body.pin), 10) : null;
    await sql`
      UPDATE "Staff"
      SET "fullName" = ${String(body.name)},
          email = ${String(body.email || '').trim().toLowerCase()},
          role = ${role},
          active = ${active},
          "passwordHash" = COALESCE(${passwordHash}, "passwordHash"),
          "pinHash" = COALESCE(${pinHash}, "pinHash")
      WHERE id = ${id}
    `;
    res.status(200).json({ id });
    return true;
  }

  // --- ADMIN: KEGS ---
  if (path === '/kegs' && method === 'GET') {
    const rows = await sql`
      SELECT id, code, "beerName", "capacityMl", cost, "receivedAt", status
      FROM "Keg"
      ORDER BY id DESC
    `;
    const statusMap: Record<string, string> = { IN_STOCK: 'Trong kho', TAPPED: 'Đang dùng', EMPTY: 'Đã hết' };
    res.status(200).json(rows.map((r) => ({
      id: Number(r.id),
      name: String(r.code),
      beer: String(r.beerName),
      capacity: `${Math.round(Number(r.capacityMl) / 1000)} L`,
      cost: Number(r.cost),
      date: new Date(r.receivedAt as string).toLocaleDateString('vi-VN'),
      status: statusMap[String(r.status)] || String(r.status)
    })));
    return true;
  }

  if (path === '/kegs' && method === 'POST') {
    if (!requireManagerOrOwner(authUser, res)) return true;
    const quantity = Math.max(1, Math.min(20, Number(body.quantity || 1)));
    const capacityMl = Number(body.capacity || 50) * 1000;
    const cost = Number(body.cost || 0);
    const beerName = String(body.beer || 'Bia hơi Hà Nội');
    const receivedAt = body.date ? new Date(String(body.date)) : new Date();

    const maxRow = await sql`SELECT COUNT(*)::int AS cnt FROM "Keg"`;
    let seq = Number(maxRow[0]?.cnt ?? 0);
    const created: number[] = [];
    for (let i = 0; i < quantity; i++) {
      seq += 1;
      const code = `KEG-${String(seq).padStart(4, '0')}`;
      const ins = await sql`
        INSERT INTO "Keg" (code, "beerName", "capacityMl", cost, "receivedAt", status)
        VALUES (${code}, ${beerName}, ${capacityMl}, ${cost}, ${receivedAt.toISOString()}, 'IN_STOCK')
        RETURNING id
      `;
      created.push(Number(ins[0].id));
    }
    res.status(201).json({ ids: created });
    return true;
  }

  // --- ADMIN: HAPPY HOURS ---
  if (path === '/happy-hours' && method === 'GET') {
    const rows = await sql`
      SELECT hh.id, hh.name, hh.weekdays, hh."startTime", hh."endTime", hh.enabled,
             mi.name AS "itemName", hhp.price AS "promoPrice"
      FROM "HappyHour" hh
      LEFT JOIN "HappyHourPrice" hhp ON hhp."happyHourId" = hh.id
      LEFT JOIN "MenuItem" mi ON mi.id = hhp."menuItemId"
      ORDER BY hh.id DESC
    `;
    const dayNames: Record<number, string> = { 1: 'T2', 2: 'T3', 3: 'T4', 4: 'T5', 5: 'T6', 6: 'T7', 7: 'CN' };
    res.status(200).json(rows.map((r) => ({
      id: Number(r.id),
      name: String(r.name),
      days: Array.isArray(r.weekdays) ? (r.weekdays as number[]).map((d) => dayNames[d] || d).join(', ') : '',
      start: String(r.startTime),
      end: String(r.endTime),
      item: r.itemName ? String(r.itemName) : '—',
      price: Number(r.promoPrice || 0),
      status: r.enabled ? 'Đang bật' : 'Đã tắt'
    })));
    return true;
  }

  if (path === '/happy-hours' && method === 'POST') {
    if (!requireOwner(authUser, res)) return true;
    const enabled = body.status !== 'Đã tắt';
    const weekdays = [1, 2, 3, 4, 5];
    const inserted = await sql`
      INSERT INTO "HappyHour" (name, weekdays, "startTime", "endTime", enabled)
      VALUES (${String(body.name)}, ${weekdays}, ${String(body.start || '16:00')}, ${String(body.end || '18:00')}, ${enabled})
      RETURNING id
    `;
    const hhId = Number(inserted[0].id);
    if (body.item && Number(body.price) > 0) {
      const menuRows = await sql`SELECT id FROM "MenuItem" WHERE name = ${String(body.item)} LIMIT 1`;
      if (menuRows[0]) {
        await sql`
          INSERT INTO "HappyHourPrice" ("happyHourId", "menuItemId", price)
          VALUES (${hhId}, ${menuRows[0].id}, ${Number(body.price)})
        `;
      }
    }
    res.status(201).json({ id: hhId });
    return true;
  }

  const hhMatch = path.match(/^\/happy-hours\/(\d+)$/);
  if (hhMatch && method === 'PATCH') {
    if (!requireOwner(authUser, res)) return true;
    const id = Number(hhMatch[1]);
    const enabled = body.status !== 'Đã tắt';
    await sql`
      UPDATE "HappyHour"
      SET name = ${String(body.name)}, "startTime" = ${String(body.start || '16:00')}, "endTime" = ${String(body.end || '18:00')}, enabled = ${enabled}
      WHERE id = ${id}
    `;
    res.status(200).json({ id });
    return true;
  }

  return false;
}
