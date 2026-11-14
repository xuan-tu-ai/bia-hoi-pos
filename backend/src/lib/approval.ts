import bcrypt from 'bcryptjs';
import type { Role } from '@prisma/client';
import { badRequest } from './errors.js';
import type { Tx } from './prisma.js';

/**
 * Xác định người duyệt cho thao tác cần duyệt (hủy/giảm món, giảm giá hóa đơn — SRS 2.2, FR-06).
 * - Quản lý ca / Chủ quán: tự duyệt, không cần PIN.
 * - Nhân viên quầy: phải nhập PIN của một Quản lý ca hoặc Chủ quán đang hoạt động.
 * Trả về id người duyệt.
 */
export async function resolveApprover(
  tx: Tx,
  user: { id: number; role: Role },
  approverPin: string | null | undefined,
): Promise<number> {
  if (user.role !== 'COUNTER') return user.id;
  if (!approverPin) throw badRequest('PIN_REQUIRED', 'Cần PIN của Quản lý ca để thực hiện thao tác này');

  const approvers = await tx.staff.findMany({
    where: { active: true, role: { in: ['SHIFT_MANAGER', 'OWNER'] }, pinHash: { not: null } },
    select: { id: true, pinHash: true },
  });
  for (const a of approvers) {
    if (a.pinHash && (await bcrypt.compare(approverPin, a.pinHash))) return a.id;
  }
  throw badRequest('INVALID_PIN', 'PIN không đúng');
}
