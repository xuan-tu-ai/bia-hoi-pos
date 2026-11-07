# backend

REST API (Node.js 20 + Express 5 + TypeScript + Prisma + PostgreSQL). Phụ trách: Hiếu. Xem `docs/srs.md` mục 4, 5, 7, 8 và [`docs/api.md`](../docs/api.md).

## Chạy trên máy

```bash
cd backend
cp .env.example .env        # rồi điền DATABASE_URL, JWT_SECRET…
npm install
npx prisma migrate dev      # tạo bảng
npx prisma db seed          # dữ liệu mẫu SRS 8.3 (xóa sạch dữ liệu cũ rồi tạo lại)
npm run dev                 # http://localhost:3000/api
```

Tài khoản mẫu (mật khẩu `123456`): `lan@` / `minh@` (quầy), `hung@` (quản lý ca, PIN 1234), `hoa@` (chủ quán, PIN 9999), `khoa@` (đã khóa) — đuôi `@biahoi.vn`.

Thử nhanh API bằng [`requests.http`](requests.http) (VS Code extension *REST Client*).

## Kiểm thử tự động

`npm test` chạy bộ test tích hợp `test/api.test.ts` theo tiêu chí nghiệm thu SRS mục 6. Cần một CSDL **riêng cho test** trong `.env`:

```text
TEST_DATABASE_URL="postgresql://user:pass@localhost:5432/biahoi_test"
```

Trước khi chạy, test tự áp migration và chạy seed trên CSDL đó (dữ liệu trong đó sẽ bị xóa). Không trỏ vào CSDL thật.

## Cấu trúc

```text
src/
├── index.ts, app.ts          # khởi động server, gắn middleware & routes
├── config/env.ts             # đọc + kiểm tra biến môi trường
├── lib/                      # prisma, pricing (giờ vàng), tab-total, vietqr, time (giờ VN), approval (PIN), audit
├── middlewares/              # auth (JWT), require-role, error-handler
└── modules/<nhóm>/           # *.routes.ts · *.service.ts · *.schema.ts (zod)
```

Quy ước (SRS 8.1, 9.1): `OrderLine` và `Payment` chỉ thêm; hủy/giảm = thêm dòng âm; giá chốt khi gửi lượt; mọi thao tác ghi `AuditLog`; các thao tác ghi nhiều bảng nằm trong `prisma.$transaction`. Quyền kiểm tra ở backend bằng `requireRole(...)` cho từng API.

## Triển khai (Render)

- Build command: `npm install && npm run build && npx prisma migrate deploy`
- Start command: `npm start`
- Biến môi trường: như `.env.example` (`CORS_ORIGIN` = địa chỉ Vercel của frontend).
