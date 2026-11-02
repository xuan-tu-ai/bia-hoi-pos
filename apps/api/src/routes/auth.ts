import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { APPROVER_ROLES } from '@biahoi/shared';
import { config } from '../config';
import { anyStaff, findStaffByPin, verifySecret, type TokenPayload } from '../lib/auth';
import { forbidden, unauthorized } from '../lib/errors';
import { assertNotLocked, recordFailure, recordSuccess } from '../lib/lockout';
import { audit, prisma } from '../lib/prisma';

const pinBody = z.object({ pin: z.string().regex(/^\d{4,6}$/, 'PIN gồm 4–6 chữ số') });
const loginBody = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });

function deviceKeyOf(req: FastifyRequest): string | undefined {
  const key = req.headers['x-device-key'];
  return typeof key === 'string' ? key : undefined;
}

/** Máy quầy phải gửi khóa thiết bị hợp lệ (token thiết bị, SRS 6.1). */
function assertCounterDevice(req: FastifyRequest): void {
  if (config.deviceKeys.length === 0) return;
  const key = deviceKeyOf(req);
  if (!key || !config.deviceKeys.includes(key)) throw forbidden('Thiết bị chưa được đăng ký làm máy quầy');
}

function wrongMessage(remaining: number, what: string): string {
  return remaining > 0 ? `${what} không đúng, còn ${remaining} lần thử` : `${what} không đúng, đã khóa ${config.pinLockMs / 1000} giây`;
}

export async function authRoutes(app: FastifyInstance) {
  const sign = (payload: TokenPayload, expiresIn: string) => app.jwt.sign(payload, { expiresIn });

  // FR-01: đăng nhập máy quầy bằng PIN
  app.post('/auth/pin', async (req) => {
    assertCounterDevice(req);
    const { pin } = pinBody.parse(req.body);
    const lockKey = `pin:${deviceKeyOf(req) ?? req.ip}`;
    assertNotLocked(lockKey);

    const staff = await findStaffByPin(pin);
    if (!staff) throw unauthorized(wrongMessage(recordFailure(lockKey), 'PIN'));
    recordSuccess(lockKey);

    await audit(prisma, staff.id, 'LOGIN_PIN', 'staff', staff.id, { ip: req.ip });
    const user = { id: staff.id, name: staff.name, role: staff.role };
    return { token: sign({ kind: 'access', sub: staff.id, role: staff.role, name: staff.name }, config.accessTokenTtl), staff: user };
  });

  // FR-13: web quản trị đăng nhập bằng email + mật khẩu; nhân viên quầy không được vào
  app.post('/auth/login', async (req) => {
    const { email, password } = loginBody.parse(req.body);
    const lockKey = `login:${email}:${req.ip}`;
    assertNotLocked(lockKey);

    const staff = await prisma.staff.findUnique({ where: { email } });
    const ok = !!staff?.active && !!staff.passwordHash && (await verifySecret(password, staff.passwordHash));
    if (!ok || !staff) throw unauthorized(wrongMessage(recordFailure(lockKey), 'Email hoặc mật khẩu'));
    if (staff.role === 'COUNTER') throw forbidden('Nhân viên quầy không truy cập được web quản trị');
    recordSuccess(lockKey);

    await audit(prisma, staff.id, 'LOGIN_WEB', 'staff', staff.id, { ip: req.ip });
    const user = { id: staff.id, name: staff.name, role: staff.role };
    return { token: sign({ kind: 'access', sub: staff.id, role: staff.role, name: staff.name }, config.accessTokenTtl), staff: user };
  });

  // FR-06, FR-08: quản lý nhập PIN để duyệt → phiếu duyệt dùng một lần, hạn 2 phút
  app.post('/auth/approve', { preHandler: anyStaff }, async (req) => {
    const { pin } = pinBody.parse(req.body);
    const lockKey = `approve:${req.user.sub}`;
    assertNotLocked(lockKey);

    const approver = await findStaffByPin(pin);
    if (!approver) throw unauthorized(wrongMessage(recordFailure(lockKey), 'PIN'));
    if (!APPROVER_ROLES.includes(approver.role)) throw forbidden('PIN này không thuộc Quản lý ca');
    recordSuccess(lockKey);

    return {
      approvalToken: sign(
        { kind: 'approval', sub: approver.id, role: approver.role, name: approver.name, jti: randomUUID() },
        config.approvalTokenTtl,
      ),
      approver: { id: approver.id, name: approver.name, role: approver.role },
    };
  });

  app.get('/auth/me', { preHandler: anyStaff }, async (req) => {
    const staff = await prisma.staff.findUniqueOrThrow({ where: { id: req.user.sub } });
    return { id: staff.id, name: staff.name, role: staff.role, email: staff.email };
  });
}
