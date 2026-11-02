// Máy in nhiệt giả: nghe cổng 9100 như máy in mạng thật, nhận lệnh ESC/POS và lưu mỗi phiếu thành ảnh PNG.
// Dùng khi nhóm chưa có máy in: đặt trạm in là "Máy in mạng" với địa chỉ máy đang chạy script này.
//   pnpm --filter @biahoi/api printer:fake                  (cổng 9100, ảnh lưu vào apps/api/printouts/)
//   PORT=9101 NAME=bep pnpm --filter @biahoi/api printer:fake   (máy in thứ hai cho trạm khác)
// Backend chạy trong Docker thì nhập địa chỉ máy in là host.docker.internal.

import { mkdirSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { decodeJobs } from '../src/lib/printing/escpos';
import { rasterToPng } from '../src/lib/printing/render';

const port = Number(process.env.PORT ?? 9100);
const name = process.env.NAME ?? 'may-in';
const outDir = path.resolve(import.meta.dirname, '../printouts');
mkdirSync(outDir, { recursive: true });
let count = 0;

net
  .createServer((socket) => {
    const chunks: Buffer[] = [];
    socket.on('data', (c) => chunks.push(c));
    socket.on('end', () => {
      const jobs = decodeJobs(Buffer.concat(chunks));
      for (const job of jobs) {
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const file = path.join(outDir, `${stamp}-${name}-${++count}.png`);
        writeFileSync(file, rasterToPng(job));
        console.log(`[${name}] nhận phiếu ${job.width}×${job.height} điểm → ${path.relative(process.cwd(), file)}`);
      }
      if (!jobs.length) console.log(`[${name}] nhận ${chunks.reduce((s, c) => s + c.length, 0)} byte nhưng không có ảnh in`);
    });
  })
  .listen(port, '0.0.0.0', () => console.log(`Máy in giả "${name}" đang nghe cổng ${port}; ảnh phiếu lưu ở ${outDir}`));
