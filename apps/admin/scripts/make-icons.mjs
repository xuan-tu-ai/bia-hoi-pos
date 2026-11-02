// Vẽ icon PWA (cốc bia hơi, giống dấu trong sidebar) ra PNG, không cần thư viện ngoài.
// Chạy: pnpm --filter @biahoi/admin icons
import { writeFileSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';

const BG = [0xfd, 0xf3, 0xe1], AMBER = [0xb4, 0x53, 0x09], INK = [0x78, 0x35, 0x0f], WHITE = [0xff, 0xff, 0xff];

const inPoly = (x, y, pts) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const inCircle = (x, y, [cx, cy, r]) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
const inRect = (x, y, [x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

// Toạ độ trong lưới 28×28 như Mark trong Icon.tsx
const glass = [[7, 9], [19.5, 9], [18.1, 23.2], [17, 24.5], [9.9, 24.5], [8.4, 23.2]];
const foam = [[9.5, 8.2, 3], [13, 6.7, 3.2], [16.8, 7.2, 3], [19.4, 8.7, 2.3]];
const foamBase = [6.6, 7.8, 21.4, 10];

function colourAt(x, y) {
  const handleOuter = inRect(x, y, [19.4, 11.2, 23.8, 20.3]);
  const handleInner = inRect(x, y, [19.4, 12.8, 22.2, 18.7]);
  if (foam.some((c) => inCircle(x, y, c)) || inRect(x, y, foamBase)) return WHITE;
  if (foam.some(([cx, cy, r]) => inCircle(x, y, [cx, cy, r + 0.9])) || inRect(x, y, [foamBase[0] - 0.9, foamBase[1], foamBase[2] + 0.9, foamBase[3] + 0.6])) return INK;
  if (inPoly(x, y, glass)) return AMBER;
  if (handleOuter && !handleInner) return INK;
  return BG;
}

function png(size, safe) {
  // safe: phần biên an toàn của icon "maskable" (Android cắt tròn), hình vẽ nằm trong vùng giữa
  const scale = (size * (1 - 2 * safe)) / 28, off = size * safe, S = 4;
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let py = 0; py < size; py++) {
    raw[py * (size * 3 + 1)] = 0;
    for (let px = 0; px < size; px++) {
      const acc = [0, 0, 0];
      for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
        const c = colourAt((px + (sx + 0.5) / S - off) / scale, (py + (sy + 0.5) / S - off) / scale);
        acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2];
      }
      const o = py * (size * 3 + 1) + 1 + px * 3;
      for (let k = 0; k < 3; k++) raw[o + k] = Math.round(acc[k] / (S * S));
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const out = new URL('../public/icons/', import.meta.url);
writeFileSync(new URL('icon-192.png', out), png(192, 0.06));
writeFileSync(new URL('icon-512.png', out), png(512, 0.06));
writeFileSync(new URL('icon-maskable-512.png', out), png(512, 0.16));
console.log('Đã tạo icon-192.png, icon-512.png, icon-maskable-512.png');
