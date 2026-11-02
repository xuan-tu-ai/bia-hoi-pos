# Web quản trị + PWA chủ quán

React 18 + Vite 5 + TypeScript, gọi backend ở [`apps/api`](../api). Gói WBS 1.4.4 và 1.4.5, FR-09 (xem lại ca), FR-11 đến FR-19, FR-21.

## Chạy

```bash
# backend phải đang chạy ở cổng 3000 (pnpm --filter @biahoi/api dev, hoặc docker compose up -d)
pnpm --filter @biahoi/admin dev        # http://127.0.0.1:5173
```

Đăng nhập: `chuquan@biahoi.vn` / `chuquan123` (chủ quán, thấy mọi màn), hoặc `quanly@biahoi.vn` / `quanly123` (quản lý ca, chỉ thấy báo cáo).

Khi chạy dev, Vite chuyển `/api` và `/socket.io` sang backend nên không vướng CORS. Muốn mở trên điện thoại trong cùng Wi-Fi, dùng địa chỉ "Network" mà Vite in ra.

**Bản build cho PWA:**

```bash
VITE_API_URL=http://<ip máy chủ>:3000 pnpm --filter @biahoi/admin build
pnpm --filter @biahoi/admin preview    # thử bản build ở cổng 4173
```

Không đặt `VITE_API_URL` thì web gọi `/api` trên cùng origin, nên máy chủ phải chuyển tiếp `/api` sang backend. Service worker chỉ chạy ở bản build.

**Chạy cả hệ thống bằng Docker** (ở thư mục gốc): `docker compose up -d --build`, web ở **http://127.0.0.1:8080**. nginx phục vụ bản build và chuyển `/api`, `/socket.io` sang backend.

### HTTPS cho điện thoại

Khi trình duyệt cho phép cài, cuối thanh bên có nút **"Cài ứng dụng lên máy này"**; không cần tìm trong menu trình duyệt. Trên iPhone không có nút này: dùng Chia sẻ → Thêm vào MH chính.

Chrome trên Android chỉ cho **cài PWA** và **nhận thông báo đẩy** khi trang chạy qua HTTPS (hoặc `localhost`). Truy cập qua LAN bằng `http://192.168…` thì web vẫn dùng được, nhưng không cài và không nhận thông báo được. Có hai cách:

1. **Tunnel tạm thời, không cần tài khoản** (đã cấu hình sẵn, chỉ chạy khi bạn bật):
   ```bash
   docker compose --profile tunnel up -d
   docker compose logs tunnel        # tìm dòng https://….trycloudflare.com
   docker compose stop tunnel        # tắt ngay sau buổi demo
   ```
   **Cảnh báo:** địa chỉ này công khai trên Internet. Ai có địa chỉ đều mở được trang đăng nhập, nên hãy đổi mật khẩu demo nếu để lâu.
2. Triển khai lên một dịch vụ có HTTPS, như SRS 6.1 đã dự kiến.

## Các màn

| Màn | Đường dẫn | FR | Ai thấy |
|---|---|---|---|
| Hôm nay | `/` | FR-16 | Chủ quán, quản lý ca |
| Hao hụt keg | `/hao-hut-keg` | FR-17 | Chủ quán, quản lý ca |
| Nhật ký hủy/giảm | `/nhat-ky-huy` | FR-18 | Chủ quán, quản lý ca |
| Bán chạy & giờ đông | `/ban-chay` | FR-19 | Chủ quán, quản lý ca |
| Ca làm việc | `/ca` | FR-09 | Chủ quán, quản lý ca |
| Thực đơn (có ảnh món) | `/thuc-don` | FR-11 | Chủ quán |
| Trạm in (máy in mạng hoặc máy quầy, IP, "In thử") | `/tram-in` | FR-11 | Chủ quán |
| Khu & bàn | `/khu-ban` | FR-12 | Chủ quán |
| Nhân viên | `/nhan-vien` | FR-13 | Chủ quán |
| Kho keg & vòi | `/kho-keg` | FR-14, FR-10 | Chủ quán |
| Giờ vàng | `/gio-vang` | FR-15 | Chủ quán |

Màn Hôm nay tự làm mới mỗi 30 giây. Ngoài ra nó cập nhật ngay khi máy quầy thay đổi dữ liệu (Socket.IO).

**Ảnh món:** trong hộp thoại Thêm/Sửa món, bấm "Chọn ảnh" (hoặc "Đổi ảnh", "Bỏ ảnh"). Ảnh được thu nhỏ còn cạnh dài 640px ngay trên trình duyệt trước khi gửi, nên ảnh chụp bằng điện thoại 5 MB chỉ còn khoảng 100 KB. Ảnh hiện trong bảng thực đơn và trên nút món ở App quầy.

**Màn đăng nhập** có ảnh quán bia hơi Hà Nội (`public/img/dang-nhap.jpg`, ảnh của thalling55 trên Wikimedia Commons, CC BY 2.0, ghi nguồn ngay trên ảnh).

**Giao diện tối:** nút mặt trăng/mặt trời ở cuối thanh bên, cạnh nút đăng xuất. Lựa chọn lưu trên từng máy; chưa chọn thì theo cài đặt sáng/tối của máy. Thêm `#theme=dark` vào địa chỉ để mở thẳng giao diện tối (tiện khi demo).

**Thông báo đẩy (FR-20):** chủ quán bật ở đầu màn Nhật ký hủy/giảm, mục "Thông báo trên thiết bị này". Có nút "Gửi thử" để kiểm tra, và nút "Tắt".

## Kiểm thử đầu-cuối

Playwright, chạy bằng Chrome cài sẵn trên máy (không tải trình duyệt). Bộ test tự seed lại dữ liệu demo trước khi chạy.

```bash
docker compose up -d --build                                         # backend + web
E2E_BASE_URL=http://127.0.0.1:8080 pnpm --filter @biahoi/admin e2e  # hoặc bỏ biến này để chạy với web dev ở cổng 5173
```

23 test:
- Đăng nhập và phân quyền: quản lý ca không vào được màn quản trị.
- Các màn báo cáo.
- Thêm, sửa, xóa ở mọi màn quản trị: món và nhóm món, trạm in, khu và bàn, nhân viên, nhập keg và thay keg, giờ vàng.
- 3 test trên khổ điện thoại 390px.

Không có Docker thì đặt `E2E_SEED_CMD="pnpm --filter @biahoi/api db:seed"`, hoặc `E2E_SKIP_SEED=1` để bỏ bước seed.

## Thiết kế

Giao diện làm theo skill `design-taste-frontend` (tasteskill v2), theo quy trình cho màn hình ứng dụng:

- **Phong cách:** `accent-ladder` (seed 2053758187). Một màu thương hiệu chỉ đặt trên dữ liệu và các dấu nhỏ; tông nhạt của nó dùng cho mục đang chọn và rãnh tiến độ.
- **Đổi so với bộ quy cách được chia:**
  - Màu raspberry đổi sang **hổ phách** (`#b45309`), màu của bia hơi.
  - Font **DM Sans đổi sang Be Vietnam Pro**, vì DM Sans không có bộ ký tự tiếng Việt.
- **Yếu tố riêng của sản phẩm:** dải **Vòi bia**. Mỗi vòi là một thanh dài đúng dung tích keg đang gắn, phần đã bán tô hổ phách. Keg đã hết hiện thêm phần hao hụt, chuyển đỏ khi vượt ngưỡng.
- **Kiểm tra:** `inspect.mjs --app` cho 0 FAIL trên cả 12 màn ở 1440, 768 và 390px (kiểm ngày 24/10/2026).
  - Cảnh báo `palette-cream` còn lại là có chủ đích: tông nhạt hổ phách chỉ nằm trên mục nav đang chọn, badge và rãnh thanh keg, không làm nền.
  - Cảnh báo khoảng trống ở Kho keg và Trạm in là do danh sách ngắn (1 keg trong kho, 2 trạm in).

- **Giao diện tối:** dùng bảng màu của phong cách `true-black-flat`, giữ nguyên bố cục accent-ladder. Nền đen ấm `#0e0d0c` (không dùng xanh than), thẻ sáng hơn một bậc (`#181716`), hổ phách sáng `#f2b33d` cho số liệu. Biểu đồ vẽ lại khi đổi giao diện. 0 FAIL khi kiểm bằng `inspect.mjs --app`.

## Cấu trúc

```text
src/
  App.tsx              router, chặn màn quản trị với người không phải chủ quán
  lib/                 gọi API, đăng nhập, hook tải dữ liệu / realtime, định dạng số và ngày kiểu Việt Nam
  components/          khung (Shell), icon và dấu sản phẩm, dải Vòi bia, hộp thoại, biểu đồ
  screens/             mỗi màn một file, đầu file ghi câu hỏi mà màn đó trả lời
  styles/app.css       nền app.css của tasteskill với bộ màu hổ phách
  styles/screens.css   phần riêng của sản phẩm
  vendor/charts.js     biểu đồ SVG của tasteskill (cột theo giờ, danh sách xếp hạng)
public/                manifest, service worker, trang "Mất kết nối", icon
scripts/make-icons.mjs vẽ icon PNG cho PWA (không cần thư viện)
```

## Dữ liệu mẫu cần thay trước khi dùng thật

- Tên quán **"Bia hơi Ngõ 7"** đặt trong `src/components/Shell.tsx` (`SHOP_NAME`).
- Giờ mở cửa 10:00 dùng để cắt trục biểu đồ giờ: `OPEN_HOUR` trong `src/screens/Today.tsx`.
- Toàn bộ món, giá, nhân viên, keg đến từ dữ liệu seed của backend.
- Ảnh món mẫu là ảnh minh họa lấy từ Wikimedia Commons. Quán thật nên thay bằng ảnh tự chụp món của mình.
- Ảnh màn đăng nhập (`public/img/dang-nhap.jpg`) và màn khóa App quầy (`apps/counter/public/img/man-khoa.jpg`) có thể thay bằng ảnh quán thật; nhớ sửa dòng ghi nguồn ảnh trong `Login.tsx` / `Lock.tsx`.
