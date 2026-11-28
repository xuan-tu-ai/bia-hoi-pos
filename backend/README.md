# backend

REST API (Node.js 20 + Express 5 + TypeScript + Prisma + PostgreSQL). Phụ trách: Hiếu. Xem `docs/srs.md` mục 4, 5, 7, 8 và [`docs/api.md`](../docs/api.md).

## Chạy trên máy

```bash
cd backend
cp .env.example .env        # rồi điền DATABASE_URL, JWT_SECRET…
npm install                 # tự chạy prisma generate
npm run dev                 # http://localhost:3000/api
```

Người phụ trách backend, khi đổi schema hoặc cần làm mới dữ liệu mẫu SRS 8.3:

```bash
npx prisma migrate dev      # tạo / cập nhật bảng
npx prisma db seed          # xóa sạch dữ liệu cũ rồi tạo lại
```

CSDL chung của nhóm trên Neon đã được tạo bảng và seed sẵn. Chỉ người phụ trách backend chạy `migrate` / `db seed` lên CSDL chung (seed xóa toàn bộ dữ liệu cũ); các thành viên khác xin chuỗi `DATABASE_URL` thật từ người phụ trách backend (không đưa lên GitHub) rồi `npm run dev`.

Tài khoản mẫu (mật khẩu `123456`): `lan@` / `minh@` (quầy), `hung@` (quản lý ca, PIN 1234), `hoa@` (chủ quán, PIN 9999), `khoa@` (đã khóa) — đuôi `@biahoi.vn`.

Thử nhanh API bằng [`requests.http`](requests.http) (VS Code extension *REST Client*).

## Kiểm thử tự động

`npm test` chạy các test tích hợp trong `test/` theo tiêu chí nghiệm thu SRS mục 6. Các file dùng chung một CSDL test nên chạy lần lượt theo tên (`01-khoi-tao` → `07-bao-cao`). Cần một CSDL **riêng cho test** trong `.env`, tạo thêm một database trên cùng project Neon (ví dụ `biahoi_test`):

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

## Triển khai (Render) — BE-08

Cấu hình nằm trong [`render.yaml`](../render.yaml) ở gốc repo (Render Blueprint, gói Free, vùng Singapore, nhánh `develop`).

1. Render Dashboard → **New → Blueprint** → chọn repo này → Render đọc `render.yaml`.
2. Điền các biến được hỏi:
   - `DATABASE_URL`: chuỗi kết nối Neon của CSDL chung (lấy từ người phụ trách backend, **không** ghi vào repo).
   - `CORS_ORIGIN`: địa chỉ Vercel của frontend, nhiều địa chỉ ngăn cách bằng dấu phẩy; `*` thay cho một đoạn tên miền để mở cho bản preview, ví dụ `https://bia-hoi.vercel.app,https://bia-hoi-*.vercel.app`.
   - `VIETQR_ACCOUNT`: số tài khoản nhận chuyển khoản.
   - `JWT_SECRET` do Render tự sinh.
3. Mỗi lần build Render chạy `npm ci --include=dev && npm run build && npx prisma migrate deploy` (gói Free không có pre-deploy nên migration nằm trong build), rồi `npm start`.
4. Kiểm tra: `GET https://<tên-dịch-vụ>.onrender.com/health` → `{"ok":true}` (có kiểm tra kết nối CSDL; lỗi CSDL trả `503`). API ở `https://<tên-dịch-vụ>.onrender.com/api`; frontend đặt `VITE_API_URL` bằng địa chỉ này.

Lưu ý:

- Khi `NODE_ENV=production`, server từ chối khởi động nếu `JWT_SECRET` còn là giá trị mẫu hoặc `DATABASE_URL` trỏ vào `localhost`.
- Gói Free "ngủ" sau 15 phút không có request; request đầu tiên mất khoảng 30–60 giây. Trước buổi demo mở `/health` trước vài phút (SRS mục 11).
- Không chạy `db seed` từ Render: seed xóa toàn bộ dữ liệu. Khi cần làm mới dữ liệu mẫu, người phụ trách backend chạy `npx prisma db seed` từ máy với `DATABASE_URL` của Neon.
