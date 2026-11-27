# Quản lý quầy bia

## Chạy ứng dụng

Yêu cầu Node.js 20.19+ hoặc 22.12+. Giao diện React 19/TypeScript nằm trong `frontend/`.

```sh
cd frontend
npm install
cp .env.example .env
npm run dev
```

Hoặc chạy trực tiếp từ thư mục gốc:

```sh
npm --prefix frontend install
npm run dev
```

Mặc định `VITE_USE_MOCK=true` để chạy với dữ liệu demo lưu trong trình duyệt. Đặt `VITE_USE_MOCK=false` và cấu hình `VITE_API_BASE_URL` trong `.env` để dùng backend. Chạy `npm run typecheck` để kiểm tra kiểu hoặc `npm run build` để tạo bản production tại `frontend/dist/`.

Đăng nhập demo (mật khẩu `123456`):

- Nhân viên: `lan@biahoi.vn` hoặc `minh@biahoi.vn`
- Quản lý ca: `hung@biahoi.vn`
- Chủ quán: `hoa@biahoi.vn`
- Tài khoản bị khóa: `khoa@biahoi.vn`

## Cấu trúc và phân quyền

SPA dùng React Router; API client và mock nằm trong `frontend/src/api/` và `frontend/src/mocks/`. Giao diện được tổ chức theo phân hệ trong `frontend/src/features/` (quầy, quản trị, báo cáo). Ma trận quyền nằm trong `frontend/src/lib/permissions.ts`; menu và bộ nạp chức năng đều kiểm tra quyền trước khi hiển thị.

Đây là prototype: quyền frontend chỉ điều khiển giao diện, backend vẫn phải xác thực/ủy quyền mọi request. VietQR hiện là mô phỏng; nhật ký kiểm toán và các nghiệp vụ cần dữ liệu thật phụ thuộc vào backend.