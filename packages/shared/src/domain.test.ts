import { describe, expect, it } from 'vitest';
import { buildBillBody } from './bill';
import { kegLoss } from './keg';
import { isRuleActive, resolveUnitPrice, type HappyHourRule } from './pricing';
import { tableStatus } from './status';
import { formatVnTime, parseVnDate, vnParts, vnStartOfDay } from './time';
import { billCode, buildVietQrPayload, crc16ccitt } from './vietqr';

/** Tạo thời điểm theo giờ Việt Nam. */
const vn = (iso: string) => new Date(`${iso}+07:00`);

describe('giờ Việt Nam', () => {
  it('đổi đúng múi giờ bất kể giờ máy chủ', () => {
    const d = vn('2026-11-20T23:30:00'); // thứ Sáu
    expect(vnParts(d)).toMatchObject({ day: 20, dayOfWeek: 5, hour: 23, minute: 30 });
    expect(formatVnTime(d)).toBe('23:30');
    expect(vnStartOfDay(d).toISOString()).toBe('2026-11-19T17:00:00.000Z');
    expect(parseVnDate('2026-11-20').getTime()).toBe(vnStartOfDay(d).getTime());
    expect(() => parseVnDate('2026-02-30')).toThrow();
  });
});

describe('giá giờ vàng (FR-15)', () => {
  const rule: HappyHourRule = {
    id: 1,
    daysOfWeek: [1, 2, 3, 4, 5],
    startMinute: 16 * 60,
    endMinute: 18 * 60,
    prices: new Map([[7, 12000]]),
  };

  it('trong khung dùng giá giờ vàng, ngoài khung dùng giá thường', () => {
    expect(resolveUnitPrice(7, 15000, [rule], vn('2026-11-20T16:00:00'))).toEqual({ unitPrice: 12000, happyHourId: 1 });
    expect(resolveUnitPrice(7, 15000, [rule], vn('2026-11-20T18:00:00'))).toEqual({ unitPrice: 15000, happyHourId: null });
    expect(resolveUnitPrice(7, 15000, [rule], vn('2026-11-21T17:00:00')).happyHourId).toBeNull(); // thứ Bảy
    expect(resolveUnitPrice(8, 40000, [rule], vn('2026-11-20T17:00:00')).unitPrice).toBe(40000); // món không có giá riêng
  });

  it('khung qua nửa đêm tính theo thứ của giờ bắt đầu', () => {
    const late = { daysOfWeek: [5], startMinute: 22 * 60, endMinute: 2 * 60 };
    expect(isRuleActive(late, vn('2026-11-20T23:00:00'))).toBe(true); // tối thứ Sáu
    expect(isRuleActive(late, vn('2026-11-21T01:00:00'))).toBe(true); // rạng sáng thứ Bảy
    expect(isRuleActive(late, vn('2026-11-22T01:00:00'))).toBe(false); // rạng sáng Chủ nhật
  });
});

describe('in tạm tính / hóa đơn (FR-07)', () => {
  it('gộp cùng tên + cùng giá, tách dòng khi khác giá, bỏ món đã hủy hết', () => {
    const body = buildBillBody(
      [
        { itemName: 'Bia hơi cốc', qty: 6, unitPrice: 15000, lineType: 'NORMAL' },
        { itemName: 'Bia hơi cốc', qty: 4, unitPrice: 15000, lineType: 'NORMAL' },
        { itemName: 'Bia hơi cốc', qty: 3, unitPrice: 12000, lineType: 'NORMAL' },
        { itemName: 'Nem chua nướng', qty: 1, unitPrice: 50000, lineType: 'NORMAL' },
        { itemName: 'Nem chua nướng', qty: -1, unitPrice: 50000, lineType: 'VOID' },
        { itemName: 'Sườn nướng', qty: 1, unitPrice: 90000, lineType: 'NORMAL' },
        { itemName: 'Sườn nướng', qty: 1, unitPrice: -9000, lineType: 'DISCOUNT' },
      ],
      [{ amount: -10000, reason: 'KHAC', reasonNote: 'Khách quen' }],
    );
    expect(body.rows).toEqual([
      { name: 'Bia hơi cốc', qty: 10, unitPrice: 15000, amount: 150000 },
      { name: 'Bia hơi cốc', qty: 3, unitPrice: 12000, amount: 36000 },
      { name: 'Sườn nướng', qty: 1, unitPrice: 90000, amount: 90000 },
    ]);
    expect(body.adjustments).toEqual([
      { label: 'Giảm giá: Sườn nướng', amount: -9000 },
      { label: 'Giảm giá hóa đơn (Khách quen)', amount: -10000 },
    ]);
    expect(body.total).toBe(150000 + 36000 + 90000 - 9000 - 10000);
  });
});

describe('hao hụt keg (FR-17)', () => {
  it('dữ liệu mẫu trong SRS: keg 50 L, bán 92 cốc 0,5 L → hao hụt 4 L = 8%, vượt ngưỡng', () => {
    expect(kegLoss(50000, 92 * 500)).toEqual({ lossMl: 4000, lossPct: 8, exceeded: true });
  });

  it('bằng ngưỡng thì chưa tô đỏ; ngưỡng cấu hình được', () => {
    expect(kegLoss(50000, 47500).exceeded).toBe(false); // đúng 5%
    expect(kegLoss(50000, 47500, 4).exceeded).toBe(true);
  });
});

describe('VietQR (FR-08)', () => {
  it('CRC-16/CCITT-FALSE đúng giá trị kiểm tra chuẩn', () => {
    expect(crc16ccitt('123456789')).toBe(0x29b1);
  });

  it('sinh chuỗi đúng cấu trúc EMVCo, có số tiền và nội dung BH<mã>', () => {
    const payload = buildVietQrPayload({ bankBin: '970436', accountNo: '0011001234567', amount: 385000, addInfo: billCode(123) });
    expect(payload.startsWith('000201010212')).toBe(true); // QR động vì có số tiền
    expect(payload).toContain('0010A000000727');
    expect(payload).toContain('0006970436');
    expect(payload).toContain('01130011001234567');
    expect(payload).toContain('0208QRIBFTTA');
    expect(payload).toContain('5303704');
    expect(payload).toContain('5406385000');
    expect(payload).toContain('5802VN');
    expect(payload).toContain('62120808BH000123');
    const body = payload.slice(0, -4);
    expect(body.endsWith('6304')).toBe(true);
    expect(payload.slice(-4)).toBe(crc16ccitt(body).toString(16).toUpperCase().padStart(4, '0'));
  });

  it('từ chối dữ liệu sai', () => {
    expect(() => buildVietQrPayload({ bankBin: '97043', accountNo: '1' })).toThrow();
    expect(() => buildVietQrPayload({ bankBin: '970436', accountNo: '1', amount: 0 })).toThrow();
    expect(() => buildVietQrPayload({ bankBin: '970436', accountNo: '1', addInfo: 'Bàn 5' })).toThrow();
  });
});

describe('màu bàn (FR-02)', () => {
  it('ưu tiên lỗi in > đã tạm tính > đang ngồi > trống', () => {
    expect(tableStatus(null)).toBe('EMPTY');
    expect(tableStatus({ hasPrintError: false, provisionalCount: 0 })).toBe('OPEN');
    expect(tableStatus({ hasPrintError: false, provisionalCount: 2 })).toBe('PROVISIONAL');
    expect(tableStatus({ hasPrintError: true, provisionalCount: 2 })).toBe('PRINT_ERROR');
  });
});
