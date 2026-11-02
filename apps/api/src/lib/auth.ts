// Xác thực (SRS 6.1, NFR-05): JWT; máy quầy đăng nhập bằng khóa thiết bị + PIN,
// web đăng nhập bằng email/mật khẩu. PIN và mật khẩu băm bằng bcrypt (FR-01).

import bcrypt from 'bcryptjs';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { APPROVER_ROLES, type Role } from '@biahoi/shared';
import { prisma } from './prisma';
import { forbidden, unauthorized } from './errors';

export interface TokenPayload {
  /** access: phiên đăng nhập; approval: phiếu duyệt ngắn hạn sau khi quản lý nhập PIN */
  kind: 'access' | 'approval';
  sub: number;
  role: Role;
  name: string;
  /** Mã ngẫu nhiên của phiếu duyệt, để hai phiếu cấp trong cùng một giây vẫn khác nhau */
  jti?: string;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: TokenPayload;
    user: TokenPayload;
  }
}

const BCRYPT_ROUNDS = 10;

export const hashSecret = (secret: string) => bcrypt.hash(secret, BCRYPT_ROUNDS);
export const verifySecret = (secret: string, hash: string) => bcrypt.compare(secret, hash);

/**
 * Tìm nhân viên đang hoạt động có PIN khớp. PIN băm không tra cứu theo chỉ mục được,
 * nên so lần lượt — chấp nhận được với quy mô vài chục nhân viên của một quán.
 */
export async function findStaffByPin(pin: string, excludeId?: number) {
  const staff = await prisma.staff.findMany({ where: { active: true, NOT: excludeId ? { id: excludeId } : undefined } });
  for (const s of staff) {
    if (await verifySecret(pin, s.pinHash)) return s;
  }
  return null;
}

/** Kiểm tra token đăng nhập và nhân viên vẫn còn hoạt động (FR-13). */
export async function authenticate(req: FastifyRequest): Promise<void> {
  try {
    await req.jwtVerify();
  } catch {
    throw unauthorized();
  }
  if (req.user.kind !== 'access') throw unauthorized();
  const staff = await prisma.staff.findUnique({ where: { id: req.user.sub }, select: { active: true, role: true } });
  if (!staff?.active) throw unauthorized('Tài khoản đã ngừng hoạt động');
  // Vai trò lấy từ CSDL để đổi vai trò có hiệu lực ngay, không chờ token hết hạn.
  req.user.role = staff.role;
}

export function requireRole(...roles: Role[]) {
  return async (req: FastifyRequest) => {
    await authenticate(req);
    if (!roles.includes(req.user.role)) throw forbidden();
  };
}

export const anyStaff = requireRole('COUNTER', 'SHIFT_MANAGER', 'OWNER');
export const managerOnly = requireRole('SHIFT_MANAGER', 'OWNER');
export const ownerOnly = requireRole('OWNER');

/** Phiếu duyệt đã dùng → thời điểm hết hạn (ms). Mỗi phiếu chỉ duyệt được một thao tác. */
const usedApprovals = new Map<string, number>();

/**
 * Kiểm tra phiếu duyệt do POST /auth/approve cấp. Gọi `consume()` sau khi thao tác
 * thành công, để thao tác bị từ chối (vd hủy quá số lượng) không làm mất phiếu.
 */
export async function verifyApproval(app: FastifyInstance, approvalToken: string) {
  let payload: TokenPayload & { exp?: number };
  try {
    payload = app.jwt.verify<TokenPayload & { exp?: number }>(approvalToken);
  } catch {
    throw forbidden('Phiếu duyệt không hợp lệ hoặc đã hết hạn, nhập lại PIN quản lý');
  }
  if (payload.kind !== 'approval') throw forbidden('Cần PIN của Quản lý ca');

  const now = Date.now();
  for (const [token, exp] of usedApprovals) if (exp <= now) usedApprovals.delete(token);
  if (usedApprovals.has(approvalToken)) throw forbidden('Phiếu duyệt đã được dùng, nhập lại PIN quản lý');

  const approver = await prisma.staff.findUnique({ where: { id: payload.sub } });
  if (!approver?.active || !APPROVER_ROLES.includes(approver.role)) throw forbidden('Cần PIN của Quản lý ca');
  const expiresAt = (payload.exp ?? now / 1000 + 300) * 1000;
  return { approver, consume: () => void usedApprovals.set(approvalToken, expiresAt) };
}
