# Backend API — Hệ thống quản lý quầy bia hơi

Fastify 5 + Prisma 6 + PostgreSQL + Socket.IO, viết bằng TypeScript. Gói WBS 1.4.2.
Hàm tính tiền, giá giờ vàng, VietQR và hao hụt keg nằm ở [`packages/shared`](../../packages/shared/src),
dùng chung với App quầy và Web quản trị.

```text
apps/api/
  prisma/schema.prisma     mô hình dữ liệu (SRS 6.2 + các trường bổ sung)
  prisma/migrations/       migration SQL
  prisma/seed.ts           dữ liệu demo (SRS mục 8)
  scripts/dev-db.ts        PostgreSQL nhúng cho máy không có Docker
  src/routes/              mỗi file một nhóm API (auth, tables, orders, payments, shifts, kegs, catalog, reports)
  src/services/tabs.ts     tổng tiền phiên, chi tiết phiên, dựng hóa đơn và phiếu in
  src/lib/                 xác thực, lỗi, realtime, khóa PIN sai, kiểm tra dữ liệu
  test/api.test.ts         test tích hợp theo tiêu chí nghiệm thu
```

## Chạy trên máy cá nhân (Windows, không cần Docker)

```bash
corepack enable                        # một lần, để có pnpm
pnpm install                           # ở thư mục gốc repo

# Cửa sổ 1 — CSDL (giữ mở)
pnpm --filter @biahoi/api db:start

# Cửa sổ 2
cd apps/api
cp .env.example .env                   # để COUNTER_DEVICE_KEYS="" khi phát triển
pnpm db:deploy                         # tạo bảng
pnpm db:seed                           # nạp dữ liệu demo (XÓA dữ liệu cũ)
pnpm dev                               # API ở http://127.0.0.1:3000
```

Trên Windows nên gọi `127.0.0.1` thay vì `localhost`: `localhost` thử IPv6 trước nên mỗi request chậm thêm khoảng 200 ms.

Có Docker Desktop thì chạy ở thư mục gốc:

```bash
docker compose up -d --build                  # API ở http://127.0.0.1:3000, tự chạy migration
docker compose exec api npx prisma db seed    # nạp dữ liệu demo
docker compose down                           # dừng (thêm -v để xóa luôn dữ liệu)
```

### Tài khoản demo

| Vai trò | PIN (App quầy) | Web |
|---|---|---|
| Nhân viên quầy | 1111, 2222 | — |
| Quản lý ca | 8888 | quanly@biahoi.vn / quanly123 |
| Chủ quán | 9999 | chuquan@biahoi.vn / chuquan123 |
| Đã nghỉ (không đăng nhập được) | 3333 | — |

Seed tạo 7 ngày bán hàng. "Hôm nay" luôn tính lùi 4 giờ từ lúc chạy seed, nên **seed lại ngay trước buổi demo**
để dashboard có bàn đang ngồi. Keg #1 hao hụt đúng 8% (92 cốc 0,5 L) đúng như dữ liệu mẫu trong FR-17.

## Test

```bash
pnpm test                                   # ở thư mục gốc: chạy mọi gói
pnpm --filter @biahoi/shared test           # 17 test đơn vị phần tính tiền (không cần CSDL)
pnpm --filter @biahoi/api test              # 47 test tích hợp; tự dựng PostgreSQL tạm ở cổng 54329
```

- `test/api.test.ts`: tiêu chí nghiệm thu FR-01 đến FR-19.
- `test/push.test.ts`: FR-20, với phần gửi thật được thay bằng bản ghi lại.
- `test/openapi.test.ts`: báo lỗi khi code có route mà `openapi.yaml` không có, hoặc ngược lại.
- `test/printing.test.ts`: ESC/POS và in qua máy in mạng, với một máy in TCP giả.
- `test/images.test.ts`: tải, đổi, bỏ ảnh món; chặn tệp giả ảnh, tệp quá 2 MB và tên tệp kiểu `../`.

### Kiểm thử tải (NFR-01)

```bash
# chạy trên hệ thống Docker; kịch bản mở hết 80 bàn và thêm lượt gọi, nên seed lại sau đó
docker run --rm -i --network projectquanlyduancntt_default -e BASE_URL=http://api:3000 grafana/k6:0.55.0 run - < apps/api/load/nfr01.js
docker compose exec api npx prisma db seed
```

Kịch bản dùng 3 máy quầy (xem sơ đồ, mở phiên, gọi món, thỉnh thoảng in tạm tính, nghỉ 1–3 giây giữa các thao tác) và 1 dashboard làm mới mỗi 5 giây, trong 60 giây, với 80 bàn đang mở.
Kết quả ngày 24/10/2026 trên laptop demo: **p95 = 27,7 ms** (ngưỡng 500 ms), 0% lỗi, 362 request.

## Tài liệu API (OpenAPI)

Hợp đồng API nằm ở [`openapi.yaml`](openapi.yaml). Khi máy chủ chạy, xem trực quan tại **http://127.0.0.1:3000/docs** (đặt `DOCS=off` để tắt).
Sửa API thì phải sửa cả `openapi.yaml`, nếu không `test/openapi.test.ts` sẽ báo lỗi.

## Quy ước chung

- **Xác thực:** header `Authorization: Bearer <token>`. Token sống 12 giờ.
  Máy quầy gửi thêm `x-device-key` khi đăng nhập PIN; danh sách khóa nằm trong biến `COUNTER_DEVICE_KEYS`.
- **Khóa PIN sai 5 lần** tính theo khóa thiết bị, hoặc theo IP máy quầy nếu không dùng khóa thiết bị. Chạy sau nginx thì đặt `TRUST_PROXY` (Docker Compose đặt sẵn `uniquelocal`) để API đọc IP thật từ `X-Forwarded-For`. Nếu không đặt, mọi máy quầy trông như cùng một IP và một máy nhập sai sẽ khóa cả quán.
  - Compose chỉ mở cổng 3000 cho chính máy chủ (`127.0.0.1:3000`), nên máy trong LAN không gọi thẳng API để giả header được.
  - Docker Desktop trên Windows chuyển mọi kết nối từ ngoài vào qua một IP chung, nên ở đó vẫn nên đặt `COUNTER_DEVICE_KEYS`, mỗi máy quầy một khóa.
- **Lỗi:** luôn có dạng `{ code, message, details? }`. `message` là tiếng Việt, hiển thị thẳng cho người dùng được.
  Các mã HTTP: 400 dữ liệu sai · 401 chưa đăng nhập · 403 không có quyền / thiếu PIN quản lý · 404 · 409 xung đột trạng thái · 429 khóa vì nhập sai PIN.
- **Tiền:** số nguyên VND. **Giờ:** ISO 8601 (UTC); mọi phép tính theo ngày/giờ dùng giờ Việt Nam. **Ngày trong query:** `YYYY-MM-DD`.
- **Dữ liệu chỉ thêm (NFR-04):** không có API sửa/xóa `order_line`, `payment`, `bill_print`, `audit_log`. Hủy món tạo dòng âm.
- **POST không có thân:** được phép gửi kèm `content-type: application/json` với thân rỗng (vd in tạm tính).

## Danh sách API

Quyền: **Q** = mọi nhân viên · **QL** = Quản lý ca, Chủ quán · **C** = chỉ Chủ quán. Dấu ✚ là API bổ sung, không có trong SRS 6.3.

| Nhóm | Endpoint | Quyền | FR |
|---|---|---|---|
| Auth | `POST /auth/pin` `{pin}` | — | FR-01 |
| | `POST /auth/login` `{email, password}` (nhân viên quầy bị chặn) | — | FR-13 |
| | `POST /auth/approve` `{pin}` → `approvalToken` (dùng 1 lần, hạn 2 phút) | Q | FR-06, 08 |
| | ✚ `GET /auth/me` | Q | |
| Bàn | `GET /areas?include=tables` (trạng thái màu, tạm tính, giờ mở) | Q | FR-02 |
| | `POST /tabs` `{tableId, guestCount?}` → `{alreadyOpen, tab}` | Q | FR-03 |
| | ✚ `GET /tabs/:id` (chi tiết phiên, mỗi dòng có `state.remainingQty`) | Q | FR-04 |
| | `POST /tabs/:id/move` `{tableId}` | Q | FR-05 |
| | `POST /tabs/:id/merge` `{tableId}` (bàn đích đang có khách) | Q | FR-05 |
| Order | `POST /tabs/:id/rounds` `{items:[{itemId, qty, note?}], note?}` → `{round, tickets, total}` | Q | FR-04 |
| | ✚ `POST /rounds/:id/print-result` `{status: PRINTED\|FAILED}` | Q | FR-02, 04 |
| | `POST /rounds/:id/reprint` `{stationId?}` | Q | FR-04 |
| | `POST /lines/:id/void` `{qty, reason, note?, approvalToken}` | Q + PIN QL | FR-06 |
| | `POST /lines/:id/discount` `{percent \| amount, reason, note?, approvalToken}` | Q + PIN QL | FR-06 |
| Thanh toán | `POST /tabs/:id/provisional` → dữ liệu in tạm tính | Q | FR-07 |
| | `GET /tabs/:id/vietqr?amount=` → chuỗi VietQR để vẽ mã QR | Q | FR-08 |
| | ✚ `POST /tabs/:id/discount` giảm giá cả hóa đơn | Q + PIN QL | FR-08 |
| | `POST /tabs/:id/pay` `{payments:[{method, amount, tendered?}]}` → hóa đơn chính thức | Q | FR-08 |
| | ✚ `GET /tabs/:id/bill` in lại hóa đơn đã thanh toán | Q | FR-08 |
| Ca | `POST /shifts/open` `{openingCash}` · ✚ `GET /shifts/current` | Q | FR-09 |
| | `POST /shifts/:id/close` `{countedCash}` · ✚ `GET /shifts?from&to` · ✚ `GET /shifts/:id` | QL | FR-09 |
| Kho bia | `POST /kegs` `{beerName, capacityMl, cost, quantity}` | C | FR-14 |
| | `GET /kegs?status=` · ✚ `GET /taps` | Q | FR-10, 14 |
| | `POST /taps/:id/change-keg` `{kegId}` | Q | FR-10 |
| Danh mục | `/menu-groups` `/menu-items` `/print-stations` `/areas` `/tables` `/taps` `/happy-hours`: GET (Q), POST/PATCH/DELETE (C) | Q / C | FR-11, 12, 15 |
| | `/staff`: GET/POST/PATCH (C); không có DELETE, dùng `active: false` | C | FR-13 |
| Báo cáo | `GET /reports/today` | QL | FR-16 |
| | `GET /reports/keg-loss?from&to&threshold` | QL | FR-17 |
| | `GET /reports/voids?from&to&staffId&approverId&reason` | QL | FR-18 |
| | `GET /reports/top-items?from&to&by=qty\|revenue&limit` · `GET /reports/hourly?from&to` (tối đa 31 ngày) | QL | FR-19 |
| Thông báo đẩy | ✚ `GET /push/public-key` · `POST /push/subscribe` · `DELETE /push/subscribe` · `POST /push/test` | C | FR-20 |

### Các luồng chính cho App quầy

**Gọi món và in (FR-04):** `POST /tabs/:id/rounds` trả về `tickets`, mỗi trạm in một phiếu kèm `printerName`.
App quầy in qua driver Windows, rồi gọi `POST /rounds/:id/print-result` với `PRINTED` hoặc `FAILED`.
Nếu `FAILED`, bàn chuyển đỏ; nút "In lại" gọi `/rounds/:id/reprint`. Phiếu có `printerName = null` khi món chưa gán trạm, lúc đó in ra PDF (NFR-08).

**Hủy/giảm món (FR-06):** mở hộp thoại PIN → `POST /auth/approve` → gửi `approvalToken` cùng yêu cầu hủy.
Nếu hủy bị từ chối (ví dụ quá số lượng), phiếu duyệt vẫn dùng lại được. Khi hủy thành công, API trả về phiếu "PHIẾU HỦY MÓN" để in xuống bếp.

**Thanh toán (FR-08):** tổng các `amount` phải **đúng bằng** số phải trả. Tiền khách đưa ghi vào `tendered` (chỉ với tiền mặt), và hóa đơn trả về `change` (tiền thừa).
Khi trả kết hợp, gọi `GET /tabs/:id/vietqr?amount=<phần chuyển khoản>`.

### Realtime (Socket.IO, cùng cổng với API)

```js
const socket = io('http://<máy chủ>:3000', { auth: { token } });
socket.on('table.updated', ({ tableIds }) => /* tải lại GET /areas?include=tables */);
socket.on('dashboard.updated', () => /* PWA tải lại /reports/today */);
socket.on('tap.updated', ({ tapIds }) => /* tải lại GET /taps */);
```

## Quyết định thiết kế cần nhóm xác nhận ở G2

Những điểm dưới đây SRS chưa nói rõ hoặc thiếu. Code đang làm theo cách ghi trong bảng; nếu nhóm chọn khác thì sửa SRS hoặc sửa code.

| # | Vấn đề | Đang làm |
|---|---|---|
| 1 | Mô hình dữ liệu SRS 6.2 thiếu trường cho FR-05/06/08/09/18 | Bổ sung (đánh dấu "bổ sung" trong `schema.prisma`): `order_line.created_at/created_by/item_name/keg_id/volume_ml/station_id/happy_hour_id`, bảng `bill_discount`, `tab.status = MERGED` + `merged_into_id`, `dining_table.current_tab_id`, `payment.shift_id/tendered`, xóa mềm bàn và món |
| 2 | Hủy món bia có trừ thể tích đã bán của keg không? | **Có trừ, với mọi lý do.** Bia rót hỏng ("Món lỗi") vì thế được tính vào hao hụt. Lý do hủy vẫn xem được trong nhật ký FR-18 |
| 3 | Ca theo người hay theo cả quán? | Cả quán dùng chung một ca. Nhân viên nào cũng mở ca được; chỉ Quản lý ca/Chủ quán đóng ca được |
| 4 | Quản lý ca có vào web không? | Có: xem báo cáo, xem ca. Chỉ Chủ quán được sửa danh mục và nhân viên |
| 5 | "Token thiết bị" cấp thế nào? | Khóa cố định trong biến môi trường `COUNTER_DEVICE_KEYS`, chưa có màn quản lý thiết bị |
| 6 | Bàn vừa in lỗi vừa đã tạm tính hiện màu gì? | Đỏ (lỗi in ưu tiên) |
| 7 | Gộp bàn khi bàn nguồn đã có giảm giá hóa đơn | Giảm giá đi theo sang phiên đích |
| 8 | Nhiều khung giờ vàng trùng nhau | Lấy giá thấp nhất |
| 9 | Món bị hủy hết có in trên hóa đơn không? | Không in |
| 10 | Món đã giảm giá rồi mới hủy | Không cho hủy tới mức giá trị dòng bị âm |

## In qua máy in mạng (FR-04, NFR-08)

Trạm in đặt `connection = NETWORK` (cùng `host`, `port`) thì khi gửi lượt gọi, in lại hoặc hủy món, backend tự vẽ phiếu thành ảnh 80 mm (576 điểm, font Be Vietnam Pro trong `assets/fonts/`) và gửi lệnh ESC/POS (`GS v 0` + cắt giấy) tới máy in qua TCP.
In dạng ảnh nên dấu tiếng Việt luôn đúng, không phụ thuộc bảng mã của máy in.

- **Lỗi máy in:** máy in không phản hồi trong 4 giây thì lượt tự chuyển `FAILED`, bàn đỏ trên mọi máy quầy, và phiếu trả về có `error`. In lại thành công thì về `PRINTED`.
- **Trạm in qua máy quầy:** trạm `BROWSER` thì phiếu trả về có `delivery = browser`, để App quầy tự in.
- **In thử:** `POST /print-stations/:id/test`.
- **Máy in giả:** `pnpm --filter @biahoi/api printer:fake` nghe cổng 9100 và lưu mỗi phiếu nhận được thành PNG trong `apps/api/printouts/`. Dùng khi demo mà chưa có máy in. Backend chạy trong Docker thì đặt host của trạm là `host.docker.internal`.

## Ảnh món (FR-11)

- **Tải lên:** `PUT /menu-items/:id/image`, gửi thẳng tệp ảnh với `content-type: image/jpeg|png|webp`, không dùng multipart. Tối đa 2 MB. Định dạng xét theo các byte đầu tệp, không tin content-type. Chỉ chủ quán được tải.
- **Bỏ ảnh:** `DELETE /menu-items/:id/image`. Ảnh cũ bị xóa khỏi đĩa khi đổi hoặc bỏ.
- **Xem ảnh:** `GET /uploads/:file`. Không cần token, vì thẻ `<img>` không gửi được token. Mỗi lần tải lên có tên tệp mới, nên ảnh được lưu đệm 1 năm.
- **Nơi lưu:** thư mục `UPLOAD_DIR` (mặc định `apps/api/uploads`). Trong Docker đây là volume `uploads`, nên build lại không mất ảnh.
- **Ảnh mẫu:** seed chép 18 ảnh trong `prisma/seed-images/` vào thư mục ảnh. Nguồn và giấy phép của từng ảnh ghi ở [`prisma/seed-images/CREDITS.md`](prisma/seed-images/CREDITS.md). Đây là ảnh minh họa, không phải ảnh món của quán.

## Thông báo đẩy (FR-20)

Mỗi khi một lần hủy món, giảm giá món hoặc giảm giá hóa đơn **lớn hơn** `PUSH_VOID_THRESHOLD` (mặc định 200.000 đ), backend gửi Web Push tới mọi thiết bị của chủ quán đã bật thông báo.
Thông báo gồm số tiền, món, bàn, lý do, người yêu cầu và người duyệt. Bấm vào thông báo thì mở màn Nhật ký hủy/giảm.

- **Khóa VAPID:** lấy từ `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`. Không đặt thì backend tự sinh một lần và lưu vào bảng `app_setting`. Đổi khóa sẽ làm mọi thiết bị phải bật lại thông báo.
- **Không làm chậm quầy:** thông báo được gửi sau khi lưu xong; thao tác ở quầy không chờ.
- **Thiết bị đã gỡ:** máy chủ push trả 404/410 thì thiết bị tự bị xóa khỏi danh sách.
- **Điều kiện trên điện thoại:** trang phải chạy qua HTTPS (xem README của `apps/admin`).
- **Đã kiểm chứng ngày 24/10/2026 trên Chrome thật:** đăng ký với `fcm.googleapis.com`, backend gửi, service worker hiện thông báo.

## Client dùng API này

- **App quầy**: `apps/counter`, bản web theo CR-01.
- **Web quản trị + PWA chủ quán**: `apps/admin`.
