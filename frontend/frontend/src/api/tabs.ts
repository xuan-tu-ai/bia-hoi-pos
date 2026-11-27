import { apiRequest } from './client.ts';
import { USE_MOCK } from '../lib/config.ts';
import type { AdjustmentAction, AdjustmentReason, CompletedBill, DiningTable, MenuItem, OrderLine, PaymentDetails, PosData } from '../types/index.ts';

interface ApiArea {
  id: string | number;
  name: string;
  tables?: Array<{ id: number; code?: string }>;
}

interface TabSummary {
  occupied: number;
  totalTables: number;
  openAmount: number;
  tables: Array<{
    tableId: number;
    areaId: string | number;
    code: string;
    status: 'EMPTY' | 'OCCUPIED' | 'PROVISIONAL_PRINTED';
    tabId?: number;
    billNo?: string;
    total?: number;
    openedAt?: string;
    guestCount?: number | null;
    provisionalCount?: number;
    rounds?: DiningTable['rounds'];
  }>;
}

interface ApiBill {
  billNo: string;
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  change: number;
  paidAt: string;
  lines: Array<{
    id?: number | string;
    name: string;
    qty: number;
    unitPrice: number;
    lineType?: string;
    reason?: string;
    note?: string | null;
  }>;
}

const reasonCodes: Record<AdjustmentReason, string> = {
  'Khách đổi ý': 'CUSTOMER_CHANGED_MIND',
  'Bếp hết món': 'OUT_OF_STOCK',
  'Nhập nhầm': 'WRONG_ENTRY',
  'Món lỗi': 'DEFECTIVE',
  'Khác': 'OTHER'
};

async function mockService() {
  return (await import('../mocks/tabs.ts')).posService;
}

export async function getPosData(): Promise<PosData> {
  if (USE_MOCK) return (await mockService()).getData();

  const [summary, areasResponse] = await Promise.all([
    apiRequest<TabSummary>('/tabs/summary'),
    apiRequest<ApiArea[]>('/areas?include=tables')
  ]);
  return {
    areas: areasResponse.map((area) => ({
      id: String(area.id),
      name: area.name,
      firstTable: area.tables?.[0]?.id ?? 0,
      count: area.tables?.length ?? 0
    })),
    tables: summary.tables.map((table) => ({
      id: table.tableId,
      billNo: table.billNo,
      areaId: String(table.areaId),
      status: table.status === 'EMPTY' ? 'empty' : table.status === 'PROVISIONAL_PRINTED' ? 'provisional' : 'occupied',
      guestCount: table.guestCount ?? null,
      openedAt: table.openedAt ?? null,
      total: table.total ?? 0,
      provisionalCount: table.provisionalCount,
      rounds: table.rounds ?? []
    })),
    completedBills: []
  };
}

export async function getMenu(): Promise<MenuItem[]> {
  if (USE_MOCK) return (await import('../mocks/tabs.ts')).MENU;
  return apiRequest<MenuItem[]>('/menu');
}

export async function openTable(tableId: number, guestCount: number | null): Promise<PosData> {
  if (USE_MOCK) return (await mockService()).openTable(tableId, guestCount);
  await apiRequest('/tabs', { method: 'POST', body: JSON.stringify({ tableId, guestCount }) });
  return getPosData();
}

export async function addRound(tableId: number, lines: OrderLine[], staffName: string): Promise<PosData> {
  if (USE_MOCK) return (await mockService()).addRound(tableId, lines, staffName);
  await apiRequest(`/tabs/${tableId}/rounds`, {
    method: 'POST',
    body: JSON.stringify({ items: lines.map((line) => ({ menuItemId: line.id, qty: line.quantity, note: line.note ?? null })) })
  });
  return getPosData();
}

export async function markProvisional(tableId: number): Promise<PosData> {
  if (USE_MOCK) return (await mockService()).markProvisional(tableId);
  await apiRequest(`/tabs/${tableId}/provisional`, { method: 'POST' });
  return getPosData();
}

export async function moveTable(sourceId: number, targetId: number, merge: boolean): Promise<PosData> {
  if (USE_MOCK) return (await mockService()).moveTable(sourceId, targetId, merge);
  await apiRequest(`/tabs/${sourceId}/${merge ? 'merge' : 'move'}`, {
    method: 'POST',
    body: JSON.stringify({ targetTableId: targetId })
  });
  return getPosData();
}

export async function adjustOrderLine(
  tableId: number,
  roundId: string,
  lineId: string,
  action: AdjustmentAction,
  quantity: number,
  discountAmount = 0,
  reason: AdjustmentReason = 'Khách đổi ý',
  note = '',
  approverPin?: string
): Promise<PosData> {
  if (USE_MOCK) {
    return (await mockService()).adjustOrderLine(tableId, roundId, lineId, action, quantity, discountAmount, reason, note);
  }
  const path = `/order-lines/${lineId}/${action}`;
  await apiRequest(path, {
    method: 'POST',
    body: JSON.stringify({
      qty: quantity,
      discountAmount: action === 'discount' ? discountAmount : undefined,
      reason: reasonCodes[reason],
      note: note || null,
      approverPin: approverPin || null
    })
  });
  return getPosData();
}

export async function payTable(tableId: number, payment: PaymentDetails): Promise<{ data: PosData; receipt: CompletedBill }> {
  if (USE_MOCK) {
    const service = await mockService();
    const data = service.closeTable(tableId, payment);
    return { data, receipt: data.completedBills[0] };
  }
  const bill = await apiRequest<ApiBill>(`/tabs/${tableId}/pay`, {
    method: 'POST',
    body: JSON.stringify({
      billDiscount: { type: payment.discountType ?? 'AMOUNT', value: payment.discountValue ?? payment.discount },
      approverPin: payment.approverPin,
      payments: payment.payments.map((entry) => ({ method: entry.method, amount: entry.amount }))
    })
  });
  const receipt: CompletedBill = {
    billNo: bill.billNo,
    tableId,
    paidAt: bill.paidAt,
    subtotal: bill.subtotal,
    discount: bill.discount,
    total: bill.total,
    change: bill.change,
    payments: payment.payments,
    lines: bill.lines.map((line, index) => ({
      id: String(line.id ?? index),
      name: line.name,
      quantity: line.qty,
      price: line.unitPrice,
      adjustment: line.lineType !== undefined && line.lineType !== 'ITEM',
      reason: line.reason,
      note: line.note ?? undefined
    }))
  };
  return { data: await getPosData(), receipt };
}
