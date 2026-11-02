// Vẽ phiếu in thành ảnh đen trắng khổ 80 mm. In dạng ảnh (raster) thay vì gửi chữ, vì máy in nhiệt
// ESC/POS phổ biến không có bảng mã tiếng Việt đầy đủ; ảnh thì dấu luôn đúng.

import { existsSync } from 'node:fs';
import path from 'node:path';
import { createCanvas, GlobalFonts, type SKRSContext2D } from '@napi-rs/canvas';

/** Khổ 80 mm, đầu in 203 dpi: vùng in 72 mm = 576 điểm. */
export const PAPER_DOTS = 576;
const MARGIN = 8;
const FONT = 'Be Vietnam Pro Print';

let fontsReady = false;
function ensureFonts(): void {
  if (fontsReady) return;
  const dirs = [path.resolve(process.cwd(), 'assets/fonts'), path.resolve(import.meta.dirname, '../../../assets/fonts'), path.resolve(import.meta.dirname, '../assets/fonts')];
  const dir = dirs.find((d) => existsSync(path.join(d, 'BeVietnamPro-Regular.ttf')));
  if (!dir) throw new Error('Không tìm thấy font in (assets/fonts/BeVietnamPro-*.ttf)');
  GlobalFonts.registerFromPath(path.join(dir, 'BeVietnamPro-Regular.ttf'), FONT);
  GlobalFonts.registerFromPath(path.join(dir, 'BeVietnamPro-Bold.ttf'), FONT);
  fontsReady = true;
}

export interface Raster {
  width: number;
  height: number;
  /** 1 bit mỗi điểm, bit cao trước; 1 = đen. Mỗi hàng `width / 8` byte. */
  bits: Buffer;
}

export type Align = 'left' | 'center' | 'right';

/** Một dòng trên phiếu. `right` là phần chữ căn phải trên cùng dòng (vd số tiền). */
export type PrintLine =
  | { kind: 'text'; text: string; size: number; bold?: boolean; align?: Align; right?: string; indent?: number }
  | { kind: 'item'; qty: string; name: string; note?: string | null }
  | { kind: 'rule' }
  | { kind: 'space'; height: number };

const font = (size: number, bold?: boolean) => `${bold ? 'bold ' : ''}${size}px "${FONT}"`;

/** Ngắt chữ theo từ để vừa bề rộng; từ quá dài thì ngắt theo ký tự. */
function wrap(ctx: SKRSContext2D, text: string, width: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= width) {
      line = next;
      continue;
    }
    if (line) out.push(line);
    line = '';
    let piece = '';
    for (const ch of word) {
      if (ctx.measureText(piece + ch).width > width && piece) {
        out.push(piece);
        piece = '';
      }
      piece += ch;
    }
    line = piece;
  }
  if (line) out.push(line);
  return out.length ? out : [''];
}

type Op = (ctx: SKRSContext2D, y: number) => void;

/** Dàn trang hai lượt: lượt đầu đo chiều cao, lượt sau vẽ lên canvas đúng chiều cao. */
export function renderLines(lines: PrintLine[]): Raster {
  ensureFonts();
  const measure = createCanvas(PAPER_DOTS, 10).getContext('2d');
  const ops: { y: number; draw: Op }[] = [];
  const inner = PAPER_DOTS - MARGIN * 2;
  let y = MARGIN;

  for (const l of lines) {
    if (l.kind === 'space') {
      y += l.height;
    } else if (l.kind === 'rule') {
      const at = y + 8;
      ops.push({
        y: at,
        draw: (ctx, yy) => {
          for (let x = MARGIN; x < PAPER_DOTS - MARGIN; x += 12) ctx.fillRect(x, yy, 7, 2);
        },
      });
      y += 18;
    } else if (l.kind === 'text') {
      measure.font = font(l.size, l.bold);
      const rightWidth = l.right ? measure.measureText(l.right).width + 12 : 0;
      const indent = l.indent ?? 0;
      const rows = wrap(measure, l.text, inner - rightWidth - indent);
      const lh = Math.round(l.size * 1.3);
      rows.forEach((row, i) => {
        const at = y + Math.round(l.size * 0.95) + i * lh;
        ops.push({
          y: at,
          draw: (ctx, yy) => {
            ctx.font = font(l.size, l.bold);
            const w = ctx.measureText(row).width;
            const x = l.align === 'center' ? (PAPER_DOTS - w) / 2 : l.align === 'right' ? PAPER_DOTS - MARGIN - w : MARGIN + indent;
            ctx.fillText(row, x, yy);
            if (l.right && i === 0) ctx.fillText(l.right, PAPER_DOTS - MARGIN - ctx.measureText(l.right).width, yy);
          },
        });
      });
      y += rows.length * lh;
    } else {
      // Món: số lượng to bên trái, tên đậm bên phải, ghi chú nhỏ dưới tên
      measure.font = font(34, true);
      const qtyWidth = Math.max(64, measure.measureText(l.qty).width + 16);
      measure.font = font(28, true);
      const names = wrap(measure, l.name, inner - qtyWidth);
      measure.font = font(22);
      const notes = l.note ? wrap(measure, `* ${l.note}`, inner - qtyWidth) : [];
      const top = y;
      ops.push({
        y: top + 34,
        draw: (ctx, yy) => {
          ctx.font = font(34, true);
          ctx.fillText(l.qty, MARGIN, yy);
        },
      });
      names.forEach((n, i) =>
        ops.push({
          y: top + 32 + i * 36,
          draw: (ctx, yy) => {
            ctx.font = font(28, true);
            ctx.fillText(n, MARGIN + qtyWidth, yy);
          },
        }),
      );
      const noteTop = top + 32 + names.length * 36;
      notes.forEach((n, i) =>
        ops.push({
          y: noteTop + i * 28,
          draw: (ctx, yy) => {
            ctx.font = font(22);
            ctx.fillText(n, MARGIN + qtyWidth, yy);
          },
        }),
      );
      y = Math.max(top + 46, noteTop + notes.length * 28 - 20) + 10;
    }
  }

  const height = Math.ceil((y + MARGIN) / 8) * 8;
  const canvas = createCanvas(PAPER_DOTS, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, PAPER_DOTS, height);
  ctx.fillStyle = '#000';
  for (const op of ops) op.draw(ctx, op.y);
  return toRaster(ctx.getImageData(0, 0, PAPER_DOTS, height).data, PAPER_DOTS, height);
}

function toRaster(rgba: Uint8ClampedArray, width: number, height: number): Raster {
  const rowBytes = width / 8;
  const bits = Buffer.alloc(rowBytes * height);
  for (let yy = 0; yy < height; yy++) {
    for (let x = 0; x < width; x++) {
      const i = (yy * width + x) * 4;
      const lum = 0.299 * rgba[i]! + 0.587 * rgba[i + 1]! + 0.114 * rgba[i + 2]!;
      if (lum < 140) bits[yy * rowBytes + (x >> 3)]! |= 0x80 >> (x & 7);
    }
  }
  return { width, height, bits };
}

/** Ảnh PNG của raster, để xem trước phiếu (máy in giả, test). */
export function rasterToPng(r: Raster): Buffer {
  const canvas = createCanvas(r.width, r.height);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(r.width, r.height);
  const rowBytes = r.width / 8;
  for (let yy = 0; yy < r.height; yy++) {
    for (let x = 0; x < r.width; x++) {
      const black = (r.bits[yy * rowBytes + (x >> 3)]! >> (7 - (x & 7))) & 1;
      const i = (yy * r.width + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = black ? 0 : 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toBuffer('image/png');
}
