// FR-20: thông báo đẩy (Web Push) tới PWA của chủ quán khi có hủy/giảm vượt ngưỡng.
// Cặp khóa VAPID lấy từ biến môi trường; nếu không có thì tự sinh một lần và lưu vào CSDL,
// vì đổi khóa sẽ làm mọi đăng ký cũ mất hiệu lực.

import webpush from 'web-push';
import type { Prisma } from '@prisma/client';
import { formatVnd } from '@biahoi/shared';
import { config } from '../config';
import { prisma } from './prisma';

export interface PushPayload {
  title: string;
  body: string;
  /** Trang mở ra khi bấm vào thông báo */
  url: string;
  /** Thông báo cùng tag thay thế nhau thay vì xếp chồng */
  tag?: string;
}

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

export type PushSender = (
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
) => Promise<unknown>;

let keys: VapidKeys | null = null;

export async function getVapidKeys(): Promise<VapidKeys> {
  if (keys) return keys;
  if (config.vapid.publicKey && config.vapid.privateKey) {
    keys = { publicKey: config.vapid.publicKey, privateKey: config.vapid.privateKey };
    return keys;
  }
  const saved = await prisma.appSetting.findUnique({ where: { key: 'vapid' } });
  if (saved) {
    keys = saved.value as unknown as VapidKeys;
    return keys;
  }
  const generated = webpush.generateVAPIDKeys();
  // Hai tiến trình cùng sinh khóa: bản ghi đầu tiên thắng, bên còn lại đọc lại.
  await prisma.appSetting.upsert({
    where: { key: 'vapid' },
    create: { key: 'vapid', value: generated as unknown as Prisma.InputJsonValue },
    update: {},
  });
  const stored = await prisma.appSetting.findUniqueOrThrow({ where: { key: 'vapid' } });
  keys = stored.value as unknown as VapidKeys;
  return keys;
}

const webPushSender: PushSender = async (subscription, payload) => {
  const k = await getVapidKeys();
  return webpush.sendNotification(subscription, payload, {
    vapidDetails: { subject: config.vapid.subject, publicKey: k.publicKey, privateKey: k.privateKey },
    TTL: 60 * 60,
    urgency: 'high',
  });
};

let sender: PushSender = webPushSender;

/** Cho test thay phần gửi thật bằng bản ghi lại. */
export function setPushSender(fn: PushSender | null): void {
  sender = fn ?? webPushSender;
}

/** Gửi tới mọi thiết bị khớp điều kiện; thiết bị đã hủy đăng ký (404/410) bị xóa. */
export async function sendPush(where: Prisma.PushSubscriptionWhereInput, payload: PushPayload) {
  const subs = await prisma.pushSubscription.findMany({ where });
  let sent = 0;
  let removed = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await sender({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload));
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
          removed++;
        } else {
          console.warn(`Gửi thông báo đẩy lỗi (${status ?? 'mạng'}):`, (err as Error).message);
        }
      }
    }),
  );
  return { sent, removed };
}

const KIND_LABEL = { VOID: 'Hủy món', DISCOUNT: 'Giảm giá món', BILL_DISCOUNT: 'Giảm giá hóa đơn' } as const;

export interface AdjustmentInfo {
  kind: keyof typeof KIND_LABEL;
  amount: number;
  tableId: number;
  itemName?: string;
  qty?: number;
  reason: string;
  requester: string;
  approver: string;
}

/** FR-20: báo cho chủ quán khi một lần hủy/giảm vượt ngưỡng (mặc định trên 200.000 đ). */
export async function notifyLargeAdjustment(info: AdjustmentInfo) {
  if (info.amount <= config.pushVoidThreshold) return null;
  const table = await prisma.diningTable.findUnique({ where: { id: info.tableId }, select: { code: true } });
  const what = info.itemName ? `${info.itemName}${info.qty ? ` ×${info.qty}` : ''}` : 'Cả hóa đơn';
  return sendPush(
    { staff: { role: 'OWNER', active: true } },
    {
      title: `${KIND_LABEL[info.kind]} ${formatVnd(info.amount)}`,
      body: `${what} · bàn ${table?.code ?? '?'} · ${info.reason}. ${info.requester} yêu cầu, ${info.approver} duyệt.`,
      url: '/nhat-ky-huy',
      tag: 'adjustment',
    },
  );
}
