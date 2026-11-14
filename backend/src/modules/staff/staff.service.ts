import bcrypt from 'bcryptjs';
import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { audit } from '../../lib/audit.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import type { createStaffSchema, updateStaffSchema } from './staff.schema.js';

/** Không bao giờ trả mật khẩu/PIN về (FR-13). */
const publicFields = {
  id: true,
  fullName: true,
  email: true,
  role: true,
  active: true,
  createdAt: true,
  pinHash: true,
} satisfies Prisma.StaffSelect;

type Row = Prisma.StaffGetPayload<{ select: typeof publicFields }>;
const toPublic = ({ pinHash, ...s }: Row) => ({ ...s, hasPin: !!pinHash });

export async function listStaff() {
  const rows = await prisma.staff.findMany({ select: publicFields, orderBy: [{ active: 'desc' }, { id: 'asc' }] });
  return rows.map(toPublic);
}

/** Danh sách rút gọn (id, họ tên) cho bộ lọc báo cáo. */
export function staffOptions() {
  return prisma.staff.findMany({ select: { id: true, fullName: true }, orderBy: { fullName: 'asc' } });
}

async function assertEmailFree(email: string, exceptId?: number) {
  const other = await prisma.staff.findUnique({ where: { email } });
  if (other && other.id !== exceptId) throw conflict('DUPLICATE_EMAIL', 'Email đã được dùng cho tài khoản khác');
}

export async function createStaff(actorId: number, input: z.infer<typeof createStaffSchema>) {
  await assertEmailFree(input.email);
  const canHavePin = input.role !== 'COUNTER';
  return prisma.$transaction(async (tx) => {
    const s = await tx.staff.create({
      data: {
        fullName: input.fullName,
        email: input.email,
        role: input.role,
        active: input.active ?? true,
        passwordHash: await bcrypt.hash(input.password, 10),
        pinHash: canHavePin && input.pin ? await bcrypt.hash(input.pin, 10) : null,
      },
      select: publicFields,
    });
    await audit(tx, actorId, 'STAFF_CREATED', 'Staff', s.id, { email: s.email, role: s.role });
    return toPublic(s);
  });
}

export async function updateStaff(actorId: number, id: number, input: z.infer<typeof updateStaffSchema>) {
  const target = await prisma.staff.findUnique({ where: { id } });
  if (!target) throw notFound('Không tìm thấy nhân viên');
  if (input.email) await assertEmailFree(input.email, id);

  // FR-13: không tự khóa chính mình
  if (id === actorId && input.active === false) throw badRequest('CANNOT_LOCK_SELF', 'Không thể tự khóa tài khoản của mình');

  // FR-13: không hạ quyền hoặc khóa chủ quán cuối cùng
  const losesOwner = target.role === 'OWNER' && target.active && ((input.role && input.role !== 'OWNER') || input.active === false);
  if (losesOwner) {
    const owners = await prisma.staff.count({ where: { role: 'OWNER', active: true } });
    if (owners <= 1) throw conflict('LAST_OWNER', 'Không thể hạ quyền hoặc khóa chủ quán cuối cùng');
  }

  const role = input.role ?? target.role;
  const data: Prisma.StaffUpdateInput = {
    fullName: input.fullName,
    email: input.email,
    role: input.role,
    active: input.active,
  };
  if (input.password) data.passwordHash = await bcrypt.hash(input.password, 10);
  if (role === 'COUNTER') data.pinHash = null;
  else if (input.pin === null) data.pinHash = null;
  else if (input.pin) data.pinHash = await bcrypt.hash(input.pin, 10);

  return prisma.$transaction(async (tx) => {
    const s = await tx.staff.update({ where: { id }, data, select: publicFields });
    const { password: _p, pin: _pin, ...logged } = input;
    await audit(tx, actorId, 'STAFF_UPDATED', 'Staff', id, {
      ...logged,
      ...(input.password ? { passwordReset: true } : {}),
      ...(input.pin !== undefined ? { pinChanged: true } : {}),
    });
    return toPublic(s);
  });
}
