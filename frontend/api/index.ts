import bcrypt from 'bcryptjs';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSql } from './_db.js';
import { signToken, verifyToken } from './_auth.js';
import { handleReports } from './_reports.js';
import { handleCounterAndAdmin } from './_admin.js';

function sendError(res: VercelResponse, status: number, code: string, message: string, details?: unknown) {
  return res.status(status).json({ error: { code, message, ...(details !== undefined ? { details } : {}) } });
}

function getRoutePath(req: VercelRequest): string {
  const qPath = req.query.__path;
  const rawQ = Array.isArray(qPath) ? qPath.join('/') : qPath;
  if (typeof rawQ === 'string' && rawQ.length > 0) {
    return '/' + rawQ.replace(/^\/+/, '').replace(/^api\//, '');
  }
  const urlPath = (req.url || '/').split('?')[0];
  return urlPath.replace(/^\/api/, '') || '/';
}

function parseRequestBody(req: VercelRequest): Record<string, any> {
  if (typeof req.body === 'object' && req.body !== null) {
    return req.body as Record<string, any>;
  }
  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      return JSON.parse(req.body) as Record<string, any>;
    } catch {
      return {};
    }
  }
  return {};
}

function toDisplayTableId(id: number, code: string): number {
  return /^\d+$/.test(code) ? Number(code) : id;
}

async function resolveTable(inputId: number) {
  const sql = getSql();
  const rows = await sql`
    SELECT id, code, "areaId"
    FROM "DiningTable"
    WHERE active = true AND (code = ${String(inputId)} OR id = ${inputId})
    ORDER BY CASE WHEN code = ${String(inputId)} THEN 0 ELSE 1 END
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function verifyApproverPin(pin: string): Promise<number | null> {
  if (!pin) return null;
  const sql = getSql();
  const approvers = await sql`
    SELECT id, "pinHash"
    FROM "Staff"
    WHERE active = true AND role IN ('SHIFT_MANAGER', 'OWNER') AND "pinHash" IS NOT NULL
  `;
  for (const row of approvers) {
    if (await bcrypt.compare(pin, String(row.pinHash))) {
      return Number(row.id);
    }
  }
  return null;
}

function getVietnamClock() {
  const now = new Date();
  const vn = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  const day = vn.getDay() === 0 ? 7 : vn.getDay();
  const hh = String(vn.getHours()).padStart(2, '0');
  const mm = String(vn.getMinutes()).padStart(2, '0');
  return { day, hhmm: `${hh}:${mm}` };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  let sql: ReturnType<typeof getSql>;
  try {
    sql = getSql();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Lỗi kết nối cơ sở dữ liệu.';
    return sendError(res, 500, 'DB_CONFIG_ERROR', msg);
  }

  const method = (req.method || 'GET').toUpperCase();
  const path = getRoutePath(req);
  const body = parseRequestBody(req);

  try {
    // 1. Auth: Login against Prisma "Staff" table (bcrypt passwordHash)
    if (path === '/auth/login' && method === 'POST') {
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const rows = await sql`
        SELECT id, "fullName", email, "passwordHash", role, active
        FROM "Staff"
        WHERE LOWER(email) = ${email}
        LIMIT 1
      `;
      const staff = rows[0];
      if (!staff || !(await bcrypt.compare(password, String(staff.passwordHash)))) {
        return sendError(res, 401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng.');
      }
      if (!staff.active) {
        return sendError(res, 403, 'ACCOUNT_LOCKED', 'Tài khoản đã bị khóa.');
      }
      const tokenUser = {
        id: Number(staff.id),
        fullName: String(staff.fullName),
        email: String(staff.email),
        role: staff.role as 'COUNTER' | 'SHIFT_MANAGER' | 'OWNER'
      };
      return res.status(200).json({ token: signToken(tokenUser), user: tokenUser });
    }

    const authUser = verifyToken(req);
    if (!authUser) {
      return sendError(res, 401, 'UNAUTHORIZED', 'Phiên đăng nhập hết hạn hoặc chưa đăng nhập.');
    }

    // 2. Auth: Me
    if (path === '/auth/me' && method === 'GET') {
      return res.status(200).json(authUser);
    }

    // 3. Menu (from MenuItem + MenuGroup + KitchenStation + active HappyHour)
    if (path === '/menu' && method === 'GET') {
      const { day, hhmm } = getVietnamClock();
      const items = await sql`
        SELECT mi.id, mi.shortcut, mi.name, mg.name AS category, mi.price, ks.name AS station
        FROM "MenuItem" mi
        JOIN "MenuGroup" mg ON mg.id = mi."groupId"
        JOIN "KitchenStation" ks ON ks.id = mi."stationId"
        WHERE mi.active = true AND mi.available = true
        ORDER BY mg."sortOrder", mi."sortOrder", mi.id
      `;
      const happyPrices = await sql`
        SELECT hhp."menuItemId", hhp.price
        FROM "HappyHourPrice" hhp
        JOIN "HappyHour" hh ON hh.id = hhp."happyHourId"
        WHERE hh.enabled = true
          AND ${day} = ANY(hh.weekdays)
          AND hh."startTime" <= ${hhmm}
          AND hh."endTime" >= ${hhmm}
      `;
      const happyMap = new Map(happyPrices.map((p) => [Number(p.menuItemId), Number(p.price)]));
      return res.status(200).json(items.map((item) => ({
        id: String(item.id),
        shortcut: String(item.shortcut),
        name: String(item.name),
        category: String(item.category),
        price: happyMap.get(Number(item.id)) ?? Number(item.price),
        station: String(item.station)
      })));
    }

    // 4. Areas with tables
    if (path === '/areas' && method === 'GET') {
      const areas = await sql`SELECT id, name FROM "Area" WHERE active = true ORDER BY "sortOrder", id`;
      const tables = await sql`SELECT id, "areaId", code FROM "DiningTable" WHERE active = true ORDER BY "sortOrder", id`;
      return res.status(200).json(areas.map((area) => ({
        id: Number(area.id),
        name: String(area.name),
        tables: tables
          .filter((t) => Number(t.areaId) === Number(area.id))
          .map((t) => ({ id: toDisplayTableId(Number(t.id), String(t.code)), code: String(t.code) }))
      })));
    }

    // 5. Tabs summary
    if (path === '/tabs/summary' && method === 'GET') {
      const tables = await sql`
        SELECT id, "areaId", code
        FROM "DiningTable"
        WHERE active = true
        ORDER BY "sortOrder", id
      `;
      const openTabs = await sql`
        SELECT id, "tableId", "billNo", "guestCount", "openedAt", "billDiscount"
        FROM "Tab"
        WHERE status = 'OPEN' AND "closedAt" IS NULL
      `;
      const openRounds = await sql`
        SELECT r.id, r."tabId", r."createdAt", s."fullName" AS "staffName"
        FROM "OrderRound" r
        JOIN "Tab" t ON t.id = r."tabId"
        JOIN "Staff" s ON s.id = r."createdById"
        WHERE t.status = 'OPEN' AND t."closedAt" IS NULL
        ORDER BY r."createdAt" ASC, r.id ASC
      `;
      const openLines = await sql`
        SELECT ol.id, ol."roundId", mi.name, ol.qty, ol."unitPrice",
               mg.name AS category, ks.name AS station,
               ol."lineType", ol.reason, ol.note
        FROM "OrderLine" ol
        JOIN "OrderRound" r ON r.id = ol."roundId"
        JOIN "Tab" t ON t.id = r."tabId"
        JOIN "MenuItem" mi ON mi.id = ol."menuItemId"
        JOIN "MenuGroup" mg ON mg.id = mi."groupId"
        JOIN "KitchenStation" ks ON ks.id = mi."stationId"
        WHERE t.status = 'OPEN' AND t."closedAt" IS NULL
        ORDER BY ol.id ASC
      `;
      const provPrints = await sql`
        SELECT bp."tabId", COUNT(*)::int AS cnt
        FROM "BillPrint" bp
        JOIN "Tab" t ON t.id = bp."tabId"
        WHERE t.status = 'OPEN' AND t."closedAt" IS NULL AND bp.kind = 'PROVISIONAL'
        GROUP BY bp."tabId"
      `;

      const tabByTableId = new Map(openTabs.map((t) => [Number(t.tableId), t]));
      const provMap = new Map(provPrints.map((p) => [Number(p.tabId), Number(p.cnt)]));
      let occupied = 0;
      let openAmount = 0;

      const summaryTables = tables.map((table) => {
        const displayId = toDisplayTableId(Number(table.id), String(table.code));
        const tab = tabByTableId.get(Number(table.id));
        if (!tab) {
          return {
            tableId: displayId,
            areaId: Number(table.areaId),
            code: String(table.code),
            status: 'EMPTY'
          };
        }

        occupied += 1;
        const tabRounds = openRounds.filter((r) => Number(r.tabId) === Number(tab.id));
        const roundIds = new Set(tabRounds.map((r) => Number(r.id)));
        const tabLines = openLines.filter((l) => roundIds.has(Number(l.roundId)));
        const subtotal = Math.max(
          0,
          tabLines.reduce((sum, l) => sum + Number(l.qty) * Number(l.unitPrice), 0) - Number(tab.billDiscount || 0)
        );
        openAmount += subtotal;
        const provisionalCount = provMap.get(Number(tab.id)) ?? 0;

        const rounds = tabRounds.map((r) => ({
          id: String(r.id),
          sentAt: new Date(r.createdAt as string).toISOString(),
          staffName: String(r.staffName),
          lines: tabLines
            .filter((l) => Number(l.roundId) === Number(r.id))
            .map((l) => ({
              id: String(l.id),
              name: String(l.name),
              quantity: Number(l.qty),
              price: Number(l.unitPrice),
              category: String(l.category),
              station: String(l.station),
              adjustment: l.lineType !== 'NORMAL',
              reason: l.reason ?? undefined,
              note: l.note ?? undefined
            }))
        }));

        return {
          tableId: displayId,
          areaId: Number(table.areaId),
          code: String(table.code),
          status: provisionalCount > 0 ? 'PROVISIONAL_PRINTED' : 'OCCUPIED',
          tabId: Number(tab.id),
          billNo: tab.billNo ? String(tab.billNo) : `HD-${tab.id}`,
          total: subtotal,
          openedAt: new Date(tab.openedAt as string).toISOString(),
          guestCount: tab.guestCount !== null ? Number(tab.guestCount) : null,
          provisionalCount,
          rounds
        };
      });

      return res.status(200).json({
        occupied,
        totalTables: tables.length,
        openAmount,
        tables: summaryTables
      });
    }

    // 6. Open tab
    if (path === '/tabs' && method === 'POST') {
      const table = await resolveTable(Number(body.tableId));
      if (!table) return sendError(res, 404, 'TABLE_NOT_FOUND', 'Không tìm thấy bàn.');

      const existing = await sql`
        SELECT id, "tableId", "guestCount", status, "openedAt"
        FROM "Tab"
        WHERE "tableId" = ${table.id} AND status = 'OPEN' AND "closedAt" IS NULL
        LIMIT 1
      `;
      if (existing.length > 0) {
        return sendError(res, 409, 'TABLE_ALREADY_OPEN', 'Bàn đã được mở.', { tabId: existing[0].id });
      }

      const guestCount = body.guestCount != null ? Number(body.guestCount) : null;
      const inserted = await sql`
        INSERT INTO "Tab" ("tableId", "guestCount", status, "openedById")
        VALUES (${table.id}, ${guestCount}, 'OPEN', ${authUser.id})
        RETURNING id, "tableId", "guestCount", status, "openedAt"
      `;
      const created = inserted[0];
      await sql`
        INSERT INTO "AuditLog" ("actorId", action, entity, "entityId", payload)
        VALUES (${authUser.id}, 'TAB_OPENED', 'Tab', ${created.id}, ${JSON.stringify({ tableId: table.id, guestCount })}::jsonb)
      `;
      return res.status(201).json(created);
    }

    // 7. Add round to table
    const roundMatch = path.match(/^\/tabs\/(\d+)\/rounds$/);
    if (roundMatch && method === 'POST') {
      const table = await resolveTable(Number(roundMatch[1]));
      if (!table) return sendError(res, 404, 'TABLE_NOT_FOUND', 'Không tìm thấy bàn.');

      let tabs = await sql`
        SELECT id FROM "Tab" WHERE "tableId" = ${table.id} AND status = 'OPEN' AND "closedAt" IS NULL LIMIT 1
      `;
      if (tabs.length === 0) {
        tabs = await sql`
          INSERT INTO "Tab" ("tableId", status, "openedById")
          VALUES (${table.id}, 'OPEN', ${authUser.id})
          RETURNING id
        `;
      }
      const tabId = Number(tabs[0].id);
      const items = Array.isArray(body.items) ? body.items : [];
      if (items.length === 0) {
        return sendError(res, 400, 'EMPTY_ROUND', 'Lượt gọi món không được để trống.');
      }

      const roundRows = await sql`
        INSERT INTO "OrderRound" ("tabId", "createdById")
        VALUES (${tabId}, ${authUser.id})
        RETURNING id
      `;
      const roundId = Number(roundRows[0].id);

      const { day, hhmm } = getVietnamClock();
      const happyPrices = await sql`
        SELECT hhp."menuItemId", hhp.price
        FROM "HappyHourPrice" hhp
        JOIN "HappyHour" hh ON hh.id = hhp."happyHourId"
        WHERE hh.enabled = true
          AND ${day} = ANY(hh.weekdays)
          AND hh."startTime" <= ${hhmm}
          AND hh."endTime" >= ${hhmm}
      `;
      const happyMap = new Map(happyPrices.map((p) => [Number(p.menuItemId), Number(p.price)]));

      for (const item of items) {
        const menuItemId = Number(item.menuItemId);
        const qty = Number(item.qty || 1);
        const note = item.note ? String(item.note) : null;
        const menuRows = await sql`
          SELECT mi.id, mi.price, mi."defaultTapId", t."currentKegId"
          FROM "MenuItem" mi
          LEFT JOIN "Tap" t ON t.id = mi."defaultTapId"
          WHERE mi.id = ${menuItemId}
          LIMIT 1
        `;
        const menu = menuRows[0];
        if (!menu) continue;
        const unitPrice = happyMap.get(Number(menu.id)) ?? Number(menu.price);
        await sql`
          INSERT INTO "OrderLine" ("roundId", "menuItemId", qty, "unitPrice", note, "lineType", "tapId", "kegId")
          VALUES (${roundId}, ${menu.id}, ${qty}, ${unitPrice}, ${note}, 'NORMAL', ${menu.defaultTapId ?? null}, ${menu.currentKegId ?? null})
        `;
      }

      return res.status(201).json({ roundId });
    }

    // 8. Mark provisional (insert into BillPrint)
    const provMatch = path.match(/^\/tabs\/(\d+)\/provisional$/);
    if (provMatch && method === 'POST') {
      const table = await resolveTable(Number(provMatch[1]));
      if (!table) return sendError(res, 404, 'TABLE_NOT_FOUND', 'Không tìm thấy bàn.');

      const tabs = await sql`
        SELECT id FROM "Tab" WHERE "tableId" = ${table.id} AND status = 'OPEN' AND "closedAt" IS NULL LIMIT 1
      `;
      if (tabs.length === 0) return sendError(res, 404, 'TAB_NOT_FOUND', 'Bàn chưa mở.');
      const tabId = Number(tabs[0].id);

      const countRows = await sql`
        SELECT COALESCE(MAX("printNo"), 0)::int AS max_no
        FROM "BillPrint"
        WHERE "tabId" = ${tabId} AND kind = 'PROVISIONAL'
      `;
      const nextNo = Number(countRows[0]?.max_no ?? 0) + 1;
      await sql`
        INSERT INTO "BillPrint" ("tabId", kind, "printNo")
        VALUES (${tabId}, 'PROVISIONAL', ${nextNo})
      `;
      return res.status(204).end();
    }

    // 9. Move or Merge table
    const moveMergeMatch = path.match(/^\/tabs\/(\d+)\/(move|merge)$/);
    if (moveMergeMatch && method === 'POST') {
      const sourceTable = await resolveTable(Number(moveMergeMatch[1]));
      const targetTable = await resolveTable(Number(body.targetTableId));
      if (!sourceTable || !targetTable) return sendError(res, 404, 'TABLE_NOT_FOUND', 'Không tìm thấy bàn.');
      const action = moveMergeMatch[2];

      const srcTabs = await sql`
        SELECT id FROM "Tab" WHERE "tableId" = ${sourceTable.id} AND status = 'OPEN' AND "closedAt" IS NULL LIMIT 1
      `;
      if (srcTabs.length === 0) return sendError(res, 404, 'TAB_NOT_FOUND', 'Bàn nguồn chưa mở.');
      const srcTabId = Number(srcTabs[0].id);

      const tgtTabs = await sql`
        SELECT id FROM "Tab" WHERE "tableId" = ${targetTable.id} AND status = 'OPEN' AND "closedAt" IS NULL LIMIT 1
      `;

      if (action === 'move') {
        if (tgtTabs.length > 0) return sendError(res, 409, 'TARGET_OCCUPIED', 'Bàn đích đang có khách.');
        await sql`UPDATE "Tab" SET "tableId" = ${targetTable.id} WHERE id = ${srcTabId}`;
        await sql`
          INSERT INTO "AuditLog" ("actorId", action, entity, "entityId", payload)
          VALUES (${authUser.id}, 'TAB_MOVED', 'Tab', ${srcTabId}, ${JSON.stringify({ fromTableId: sourceTable.id, toTableId: targetTable.id })}::jsonb)
        `;
      } else {
        if (tgtTabs.length === 0) {
          await sql`UPDATE "Tab" SET "tableId" = ${targetTable.id} WHERE id = ${srcTabId}`;
        } else {
          const tgtTabId = Number(tgtTabs[0].id);
          await sql`UPDATE "OrderRound" SET "tabId" = ${tgtTabId} WHERE "tabId" = ${srcTabId}`;
          await sql`UPDATE "Tab" SET status = 'MERGED', "closedAt" = NOW(), "mergedIntoId" = ${tgtTabId} WHERE id = ${srcTabId}`;
          await sql`
            INSERT INTO "AuditLog" ("actorId", action, entity, "entityId", payload)
            VALUES (${authUser.id}, 'TAB_MERGED', 'Tab', ${tgtTabId}, ${JSON.stringify({ sourceTabId: srcTabId })}::jsonb)
          `;
        }
      }
      return res.status(204).end();
    }

    // 10. Void / Discount order line
    const adjustMatch = path.match(/^\/order-lines\/(\d+)\/(void|discount)$/);
    if (adjustMatch && method === 'POST') {
      const lineId = Number(adjustMatch[1]);
      const action = adjustMatch[2];
      const lineRows = await sql`
        SELECT id, "roundId", "menuItemId", "unitPrice", "tapId", "kegId"
        FROM "OrderLine"
        WHERE id = ${lineId}
        LIMIT 1
      `;
      const orig = lineRows[0];
      if (!orig) return sendError(res, 404, 'LINE_NOT_FOUND', 'Không tìm thấy dòng món.');

      let approvedById: number | null = authUser.role === 'COUNTER' ? null : authUser.id;
      if (authUser.role === 'COUNTER') {
        approvedById = await verifyApproverPin(String(body.approverPin || ''));
        if (!approvedById) {
          return sendError(res, 403, 'INVALID_PIN', 'Mã PIN quản lý không hợp lệ.');
        }
      }

      const reason = String(body.reason || 'OTHER');
      const note = body.note ? String(body.note) : null;

      if (action === 'void') {
        const qty = Math.abs(Number(body.qty || 1));
        const inserted = await sql`
          INSERT INTO "OrderLine" ("roundId", "menuItemId", qty, "unitPrice", note, "lineType", "refLineId", reason, "requestedById", "approvedById", "tapId", "kegId")
          VALUES (${orig.roundId}, ${orig.menuItemId}, ${-qty}, ${orig.unitPrice}, ${note}, 'VOID', ${orig.id}, ${reason}, ${authUser.id}, ${approvedById}, ${orig.tapId ?? null}, ${orig.kegId ?? null})
          RETURNING id
        `;
        await sql`
          INSERT INTO "AuditLog" ("actorId", action, entity, "entityId", payload)
          VALUES (${authUser.id}, 'LINE_VOIDED', 'OrderLine', ${inserted[0].id}, ${JSON.stringify({ refLineId: orig.id, qty, reason })}::jsonb)
        `;
      } else {
        const discountAmount = Math.abs(Number(body.discountAmount || 0));
        const inserted = await sql`
          INSERT INTO "OrderLine" ("roundId", "menuItemId", qty, "unitPrice", note, "lineType", "refLineId", reason, "requestedById", "approvedById")
          VALUES (${orig.roundId}, ${orig.menuItemId}, 1, ${-discountAmount}, ${note}, 'DISCOUNT', ${orig.id}, ${reason}, ${authUser.id}, ${approvedById})
          RETURNING id
        `;
        await sql`
          INSERT INTO "AuditLog" ("actorId", action, entity, "entityId", payload)
          VALUES (${authUser.id}, 'LINE_DISCOUNTED', 'OrderLine', ${inserted[0].id}, ${JSON.stringify({ refLineId: orig.id, discountAmount, reason })}::jsonb)
        `;
      }

      return res.status(204).end();
    }

    // 11. Pay table
    const payMatch = path.match(/^\/tabs\/(\d+)\/pay$/);
    if (payMatch && method === 'POST') {
      const table = await resolveTable(Number(payMatch[1]));
      if (!table) return sendError(res, 404, 'TABLE_NOT_FOUND', 'Không tìm thấy bàn.');

      const tabs = await sql`
        SELECT id, "billNo"
        FROM "Tab"
        WHERE "tableId" = ${table.id} AND status = 'OPEN' AND "closedAt" IS NULL
        LIMIT 1
      `;
      if (tabs.length === 0) return sendError(res, 404, 'TAB_NOT_FOUND', 'Bàn chưa có hóa đơn mở.');
      const tab = tabs[0];
      const tabId = Number(tab.id);

      const lines = await sql`
        SELECT ol.id, mi.name, ol.qty, ol."unitPrice", ol."lineType", ol.reason, ol.note
        FROM "OrderLine" ol
        JOIN "OrderRound" r ON r.id = ol."roundId"
        JOIN "MenuItem" mi ON mi.id = ol."menuItemId"
        WHERE r."tabId" = ${tabId}
        ORDER BY ol.id ASC
      `;

      const subtotal = Math.max(0, lines.reduce((sum, l) => sum + Number(l.qty) * Number(l.unitPrice), 0));
      const billDiscount = body.billDiscount || {};
      const discountVal = Number(billDiscount.value || 0);
      const discount = billDiscount.type === 'PERCENT'
        ? Math.round((subtotal * discountVal) / 100)
        : Math.min(subtotal, Math.max(0, discountVal));

      let discountApprovedById: number | null = null;
      if (discount > 0) {
        if (authUser.role === 'COUNTER') {
          discountApprovedById = await verifyApproverPin(String(body.approverPin || ''));
          if (!discountApprovedById) {
            return sendError(res, 403, 'INVALID_PIN', 'Mã PIN quản lý không hợp lệ.');
          }
        } else {
          discountApprovedById = authUser.id;
        }
      }

      const total = Math.max(0, subtotal - discount);
      const payments = Array.isArray(body.payments) ? body.payments : [];
      const paid = payments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
      if (paid < total) {
        return sendError(res, 400, 'INSUFFICIENT_PAYMENT', 'Số tiền nhận chưa đủ.');
      }
      const change = Math.max(0, paid - total);

      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const billNo = tab.billNo ? String(tab.billNo) : `HD-${todayStr}-${String(tabId).padStart(4, '0')}`;
      const paidAt = new Date().toISOString();

      await sql`
        UPDATE "Tab"
        SET status = 'PAID',
            "closedAt" = NOW(),
            "billNo" = ${billNo},
            "billDiscount" = ${discount},
            "billDiscountById" = ${discount > 0 ? authUser.id : null},
            "billDiscountApprovedById" = ${discountApprovedById}
        WHERE id = ${tabId}
      `;

      for (const p of payments) {
        const amount = Number(p.amount || 0);
        if (amount <= 0) continue;
        const methodVal = p.method === 'TRANSFER' ? 'TRANSFER' : 'CASH';
        await sql`
          INSERT INTO "Payment" ("tabId", method, amount, "receivedById")
          VALUES (${tabId}, ${methodVal}, ${amount}, ${authUser.id})
        `;
      }

      await sql`
        INSERT INTO "BillPrint" ("tabId", kind, "printNo")
        VALUES (${tabId}, 'FINAL', 1)
      `;
      await sql`
        INSERT INTO "AuditLog" ("actorId", action, entity, "entityId", payload)
        VALUES (${authUser.id}, 'TAB_PAID', 'Tab', ${tabId}, ${JSON.stringify({ billNo, total, discount })}::jsonb)
      `;

      return res.status(200).json({
        billNo,
        subtotal,
        discount,
        total,
        paid,
        change,
        paidAt,
        lines: lines.map((l) => ({
          id: l.id,
          name: l.name,
          qty: Number(l.qty),
          unitPrice: Number(l.unitPrice),
          lineType: l.lineType === 'NORMAL' ? 'ITEM' : l.lineType,
          reason: l.reason ?? undefined,
          note: l.note ?? null
        }))
      });
    }

    // 12. Reports & Counter Shifts/Taps & Admin CRUD
    if (await handleReports(path, method, req, res)) return;
    if (await handleCounterAndAdmin(path, method, body, authUser, res)) return;

    return sendError(res, 404, 'NOT_FOUND', `Không tìm thấy API: ${method} ${path}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi xử lý máy chủ.';
    return sendError(res, 500, 'INTERNAL_ERROR', message);
  }
}
