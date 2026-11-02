const env = process.env;
const isProd = env.NODE_ENV === 'production';

if (isProd && !env.JWT_SECRET) throw new Error('Thiếu biến môi trường JWT_SECRET');

export const config = {
  isProd,
  port: Number(env.PORT ?? 3000),
  host: env.HOST ?? '0.0.0.0',
  /**
   * Các proxy được tin để đọc IP thật của máy quầy từ X-Forwarded-For (vd nginx trong Docker: "uniquelocal").
   * Không đặt = không tin header này. Chỉ bật khi cổng API không mở trực tiếp ra mạng LAN, nếu không máy khác giả được IP.
   */
  trustProxy: env.TRUST_PROXY || false,
  jwtSecret: env.JWT_SECRET ?? 'dev-secret-chi-dung-khi-phat-trien',
  accessTokenTtl: '12h',
  approvalTokenTtl: '2m',
  /** Khóa thiết bị của máy quầy; rỗng = không kiểm tra (môi trường phát triển). */
  deviceKeys: (env.COUNTER_DEVICE_KEYS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  corsOrigin: !env.CORS_ORIGIN || env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
  bank: {
    bin: env.BANK_BIN ?? '',
    accountNo: env.BANK_ACCOUNT_NO ?? '',
    accountName: env.BANK_ACCOUNT_NAME ?? '',
  },
  kegLossThresholdPct: Number(env.KEG_LOSS_THRESHOLD_PCT ?? 5),
  /** FR-20: hủy/giảm lớn hơn số tiền này thì báo cho chủ quán */
  pushVoidThreshold: Number(env.PUSH_VOID_THRESHOLD ?? 200_000),
  vapid: {
    publicKey: env.VAPID_PUBLIC_KEY ?? '',
    privateKey: env.VAPID_PRIVATE_KEY ?? '',
    subject: env.VAPID_SUBJECT ?? 'mailto:chuquan@biahoi.local',
  },
  /** Ảnh món do chủ quán tải lên. Trong Docker là một volume riêng để không mất khi build lại. */
  uploadDir: env.UPLOAD_DIR ?? 'uploads',
  pinMaxFails: 5,
  pinLockMs: 60_000,
};
