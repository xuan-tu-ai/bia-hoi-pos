# Đặc tả API chi tiết

> Mở rộng từ SRS v0.2 mục 7. Người soạn: Phí Việt Hiếu (backend).
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
- `GET /reports/top-items?from=&to=&by=qty|revenue` — `{ items: [{ menuItemId, name, qty, revenue }] }`, top 10, chỉ hóa đơn đã thanh toán.
- `GET /reports/hourly?from=&to=` — `{ days, hours: [{ hour, revenue, bills }] }`.

### Quản trị

- `GET /areas?include=tables` — chỉ khu & bàn đang hoạt động. Xóa bàn đã có lịch sử = ẩn (số bàn được giải phóng để tạo lại).
- `GET /menu` — nhóm → món đang bán, mỗi món `{ id, name, shortcut, unit, price (giá hiện hành), regularPrice, isHappyHour, available, stationId, stationName, beerVolumeMl }`.
- `GET /menu-items?groupId=&q=&includeInactive=true` — kèm `group`, `station`, `defaultTap`. Món bia hơi (`beerVolumeMl`) bắt buộc `defaultTapId`. Mã tắt chỉ chữ thường không dấu & số.
- `GET /staff` — không bao giờ trả mật khẩu/PIN; có `hasPin`. `PATCH /staff/:id`: `password` bỏ trống = giữ nguyên; `pin: null` = xóa PIN. Vai trò `COUNTER` luôn không có PIN.
- `GET /happy-hours` — mỗi khung có `activeNow` và `prices: [{ menuItemId, name, regularPrice, price }]`. `PATCH` có `prices` thì thay toàn bộ danh sách giá.
