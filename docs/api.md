# Đặc tả API chi tiết

> Việc BE-D2 (WBS 1.3.2), hạn 10/11/2026. Mở rộng từ SRS v0.2 mục 7. Người soạn: Phí Việt Hiếu (backend).
> Bảng và cột nhắc tới ở đây: xem [`thiet-ke-csdl.md`](thiet-ke-csdl.md). Danh sách đầy đủ request của mọi API: mục 4.
> Đường dẫn và quyền **giữ nguyên** như bảng SRS 7.2. Tài liệu này ghi thêm những chỗ SRS chưa nói rõ: dạng response, mã lỗi bổ sung, quy tắc tính toán.
> Muốn đổi API: thống nhất backend–frontend rồi sửa file này trước khi code.

## 1. Quy ước chung

Theo SRS 7.1. Bổ sung:

- **Giờ Việt Nam (UTC+7)** dùng cho mọi phép "hôm nay", giờ vàng, doanh thu theo giờ; tham số ngày `from`/`to` dạng `YYYY-MM-DD`, tính cả hai đầu.
- Lỗi kiểm tra dữ liệu: `400 VALIDATION_ERROR`, `details` là mảng `{ path, message }`.
- Thành công không có nội dung (xóa): `204`.

### Mã lỗi bổ sung

| HTTP | `code` | Khi nào |
|---|---|---|
| 401 | `INVALID_CREDENTIALS` | Sai email hoặc mật khẩu ("Email hoặc mật khẩu không đúng") |
| 403 | `ACCOUNT_LOCKED` | Tài khoản bị khóa |
| 400 | `PIN_REQUIRED` | Nhân viên quầy hủy/giảm mà không gửi `approverPin` |
| 400 | `QTY_EXCEEDED` | Hủy nhiều hơn số lượng còn lại (`details.remainingQty`) |
| 400 | `DISCOUNT_EXCEEDED` | Giảm nhiều hơn tiền còn lại của món |
| 400 | `OVERPAID_TRANSFER` | Chuyển khoản vượt số phải trả (tiền thừa chỉ trả bằng tiền mặt) |
| 400 | `SAME_TABLE` | Chuyển/gộp vào chính bàn đó |
| 400 | `RANGE_TOO_LARGE` | Báo cáo bán chạy/theo giờ quá 31 ngày |
| 400 | `CANNOT_LOCK_SELF` | Tự khóa tài khoản của mình |
| 409 | `TABLE_EMPTY` | Gộp vào bàn đang trống (phải dùng Chuyển) |
| 409 | `TAB_NOT_OPEN` | Thao tác trên phiên đã thanh toán / đã gộp |
| 409 | `ITEM_UNAVAILABLE` | Gửi món đang "Hết món" |
| 409 | `KEG_NOT_IN_STOCK` | Thay keg bằng keg không ở trạng thái "Trong kho" |
| 409 | `AREA_NOT_EMPTY` | Xóa khu còn bàn |
| 409 | `DUPLICATE_TABLE_CODE`, `DUPLICATE_EMAIL` | Trùng số bàn / email |
| 409 | `LAST_OWNER` | Hạ quyền hoặc khóa chủ quán cuối cùng |
| 409 | `SHIFT_ALREADY_CLOSED` | Đóng ca đã đóng |

## 2. Duyệt bằng PIN

Áp dụng cho `POST /order-lines/:id/void`, `POST /order-lines/:id/discount` và giảm giá hóa đơn trong `POST /tabs/:id/pay`.

- Người gọi là `SHIFT_MANAGER`/`OWNER` → tự duyệt, bỏ qua `approverPin`.
- Người gọi là `COUNTER` → bắt buộc `approverPin` (4–6 số) khớp PIN của một Quản lý ca/Chủ quán đang hoạt động; người đó được ghi là người duyệt.

## 3. Response các API chính

### Phiên bàn

`GET /api/tabs/summary` — như SRS 7.3; mỗi bàn có thêm `guestCount`. Trạng thái: `EMPTY`, `OCCUPIED`, `PROVISIONAL_PRINTED` (đã in tạm tính ít nhất 1 lần).

`GET /api/tabs/:id`

```json
{
  "id": 302, "billNo": "HD-20261120-0302", "status": "OPEN",
  "table": { "id": 13, "code": "13", "areaId": 1, "areaName": "Trong nhà" },
  "guestCount": 6, "openedAt": "...", "openedBy": { "id": 2, "fullName": "Nguyễn Thị Lan" },
  "closedAt": null, "mergedIntoId": null, "provisionalCount": 1,
  "subtotal": 85000, "billDiscount": 0, "total": 85000,
  "rounds": [{
    "id": 901, "createdAt": "...", "createdBy": { "id": 2, "fullName": "Nguyễn Thị Lan" },
    "lines": [
      { "id": 5502, "menuItemId": 1, "name": "Bia hơi cốc 0,5L", "unit": "cốc", "stationId": 1, "stationName": "Quầy rót bia",
        "qty": 4, "unitPrice": 15000, "amount": 60000, "note": null, "lineType": "NORMAL", "refLineId": null,
        "remainingQty": 4, "discountAmount": 0, "netAmount": 60000, "reason": null, "requestedBy": null, "approvedBy": null, "createdAt": "..." }
    ]
  }]
}
```

- `status`: `OPEN` · `PAID` · `MERGED` (đã gộp sang phiên `mergedIntoId`).
- `billNo` = `HD-<ngày mở bàn>-<id phiên 4 số>`, biết trước để in vào nội dung VietQR; chính thức khi thanh toán.
- Dòng `NORMAL` có thêm `remainingQty` (sau hủy), `discountAmount`, `netAmount`. Dòng `VOID`/`DISCOUNT` nằm cùng lượt với dòng gốc, `refLineId` trỏ về dòng gốc.

`POST /api/tabs/:id/move` · `POST /api/tabs/:id/merge` — body `{ "targetTableId": 40 }`.
Move trả `{ tabId, tableId, tableCode }`; merge trả `{ targetTabId, tableId, tableCode, tabTotal }`.

`POST /api/order-lines/:id/discount` — body `{ "type": "PERCENT" | "AMOUNT", "value": 10, "reason": "...", "note": null, "approverPin": "1234" }`. Tạo dòng `DISCOUNT` với `qty = 1`, `unitPrice = −số tiền giảm`. `%` tính trên tiền còn lại của món.

Void/discount trả dòng vừa tạo như SRS 7.3, kèm `tabTotal`.

`POST /api/tabs/:id/provisional` — trả hóa đơn:

```json
{ "tabId": 302, "billNo": "HD-20261120-0302", "tableCode": "13", "areaName": "Trong nhà", "guestCount": 6, "openedAt": "...",
  "lines": [ { "name": "Bia hơi cốc 0,5L", "qty": 10, "unitPrice": 15000, "amount": 150000, "discount": 0 } ],
  "subtotal": 150000, "discount": 0, "total": 150000,
  "kind": "PROVISIONAL", "printNo": 2, "printedAt": "...", "printedBy": "Nguyễn Thị Lan" }
```

Dòng gộp theo (món, đơn giá); món hủy hết không hiện; `amount` là tiền sau giảm.

### Thanh toán

`GET /api/tabs/:id/vietqr?amount=` — `amount` bỏ trống = tổng hiện tại. Trả `{ url, amount, addInfo, billNo, bank, account, accountName }`; `addInfo` = `BH` + phần số của số hóa đơn (vd `BH202611200302`).

`POST /api/tabs/:id/pay` — như SRS 7.3. `billDiscount` có thể thêm `reason` (mặc định `OTHER`) và `note`. Quy tắc:

- `discount` = `round(subtotal × value / 100)` hoặc `value`, không vượt `subtotal`.
- Tổng nhận < phải trả → `INSUFFICIENT_PAYMENT`. Tiền thừa chỉ trả từ phần tiền mặt.
- `Payment.amount` lưu **số thực thu** (tiền mặt đã trừ tiền thừa), nên Σ Payment = doanh thu.
- Response thêm `payments` (đã lưu), `cashier`, `tableCode`, `areaName`, `openedAt`, `kind: "FINAL"`.

### Ca

`GET /api/shifts/current` trả `null` khi chưa mở ca. Mỗi ca:
`{ id, staff, openedAt, openingCash, closedAt, closedBy, countedCash, cashSales, transferSales, expectedCash, difference, status }`
với `expectedCash = openingCash + cashSales`, `difference = countedCash − expectedCash`.

### Vòi & keg

`GET /api/taps` — `{ taps: [{ id, name, currentKeg: { id, code, beerName, capacityMl, tappedAt, soldMl, percent } | null }], inStockKegs: [...] }`.
`inStockKegs` để nhân viên quầy chọn keg khi thay (họ không có quyền gọi `GET /kegs`).

`POST /api/taps/:id/change-keg` — body `{ "kegId": 9 }`. Keg cũ → `EMPTY`, chốt `soldMl`; keg mới → `TAPPED`.

`GET /api/kegs?status=` — `{ summary: { inStock, tapped, empty }, items: [...] }`.
`POST /api/kegs` — body `{ beerName, capacityMl: 30000 | 50000, cost, receivedAt: "YYYY-MM-DD", quantity }`, trả mảng keg vừa tạo (mã `KEG-xxxx`).

**Số ml đã bán của keg** = Σ `qty × beerVolumeMl` của các dòng `NORMAL`/`VOID` gắn keg đó (keg gắn trên vòi mặc định của món lúc gửi).

### Báo cáo

- `GET /reports/today` — `revenue`, `openAmount`, `occupiedTables` (+`total`), `bills`: mỗi cái `{ value, yesterday, changePercent }` (so với cùng giờ hôm qua; `null` nếu hôm qua = 0). `hourly`: 24 phần tử `{ hour, today, yesterday }`. `paymentSplit: { cash, transfer }`.
- `GET /reports/keg-loss?from=&to=&threshold=` — như SRS 7.3, mỗi keg thêm `lossAmount`, `durationMinutes`. Mặc định 30 ngày gần nhất, ngưỡng 5%. `lossAmount = lossMl × cost / capacityMl`.
- `GET /reports/voids?from=&to=&staffId=&approverId=&reason=&type=` — `{ count, totalAmount, voidAmount, discountAmount, items, people }`. `type`: `VOID` · `DISCOUNT` · `BILL_DISCOUNT`. `people` là danh sách `{ id, fullName }` cho bộ lọc. Mặc định 7 ngày gần nhất.
- `GET /reports/top-items?from=&to=&by=qty|revenue&limit=` — `{ items: [{ menuItemId, name, qty, revenue }] }`, mặc định top 10 (`limit` 1–50), chỉ hóa đơn đã thanh toán.
- `GET /reports/hourly?from=&to=` — `{ days, hours: [{ hour, revenue, bills }] }`.

### Quản trị

- `GET /areas?include=tables` — chỉ khu & bàn đang hoạt động. Xóa bàn đã có lịch sử = ẩn (số bàn được giải phóng để tạo lại).
- `GET /menu` — nhóm → món đang bán, mỗi món `{ id, name, shortcut, unit, price (giá hiện hành), regularPrice, isHappyHour, available, stationId, stationName, beerVolumeMl }`.
- `GET /menu-items?groupId=&q=&includeInactive=true` — kèm `group`, `station`, `defaultTap`. Món bia hơi (`beerVolumeMl`) bắt buộc `defaultTapId`. Mã tắt chỉ chữ thường không dấu & số.
- `GET /staff` — không bao giờ trả mật khẩu/PIN; có `hasPin`. `PATCH /staff/:id`: `password` bỏ trống = giữ nguyên; `pin: null` = xóa PIN. Vai trò `COUNTER` luôn không có PIN.
- `GET /happy-hours` — mỗi khung có `activeNow` và `prices: [{ menuItemId, name, regularPrice, price }]`. `PATCH` có `prices` thì thay toàn bộ danh sách giá.

## 4. Danh sách đầy đủ: quyền, request, kết quả

Quyền: C = `COUNTER`, M = `SHIFT_MANAGER`, O = `OWNER`. Ký hiệu `?` = không bắt buộc. Mọi API (trừ đăng nhập) có thể trả `401 UNAUTHORIZED`, `403 FORBIDDEN`, `400 VALIDATION_ERROR`; API có `:id` có thể trả `404 NOT_FOUND`. Cột **Lỗi riêng** chỉ ghi các lỗi khác ngoài những lỗi này.

Kiểu dữ liệu dùng chung: **tiền** = số nguyên ≥ 0; **PIN** = chuỗi 4–6 chữ số; **ngày** = `YYYY-MM-DD`; **giờ** = `HH:mm`; **lý do** = `CUSTOMER_CHANGED_MIND` · `OUT_OF_STOCK` · `WRONG_ENTRY` · `DEFECTIVE` · `OTHER` (`OTHER` bắt buộc có `note`).

### 4.1 Đăng nhập

| API | Quyền | Request | Thành công | Lỗi riêng |
|---|---|---|---|---|
| `POST /auth/login` | Không cần token | `{ email, password }` — email tự chuyển chữ thường | 200 `{ token, user }`, token hết hạn sau 12 giờ | 401 `INVALID_CREDENTIALS`, 403 `ACCOUNT_LOCKED` |
| `GET /auth/me` | C M O | — | 200 `{ id, fullName, email, role }` | |

### 4.2 Khu & bàn

| API | Quyền | Request | Thành công | Lỗi riêng |
|---|---|---|---|---|
| `GET /areas?include=tables` | C M O | `include?` = `tables` | 200 mảng khu (kèm bàn nếu có `include`) | |
| `POST /areas` | O | `{ name (1–50 ký tự), sortOrder? }` | 201 khu vừa tạo | |
| `PATCH /areas/:id` | O | như POST, mọi trường `?` | 200 khu | |
| `DELETE /areas/:id` | O | — | 204 | 409 `AREA_NOT_EMPTY` |
| `POST /tables` | O | `{ areaId, code (1–10 ký tự), sortOrder? }` | 201 bàn | 409 `DUPLICATE_TABLE_CODE` |
| `PATCH /tables/:id` | O | `{ areaId?, code?, sortOrder?, active? }` | 200 bàn | 409 `DUPLICATE_TABLE_CODE`, `TABLE_NOT_EMPTY` (ẩn bàn đang có khách) |
| `DELETE /tables/:id` | O | — | 204 (bàn có lịch sử thì chỉ ẩn) | 409 `TABLE_NOT_EMPTY` |

### 4.3 Phiên bàn

| API | Quyền | Request | Thành công | Lỗi riêng |
|---|---|---|---|---|
| `GET /tabs/summary` | C M O | — | 200, xem SRS 7.3 | |
| `POST /tabs` | C M O | `{ tableId, guestCount? (1–200) }` | 201 phiên | 409 `TABLE_ALREADY_OPEN` (`details.tabId`) |
| `GET /tabs/:id` | C M O | — | 200, xem mục 3 | |
| `POST /tabs/:id/rounds` | C M O | `{ items: [{ menuItemId, qty (1–999), note? (≤ 200) }] }`, 1–100 món | 201 `{ round, tickets, tabTotal }` | 409 `TAB_NOT_OPEN`, `ITEM_UNAVAILABLE` |
| `POST /tabs/:id/move` | C M O | `{ targetTableId }` | 200 `{ tabId, tableId, tableCode }` | 400 `SAME_TABLE`; 409 `TABLE_NOT_EMPTY`, `TAB_NOT_OPEN` |
| `POST /tabs/:id/merge` | C M O | `{ targetTableId }` | 200 `{ targetTabId, tableId, tableCode, tabTotal }` | 400 `SAME_TABLE`; 409 `TABLE_EMPTY`, `TAB_NOT_OPEN` |
| `POST /order-lines/:id/void` | C (cần PIN) M O | `{ qty (≥ 1), reason, note?, approverPin? }` | 201 dòng `VOID` + `tabTotal` | 400 `PIN_REQUIRED`, `INVALID_PIN`, `QTY_EXCEEDED`; 409 `TAB_NOT_OPEN` |
| `POST /order-lines/:id/discount` | C (cần PIN) M O | `{ type: PERCENT\|AMOUNT, value (> 0, % ≤ 100), reason, note?, approverPin? }` | 201 dòng `DISCOUNT` + `tabTotal` | 400 `PIN_REQUIRED`, `INVALID_PIN`, `DISCOUNT_EXCEEDED`; 409 `TAB_NOT_OPEN` |
| `POST /tabs/:id/provisional` | C M O | — | 201 hóa đơn tạm tính (mục 3) | 409 `TAB_NOT_OPEN` |

### 4.4 Thanh toán

| API | Quyền | Request | Thành công | Lỗi riêng |
|---|---|---|---|---|
| `GET /tabs/:id/vietqr` | C M O | query `amount?` (> 0; bỏ trống = tổng hiện tại) | 200 `{ url, amount, addInfo, billNo, bank, account, accountName }` | 400 `VALIDATION_ERROR` nếu số tiền ≤ 0 |
| `POST /tabs/:id/pay` | C M O | `{ billDiscount?: { type, value, reason?, note? }, approverPin?, payments: [{ method: CASH\|TRANSFER, amount (> 0) }] }`, tối đa 10 khoản | 200 hóa đơn cuối (mục 3) | 400 `INSUFFICIENT_PAYMENT`, `OVERPAID_TRANSFER`, `PIN_REQUIRED`, `INVALID_PIN`; 409 `TAB_NOT_OPEN` |

`approverPin` chỉ cần khi người gọi là C và có `billDiscount`.

### 4.5 Ca

| API | Quyền | Request | Thành công | Lỗi riêng |
|---|---|---|---|---|
| `POST /shifts/open` | C M O | `{ openingCash }` | 201 ca | 409 `SHIFT_ALREADY_OPEN` (`details.shiftId`) |
| `GET /shifts/current` | C M O | — | 200 ca đang mở hoặc `null` | |
| `POST /shifts/:id/close` | M O | `{ countedCash }` | 200 ca kèm `expectedCash`, `difference` | 409 `SHIFT_ALREADY_CLOSED` |
| `GET /shifts` | M O | — | 200 50 ca gần nhất, mới nhất trước | |

### 4.6 Vòi & keg

| API | Quyền | Request | Thành công | Lỗi riêng |
|---|---|---|---|---|
| `GET /taps` | C M O | — | 200 `{ taps, inStockKegs }` | |
| `POST /taps/:id/change-keg` | C M O | `{ kegId }` | 200 `{ tapId, emptiedKeg: { id, code, soldMl } \| null, tappedKeg: { id, code, tappedAt } }` | 409 `KEG_NOT_IN_STOCK` |
| `GET /kegs` | M O | query `status?` = `IN_STOCK`\|`TAPPED`\|`EMPTY` | 200 `{ summary, items }` | |
| `POST /kegs` | M O | `{ beerName, capacityMl: 30000\|50000, cost, receivedAt (ngày), quantity (1–50) }` | 201 mảng keg vừa tạo | |

### 4.7 Thực đơn

| API | Quyền | Request | Thành công | Lỗi riêng |
|---|---|---|---|---|
| `GET /menu` | C M O | — | 200 nhóm → món đang bán, giá hiện hành | |
| `GET /menu-groups` | O | — | 200 mảng nhóm | |
| `POST /menu-groups` · `PATCH /menu-groups/:id` | O | `{ name (1–50), sortOrder? }` | 201 / 200 | |
| `GET /kitchen-stations` | O | — | 200 mảng khu chế biến | |
| `POST /kitchen-stations` · `PATCH /kitchen-stations/:id` | O | `{ name (1–50), sortOrder? }` | 201 / 200 | |
| `GET /menu-items` | O | query `groupId?`, `q?` (tìm tên/mã tắt), `includeInactive?` = `true` | 200 mảng món | |
| `POST /menu-items` | O | `{ name (1–100), shortcut (a–z, 0–9, ≤ 20), groupId, price, unit (1–20), stationId, beerVolumeMl?, defaultTapId?, available?, active?, sortOrder? }` | 201 món | 409 `DUPLICATE_SHORTCUT`; 400 `VALIDATION_ERROR` nếu có `beerVolumeMl` mà thiếu `defaultTapId` |
| `PATCH /menu-items/:id` | O | như POST, mọi trường `?` | 200 món | như POST |

### 4.8 Nhân viên

| API | Quyền | Request | Thành công | Lỗi riêng |
|---|---|---|---|---|
| `GET /staff` | O | — | 200 mảng `{ id, fullName, email, role, active, hasPin, createdAt }` | |
| `POST /staff` | O | `{ fullName, email, password (≥ 6), role, pin?, active? }` | 201 nhân viên | 409 `DUPLICATE_EMAIL` |
| `PATCH /staff/:id` | O | `{ fullName?, email?, password?, role?, pin? (null = xóa), active? }` | 200 nhân viên | 400 `CANNOT_LOCK_SELF`; 409 `DUPLICATE_EMAIL`, `LAST_OWNER` |

Vai trò `COUNTER` luôn bị bỏ PIN, kể cả khi gửi lên.

### 4.9 Giờ vàng

| API | Quyền | Request | Thành công | Lỗi riêng |
|---|---|---|---|---|
| `GET /happy-hours` | O | — | 200 mảng khung, kèm `activeNow`, `prices` | |
| `POST /happy-hours` | O | `{ name (1–100), weekdays: [1–7] (≥ 1 thứ), startTime, endTime (khác startTime), enabled?, prices: [{ menuItemId, price }] }` — mỗi món một lần | 201 khung | |
| `PATCH /happy-hours/:id` | O | như POST, mọi trường `?`; có `prices` thì thay toàn bộ | 200 khung | |
| `DELETE /happy-hours/:id` | O | — | 204 | |

### 4.10 Báo cáo

Khoảng ngày `from`, `to` tính theo giờ Việt Nam, lấy cả hai đầu.

| API | Quyền | Query | Mặc định | Lỗi riêng |
|---|---|---|---|---|
| `GET /reports/today` | M O | — | Hôm nay so với cùng giờ hôm qua | |
| `GET /reports/keg-loss` | O | `from?`, `to?`, `threshold?` (0–100) | 30 ngày gần nhất, ngưỡng 5% | |
| `GET /reports/voids` | M O | `from?`, `to?`, `staffId?`, `approverId?`, `reason?`, `type?` | 7 ngày gần nhất | |
| `GET /reports/top-items` | O | `from?`, `to?`, `by?` = `qty`\|`revenue`, `limit?` (1–50) | 7 ngày gần nhất, `by=qty`, `limit=10` | 400 `RANGE_TOO_LARGE` (> 31 ngày) |
| `GET /reports/hourly` | O | `from?`, `to?` | 7 ngày gần nhất | 400 `RANGE_TOO_LARGE` (> 31 ngày) |
