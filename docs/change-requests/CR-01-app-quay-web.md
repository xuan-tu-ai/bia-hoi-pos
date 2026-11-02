# PHIẾU YÊU CẦU THAY ĐỔI — CR-01

| | |
|---|---|
| **Người đề xuất** | Phí Việt Hiếu |
| **Ngày** | 24/10/2026 |
| **Loại** | Phạm vi (kỹ thuật triển khai) |
| **Trạng thái** | Chờ CCB quyết định |

## Mô tả thay đổi

Làm **App quầy dạng web** (React, chạy trên Chrome hoặc Edge của máy quầy, địa chỉ `http://<máy chủ>:8080/quay/`) thay cho ứng dụng desktop Electron có bộ cài `.exe` như SRS 1.3 và 6.1 mô tả.

Chức năng FR-01 đến FR-10 giữ nguyên. Chỉ cách đóng gói và cách in thay đổi.

## Lý do

1. **Một công nghệ cho cả nhóm.** Web quản trị đã làm bằng React + Vite. App quầy dùng cùng công nghệ nên không phải học thêm Electron. Điều này giảm rủi ro R01 ("thành viên chưa quen React/Electron/Node", điểm 16).
2. **Triển khai và cập nhật tập trung.** Sửa lỗi xong, mọi máy quầy dùng bản mới ngay khi tải lại trang, không phải cài lại `.exe` trên từng máy.
3. **Đã làm xong và kiểm thử.** App quầy dạng web đã có đủ FR-01 đến FR-10, đạt 10/10 kiểm thử đầu-cuối (gồm in qua máy in mạng), chạy được trong Docker cùng hệ thống.

## Yêu cầu và gói WBS bị ảnh hưởng

| Mục | Hiện tại | Đề xuất |
|---|---|---|
| SRS 1.3, 6.1 | App quầy: Electron + React, ứng dụng desktop Windows | App quầy: React chạy trên trình duyệt của máy quầy |
| NFR-07 | Bộ cài `.exe` cho Windows 10/11 | Mở bằng Chrome/Edge (khuyến nghị chế độ kiosk), không cần cài đặt |
| NFR-08 | In máy in nhiệt 80 mm qua driver Windows; không có máy in thì xuất PDF | Mỗi trạm chọn một trong hai cách. **Máy in mạng**: máy chủ gửi phiếu thẳng tới máy in nhiệt có cổng LAN (ESC/POS qua TCP 9100), phiếu in dạng ảnh nên đúng dấu tiếng Việt. **Máy in của máy quầy**: in qua hộp thoại in của trình duyệt (`--kiosk-printing` để in thẳng); vẫn xuất PDF được |
| FR-04 | Mỗi trạm in một phiếu, gửi đúng máy in của trạm | Giữ nguyên với trạm dùng máy in mạng. Máy in mạng không phản hồi thì lượt tự chuyển "lỗi in" (bàn đỏ) |
| FR-11 | Trạm in có "tên máy in Windows" | Trạm in có cách in (máy in mạng / máy quầy), IP và cổng máy in, nút "In thử". Tên máy in thành ghi chú |
| WBS 1.4.3 | "Đóng gói bộ cài .exe" | Bỏ việc đóng gói; thêm cấu hình chế độ kiosk cho máy quầy |

## Phân tích tác động (QLDA điền)

- **Phạm vi:** không thêm hay bớt FR. NFR-07 và NFR-08 được viết lại như bảng trên.
- **Tiến độ:** rút ngắn hoạt động L (App quầy), vì không còn bước đóng gói `.exe` và thử cài trên máy sạch. Không lùi mốc G3.
- **Chi phí:** giảm giờ công gói 1.4.3, vì bỏ phần đóng gói và in qua driver. Ước tính giảm 6–10 giờ.
- **Chất lượng:** có 10 test đầu-cuối (`apps/counter/e2e`) phủ FR-01 đến FR-10. Trong đó có test hai máy quầy cập nhật cho nhau trong ≤ 3 giây (FR-02, NFR-02), và test in qua máy in mạng (máy in tắt thì bàn đỏ, bật lại thì in lại được). Backend có thêm 6 test cho phần ESC/POS.
- **Rủi ro mới:**
  - **R12 — Máy in tại trạm cần cổng mạng.** Muốn phiếu tự ra ở bếp thì máy in bếp phải là loại có cổng LAN, đặt IP tĩnh. Máy in USB thì chỉ in được qua máy quầy cắm trực tiếp. Xác suất 2, tác động 2, điểm 4. Chiến lược giảm thiểu: có nút "In thử" cho từng trạm, và có máy in giả (`pnpm --filter @biahoi/api printer:fake`) để demo khi chưa có máy in.
  - **R13 — Nhân viên đóng nhầm trình duyệt.** Giảm thiểu bằng chế độ kiosk (`--kiosk`). Token đăng nhập chỉ sống theo phiên trình duyệt, nên mở lại thì phải nhập lại PIN.

## Quyết định CCB

☐ Duyệt ☐ Từ chối ☐ Hoãn  Ngày: __/__/2026

Chữ ký CCB: ________

## Tài liệu cần cập nhật nếu được duyệt

SRS (1.3, 6.1, NFR-07, NFR-08, FR-04, FR-11; mô hình dữ liệu `print_station` thêm `connection`, `host`, `port`); RTM (cột trạng thái FR-01 đến FR-10, ghi chú NFR-07, NFR-08); Từ điển WBS 1.4.3; Sổ rủi ro (thêm R12, R13; sửa R10); Nhật ký thay đổi.
