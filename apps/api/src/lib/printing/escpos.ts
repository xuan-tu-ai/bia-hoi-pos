// Lệnh ESC/POS cho máy in nhiệt: in ảnh raster (GS v 0), đẩy giấy, cắt giấy.
// Dùng được với hầu hết máy in nhiệt 80 mm có cổng LAN (Xprinter, Epson TM, Rongta…), cổng TCP 9100.

import net from 'node:net';
import type { Raster } from './render';

const ESC = 0x1b;
const GS = 0x1d;
/** Nhiều máy in giới hạn chiều cao một khối GS v 0, nên chia ảnh thành khối 256 hàng. */
const BAND = 256;

export function escposJob(raster: Raster): Buffer {
  const rowBytes = raster.width / 8;
  const parts: Buffer[] = [Buffer.from([ESC, 0x40])]; // ESC @: khởi tạo
  for (let top = 0; top < raster.height; top += BAND) {
    const rows = Math.min(BAND, raster.height - top);
    parts.push(Buffer.from([GS, 0x76, 0x30, 0x00, rowBytes & 0xff, rowBytes >> 8, rows & 0xff, rows >> 8]));
    parts.push(raster.bits.subarray(top * rowBytes, (top + rows) * rowBytes));
  }
  parts.push(Buffer.from([ESC, 0x64, 0x04])); // ESC d 4: đẩy 4 dòng
  parts.push(Buffer.from([GS, 0x56, 0x42, 0x00])); // GS V B 0: cắt giấy
  return Buffer.concat(parts);
}

/**
 * Đọc lại các phiếu từ dữ liệu ESC/POS (cho máy in giả và test): các khối GS v 0 liền nhau ghép
 * thành một ảnh, lệnh cắt giấy kết thúc một phiếu.
 */
export function decodeJobs(data: Buffer): Raster[] {
  const out: Raster[] = [];
  let width = 0;
  let bands: Buffer[] = [];
  let height = 0;
  const flush = () => {
    if (bands.length) out.push({ width, height, bits: Buffer.concat(bands) });
    bands = [];
    height = 0;
  };
  let i = 0;
  while (i < data.length) {
    if (data[i] === GS && data[i + 1] === 0x76 && data[i + 2] === 0x30) {
      const rowBytes = data[i + 4]! | (data[i + 5]! << 8);
      const rows = data[i + 6]! | (data[i + 7]! << 8);
      width = rowBytes * 8;
      bands.push(data.subarray(i + 8, i + 8 + rowBytes * rows));
      height += rows;
      i += 8 + rowBytes * rows;
    } else if (data[i] === GS && data[i + 1] === 0x56) {
      flush();
      i += data[i + 2] === 0x41 || data[i + 2] === 0x42 ? 4 : 3;
    } else {
      i++;
    }
  }
  flush();
  return out;
}

/** Gửi dữ liệu tới máy in mạng; lỗi nếu không kết nối được hoặc quá `timeoutMs`. */
export function sendToPrinter(host: string, port: number, data: Buffer, timeoutMs = 4000): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port });
    let settled = false;
    const done = (err?: Error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (err) reject(err);
      else resolve();
    };
    socket.setTimeout(timeoutMs, () => done(new Error(`Máy in ${host}:${port} không phản hồi`)));
    socket.on('error', (e: NodeJS.ErrnoException) =>
      done(new Error(e.code === 'ECONNREFUSED' ? `Máy in ${host}:${port} từ chối kết nối (đang tắt?)` : `Không kết nối được máy in ${host}:${port}`)),
    );
    socket.on('connect', () => socket.end(data, () => done()));
  });
}
