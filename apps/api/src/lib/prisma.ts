import { Prisma, PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export type Tx = Prisma.TransactionClient;

/**
 * Khóa hàng của phiên bàn đến hết transaction, để các thao tác ghi đồng thời trên
 * cùng một bàn (gọi món, hủy, gộp, thanh toán) từ nhiều máy quầy chạy tuần tự.
 */
export async function lockTab(tx: Tx, tabId: number): Promise<void> {
  await tx.$queryRaw`SELECT id FROM tab WHERE id = ${tabId} FOR UPDATE`;
}

export async function audit(
  tx: Tx,
  actorId: number | null,
  action: string,
  entity: string,
  entityId: number | null,
  payload?: Prisma.InputJsonValue,
): Promise<void> {
  await tx.auditLog.create({ data: { actorId, action, entity, entityId, payload } });
}
