import type { Prisma } from '@prisma/client';
import type { Tx } from './prisma.js';

/** Ghi một dòng nhật ký thao tác (SRS 8.1): ai, làm gì, trên đối tượng nào. */
export function audit(
  tx: Tx,
  actorId: number,
  action: string,
  entity: string,
  entityId: number,
  payload?: Prisma.InputJsonValue,
) {
  return tx.auditLog.create({ data: { actorId, action, entity, entityId, payload } });
}
