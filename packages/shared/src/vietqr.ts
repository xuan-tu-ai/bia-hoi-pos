// Chuỗi VietQR (chuẩn EMVCo QR của NAPAS) cho chuyển khoản tới tài khoản (FR-08).
// App quầy chỉ cần vẽ chuỗi này thành mã QR.

function tlv(id: string, value: string): string {
  if (value.length > 99) throw new Error(`Trường ${id} quá dài`);
  return id + String(value.length).padStart(2, '0') + value;
}

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) theo yêu cầu của EMVCo. */
export function crc16ccitt(input: string): number {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

export interface VietQrInput {
  /** Mã BIN ngân hàng 6 chữ số, vd 970436 (Vietcombank) */
  bankBin: string;
  accountNo: string;
  /** Số tiền VND; bỏ trống thì người chuyển tự nhập */
  amount?: number;
  /** Nội dung chuyển khoản, chỉ chữ không dấu và số */
  addInfo?: string;
}

export function buildVietQrPayload({ bankBin, accountNo, amount, addInfo }: VietQrInput): string {
  if (!/^\d{6}$/.test(bankBin)) throw new Error('BIN ngân hàng phải gồm 6 chữ số');
  if (!/^[0-9A-Za-z]{1,19}$/.test(accountNo)) throw new Error('Số tài khoản không hợp lệ');
  if (amount !== undefined && (!Number.isSafeInteger(amount) || amount <= 0)) throw new Error('Số tiền không hợp lệ');
  if (addInfo !== undefined && !/^[0-9A-Za-z ]{1,25}$/.test(addInfo)) {
    throw new Error('Nội dung chuyển khoản chỉ gồm chữ không dấu, số, tối đa 25 ký tự');
  }

  const beneficiary = tlv('00', bankBin) + tlv('01', accountNo);
  const merchantInfo = tlv('00', 'A000000727') + tlv('01', beneficiary) + tlv('02', 'QRIBFTTA');

  let payload =
    tlv('00', '01') +
    tlv('01', amount ? '12' : '11') +
    tlv('38', merchantInfo) +
    tlv('53', '704') +
    (amount ? tlv('54', String(amount)) : '') +
    tlv('58', 'VN') +
    (addInfo ? tlv('62', tlv('08', addInfo)) : '');
  payload += '6304';
  return payload + crc16ccitt(payload).toString(16).toUpperCase().padStart(4, '0');
}

/** Mã hóa đơn dùng làm nội dung chuyển khoản: BH<mã hóa đơn>. */
export function billCode(tabId: number): string {
  return 'BH' + String(tabId).padStart(6, '0');
}
