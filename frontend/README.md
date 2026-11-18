# quan-ly-quay-bia-nhom-7

## Chạy ứng dụng

Yêu cầu Node.js 18 trở lên. Giao diện được viết bằng React 19 và TypeScript.

```sh
npm install
npm run dev
```

Mở URL Vite hiển thị trong terminal. Trang đăng nhập nằm ở `/`, dashboard ở `/dashboard.html`.

Chạy `npm run typecheck` để kiểm tra kiểu. `npm run build` tự chạy type-check trước khi build production.

Tài khoản demo:

- Nhân viên: `nhanvien@quaybia.vn` / `123456`
- Quản lý ca: `quanly@quaybia.vn` / `123456`
- Chủ quán: `hoa@biahoi.vn` / `123456`

Ứng dụng hiện dùng `localStorage` cho phiên đăng nhập và dữ liệu giao diện demo; dữ liệu chưa đồng bộ giữa nhiều thiết bị và chưa kết nối API backend. Chạy `npm run build` để tạo bản production đa trang trong `dist/`.

## Giao diện theo SRS

Sau khi đăng nhập, thanh điều hướng có các màn hình mẫu cho FR-01 đến FR-19: sơ đồ bàn và phiên bàn; gọi món, in tạm tính, chuyển/gộp bàn, hủy/giảm; thanh toán; ca làm việc; vòi và kho keg; thực đơn, khu/bàn, nhân viên, giá giờ vàng; tổng quan và các báo cáo. Tài khoản quản lý ca/chủ quán có thêm các màn báo cáo và quản trị.

Đây là prototype giao diện với dữ liệu minh họa. Các thao tác chưa thay thế backend: đăng nhập/phân quyền, lưu lịch sử, đồng bộ đa thiết bị, VietQR thật, nhật ký kiểm toán và nghiệp vụ kho cần được nối với API trước khi nghiệm thu.