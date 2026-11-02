// Lưu ảnh món trên đĩa máy chủ (thư mục config.uploadDir). Tên tệp do máy chủ đặt, không lấy từ người dùng.

import { randomBytes } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;
type Ext = keyof typeof TYPES;

/** Nhận dạng ảnh theo các byte đầu tệp, không tin content-type do trình duyệt gửi. */
export function imageExt(buf: Buffer): Ext | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length > 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  return null;
}

/** Tên tệp hợp lệ: chỉ do saveImage tạo ra, nên chặn được mọi đường dẫn kiểu ../ */
export const FILE_NAME = /^[a-z]+-\d+-[0-9a-f]{8}\.(jpg|png|webp)$/;

const dir = () => path.resolve(config.uploadDir);

/** Ghi ảnh, trả về tên tệp. Mỗi lần tải lên một tên mới, nên trình duyệt lưu đệm lâu được. */
export async function saveImage(prefix: string, id: number, buf: Buffer, ext: Ext): Promise<string> {
  await mkdir(dir(), { recursive: true });
  const file = `${prefix}-${id}-${randomBytes(4).toString('hex')}.${ext}`;
  await writeFile(path.join(dir(), file), buf);
  return file;
}

export async function removeImage(file: string | null): Promise<void> {
  if (!file || !FILE_NAME.test(file)) return;
  await unlink(path.join(dir(), file)).catch(() => {}); // tệp đã mất thì thôi
}

export async function readImage(file: string): Promise<{ data: Buffer; type: string } | null> {
  if (!FILE_NAME.test(file)) return null;
  try {
    const data = await readFile(path.join(dir(), file));
    return { data, type: TYPES[path.extname(file).slice(1) as Ext] };
  } catch {
    return null;
  }
}
