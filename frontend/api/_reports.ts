import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSql } from './_db.js';

function strQuery(val: string | string[] | undefined): string {
  return Array.isArray(val) ? (val[0] ?? '') : (val ?? '');
}

const reasonLabels: Record<string, string> = {
  CUSTOMER_CHANGED_MIND: 'Khách đổi ý',
  OUT_OF_STOCK: 'Bếp hết món',
  WRONG_ENTRY: 'Nhập nhầm',
  DEFECTIVE: 'Món lỗi',
  OTHER: 'Khác'
};

export async function handleReports(path: string, method: string, req: VercelRequest, res: VercelResponse): Promise<boolean> {
  if (!path.startsWith('/reports') || method !== 'GET') return false;
  const sql = getSql();

  if (path === '/reports/today') {
    const paidRows = await sql`
      SELECT
        COALESCE(SUM(GREATEST(0, COALESCE(s.line_sum, 0) - t."billDiscount")), 0)::int AS revenue,
        COUNT(*)::int AS bills
      FROM "Tab" t
      LEFT JOIN (
        SELECT r."tabId", COALESCE(SUM(ol.qty * ol."unitPrice"), 0)::int AS line_sum
        FROM "OrderRound" r
        JOIN "OrderLine" ol ON ol."roundId" = r.id
        GROUP BY r."tabId"
      ) s ON s."tabId" = t.id
      WHERE t.status = 'PAID'
        AND (t."closedAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
    `;

    const yesterdayRows = await sql`
      SELECT COALESCE(SUM(GREATEST(0, COALESCE(s.line_sum, 0) - t."billDiscount")), 0)::int AS revenue
      FROM "Tab" t
      LEFT JOIN (
        SELECT r."tabId", COALESCE(SUM(ol.qty * ol."unitPrice"), 0)::int AS line_sum
        FROM "OrderRound" r
        JOIN "OrderLine" ol ON ol."roundId" = r.id
        GROUP BY r."tabId"
      ) s ON s."tabId" = t.id
      WHERE t.status = 'PAID'
        AND (t."closedAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = ((NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - INTERVAL '1 day')
    `;

    const openRows = await sql`
      SELECT
        COALESCE(SUM(GREATEST(0, COALESCE(s.line_sum, 0) - t."billDiscount")), 0)::int AS open_amount,
        COUNT(*)::int AS occupied
      FROM "Tab" t
      LEFT JOIN (
        SELECT r."tabId", COALESCE(SUM(ol.qty * ol."unitPrice"), 0)::int AS line_sum
        FROM "OrderRound" r
        JOIN "OrderLine" ol ON ol."roundId" = r.id
        GROUP BY r."tabId"
      ) s ON s."tabId" = t.id
      WHERE t.status = 'OPEN' AND t."closedAt" IS NULL
    `;

    const tableCountRows = await sql`SELECT COUNT(*)::int AS total FROM "DiningTable" WHERE active = true`;

    const paymentRows = await sql`
      SELECT p.method, COALESCE(SUM(p.amount), 0)::int AS total
      FROM "Payment" p
      JOIN "Tab" t ON t.id = p."tabId"
      WHERE t.status = 'PAID'
        AND (t."closedAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
      GROUP BY p.method
    `;

    const hourlyToday = await sql`
      SELECT EXTRACT(HOUR FROM t."closedAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')::int AS hour,
             COALESCE(SUM(GREATEST(0, COALESCE(s.line_sum, 0) - t."billDiscount")), 0)::int AS revenue
      FROM "Tab" t
      LEFT JOIN (
        SELECT r."tabId", COALESCE(SUM(ol.qty * ol."unitPrice"), 0)::int AS line_sum
        FROM "OrderRound" r
        JOIN "OrderLine" ol ON ol."roundId" = r.id
        GROUP BY r."tabId"
      ) s ON s."tabId" = t.id
      WHERE t.status = 'PAID'
        AND (t."closedAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
      GROUP BY 1 ORDER BY 1
    `;

    const hourlyYesterday = await sql`
      SELECT EXTRACT(HOUR FROM t."closedAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')::int AS hour,
             COALESCE(SUM(GREATEST(0, COALESCE(s.line_sum, 0) - t."billDiscount")), 0)::int AS revenue
      FROM "Tab" t
      LEFT JOIN (
        SELECT r."tabId", COALESCE(SUM(ol.qty * ol."unitPrice"), 0)::int AS line_sum
        FROM "OrderRound" r
        JOIN "OrderLine" ol ON ol."roundId" = r.id
        GROUP BY r."tabId"
      ) s ON s."tabId" = t.id
      WHERE t.status = 'PAID'
        AND (t."closedAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = ((NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - INTERVAL '1 day')
      GROUP BY 1 ORDER BY 1
    `;

    const cashRevenue = Number(paymentRows.find((r) => r.method === 'CASH')?.total ?? 0);
    const transferRevenue = Number(paymentRows.find((r) => r.method === 'TRANSFER')?.total ?? 0);

    res.status(200).json({
      revenue: paidRows[0]?.revenue ?? 0,
      yesterdayRevenue: yesterdayRows[0]?.revenue ?? 0,
      bills: paidRows[0]?.bills ?? 0,
      openAmount: openRows[0]?.open_amount ?? 0,
      occupiedTables: openRows[0]?.occupied ?? 0,
      totalTables: tableCountRows[0]?.total ?? 0,
      cashRevenue,
      transferRevenue,
      hourly: hourlyToday,
      yesterdayHourly: hourlyYesterday
    });
    return true;
  }

  if (path === '/reports/keg-loss') {
    const threshold = Number(strQuery(req.query.threshold) || 5);
    const from = strQuery(req.query.from);
    const to = strQuery(req.query.to);

    const kegs = await sql`
      SELECT k.id AS "kegId", k.code, k."beerName", COALESCE(t.name, '—') AS "tapName",
             k."capacityMl", COALESCE(k."soldMl", 0) AS "soldMl", k.cost,
             k."tappedAt", k."emptiedAt"
      FROM "Keg" k
      LEFT JOIN "Tap" t ON t.id = k."tapId"
      WHERE k.status = 'EMPTY'
        AND (${from} = '' OR (k."emptiedAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date >= ${from || '1970-01-01'}::date)
        AND (${to} = '' OR (k."emptiedAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= ${to || '2999-12-31'}::date)
      ORDER BY k."emptiedAt" DESC, k.id DESC
    `;

    let totalLossMl = 0;
    let totalLossAmount = 0;
    const mapped = kegs.map((k) => {
      const cap = Number(k.capacityMl);
      const sold = Number(k.soldMl);
      const lossMl = Math.max(0, cap - sold);
      const costPerMl = cap > 0 ? Number(k.cost) / cap : 0;
      totalLossMl += lossMl;
      totalLossAmount += Math.round(lossMl * costPerMl);
      const lossPercent = cap > 0 ? Number(((lossMl / cap) * 100).toFixed(1)) : 0;
      return {
        kegId: Number(k.kegId),
        code: String(k.code),
        beerName: String(k.beerName),
        tapName: String(k.tapName),
        capacityMl: cap,
        soldMl: sold,
        lossMl,
        lossPercent,
        tappedAt: k.tappedAt ? new Date(k.tappedAt as string).toISOString() : '',
        emptiedAt: k.emptiedAt ? new Date(k.emptiedAt as string).toISOString() : '',
        overThreshold: lossPercent > threshold
      };
    });

    res.status(200).json({
      threshold,
      totalLossLiters: Number((totalLossMl / 1000).toFixed(2)),
      totalLossAmount,
      kegs: mapped
    });
    return true;
  }

  if (path === '/reports/voids') {
    const from = strQuery(req.query.from);
    const to = strQuery(req.query.to);
    const staff = strQuery(req.query.staff).trim().toLowerCase();
    const approver = strQuery(req.query.approver).trim().toLowerCase();
    const reason = strQuery(req.query.reason).trim();

    const rows = await sql`
      SELECT ol.id,
             ol."createdAt",
             CONCAT('Bàn ', dt.code) AS "table",
             mi.name AS item,
             ol.qty AS quantity,
             ABS(ol.qty * ol."unitPrice")::int AS amount,
             ol."lineType"::text AS "lineType",
             COALESCE(ol.reason, 'OTHER') AS reason,
             ol.note,
             COALESCE(req_s."fullName", '—') AS "requestedBy",
             COALESCE(app_s."fullName", '—') AS "approvedBy"
      FROM "OrderLine" ol
      JOIN "OrderRound" r ON r.id = ol."roundId"
      JOIN "Tab" t ON t.id = r."tabId"
      JOIN "DiningTable" dt ON dt.id = t."tableId"
      JOIN "MenuItem" mi ON mi.id = ol."menuItemId"
      LEFT JOIN "Staff" req_s ON req_s.id = ol."requestedById"
      LEFT JOIN "Staff" app_s ON app_s.id = ol."approvedById"
      WHERE ol."lineType" IN ('VOID', 'DISCOUNT')
        AND (${from} = '' OR (ol."createdAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date >= ${from || '1970-01-01'}::date)
        AND (${to} = '' OR (ol."createdAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= ${to || '2999-12-31'}::date)
        AND (${staff} = '' OR LOWER(COALESCE(req_s."fullName", '')) LIKE ${`%${staff}%`})
        AND (${approver} = '' OR LOWER(COALESCE(app_s."fullName", '')) LIKE ${`%${approver}%`})
        AND (${reason} = '' OR ol.reason = ${reason})
      ORDER BY ol."createdAt" DESC, ol.id DESC
      LIMIT 200
    `;

    res.status(200).json(rows.map((r) => ({
      id: Number(r.id),
      createdAt: new Date(r.createdAt as string).toISOString(),
      table: String(r.table),
      item: String(r.item),
      quantity: Number(r.quantity),
      amount: Number(r.amount),
      type: r.lineType === 'VOID' ? 'Hủy món' : 'Giảm giá',
      reason: reasonLabels[String(r.reason)] || String(r.reason),
      note: r.note ? String(r.note) : '',
      staff: `${r.requestedBy} / ${r.approvedBy}`
    })));
    return true;
  }

  if (path === '/reports/top-items') {
    const from = strQuery(req.query.from);
    const to = strQuery(req.query.to);
    const by = strQuery(req.query.by) === 'amount' ? 'amount' : 'quantity';

    const items = await sql`
      SELECT mi.id,
             mi.name,
             SUM(ol.qty)::int AS quantity,
             SUM(ol.qty * ol."unitPrice")::int AS revenue
      FROM "OrderLine" ol
      JOIN "OrderRound" r ON r.id = ol."roundId"
      JOIN "Tab" t ON t.id = r."tabId"
      JOIN "MenuItem" mi ON mi.id = ol."menuItemId"
      WHERE ol."lineType" = 'NORMAL'
        AND t.status = 'PAID'
        AND (${from} = '' OR (t."closedAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date >= ${from || '1970-01-01'}::date)
        AND (${to} = '' OR (t."closedAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= ${to || '2999-12-31'}::date)
      GROUP BY mi.id, mi.name
      HAVING SUM(ol.qty) > 0
      ORDER BY CASE WHEN ${by} = 'amount' THEN SUM(ol.qty * ol."unitPrice") ELSE SUM(ol.qty) END DESC
      LIMIT 20
    `;

    const hourly = await sql`
      SELECT EXTRACT(HOUR FROM t."closedAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')::int AS hour,
             COALESCE(SUM(GREATEST(0, COALESCE(s.line_sum, 0) - t."billDiscount")), 0)::int AS revenue
      FROM "Tab" t
      LEFT JOIN (
        SELECT r."tabId", COALESCE(SUM(ol.qty * ol."unitPrice"), 0)::int AS line_sum
        FROM "OrderRound" r
        JOIN "OrderLine" ol ON ol."roundId" = r.id
        GROUP BY r."tabId"
      ) s ON s."tabId" = t.id
      WHERE t.status = 'PAID'
        AND (${from} = '' OR (t."closedAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date >= ${from || '1970-01-01'}::date)
        AND (${to} = '' OR (t."closedAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= ${to || '2999-12-31'}::date)
      GROUP BY 1 ORDER BY 1
    `;

    const totalRev = items.reduce((s, i) => s + Number(i.revenue), 0) || 1;
    res.status(200).json({
      items: items.map((item, idx) => ({
        id: Number(item.id),
        rank: idx + 1,
        name: String(item.name),
        quantity: Number(item.quantity),
        revenue: Number(item.revenue),
        share: `${Math.round((Number(item.revenue) / totalRev) * 100)}%`
      })),
      hourly
    });
    return true;
  }

  if (path === '/reports/hourly') {
    const from = strQuery(req.query.from);
    const to = strQuery(req.query.to);
    const rows = await sql`
      SELECT EXTRACT(HOUR FROM t."closedAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')::int AS hour,
             COALESCE(SUM(GREATEST(0, COALESCE(s.line_sum, 0) - t."billDiscount")), 0)::int AS revenue
      FROM "Tab" t
      LEFT JOIN (
        SELECT r."tabId", COALESCE(SUM(ol.qty * ol."unitPrice"), 0)::int AS line_sum
        FROM "OrderRound" r
        JOIN "OrderLine" ol ON ol."roundId" = r.id
        GROUP BY r."tabId"
      ) s ON s."tabId" = t.id
      WHERE t.status = 'PAID'
        AND (${from} = '' OR (t."closedAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date >= ${from || '1970-01-01'}::date)
        AND (${to} = '' OR (t."closedAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= ${to || '2999-12-31'}::date)
      GROUP BY 1 ORDER BY 1
    `;
    res.status(200).json(rows);
    return true;
  }

  return false;
}
