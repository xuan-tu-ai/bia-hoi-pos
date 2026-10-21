# Tầm nhìn: Hệ thống quản lý quầy nhà hàng bia hơi (SaaS)

> **Tài liệu tầm nhìn dài hạn — KHÔNG phải phạm vi bài tập nhóm.** Phạm vi thực hiện xem `bia-hoi-quay-spec.md`; tài liệu này chỉ dùng cho mục "Hướng phát triển" trong báo cáo.
> Trạng thái: Draft v1 — 2026-10-18
> Nguồn: phỏng vấn yêu cầu với chủ sản phẩm

## 1. Tóm tắt

Phần mềm SaaS (thuê bao tháng) bán cho **nhà hàng bia hơi quy mô lớn (>60 bàn)** tại Việt Nam. Trọng tâm là **quầy**: nơi gộp 4 vai trò — thu ngân, rót bia, điều phối order, quản lý kho tại quầy. Ba vấn đề sản phẩm phải giải quyết tốt hơn đối thủ (KiotViet, Sapo, iPOS…):

1. **Thất thoát bia hơi** — đối chiếu keg nhập vs cốc bán.
2. **Sót món / nhầm bàn** giờ cao điểm.
3. **Tính tiền chậm, sai** khi đông khách, gộp/chuyển/tách nhóm.

Ràng buộc cứng: **offline-first** (quán bia mất mạng thường xuyên), người dùng là **nhân viên trẻ thời vụ** (phải học được trong ~5 phút), team **1–2 dev, 3–4 tháng** cho MVP.

## 2. Người dùng & vai trò

| Vai trò | Thiết bị | Việc chính |
|---|---|---|
| Nhân viên quầy (1–4 người song song) | PC/laptop Windows | Nhập order hộ phục vụ, in phiếu, tính tiền |
| Người rót bia | — (nhận phiếu in) | Rót theo phiếu |
| Bếp (theo trạm: nướng, chiên, lẩu…) | Máy in nhiệt | Nhận phiếu món theo trạm |
| Quản lý ca | Máy quầy (nhập PIN) | Duyệt hủy/giảm, mở/đóng ca, chỉ định hub |
| Chủ quán | Điện thoại (PWA) | Xem báo cáo từ xa, nhận cảnh báo |
| Phục vụ | (Phase 2: app điện thoại) | MVP: hô/đưa giấy cho quầy nhập |

Phân quyền dựa trên **PIN cá nhân 4–6 số** trên máy quầy (đăng nhập nhanh, đổi người không cần logout cả máy). Mọi thao tác ghi `staff_id`.

## 3. Phạm vi

### 3.1 MVP (3–4 tháng)

- Sơ đồ bàn theo khu + ô lệnh nhập nhanh.
- Order do quầy nhập; nhiều máy quầy song song (mỗi người phụ trách khu/dãy bàn, nhưng không khóa cứng).
- Gộp / chuyển bàn; nhiều nhóm trên 1 bàn dài (mỗi nhóm 1 bill).
- In phiếu theo trạm (bếp từng trạm + phiếu rót bia ở quầy).
- Bia hơi bán theo: cốc (vại), ca/tháp, lít (nhập tay); chế độ "đếm vỏ cuối bữa".
- Giá theo khung giờ (happy hour), giá theo khu, phụ thu / giảm tay (có duyệt).
- Hủy/giảm sau khi gửi bếp/in phiếu rót: **bắt buộc PIN quản lý + lý do**, ghi nhật ký.
- In tạm tính tự do, đánh số lần in.
- Thanh toán: tiền mặt, VietQR động + tự xác nhận qua webhook ngân hàng (Casso/SePay); offline thì xác nhận tay.
- Hóa đơn điện tử: tích hợp **1 nhà cung cấp** (đề xuất bên dưới), có hàng đợi phát hành khi offline.
- Kho: keg bia hơi (quy đổi ra cốc) + hàng bán nguyên đơn vị (bia chai/lon, nước ngọt, khăn lạnh, thuốc lá…).
- Ca đơn giản: doanh thu theo ca / nhân viên.
- Báo cáo chủ quán (PWA): doanh thu realtime, hao hụt bia theo keg, nhật ký hủy/giảm (+ push khi có), món bán chạy / giờ cao điểm.
- Offline-first với local hub tại quán; **failover hub thủ công**.
- Multi-tenant; schema có sẵn tenant → nhiều chi nhánh (UI chỉ 1 chi nhánh).

### 3.2 Phase 2 (đã quyết định đẩy lùi)

- Hub tự bầu lại (automatic failover).
- Định lượng nguyên liệu theo công thức (BOM).
- Màn hình bếp (KDS) — cấu hình in/KDS theo từng trạm.
- Đặt bàn trước, combo / tặng kèm.
- App phục vụ order tại bàn (kiến trúc phải sẵn sàng ngay từ MVP: order là API, không gắn chặt UI quầy).
- Tích hợp flow meter (IoT, ví dụ ESP32) trên vòi — MVP để sẵn API nhận sự kiện `pour`.
- Thêm nhà cung cấp HĐĐT (qua lớp adapter đã thiết kế từ MVP).
- UI chuỗi nhiều chi nhánh (menu chung, giá riêng, báo cáo gộp).

### 3.3 Ngoài phạm vi

- Đa ngôn ngữ (chỉ tiếng Việt, VND; code để sẵn i18n keys nhưng không dịch).
- Quản lý ca/két đầy đủ (đếm mệnh giá, lệch két) — chỉ làm bản đơn giản.
- Công nợ khách quen, tách bill chia đều theo người.
- Khách tự order qua QR.

## 4. Nghiệp vụ chi tiết

### 4.1 Bàn & phiên (session)

- **Bàn** (`table`) là vị trí vật lý thuộc **khu** (`area`). Khu mang thuộc tính giá (bảng giá theo khu).
- **Phiên** (`tab`) là một nhóm khách đang ngồi = một bill. Một bàn có thể có **nhiều tab** (bàn dài ghép nhiều nhóm); tab có nhãn ngắn (`12A`, `12B`).
- **Gộp bàn**: tab chiếm nhiều bàn (quan hệ N-N tab–table). Order nhập vào bất kỳ bàn nào trong nhóm đều vào cùng tab.
- **Chuyển bàn**: đổi bàn của tab, giữ nguyên toàn bộ lịch sử; ghi sự kiện `tab_moved`.
- **Tách nhóm**: chọn các dòng order chuyển sang tab mới (dùng khi nhóm muốn trả riêng phần mình).
- Trạng thái bàn trên sơ đồ (màu): trống / đang ngồi / có món chờ quá X phút / đã in tạm tính / đang chờ thanh toán.

### 4.2 Order

- Order gồm các **lượt** (`order_round`), mỗi lượt có nhiều **dòng** (`order_line`). Mỗi lượt lưu: thời điểm, máy, nhân viên nhập.
- Dòng order **bất biến**: sửa = tạo dòng điều chỉnh (âm) kèm lý do, không UPDATE/DELETE. Đây là nền tảng cho chống gian lận và đồng bộ offline.
- **Giá chốt tại thời điểm nhập** (snapshot giá vào dòng) theo: món × khu × khung giờ. Vì vậy happy hour áp đúng cho cốc gọi lúc 17:59 dù thanh toán lúc 20:00.
- **Bill gộp dòng** cùng món + cùng đơn giá (`Bia hơi x10`); màn chi tiết vẫn xem được từng lượt. Nếu cùng món nhưng khác giá (happy hour) → 2 dòng trên bill.
- Gửi lượt → in phiếu theo **trạm** được gán cho món (bia → máy in quầy rót; món nướng → máy in trạm nướng…). Một lượt có thể sinh nhiều phiếu.

### 4.3 Bia hơi: đơn vị bán & chế độ đếm

- Món bia hơi có **thể tích quy đổi**: cốc = 0.5L (cấu hình), ca 1.5–2L, tháp 3–5L, hoặc bán theo lít (nhập số lít).
- **Chế độ tính bia — cấu hình theo quán** (không trộn):
  - `PER_ROUND`: mỗi lượt gọi bia là một dòng order (mặc định).
  - `END_COUNT`: trong bữa vẫn in phiếu rót (để quầy rót) nhưng **dòng tính tiền** được tạo lúc thanh toán từ số vỏ cốc đếm được. Phiếu rót trong bữa ghi nhận làm "lượng rót" phục vụ đối chiếu hao hụt.
- Lưu ý: ở `END_COUNT` + happy hour, giá áp theo thời điểm thanh toán (hoặc cấu hình tỉ lệ) — cần xác nhận lại với khách hàng pilot.

### 4.4 Kho & chống thất thoát bia

- Keg (30L/50L…) nhập kho theo lô. Mỗi keg có trạng thái: `in_stock → tapped → empty`.
- Thao tác **"Thay keg"** trên máy quầy (1 chạm, chọn vòi): đóng keg cũ, mở keg mới.
- **Hao hụt keg** = (thể tích keg ÷ thể tích cốc) − tổng cốc quy đổi đã bán trong khoảng [mở, đóng] trên vòi đó. Báo cáo % hao hụt theo keg, theo ca, theo ngày; ngưỡng cảnh báo cấu hình (ví dụ >5%).
- Vì người rót làm theo phiếu in (không có xác nhận "đã rót"), lượng tiêu hao lý thuyết = tổng dòng order bia (đã trừ hủy). Hủy bia sau khi in phiếu rót được đánh dấu riêng là "rót nhưng hủy" — một nguồn rủi ro thất thoát chính.
- Hàng nguyên đơn vị: trừ kho khi bán; kiểm kê cuối ngày nhập số thực tế → lệch kho.
- Phase 2: sự kiện `pour` từ flow meter thay thế số lý thuyết.

### 4.5 Giá & khuyến mãi (MVP)

- Bảng giá = món × khu × khung giờ (thứ trong tuần + giờ bắt đầu/kết thúc). Ưu tiên: khung giờ cụ thể > khu > giá gốc.
- Phụ thu: theo % hoặc số tiền, theo ngày (Lễ/Tết) hoặc tay.
- Giảm giá tay: theo dòng hoặc theo bill, % hoặc số tiền; **cần PIN quản lý** nếu vượt ngưỡng cấu hình.

### 4.6 Hủy, giảm & nhật ký kiểm soát

- Trước khi gửi (chưa in phiếu): nhân viên tự sửa.
- Sau khi gửi bếp/in phiếu rót, hoặc sau khi in tạm tính: **PIN quản lý + chọn lý do** (danh sách cấu hình + ghi chú tự do).
- Mọi hủy/giảm/chuyển/gộp/mở lại bill đã thanh toán ghi vào `audit_log` bất biến; chủ quán nhận push.

### 4.7 Tạm tính & thanh toán

- In tạm tính không giới hạn, mỗi lần in ghi "Lần in N" + giờ in; không khóa bàn.
- Thanh toán:
  - **Tiền mặt**.
  - **VietQR động**: QR chứa số tiền + nội dung `<mã quán><mã bill>`. Webhook Casso/SePay khớp nội dung → tự đánh dấu đã trả, hiện thông báo trên máy quầy. Sinh QR thực hiện offline được (chuỗi EMVCo tính local).
  - **Offline**: vẫn hiện VietQR, thu ngân xác nhận tay; khi online lại, đối soát với giao dịch ngân hàng và gắn cờ các bill "xác nhận tay chưa khớp".
  - Kết hợp nhiều phương thức trong 1 bill.
- **HĐĐT**: phát hành từ bill đã thanh toán; offline → xếp hàng `einvoice_queue`, phát hành khi có mạng; hiển thị trạng thái (chờ/đã phát hành/lỗi). Nhà cung cấp đầu tiên đề xuất: **MISA meInvoice** hoặc **Viettel S-Invoice** (chọn theo khách hàng pilot), sau một interface `EInvoiceProvider` để thêm nhà cung cấp khác.

### 4.8 Ca

- Mở ca / đóng ca theo nhân viên quầy; báo cáo doanh thu theo ca, theo nhân viên, theo phương thức thanh toán. Không đếm mệnh giá.

## 5. UI / UX

### 5.1 Nguyên tắc

- Thiết kế cho **nhân viên thời vụ**: mọi thao tác chính ≤ 3 chạm/phím; chữ to; màu trạng thái nhất quán; không có menu lồng sâu.
- Tối ưu **tốc độ nhập**: mục tiêu nhập 1 lượt order trong 3–5 giây với người quen tay.
- Hỗ trợ cả chuột/cảm ứng và bàn phím thuần.

### 5.2 Màn hình chính quầy

- **Nền**: sơ đồ bàn theo tab khu (Trong nhà / Sân / Tầng 2…). Ô bàn hiển thị: số bàn, nhãn tab, tổng tiền, thời gian ngồi, icon cảnh báo.
- **Ô lệnh nhanh** luôn focus ở trên cùng. Cú pháp đề xuất:
  - `12 3b 1ngo` → bàn 12: 3 cốc bia (mã tắt `b`), 1 ngô nướng (`ngo`).
  - `12a ...` → tab A của bàn 12.
  - Gợi ý autocomplete mã tắt theo tần suất; Enter = gửi lượt + in phiếu.
  - Lệnh thao tác: `/chuyen 12 25`, `/gop 12 13`, `/tt 12` (tạm tính), `/pay 12`.
- Click bàn → panel bên phải: danh sách lượt, nút nhanh món hay gọi (grid lớn), nút Tạm tính / Thanh toán.
- Phản hồi rõ ràng sau gửi: toast "Bàn 12 — đã gửi 2 phiếu (Quầy rót, Nướng)"; nếu máy in lỗi → banner đỏ không tự tắt.

### 5.3 Màn khác (MVP)

- Thanh toán (chọn phương thức, QR to, tiền thối).
- Thay keg (chọn vòi → keg mới).
- Nhập kho / kiểm kê.
- Cấu hình (menu, mã tắt, trạm in, khu, bảng giá, nhân viên & PIN, chế độ đếm bia) — chạy trên web cloud.
- PWA chủ quán: dashboard realtime, hao hụt keg, nhật ký hủy/giảm, top món, heatmap giờ.

## 6. Kiến trúc kỹ thuật

### 6.1 Stack đề xuất (TypeScript full-stack)

| Thành phần | Công nghệ | Lý do |
|---|---|---|
| App quầy (Windows) | **Electron** + React | In ESC/POS qua USB/LAN, chạy hub nhúng bằng Node, mature trên Windows |
| Local hub | Node service (chạy trong app quầy được chỉ định làm hub) + **SQLite** | Không cần thiết bị riêng; LAN không phụ thuộc Internet |
| Cloud backend | Node (Fastify hoặc NestJS) + **PostgreSQL** | Multi-tenant, Row-Level Security theo `tenant_id` |
| Admin & PWA chủ quán | React (Vite) PWA | Web Push cho cảnh báo |
| Realtime | WebSocket (LAN: client↔hub; cloud: hub↔cloud, PWA↔cloud) | |
| Shared | Monorepo (pnpm), package domain chung (tính giá, bill, quy đổi bia) dùng ở cả hub và cloud | Đảm bảo hub offline tính tiền giống hệt cloud |

Lựa chọn thay thế: Tauri (nhẹ hơn) — loại vì hub cần runtime Node và driver máy in phức tạp hơn.

### 6.2 Topology tại quán

```
[Máy quầy 1 = HUB] ⇄ SQLite (nguồn sự thật tại quán)
     ▲  ▲  ▲                     │
 LAN │  │  │ WebSocket           │ sync (outbox) khi có Internet
[Máy quầy 2][Máy quầy 3]         ▼
     │                        [Cloud: API + Postgres] ⇄ PWA chủ quán / Webhook ngân hàng / HĐĐT
[Máy in trạm (LAN/USB)]
```

- Client tìm hub bằng mDNS + IP tĩnh dự phòng.
- Máy in LAN được hub gọi trực tiếp; máy in USB gắn máy nào thì máy đó in (hub gửi lệnh qua WS).
- Mỗi máy quầy giữ **bản sao read-only cập nhật liên tục** của hub (replicate qua WS) để phục vụ failover thủ công.

### 6.3 Mô hình dữ liệu & đồng bộ

- **Event log bất biến** tại hub (`order_line_added`, `line_voided`, `tab_moved`, `payment_recorded`, `keg_tapped`…), mỗi event có ULID, `device_id`, `staff_id`, timestamp.
- Trạng thái (tab, bill) là projection từ event → dễ audit, dễ đồng bộ, không cần CRDT vì có một hub làm thứ tự tổng.
- Hub đẩy event lên cloud theo **outbox** (at-least-once, idempotent theo event id). Cloud đẩy xuống: cấu hình menu/giá, xác nhận thanh toán VietQR, kết quả HĐĐT.
- Cấu hình (menu, giá) chỉnh trên cloud → version hóa → hub kéo về; hub luôn có bản cấu hình đầy đủ để chạy offline.
- Tiền: số nguyên VND, không dùng float.
- Đánh số bill/phiếu theo hub (tiền tố hub + chuỗi tăng) để không trùng khi đổi hub.

### 6.4 Failover hub (MVP: thủ công)

1. Hub tắt → các client báo "Mất kết nối hub" (banner đỏ), chuyển chế độ chỉ đọc.
2. Nếu có Internet: client có thể tạm kết nối thẳng cloud (cloud đã có event tới thời điểm sync cuối).
3. Quản lý nhập PIN trên một máy khác → "Đặt máy này làm hub" → máy đó promote bản replicate, tăng `hub_epoch`, các client kết nối lại.
4. Khi hub cũ bật lại với epoch thấp hơn → tự hạ xuống client; event chưa replicate của hub cũ (nếu có) được đưa vào hàng chờ đối soát cho quản lý duyệt.

Phase 2: tự bầu hub (leader election theo epoch/lease).

### 6.5 Tích hợp

- **Ngân hàng**: webhook Casso/SePay → cloud → hub (khi online). Khớp theo nội dung chuyển khoản + số tiền.
- **HĐĐT**: interface `EInvoiceProvider { issue, cancel, getStatus }`, 1 implementation cho MVP.
- **Flow meter (Phase 2)**: endpoint trên hub nhận `pour{tap_id, ml, ts}`.

## 7. Yêu cầu phi chức năng

- Thời gian phản hồi gửi lượt trên LAN: < 300 ms; in phiếu < 2 s.
- Chạy liên tục ca 12–16 giờ không cần khởi động lại.
- Offline không giới hạn thời gian ở mức vận hành (order, in, thanh toán tiền mặt/QR xác nhận tay).
- Không mất dữ liệu khi mất điện đột ngột: SQLite WAL + fsync mỗi event; khuyến nghị UPS cho máy hub.
- Tự cập nhật app quầy (auto-update), không cập nhật giữa ca.
- Bảo mật: PIN băm; token thiết bị cấp khi ghép máy với quán; RLS trên Postgres.

## 8. Rủi ro & câu hỏi mở

| # | Vấn đề | Ghi chú |
|---|---|---|
| 1 | Quầy nhập order cho >60 bàn có thể nghẽn giờ cao điểm | MVP giải bằng nhiều máy quầy + ô lệnh nhanh; app phục vụ ở phase 2 là lối thoát. Cần đo trong pilot. |
| 2 | Scope MVP vẫn rộng với 1–2 dev | Ưu tiên theo thứ tự: order/in/bàn → thanh toán tiền mặt + VietQR → offline/hub → keg → báo cáo → HĐĐT. HĐĐT có thể trượt nếu pilot chưa bắt buộc. |
| 3 | `END_COUNT` + happy hour: giá áp thế nào? | Xác nhận với quán pilot. |
| 4 | Hao hụt keg không có xác nhận "đã rót" | Số liệu chỉ là lý thuyết; flow meter phase 2 mới chống thất thoát triệt để. |
| 5 | Chọn nhà cung cấp HĐĐT đầu tiên | Theo nhà cung cấp quán pilot đang dùng. |
| 6 | Mua/bán kèm phần cứng (máy in, UPS, router)? | Chưa quyết; ảnh hưởng onboarding & hỗ trợ. |
| 7 | Gói giá SaaS (theo số máy quầy? theo số bàn?) | Chưa thảo luận. |

## 9. Tiêu chí hoàn thành MVP

- Một quán pilot >60 bàn chạy trọn 2 tuần không cần giấy ghi order dự phòng.
- Rút cáp Internet 2 giờ giữa ca: vận hành bình thường, đồng bộ đúng khi có mạng lại (0 event mất/trùng).
- Tắt máy hub giữa ca: chuyển hub thủ công trong < 2 phút, không mất order đã gửi.
- Báo cáo hao hụt keg hiển thị cho chủ quán theo từng keg.
- Mọi hủy/giảm sau gửi đều có PIN quản lý + lý do trong nhật ký.
