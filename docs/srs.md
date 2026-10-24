# Đặc tả yêu cầu phần mềm (SRS): Hệ thống quản lý quầy nhà hàng bia hơi

> Nhóm 7 — môn Quản trị dự án — ĐH Bách Khoa
> Phiên bản: 0.1 (bản nháp để duyệt ở Gate G1) — 2026-10-24
> Người soạn: Phí Việt Hiếu (phụ trách yêu cầu & thiết kế), Nguyễn Xuân Tự
> Tài liệu liên quan: `ke-hoach-quan-ly-du-an.md` (kế hoạch quản lý dự án), `tam-nhin.md` (hướng phát triển — ngoài phạm vi)

## 1. Giới thiệu

### 1.1 Mục đích

Tài liệu mô tả yêu cầu của hệ thống quản lý quầy cho một nhà hàng bia hơi. Đây là đầu vào cho các pha Thiết kế, Cài đặt, Kiểm thử, và là căn cứ nghiệm thu sản phẩm. Cùng với WBS trong kế hoạch dự án, tài liệu này tạo thành *scope baseline*.

### 1.2 Bối cảnh nghiệp vụ

Một nhà hàng bia hơi đông khách có nhiều bàn chia theo khu (trong nhà, sân, tầng 2). Phục vụ nhận yêu cầu tại bàn rồi báo về **quầy**. Nhân viên quầy nhập order, in phiếu cho bếp và người rót bia, cuối bữa tính tiền. Khi làm bằng giấy, các vấn đề thường gặp là:

- Sót món, ra nhầm bàn giờ cao điểm.
- Tính tiền chậm và sai khi gộp/chuyển bàn.
- Thất thoát bia hơi: không đối chiếu được lượng bia trong keg (bom) với số cốc đã bán.
- Hủy món tùy tiện, chủ quán không kiểm soát được.

### 1.3 Phương pháp thu thập yêu cầu

Nhóm thu thập yêu cầu bằng **nghiên cứu tài liệu** (document analysis), gồm:

1. **Phân tích phần mềm tương tự:** tài liệu hướng dẫn và video demo của một số phần mềm quản lý bán hàng cho nhà hàng/quán nhậu đang phổ biến tại Việt Nam (KiotViet, iPOS, Sapo FnB, CukCuk). Mục tiêu là rút ra các chức năng phổ biến và cách tổ chức màn hình.
2. **Tài liệu & bài viết về vận hành quán bia hơi:** quy trình gọi món, rót bia theo keg, các hình thức thất thoát thường gặp.
3. **Bản mẫu giao diện (prototype):** dùng để cả nhóm thống nhất cách hiểu yêu cầu trước khi duyệt.

Kết quả nghiên cứu được ghi trong `docs/nghien-cuu-yeu-cau.md` (Hiếu phụ trách) và là nguồn của từng yêu cầu trong RTM (mục 8).

### 1.4 Phạm vi sản phẩm

Sản phẩm là **một web app duy nhất có phân quyền**, chạy trên trình duyệt (máy tính ở quầy, laptop, điện thoại). Giao diện và chức năng hiển thị theo vai trò người đăng nhập.

| Phân hệ | Vai trò sử dụng | Nội dung |
|---|---|---|
| **Quầy** | Nhân viên quầy, Quản lý ca | Sơ đồ bàn, gọi món, in phiếu, chuyển/gộp bàn, hủy/giảm có duyệt, tạm tính, thanh toán, ca, thay keg |
| **Quản trị** | Chủ quán | Thực đơn, khu & bàn, nhân viên & phân quyền, kho keg, giá giờ vàng |
| **Báo cáo** | Chủ quán (Quản lý ca xem một phần) | Dashboard doanh thu, hao hụt keg, nhật ký hủy/giảm, món bán chạy & giờ cao điểm |

**Ngoài phạm vi** (xem `tam-nhin.md`): ứng dụng desktop riêng, app di động / PWA, chạy offline, máy in nhiệt chuyên dụng (chỉ in qua trình duyệt), hóa đơn điện tử, tự xác nhận chuyển khoản qua ngân hàng, nhiều chi nhánh, app cho phục vụ, khách tự order bằng QR, màn hình bếp, định lượng nguyên liệu, đặt bàn, combo, tách bill theo người, thông báo đẩy.

### 1.5 Thuật ngữ

| Thuật ngữ | Nghĩa |
|---|---|
| Khu | Nhóm bàn theo vị trí (Trong nhà, Sân, Tầng 2) |
| Phiên bàn | Một lượt khách ngồi từ lúc mở bàn đến lúc thanh toán = một hóa đơn |
| Lượt gọi | Một lần nhập order cho một phiên bàn, có thể gồm nhiều món |
| Khu chế biến | Nơi nhận phiếu: Quầy rót bia, Bếp nướng, Bếp chiên… |
| Keg | Thùng/bom bia hơi (30 L, 50 L) |
| Vòi | Vòi rót bia, mỗi lúc gắn một keg |
| Tạm tính | Hóa đơn in cho khách xem trước khi thanh toán |
| PIN duyệt | Mã 4–6 chữ số của Quản lý ca, dùng để duyệt hủy/giảm |

### 1.6 Mức ưu tiên (MoSCoW)

- **M (Must):** bắt buộc cho bản demo cuối kỳ; thiếu là không nghiệm thu.
- **S (Should):** nên có; cắt được nếu trễ tiến độ (qua quy trình kiểm soát thay đổi).
- **C (Could):** làm nếu dư thời gian.

## 2. Tác nhân & phân quyền

### 2.1 Tác nhân

| Mã | Tác nhân | Mô tả |
|---|---|---|
| AC1 | Nhân viên quầy | Nhập order, in phiếu, tính tiền |
| AC2 | Quản lý ca | Như AC1 + duyệt hủy/giảm, đóng ca, xem báo cáo trong ngày |
| AC3 | Chủ quán | Toàn quyền: cấu hình hệ thống, xem mọi báo cáo |

### 2.2 Ma trận phân quyền

✔ = được phép · ◐ = được phép có điều kiện · — = không được phép

| Chức năng | Nhân viên quầy | Quản lý ca | Chủ quán |
|---|---|---|---|
| Sơ đồ bàn, mở bàn, gọi món, in phiếu | ✔ | ✔ | ✔ |
| Chuyển / gộp bàn | ✔ | ✔ | ✔ |
| Hủy / giảm món sau khi gửi | ◐ cần PIN Quản lý ca | ✔ | ✔ |
| Tạm tính, thanh toán | ✔ | ✔ | ✔ |
| Giảm giá cả hóa đơn | ◐ cần PIN Quản lý ca | ✔ | ✔ |
| Mở ca | ✔ | ✔ | ✔ |
| Đóng ca | — | ✔ | ✔ |
| Thay keg | ✔ | ✔ | ✔ |
| Quản trị thực đơn, khu & bàn, giờ vàng | — | — | ✔ |
| Quản trị nhân viên & phân quyền | — | — | ✔ |
| Nhập kho keg | — | ✔ | ✔ |
| Báo cáo trong ngày (dashboard, nhật ký hủy) | — | ✔ | ✔ |
| Báo cáo theo khoảng ngày, hao hụt keg | — | — | ✔ |

Quyền được kiểm tra ở cả giao diện (ẩn menu) và CSDL (Row Level Security), không chỉ ẩn trên giao diện.

## 3. Danh sách use case

| Mã UC | Tên | Tác nhân | Ưu tiên |
|---|---|---|---|
| UC01 | Đăng nhập / đăng xuất | AC1, AC2, AC3 | M |
| UC02 | Xem sơ đồ bàn theo khu | AC1 | M |
| UC03 | Mở phiên bàn | AC1 | M |
| UC04 | Nhập lượt gọi món & in phiếu | AC1 | M |
| UC05 | Chuyển bàn / gộp bàn | AC1 | M |
| UC06 | Hủy hoặc giảm món sau khi đã gửi (cần duyệt) | AC1, AC2 | M |
| UC07 | In tạm tính | AC1 | M |
| UC08 | Thanh toán (tiền mặt / chuyển khoản VietQR) | AC1 | M |
| UC09 | Mở / đóng ca | AC1, AC2 | S |
| UC10 | Thay keg tại vòi | AC1 | M |
| UC11 | Quản lý thực đơn & khu chế biến | AC3 | M |
| UC12 | Quản lý khu & bàn | AC3 | M |
| UC13 | Quản lý nhân viên & phân quyền | AC3 | M |
| UC14 | Nhập kho keg | AC2, AC3 | M |
| UC15 | Cấu hình giá giờ vàng | AC3 | S |
| UC16 | Xem dashboard doanh thu hôm nay | AC2, AC3 | M |
| UC17 | Xem báo cáo hao hụt keg | AC3 | M |
| UC18 | Xem nhật ký hủy/giảm | AC2, AC3 | M |
| UC19 | Xem món bán chạy & giờ cao điểm | AC3 | S |

Đặc tả chi tiết từng use case (luồng chính, luồng thay thế, tiền/hậu điều kiện) nằm trong `docs/use-case.md` (Hiếu phụ trách, hoàn thành trước G1).

## 4. Yêu cầu chức năng

Mỗi yêu cầu có mã `FR-xx`, liên kết use case và **tiêu chí nghiệm thu (AC)**. Một yêu cầu chỉ được coi là xong khi mọi AC đều đạt trong kiểm thử.

### 4.1 Phân hệ Quầy

**FR-01 Đăng nhập (UC01, M)**
- Đăng nhập bằng email + mật khẩu. Sau khi đăng nhập, menu hiển thị theo vai trò (mục 2.2).
- AC: tài khoản bị khóa không đăng nhập được. Truy cập trực tiếp URL của chức năng không có quyền thì bị chuyển về trang "Không có quyền truy cập". Mọi thao tác ghi lại người thực hiện.

**FR-02 Sơ đồ bàn (UC02, M)**
- Mỗi khu là một tab; bàn hiển thị dạng lưới ô vuông theo thứ tự cấu hình.
- Mỗi ô: số bàn, tổng tiền tạm tính, thời gian đã ngồi.
- Màu trạng thái: xám = trống; xanh = đang ngồi; vàng = đã in tạm tính.
- AC: thay đổi do một máy khác tạo hiện trên sơ đồ trong ≤ 3 giây, không cần tải lại trang. Hiển thị được 80 bàn trên màn hình 1366×768 mà không cuộn ngang.

**FR-03 Mở phiên bàn (UC03, M)**
- Bấm bàn trống → mở phiên (tùy chọn nhập số khách).
- AC: một bàn chỉ có tối đa 1 phiên đang mở. Hai máy cùng mở một bàn → máy sau nhận thông báo "Bàn đã được mở" và vào phiên đó.

**FR-04 Nhập lượt gọi món & in phiếu (UC04, M)**
- Panel phiên bàn gồm: lưới nút món theo nhóm (Bia, Đồ nướng, Đồ chiên…), ô tìm món theo tên hoặc mã tắt (vd `b` = bia hơi cốc), danh sách món của lượt đang nhập với nút +/–.
- Bấm "Gửi" → lưu lượt gọi, tách món theo khu chế biến, mở hộp thoại in của trình duyệt với mỗi khu một phiếu khổ 80 mm: số bàn, giờ, tên nhân viên, món & số lượng, ghi chú.
- Giá được **chốt tại thời điểm gửi**. Nếu có giờ vàng thì áp giá giờ vàng theo giờ gửi.
- AC: nhập và gửi một lượt 3 món trong ≤ 10 giây với người đã quen. Lượt đã gửi không sửa trực tiếp được, chỉ hủy qua FR-06. Có nút "In lại phiếu" cho lượt đã gửi.

**FR-05 Chuyển / gộp bàn (UC05, M)**
- Chuyển: chọn bàn đích đang trống → toàn bộ phiên chuyển sang.
- Gộp: chọn bàn đích đang có phiên → các món của bàn nguồn nhập vào phiên đích; bàn nguồn trở về trống.
- AC: tổng tiền sau gộp = tổng hai phiên trước gộp. Lịch sử ghi lại thao tác chuyển/gộp (ai, lúc nào, từ đâu đến đâu).

**FR-06 Hủy / giảm món sau khi gửi (UC06, M)**
- Chọn món trong lượt đã gửi → "Hủy" (chọn số lượng) hoặc "Giảm giá" (% hoặc số tiền).
- Bắt buộc chọn lý do (Khách đổi ý, Bếp hết món, Nhập nhầm, Món lỗi, Khác + ghi chú). Nếu người thao tác là Nhân viên quầy thì phải **nhập PIN duyệt của Quản lý ca**.
- Hủy món không xóa dữ liệu mà tạo dòng điều chỉnh âm.
- AC: nhân viên quầy không thể hoàn tất nếu thiếu PIN đúng. Mỗi lần hủy/giảm tạo một bản ghi nhật ký gồm món, số lượng, số tiền, lý do, người yêu cầu, người duyệt, thời điểm. Bỏ món khi đang nhập (chưa gửi) thì không cần duyệt.

**FR-07 In tạm tính (UC07, M)**
- In hóa đơn tạm tính, gộp các món cùng tên và cùng đơn giá (vd "Bia hơi cốc ×10").
- AC: không giới hạn số lần in; mỗi bản ghi "Tạm tính — lần in N — HH:mm". Sau khi in, bàn chuyển vàng nhưng vẫn gọi thêm món được.

**FR-08 Thanh toán (UC08, M)**
- Màn thanh toán: tổng tiền, giảm giá cả hóa đơn (theo quyền ở mục 2.2), chọn phương thức:
  - Tiền mặt: nhập tiền khách đưa → hiển thị tiền thừa.
  - Chuyển khoản: hiển thị **mã VietQR** sinh từ tài khoản ngân hàng của quán, kèm số tiền và nội dung `BH<mã hóa đơn>`. Nhân viên kiểm tra rồi bấm "Đã nhận tiền".
  - Có thể kết hợp hai phương thức.
- Hoàn tất → in hóa đơn, đóng phiên, bàn về trống.
- AC: không thể đóng phiên khi số tiền nhận nhỏ hơn tổng phải trả. Mã QR quét được bằng app ngân hàng thật và điền đúng số tiền. Hóa đơn đã thanh toán không sửa được.

**FR-09 Mở / đóng ca (UC09, S)**
- Mở ca: nhập tiền đầu ca. Đóng ca (Quản lý ca): tổng hợp doanh thu theo phương thức trong ca; nhập tiền mặt thực đếm → hiện chênh lệch.
- AC: báo cáo đóng ca in được và xem lại được trong phân hệ Báo cáo.

**FR-10 Thay keg (UC10, M)**
- Màn "Vòi bia": danh sách vòi và keg đang gắn. Bấm "Thay keg" → chọn keg mới từ kho → keg cũ chuyển trạng thái "Đã hết".
- Mỗi món bia hơi khai báo thể tích (cốc 0,5 L; ca 1,5 L; tháp 3 L) và vòi mặc định. Khi bán, thể tích được cộng dồn vào keg đang gắn ở vòi đó.
- AC: báo cáo hao hụt (FR-17) tính đúng cho keg vừa thay ra.

### 4.2 Phân hệ Quản trị

**FR-11 Thực đơn & khu chế biến (UC11, M)**
- Thêm/sửa/ẩn nhóm món và món: tên, mã tắt, giá, đơn vị, khu chế biến, thể tích bia và vòi mặc định (nếu là bia hơi), trạng thái còn/hết.
- Thêm/sửa khu chế biến (tên).
- AC: món "hết" hiển thị mờ và không bấm được ở phân hệ Quầy. Đổi giá không ảnh hưởng các lượt gọi đã gửi.

**FR-12 Khu & bàn (UC12, M)**
- Thêm/sửa/xóa khu; thêm/sửa/xóa bàn (số bàn, khu, thứ tự hiển thị).
- AC: không xóa được bàn đang có phiên mở.

**FR-13 Nhân viên & phân quyền (UC13, M)**
- Tạo tài khoản nhân viên: họ tên, email, vai trò (Nhân viên quầy / Quản lý ca / Chủ quán), PIN duyệt (với Quản lý ca), trạng thái hoạt động.
- AC: đổi vai trò có hiệu lực từ lần đăng nhập tiếp theo. Tài khoản bị khóa không đăng nhập được. Không thể tự khóa chính mình hoặc xóa chủ quán cuối cùng.

**FR-14 Nhập kho keg (UC14, M)**
- Nhập keg: loại bia, dung tích (L), giá nhập, ngày nhập, số lượng (tạo nhiều keg cùng lúc). Danh sách keg theo trạng thái: Trong kho / Đang dùng / Đã hết.
- AC: keg chỉ được gắn vào vòi khi đang ở trạng thái Trong kho.

**FR-15 Giá giờ vàng (UC15, S)**
- Khai báo khung giờ (các thứ trong tuần, giờ bắt đầu – kết thúc) và giá riêng cho từng món trong khung đó.
- AC: lượt gọi gửi trong khung giờ dùng giá giờ vàng, ngoài khung dùng giá thường. Hóa đơn tách 2 dòng nếu cùng món nhưng khác giá.

### 4.3 Phân hệ Báo cáo

**FR-16 Dashboard hôm nay (UC16, M)**
- Doanh thu đã thu, tạm tính đang mở, số bàn đang ngồi / tổng bàn, số hóa đơn, so sánh với cùng thời điểm hôm qua.
- AC: số liệu tự làm mới mỗi 30 giây và khớp tổng hóa đơn trong CSDL. Hiển thị tốt trên điện thoại (chiều ngang 375 px).

**FR-17 Hao hụt keg (UC17, M)**
- Mỗi keg đã hết: dung tích, thể tích đã bán (L), hao hụt (L) = dung tích − đã bán, tỉ lệ %, thời gian sử dụng. Tô đỏ keg vượt ngưỡng (mặc định 5%, cấu hình được).
- AC: với dữ liệu mẫu (keg 50 L, bán 92 cốc 0,5 L), báo cáo hiển thị hao hụt 4 L = 8% và tô đỏ.

**FR-18 Nhật ký hủy/giảm (UC18, M)**
- Danh sách theo ngày, lọc theo nhân viên / người duyệt / lý do; tổng tiền bị hủy/giảm.
- AC: mọi bản ghi từ FR-06 và giảm giá hóa đơn ở FR-08 đều xuất hiện.

**FR-19 Món bán chạy & giờ cao điểm (UC19, S)**
- Top 10 món theo số lượng/doanh thu trong khoảng ngày; biểu đồ doanh thu theo giờ trong ngày.
- AC: khoảng ngày tối đa 31 ngày; tải xong trong ≤ 3 giây với dữ liệu demo.

## 5. Yêu cầu phi chức năng

| Mã | Yêu cầu | Cách kiểm tra |
|---|---|---|
| NFR-01 | Hiệu năng: mỗi thao tác ở phân hệ Quầy phản hồi ≤ 1 giây với 80 bàn đang mở | Đo thủ công trên dữ liệu demo |
| NFR-02 | Đồng thời: tối thiểu 3 máy cùng thao tác; cập nhật lẫn nhau ≤ 3 giây | Kiểm thử thủ công 3 trình duyệt |
| NFR-03 | Dễ dùng: người mới tự nhập & gửi lượt gọi đầu tiên trong ≤ 5 phút không cần hướng dẫn | Thử với 2 người ngoài nhóm |
| NFR-04 | Toàn vẹn dữ liệu: lượt gọi, hóa đơn đã thanh toán, nhật ký không bị xóa/sửa; tiền lưu bằng số nguyên VND | Rà soát CSDL |
| NFR-05 | Bảo mật: phân quyền bằng Row Level Security; PIN lưu dạng băm; không lộ khóa bí mật ở frontend | Kiểm thử phân quyền |
| NFR-06 | Giao diện tiếng Việt; phân hệ Quầy dùng tốt trên màn hình máy tính ≥ 1366×768, nút chính ≥ 44×44 px; phân hệ Báo cáo dùng được trên điện thoại | Rà soát UI |
| NFR-07 | Tương thích: Chrome và Edge bản mới nhất | Kiểm thử trên 2 trình duyệt |
| NFR-08 | Triển khai: truy cập được qua một đường dẫn công khai để demo | Mở từ máy ngoài mạng nhóm |

## 6. Thiết kế sơ bộ (đầu vào cho pha Thiết kế)

### 6.1 Kiến trúc & công nghệ

```
[Trình duyệt: máy quầy / laptop chủ quán / điện thoại]
        │  HTTPS
        ▼
[Web app React + Vite + TypeScript]  ── triển khai trên Vercel/Netlify (gói miễn phí)
        │  supabase-js
        ▼
[Supabase: Auth · PostgreSQL + Row Level Security · Realtime · hàm RPC]
```

- **Frontend:** React + Vite + TypeScript, React Router, thư viện giao diện (vd shadcn/ui hoặc Ant Design), thư viện sinh QR (VietQR theo chuẩn EMVCo), Recharts cho biểu đồ.
- **Backend:** Supabase. *Auth* lo đăng nhập. *PostgreSQL* với *Row Level Security* lo phân quyền theo vai trò. *Realtime* để sơ đồ bàn tự cập nhật. *Hàm RPC (Postgres function)* xử lý các thao tác cần toàn vẹn: gửi lượt gọi, gộp bàn, hủy có duyệt PIN, thanh toán, thay keg.
- **In ấn:** trang in riêng với CSS `@media print` khổ 80 mm, gọi `window.print()`.
- **Mã nguồn:** thư mục `web/` trong repo GitHub; migration CSDL trong `supabase/migrations/`.

### 6.2 Mô hình dữ liệu (thực thể chính)

| Bảng | Trường chính |
|---|---|
| `profiles` | id (= auth user), full_name, role (COUNTER / SHIFT_MANAGER / OWNER), pin_hash, active |
| `areas` | id, name, sort_order |
| `dining_tables` | id, area_id, code, sort_order |
| `kitchen_stations` | id, name |
| `menu_groups` | id, name, sort_order |
| `menu_items` | id, group_id, name, shortcut, price, unit, station_id, beer_volume_ml, default_tap_id, available |
| `happy_hours` / `happy_hour_prices` | khung giờ; giá theo món |
| `tabs` | id, table_id, opened_at, opened_by, guest_count, status (OPEN / PAID), closed_at |
| `order_rounds` | id, tab_id, created_at, created_by |
| `order_lines` | id, round_id, item_id, qty, unit_price, line_type (NORMAL / VOID / DISCOUNT), ref_line_id, reason, approved_by |
| `payments` | id, tab_id, method (CASH / TRANSFER), amount, received_by, created_at |
| `bill_prints` | id, tab_id, kind (PROVISIONAL / FINAL), print_no, printed_at |
| `shifts` | id, staff_id, opened_at, opening_cash, closed_at, counted_cash |
| `kegs` | id, beer_name, capacity_ml, cost, received_at, status (IN_STOCK / TAPPED / EMPTY), tap_id, tapped_at, emptied_at |
| `taps` | id, name, current_keg_id |
| `audit_logs` | id, actor_id, action, entity, entity_id, payload, created_at |

Quy tắc: `order_lines` và `payments` chỉ thêm, không sửa/xóa. Tổng tiền phiên = Σ(qty × unit_price) của các dòng; dòng VOID/DISCOUNT mang giá trị âm.

### 6.3 Danh sách màn hình (đầu vào cho đặc tả màn hình)

| Phân hệ | Màn hình |
|---|---|
| Chung | Đăng nhập · Khung ứng dụng (menu theo vai trò) · Không có quyền truy cập |
| Quầy | Sơ đồ bàn · Phiên bàn (gọi món) · Hộp thoại duyệt PIN · Thanh toán · Trang in phiếu / tạm tính / hóa đơn · Vòi bia & thay keg · Ca |
| Quản trị | Thực đơn · Khu chế biến · Khu & bàn · Nhân viên · Kho keg · Giờ vàng |
| Báo cáo | Dashboard hôm nay · Hao hụt keg · Nhật ký hủy/giảm · Món bán chạy & giờ cao điểm · Báo cáo ca |

## 7. Dữ liệu demo

Seed gồm: 3 khu, 80 bàn, 4 nhóm món / 30 món (trong đó 3 món bia hơi: cốc 0,5 L, ca 1,5 L, tháp 3 L), 3 khu chế biến, 2 vòi, 6 keg 50 L, 5 tài khoản (2 nhân viên quầy, 1 quản lý ca, 1 chủ quán, 1 tài khoản bị khóa), dữ liệu bán 7 ngày để báo cáo có số liệu, trong đó có 1 keg hao hụt 8%.

## 8. Ma trận truy vết yêu cầu (RTM)

Trạng thái: `Đề xuất` → `Đã duyệt` (G1) → `Đã thiết kế` (G2) → `Đã cài đặt` (G3) → `Đã kiểm thử` (G4) → `Đã nghiệm thu`.

Nguồn: **PM** = phân tích phần mềm tương tự · **TL** = tài liệu vận hành quán bia · **ĐB** = đề bài · **N** = nhóm đề xuất

| ID | Tên | Phân hệ | Nguồn | Ưu tiên | Gói WBS | Đặc tả | Cài đặt | Test case | Trạng thái |
|---|---|---|---|---|---|---|---|---|---|
| FR-01 | Đăng nhập & phân quyền | Quầy | PM | M | 1.4.1 | Hiếu | Tự | TC-01 | Đề xuất |
| FR-02 | Sơ đồ bàn | Quầy | PM, ĐB | M | 1.4.2 | Hiếu | Tự | TC-02 | Đề xuất |
| FR-03 | Mở phiên bàn | Quầy | PM | M | 1.4.2 | Hiếu | Tự | TC-03 | Đề xuất |
| FR-04 | Gọi món & in phiếu | Quầy | PM, TL | M | 1.4.2 | Hiếu | Tự | TC-04 | Đề xuất |
| FR-05 | Chuyển / gộp bàn | Quầy | PM, TL | M | 1.4.2 | Hiếu | Tự | TC-05 | Đề xuất |
| FR-06 | Hủy / giảm có duyệt | Quầy | TL | M | 1.4.2 | Hiếu | Tự | TC-06 | Đề xuất |
| FR-07 | In tạm tính | Quầy | PM, TL | M | 1.4.2 | Hiếu | Tự | TC-07 | Đề xuất |
| FR-08 | Thanh toán & VietQR | Quầy | PM | M | 1.4.2 | Hiếu | Tự | TC-08 | Đề xuất |
| FR-09 | Mở / đóng ca | Quầy | PM | S | 1.4.2 | Hiếu | Tự | TC-09 | Đề xuất |
| FR-10 | Thay keg | Quầy | TL | M | 1.4.2 | Hiếu | Tự | TC-10 | Đề xuất |
| FR-11 | Thực đơn & khu chế biến | Quản trị | PM | M | 1.4.3 | Hiếu | Tự | TC-11 | Đề xuất |
| FR-12 | Khu & bàn | Quản trị | PM | M | 1.4.3 | Hiếu | Tự | TC-12 | Đề xuất |
| FR-13 | Nhân viên & phân quyền | Quản trị | PM, ĐB | M | 1.4.3 | Hiếu | Tự | TC-13 | Đề xuất |
| FR-14 | Nhập kho keg | Quản trị | TL | M | 1.4.3 | Hiếu | Tự | TC-14 | Đề xuất |
| FR-15 | Giá giờ vàng | Quản trị | TL | S | 1.4.3 | Hiếu | Tự | TC-15 | Đề xuất |
| FR-16 | Dashboard hôm nay | Báo cáo | PM | M | 1.4.4 | Hiếu | Tự | TC-16 | Đề xuất |
| FR-17 | Hao hụt keg | Báo cáo | TL | M | 1.4.4 | Hiếu | Tự | TC-17 | Đề xuất |
| FR-18 | Nhật ký hủy/giảm | Báo cáo | TL | M | 1.4.4 | Hiếu | Tự | TC-18 | Đề xuất |
| FR-19 | Bán chạy & giờ cao điểm | Báo cáo | PM | S | 1.4.4 | Hiếu | Tự | TC-19 | Đề xuất |
| NFR-01..08 | Phi chức năng | Toàn hệ thống | N | M | 1.4, 1.5 | Hiếu | Tự | TC-N01..N08 | Đề xuất |

Test case do Trung viết và thực hiện. Cột Trạng thái được cập nhật ở mỗi Gate.

## 9. Giả định & ràng buộc

- Một quán duy nhất; không có nhiều chi nhánh.
- Máy quầy luôn có kết nối Internet trong lúc sử dụng và demo.
- Xác nhận chuyển khoản do nhân viên kiểm tra thủ công.
- In qua hộp thoại in của trình duyệt (máy in thường hoặc lưu PDF).
- Dùng gói miễn phí của Supabase và Vercel/Netlify.
- Thời gian: 26/10/2026 – 13/12/2026, 4 thành viên.
