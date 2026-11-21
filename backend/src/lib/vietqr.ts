import { env } from '../config/env.js';

/**
 * Đường dẫn ảnh VietQR qua dịch vụ miễn phí img.vietqr.io (SRS FR-08):
 * https://img.vietqr.io/image/<ngân hàng>-<số TK>-compact2.png?amount=&addInfo=&accountName=
 */
export function vietQrUrl(amount: number, addInfo: string): string {
  const base = `https://img.vietqr.io/image/${encodeURIComponent(env.VIETQR_BANK)}-${encodeURIComponent(env.VIETQR_ACCOUNT)}-compact2.png`;
  const qs = new URLSearchParams({
    amount: String(Math.round(amount)),
    addInfo,
    accountName: env.VIETQR_ACCOUNT_NAME,
  });
  return `${base}?${qs.toString()}`;
}

/** Nội dung chuyển khoản: "BH" + phần số của số hóa đơn (ngân hàng chỉ nhận chữ & số). */
export function transferNote(billNo: string): string {
  return `BH${billNo.replace(/[^0-9A-Za-z]/g, '').replace(/^HD/, '')}`;
}
