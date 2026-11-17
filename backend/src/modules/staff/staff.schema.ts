import { z } from 'zod';
import { pin } from '../../lib/http.js';

const role = z.enum(['COUNTER', 'SHIFT_MANAGER', 'OWNER']);
const password = z.string().min(6, 'Mật khẩu ít nhất 6 ký tự').max(100);

export const createStaffSchema = z.object({
  fullName: z.string().trim().min(1, 'Chưa nhập họ tên').max(100),
  email: z.string().trim().toLowerCase().email('Email không hợp lệ'),
  password,
  role,
  /** Chỉ cho Quản lý ca và Chủ quán. */
  pin: pin.nullable().optional(),
  active: z.boolean().optional(),
});

export const updateStaffSchema = z.object({
  fullName: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().toLowerCase().email('Email không hợp lệ').optional(),
  /** Đặt lại mật khẩu; bỏ trống = giữ nguyên. */
  password: password.optional(),
  role: role.optional(),
  /** Chuỗi = đặt PIN mới; null = xóa PIN; bỏ trống = giữ nguyên. */
  pin: pin.nullable().optional(),
  active: z.boolean().optional(),
});
