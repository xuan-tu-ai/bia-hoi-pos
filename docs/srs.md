# Đặc tả yêu cầu phần mềm (SRS): Hệ thống quản lý quầy nhà hàng bia hơi

> Nhóm 7 — môn Quản trị dự án — ĐH Bách Khoa
> Phiên bản: 0.1 (bản nháp để duyệt ở Gate G1) — 2026-10-20
> Người soạn: Nguyễn Xuân Tự (nhóm trưởng)
> Tài liệu liên quan: `ke-hoach-quan-ly-du-an.md` (kế hoạch quản lý dự án), `bia-hoi-counter-pos-vision.md` (tầm nhìn dài hạn — ngoài phạm vi)

## 1. Giới thiệu

### 1.1 Mục đích

Tài liệu mô tả các yêu cầu của hệ thống quản lý quầy cho một nhà hàng bia hơi. Đây là đầu vào cho các pha Thiết kế, Cài đặt, Kiểm thử, và là căn cứ nghiệm thu sản phẩm (scope baseline cùng với WBS trong kế hoạch dự án).

### 1.2 Bối cảnh nghiệp vụ

Một nhà hàng bia hơi đông khách có nhiều bàn chia theo khu (trong nhà, sân, tầng 2). Phục vụ nhận yêu cầu tại bàn rồi báo về **quầy**; nhân viên quầy nhập order, in phiếu cho bếp và cho người rót bia, cuối bữa tính tiền. Các vấn đề thường gặp khi làm bằng giấy:

- Sót món, ra nhầm bàn giờ cao điểm.
- Tính tiền chậm và sai khi gộp/chuyển bàn.
- Thất thoát bia hơi: không đối chiếu được lượng bia trong keg (bom) với số cốc đã bán.
- Hủy món tùy tiện, chủ quán không kiểm soát được.

### 1.3 Phạm vi sản phẩm

Hệ thống gồm 3 thành phần dùng chung một backend:

| Thành phần | Người dùng | Nền tảng |
|---|---|---|
| **App quầy** | Nhân viên quầy, Quản lý ca | Ứng dụng desktop Windows (Electron + React) |
| **Web quản trị** | Chủ quán / Quản lý | Web (React + Vite) |
| **PWA chủ quán** | Chủ quán | PWA cài được lên điện thoại (cùng codebase với web quản trị) |
| **Backend API** | — | Node.js + PostgreSQL |

**Ngoài phạm vi** (xem tài liệu tầm nhìn): chạy offline / máy chủ cục bộ, hóa đơn điện tử, tự xác nhận chuyển khoản qua webhook ngân hàng, nhiều chi nhánh / nhiều quán (multi-tenant), app cho phục vụ, khách tự order bằng QR, màn hình bếp (KDS), định lượng nguyên liệu, đặt bàn, combo, tách bill theo người, công nợ, cảm biến lưu lượng bia.

### 1.4 Thuật ngữ

| Thuật ngữ | Nghĩa |
|---|---|
| Khu | Nhóm bàn theo vị trí (Trong nhà, Sân, Tầng 2) |
| Phiên bàn (tab) | Một lượt khách ngồi từ lúc mở bàn đến lúc thanh toán = một hóa đơn |
| Lượt gọi | Một lần nhập order cho một phiên bàn, có thể gồm nhiều món |
| Trạm in | Nơi nhận phiếu: Quầy rót bia, Bếp nướng, Bếp chiên… |
| Keg | Thùng/bom bia hơi (30L, 50L) |
| Tạm tính | Hóa đơn in cho khách xem trước khi thanh toán |
| PIN | Mã số cá nhân 4–6 chữ số để đăng nhập nhanh và duyệt thao tác |

### 1.5 Mức ưu tiên (MoSCoW)

- **M (Must)**: bắt buộc cho bản demo cuối kỳ; thiếu là không nghiệm thu.
- **S (Should)**: nên có; cắt được nếu trễ tiến độ (qua quy trình kiểm soát thay đổi).
- **C (Could)**: làm nếu dư thời gian.

## 2. Tác nhân (Actors)

| Mã | Tác nhân | Mô tả | Phân loại* |
|---|---|---|---|
| AC1 | Nhân viên quầy | Nhập order, in phiếu, tính tiền | Phức tạp (giao diện đồ họa) |
| AC2 | Quản lý ca | Như AC1 + duyệt hủy/giảm, đóng ca | Phức tạp |
| AC3 | Chủ quán | Cấu hình hệ thống, xem báo cáo | Phức tạp |
| AC4 | Máy in nhiệt | Hệ thống ngoài nhận lệnh in | Đơn giản (API) |

\* Phân loại phục vụ ước lượng theo điểm use case (UCP) nếu cần đối chiếu chi phí theo QĐ 671/QĐ-BTTTT.

## 3. Danh sách use case

| Mã UC | Tên | Tác nhân | Ưu tiên | Số giao dịch ước tính |
|---|---|---|---|---|
| UC01 | Đăng nhập bằng PIN / đổi người dùng | AC1, AC2 | M | 3 |
| UC02 | Xem sơ đồ bàn theo khu | AC1 | M | 3 |
| UC03 | Mở phiên bàn | AC1 | M | 2 |
| UC04 | Nhập lượt gọi món & gửi in phiếu | AC1, AC4 | M | 7 |
| UC05 | Chuyển bàn / gộp bàn | AC1 | M | 5 |
| UC06 | Hủy hoặc giảm món sau khi đã gửi (cần duyệt) | AC1, AC2 | M | 6 |
| UC07 | In tạm tính | AC1, AC4 | M | 3 |
| UC08 | Thanh toán (tiền mặt / chuyển khoản QR) | AC1, AC4 | M | 6 |
| UC09 | Mở / đóng ca | AC1, AC2 | S | 4 |
| UC10 | Thay keg tại vòi | AC1 | M | 3 |
| UC11 | Quản lý thực đơn & trạm in | AC3 | M | 6 |
| UC12 | Quản lý khu & bàn | AC3 | M | 4 |
| UC13 | Quản lý nhân viên, vai trò, PIN | AC3 | M | 4 |
| UC14 | Nhập kho keg | AC3 | M | 3 |
| UC15 | Cấu hình giá giờ vàng (happy hour) | AC3 | S | 4 |
| UC16 | Xem dashboard doanh thu hôm nay | AC3 | M | 3 |
| UC17 | Xem báo cáo hao hụt keg | AC3 | M | 4 |
| UC18 | Xem nhật ký hủy/giảm | AC3 | M | 3 |
| UC19 | Xem báo cáo món bán chạy & giờ cao điểm | AC3 | S | 4 |
| UC20 | Nhận thông báo đẩy khi có hủy món | AC3 | C | 3 |

## 4. Yêu cầu chức năng

Mỗi yêu cầu có mã `FR-xx`, liên kết use case và **tiêu chí nghiệm thu (AC)**. Một yêu cầu chỉ được coi là xong khi mọi AC đều đạt trong kiểm thử.

### 4.1 App quầy

**FR-01 Đăng nhập PIN (UC01, M)**
- Màn hình khóa có bàn phím số; nhập PIN để vào. Nút "Đổi người" đưa về màn hình khóa mà không thoát ứng dụng.
- AC: PIN sai 5 lần liên tiếp thì khóa 60 giây. Mọi thao tác ghi lại nhân viên đang đăng nhập. PIN lưu dạng băm (bcrypt).

**FR-02 Sơ đồ bàn (UC02, M)**
- Mỗi khu là một tab; bàn hiển thị dạng lưới ô vuông theo thứ tự cấu hình.
- Mỗi ô: số bàn, tổng tiền tạm tính, thời gian đã ngồi.
- Màu trạng thái: xám = trống; xanh = đang ngồi; vàng = đã in tạm tính; đỏ = có lượt gọi chưa in được (lỗi máy in).
- AC: thay đổi do một máy quầy khác tạo hiện trên sơ đồ trong ≤ 3 giây. Hiển thị được 80 bàn mà không cần cuộn ngang trên màn 1366×768.

**FR-03 Mở phiên bàn (UC03, M)**
- Bấm bàn trống → mở phiên (tùy chọn nhập số khách).
- AC: một bàn chỉ có tối đa 1 phiên đang mở. Hai máy cùng mở một bàn → máy sau nhận thông báo "Bàn đã được mở" và vào phiên đó.

**FR-04 Nhập lượt gọi món (UC04, M)**
- Panel phiên bàn gồm: lưới nút món theo nhóm (Bia, Đồ nướng, Đồ chiên…), ô tìm món theo tên hoặc mã tắt (vd `b` = bia hơi cốc), danh sách món của lượt đang nhập với nút +/–.
- Bấm "Gửi" → lưu lượt gọi, tách món theo trạm in, in mỗi trạm một phiếu: số bàn, giờ, tên nhân viên, danh sách món & số lượng, ghi chú.
- Giá được **chốt tại thời điểm gửi** (nếu có happy hour thì áp giá giờ vàng theo giờ gửi).
- AC: nhập và gửi một lượt 3 món trong ≤ 10 giây với người đã quen. Lượt đã gửi không sửa trực tiếp được (chỉ hủy qua FR-06). Nếu máy in lỗi, lượt vẫn được lưu, bàn chuyển đỏ và có nút "In lại".

**FR-05 Chuyển / gộp bàn (UC05, M)**
- Chuyển: chọn bàn đích đang trống → toàn bộ phiên chuyển sang.
- Gộp: chọn bàn đích đang có phiên → các món của bàn nguồn nhập vào phiên đích; bàn nguồn trở về trống.
- AC: tổng tiền sau gộp = tổng hai phiên trước gộp. Lịch sử ghi lại thao tác chuyển/gộp (ai, lúc nào, từ đâu đến đâu).

**FR-06 Hủy / giảm món sau khi gửi (UC06, M)**
- Chọn món trong lượt đã gửi → "Hủy" (chọn số lượng) hoặc "Giảm giá" (% hoặc số tiền).
- Bắt buộc: chọn lý do từ danh sách (Khách đổi ý, Bếp hết món, Nhập nhầm, Món lỗi, Khác + ghi chú) và **nhập PIN của người có vai trò Quản lý ca**.
- Hủy món không xóa dữ liệu mà tạo dòng điều chỉnh âm.
- AC: nhân viên thường không thể hoàn tất nếu thiếu PIN quản lý. Mỗi lần hủy/giảm tạo một bản ghi nhật ký gồm món, số lượng, số tiền, lý do, người yêu cầu, người duyệt, thời điểm. Hủy món trước khi gửi (đang nhập) thì không cần duyệt.

**FR-07 In tạm tính (UC07, M)**
- In hóa đơn tạm tính, gộp các món cùng tên + cùng đơn giá (vd "Bia hơi cốc ×10").
- AC: không giới hạn số lần in; mỗi bản ghi "Tạm tính — lần in N — HH:mm". Sau khi in, bàn chuyển vàng nhưng vẫn gọi thêm món được.

**FR-08 Thanh toán (UC08, M)**
- Màn thanh toán: tổng tiền, giảm giá cả hóa đơn (cần PIN quản lý), chọn phương thức:
  - Tiền mặt: nhập tiền khách đưa → hiển thị tiền thừa.
  - Chuyển khoản: hiển thị **mã VietQR** sinh từ tài khoản ngân hàng của quán, số tiền và nội dung `BH<mã hóa đơn>`; nhân viên kiểm tra rồi bấm "Đã nhận tiền".
  - Có thể kết hợp hai phương thức.
- Hoàn tất → in hóa đơn chính thức, đóng phiên, bàn về trống.
- AC: không thể đóng phiên khi số tiền nhận < tổng phải trả. Mã QR quét được bằng app ngân hàng thật và điền đúng số tiền. Hóa đơn đã thanh toán không sửa được.

**FR-09 Mở / đóng ca (UC09, S)**
- Mở ca: nhập tiền đầu ca. Đóng ca: hệ thống tổng hợp doanh thu theo phương thức trong ca; quản lý nhập tiền mặt thực đếm → hiện chênh lệch.
- AC: báo cáo đóng ca in được và xem lại được trên web quản trị.

**FR-10 Thay keg (UC10, M)**
- Màn "Vòi bia": danh sách vòi và keg đang gắn. Bấm "Thay keg" → chọn keg mới từ kho → keg cũ chuyển trạng thái "Đã hết".
- Mỗi món bia hơi khai báo thể tích (cốc 0,5 L; ca 1,5 L; tháp 3 L). Khi bán, thể tích được cộng dồn vào keg đang gắn ở vòi mặc định của món đó.
- AC: báo cáo hao hụt (FR-17) tính đúng cho keg vừa đóng.

### 4.2 Web quản trị

**FR-11 Quản lý thực đơn & trạm in (UC11, M)**
- CRUD nhóm món, món (tên, mã tắt, giá, đơn vị, trạm in, thể tích bia nếu là bia hơi, vòi mặc định, trạng thái còn/hết).
- CRUD trạm in (tên, tên máy in Windows trên máy quầy).
- AC: món "hết" hiển thị mờ và không bấm được trên app quầy. Đổi giá không ảnh hưởng các lượt gọi đã gửi.

**FR-12 Quản lý khu & bàn (UC12, M)**
- CRUD khu; CRUD bàn (số bàn, khu, thứ tự hiển thị).
- AC: không xóa được bàn đang có phiên mở.

**FR-13 Quản lý nhân viên (UC13, M)**
- CRUD nhân viên: họ tên, vai trò (Nhân viên quầy / Quản lý ca / Chủ quán), PIN, trạng thái hoạt động. Chủ quán đăng nhập web bằng email + mật khẩu.
- AC: nhân viên ngừng hoạt động không đăng nhập được. Nhân viên quầy không truy cập được web quản trị.

**FR-14 Nhập kho keg (UC14, M)**
- Nhập keg: loại bia, dung tích (L), giá nhập, ngày nhập, số lượng (tạo nhiều keg cùng lúc). Danh sách keg theo trạng thái: Trong kho / Đang dùng / Đã hết.
- AC: keg chỉ được gắn vào vòi khi ở trạng thái Trong kho.

**FR-15 Giá giờ vàng (UC15, S)**
- Khai báo khung giờ (các thứ trong tuần, giờ bắt đầu – kết thúc) và giá riêng cho từng món trong khung đó.
- AC: lượt gọi gửi trong khung giờ dùng giá giờ vàng; ngoài khung dùng giá thường; hóa đơn tách 2 dòng nếu cùng món nhưng khác giá.

### 4.3 PWA chủ quán (báo cáo)

**FR-16 Dashboard hôm nay (UC16, M)**
- Doanh thu đã thu, tạm tính đang mở, số bàn đang ngồi / tổng bàn, số hóa đơn, so sánh với cùng thời điểm hôm qua.
- AC: số liệu tự làm mới mỗi 30 giây; khớp tổng hóa đơn trong CSDL.

**FR-17 Hao hụt keg (UC17, M)**
- Mỗi keg đã hết: dung tích, thể tích đã bán (L), hao hụt (L) = dung tích − đã bán, tỉ lệ %, thời gian dùng. Tô đỏ keg vượt ngưỡng (mặc định 5%, cấu hình được).
- AC: với dữ liệu mẫu (keg 50 L, bán 92 cốc 0,5 L), báo cáo hiển thị hao hụt 4 L = 8%, tô đỏ.

**FR-18 Nhật ký hủy/giảm (UC18, M)**
- Danh sách theo ngày, lọc theo nhân viên/người duyệt/lý do; tổng tiền bị hủy/giảm.
- AC: mọi bản ghi từ FR-06 và giảm giá hóa đơn ở FR-08 đều xuất hiện.

**FR-19 Món bán chạy & giờ cao điểm (UC19, S)**
- Top 10 món theo số lượng/doanh thu trong khoảng ngày; biểu đồ doanh thu theo giờ trong ngày.
- AC: khoảng ngày tối đa 31 ngày; tải xong trong ≤ 3 giây với dữ liệu demo.

**FR-20 Thông báo đẩy (UC20, C)**
- Web Push đến PWA của chủ quán mỗi khi có hủy/giảm vượt 200.000 đ.
- AC: thông báo đến trong ≤ 1 phút trên điện thoại Android đã cài PWA.

**FR-21 Cài đặt PWA (M)**
- AC: Chrome trên Android hiện lời mời "Thêm vào màn hình chính"; mở từ màn hình chính chạy toàn màn hình; khi mất mạng hiển thị trang "Mất kết nối" thay vì lỗi trình duyệt.

## 5. Yêu cầu phi chức năng

| Mã | Yêu cầu | Cách kiểm tra |
|---|---|---|
| NFR-01 | Hiệu năng: API phản hồi ≤ 500 ms (p95) với 3 máy quầy + 80 bàn đang mở | Kịch bản tải bằng k6/script |
| NFR-02 | Đồng thời: tối thiểu 3 máy quầy cùng thao tác; cập nhật lẫn nhau ≤ 3 giây | Kiểm thử thủ công 3 máy |
| NFR-03 | Dễ dùng: nhân viên mới tự nhập & gửi lượt gọi đầu tiên trong ≤ 5 phút không cần hướng dẫn | Thử với 2 người ngoài nhóm |
| NFR-04 | Toàn vẹn dữ liệu: lượt gọi, hóa đơn đã thanh toán, nhật ký không bị xóa/sửa; tiền lưu bằng số nguyên VND | Rà soát CSDL & API |
| NFR-05 | Bảo mật: PIN/mật khẩu băm; API yêu cầu token; phân quyền theo vai trò | Kiểm thử phân quyền |
| NFR-06 | Giao diện tiếng Việt, chữ ≥ 14 px trên app quầy, nút chính ≥ 44×44 px | Rà soát UI |
| NFR-07 | Cài đặt: app quầy có bộ cài `.exe` cho Windows 10/11 | Cài trên máy sạch |
| NFR-08 | In: hỗ trợ máy in nhiệt 80 mm qua driver Windows; nếu không có máy in thì xuất PDF để demo | Kiểm thử in |
| NFR-09 | Chất lượng mã: mọi thay đổi qua Pull Request được nhóm trưởng duyệt; lint không lỗi | Quy định GitHub |

## 6. Thiết kế sơ bộ (đầu vào cho pha Thiết kế)

### 6.1 Kiến trúc

```
[App quầy (Electron+React)] ─┐
[App quầy máy 2, 3...]  ─────┼── HTTPS REST + WebSocket ──> [Backend API (Node/Fastify)] ──> [PostgreSQL]
[Web quản trị / PWA (React)] ┘
Máy in nhiệt ← in qua driver Windows từ tiến trình Electron
```

- Monorepo (pnpm workspaces): `apps/counter` (Electron + React + Vite), `apps/admin` (React + Vite, gồm web quản trị và PWA), `apps/api` (Fastify + Prisma), `packages/shared` (kiểu dữ liệu, hàm tính tiền dùng chung).
- Realtime: WebSocket (Socket.IO) phát sự kiện `table.updated` để các máy quầy và dashboard tự cập nhật.
- Xác thực: JWT. App quầy dùng token thiết bị + PIN nhân viên; web dùng email/mật khẩu.
- Triển khai demo: Docker Compose (API + Postgres) trên một laptop trong mạng LAN; có thể triển khai thêm lên dịch vụ miễn phí để PWA truy cập từ Internet.

### 6.2 Mô hình dữ liệu (thực thể chính)

| Bảng | Trường chính |
|---|---|
| `staff` | id, name, role (COUNTER/SHIFT_MANAGER/OWNER), pin_hash, email, password_hash, active |
| `area` | id, name, sort_order |
| `dining_table` | id, area_id, code, sort_order |
| `menu_group` | id, name, sort_order |
| `menu_item` | id, group_id, name, shortcut, price, unit, station_id, beer_volume_ml, default_tap_id, available |
| `happy_hour` / `happy_hour_price` | khung giờ; giá theo món |
| `print_station` | id, name, printer_name |
| `tab` | id, table_id, opened_at, opened_by, guest_count, status (OPEN/PAID), closed_at |
| `order_round` | id, tab_id, created_at, created_by, printed_status |
| `order_line` | id, round_id, item_id, qty, unit_price, line_type (NORMAL/VOID/DISCOUNT), ref_line_id, reason, approved_by |
| `payment` | id, tab_id, method (CASH/TRANSFER), amount, received_by, created_at |
| `bill_print` | id, tab_id, kind (PROVISIONAL/FINAL), print_no, printed_at |
| `shift` | id, staff_id, opened_at, opening_cash, closed_at, counted_cash |
| `keg` | id, beer_name, capacity_ml, cost, received_at, status (IN_STOCK/TAPPED/EMPTY), tap_id, tapped_at, emptied_at |
| `tap` | id, name, current_keg_id |
| `audit_log` | id, actor_id, action, entity, entity_id, payload_json, created_at |

Quy tắc: `order_line` và `payment` chỉ thêm, không sửa/xóa; tổng tiền phiên = Σ(qty × unit_price) của các dòng (dòng VOID/DISCOUNT mang giá trị âm).

### 6.3 Danh sách API chính

| Nhóm | Endpoint |
|---|---|
| Auth | `POST /auth/pin`, `POST /auth/login`, `POST /auth/approve` (xác thực PIN quản lý) |
| Bàn | `GET /areas?include=tables`, `POST /tabs`, `POST /tabs/:id/move`, `POST /tabs/:id/merge` |
| Order | `POST /tabs/:id/rounds`, `POST /rounds/:id/reprint`, `POST /lines/:id/void`, `POST /lines/:id/discount` |
| Thanh toán | `POST /tabs/:id/provisional`, `POST /tabs/:id/pay`, `GET /tabs/:id/vietqr` |
| Ca | `POST /shifts/open`, `POST /shifts/:id/close` |
| Kho bia | `POST /kegs`, `GET /kegs`, `POST /taps/:id/change-keg` |
| Danh mục | CRUD `/menu-groups`, `/menu-items`, `/print-stations`, `/areas`, `/tables`, `/staff`, `/happy-hours` |
| Báo cáo | `GET /reports/today`, `/reports/keg-loss`, `/reports/voids`, `/reports/top-items`, `/reports/hourly` |

### 6.4 Màn hình (đầu vào cho mockup)

App quầy: Khóa PIN · Sơ đồ bàn · Panel phiên bàn (gọi món) · Hộp thoại duyệt PIN quản lý · Thanh toán · Vòi bia/Thay keg · Ca.
Web quản trị: Đăng nhập · Thực đơn · Trạm in · Khu & bàn · Nhân viên · Kho keg · Giờ vàng.
PWA: Dashboard hôm nay · Hao hụt keg · Nhật ký hủy/giảm · Món bán chạy & giờ cao điểm.

## 7. Ma trận truy vết yêu cầu (RTM)

Trạng thái: `Đề xuất` → `Đã duyệt` (G1) → `Đã thiết kế` (G2) → `Đã cài đặt` (G3) → `Đã kiểm thử` (G4) → `Đã nghiệm thu`.

| ID | Tên | Nhóm | Nguồn | Ưu tiên | Gói WBS | Phụ trách | Test case | Trạng thái |
|---|---|---|---|---|---|---|---|---|
| FR-01 | Đăng nhập PIN | App quầy | Phỏng vấn | M | 1.4.3 | Hiếu | TC-01 | Đề xuất |
| FR-02 | Sơ đồ bàn | App quầy | Phỏng vấn | M | 1.4.3 | Hiếu | TC-02 | Đề xuất |
| FR-03 | Mở phiên bàn | App quầy | Phỏng vấn | M | 1.4.3 | Hiếu | TC-03 | Đề xuất |
| FR-04 | Nhập lượt gọi & in phiếu | App quầy | Phỏng vấn | M | 1.4.3 | Hiếu | TC-04 | Đề xuất |
| FR-05 | Chuyển / gộp bàn | App quầy | Phỏng vấn | M | 1.4.3 | Trung | TC-05 | Đề xuất |
| FR-06 | Hủy / giảm có duyệt | App quầy | Phỏng vấn | M | 1.4.3 | Trung | TC-06 | Đề xuất |
| FR-07 | In tạm tính | App quầy | Phỏng vấn | M | 1.4.3 | Trung | TC-07 | Đề xuất |
| FR-08 | Thanh toán | App quầy | Phỏng vấn | M | 1.4.3 | Trung | TC-08 | Đề xuất |
| FR-09 | Mở / đóng ca | App quầy | Phỏng vấn | S | 1.4.3 | Trung | TC-09 | Đề xuất |
| FR-10 | Thay keg | App quầy | Phỏng vấn | M | 1.4.3 | Hiếu | TC-10 | Đề xuất |
| FR-11 | Thực đơn & trạm in | Web quản trị | Phỏng vấn | M | 1.4.4 | Thái | TC-11 | Đề xuất |
| FR-12 | Khu & bàn | Web quản trị | Phỏng vấn | M | 1.4.4 | Thái | TC-12 | Đề xuất |
| FR-13 | Nhân viên | Web quản trị | Phỏng vấn | M | 1.4.4 | Thái | TC-13 | Đề xuất |
| FR-14 | Nhập kho keg | Web quản trị | Phỏng vấn | M | 1.4.4 | Thái | TC-14 | Đề xuất |
| FR-15 | Giá giờ vàng | Web quản trị | Phỏng vấn | S | 1.4.4 | Thái | TC-15 | Đề xuất |
| FR-16 | Dashboard hôm nay | PWA | Phỏng vấn | M | 1.4.5 | Thái | TC-16 | Đề xuất |
| FR-17 | Hao hụt keg | PWA | Phỏng vấn | M | 1.4.5 | Tự | TC-17 | Đề xuất |
| FR-18 | Nhật ký hủy/giảm | PWA | Phỏng vấn | M | 1.4.5 | Thái | TC-18 | Đề xuất |
| FR-19 | Bán chạy & giờ cao điểm | PWA | Phỏng vấn | S | 1.4.5 | Thái | TC-19 | Đề xuất |
| FR-20 | Thông báo đẩy | PWA | Phỏng vấn | C | 1.4.5 | Tự | TC-20 | Đề xuất |
| FR-21 | Cài đặt PWA | PWA | Đề bài | M | 1.4.5 | Thái | TC-21 | Đề xuất |
| NFR-01..09 | Phi chức năng | Toàn hệ thống | Nhóm | M | 1.4.1, 1.5 | Tự / Trung | TC-N01..N09 | Đề xuất |

> Backend API cho mọi FR thuộc gói 1.4.2 (Tự phụ trách). Mỗi FR có thể chia nhỏ thành issue GitHub; issue phải ghi mã FR.

## 8. Dữ liệu demo

Seed: 3 khu, 80 bàn, 4 nhóm món / 30 món (trong đó 3 món bia hơi: cốc 0,5 L, ca 1,5 L, tháp 3 L), 2 trạm in, 2 vòi, 6 keg 50 L, 5 nhân viên (2 quầy, 1 quản lý ca, 1 chủ quán…), dữ liệu bán 7 ngày để báo cáo có số liệu, trong đó có 1 keg hao hụt 8%.

## 9. Giả định & ràng buộc

- Một quán duy nhất; không có nhiều chi nhánh.
- Luôn có mạng LAN giữa các máy quầy và máy chủ trong lúc demo.
- Xác nhận chuyển khoản do nhân viên kiểm tra thủ công.
- Máy in nhiệt có thể không có → in ra PDF thay thế.
- Thời gian: 8 tuần (19/10/2026 – 13/12/2026), 4 thành viên.
