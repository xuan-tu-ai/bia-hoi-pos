# Kế hoạch kiểm thử
## 1. Mục tiêu và phạm vi

Xác minh hệ thống hỗ trợ quy trình từ mở bàn, gửi món đến thanh toán và đối soát. Ưu tiên các lỗi gây sai tiền, mất lịch sử, sai phân quyền hoặc sai trạng thái khi nhiều máy thao tác đồng thời.

| Phạm vi | Cách kiểm thử |
|---|---|
| Khởi tạo, đăng nhập, khu/bàn, thực đơn, nhân viên | Chạy bộ Vitest/Supertest, kiểm thử bổ sung qua REST API và đối chiếu PostgreSQL |
| Sơ đồ bàn, gọi món, giờ vàng | Kiểm thử danh mục trên bản hiện tại. Chạy các ca nghiệp vụ khi có API tương ứng |
| Phiên bàn, phiếu in, thanh toán, ca, vòi/keg, báo cáo | Chuẩn bị dữ liệu và tiêu chí nghiệm thu. Đánh dấu **Blocked** cho các ca cần chức năng chưa có |
| Giao diện, in, đa thiết bị và demo triển khai | Chạy E2E, kiểm thử thiết bị và UAT khi có bản giao diện tích hợp |


## 2. Môi trường và dữ liệu kiểm thử

- Dùng Node.js ≥20, PostgreSQL và hai cơ sở dữ liệu kiểm thử độc lập. `TEST_DATABASE_URL` dành cho Vitest. Dùng `JWT_SECRET` riêng và cấu hình `CORS_ORIGIN` khớp địa chỉ frontend test.
- Seed chuẩn gồm 80 bàn, 20 bàn đang có khách, thực đơn, khu chế biến, vòi và lịch sử hóa đơn. Dùng tài khoản mẫu cho ba vai trò Quầy, Quản lý ca, Chủ quán và tài khoản bị khóa. Giữ dữ liệu kiểm thử riêng cho mỗi ca làm thay đổi số liệu đối soát.
- Chuẩn bị bộ dữ liệu mở rộng gồm hai bàn trống, hai bàn có phiên, món từ ba khu chế biến, một món hết hàng, một món có hai đơn giá, thanh toán hỗn hợp và keg 50 L bán ròng 46 L. Cố định thời điểm theo `Asia/Ho_Chi_Minh` khi kiểm thử giờ vàng và báo cáo qua nửa đêm.
- Khi có bản tích hợp, dùng ba máy hoặc phiên trình duyệt độc lập, Chrome và Edge phiên bản mới nhất tại thời điểm chạy, màn Quầy 1366×768, màn Báo cáo rộng 375 px và máy in nhiệt hoặc bản xem trước 80 mm. VietQR dùng tài khoản thử và kiểm tra thông tin trên màn hình quét trước bước xác nhận chuyển tiền.


## 3. Ma trận ca kiểm thử chức năng

Xem [ma trận và ca kiểm thử chi tiết](test-cases.md).

## 4. Kiểm thử phi chức năng và toàn vẹn

|  Mã SRS  | Phương pháp và tiêu chí |
|---|---|
| NFR-01 | Tạo 80 phiên mở bằng fixture riêng, đo từ thao tác đến phản hồi có thể sử dụng trên màn Quầy. Ghi số mẫu, p95, giá trị lớn nhất và số lần vượt ngưỡng. Tiêu chí SRS là mỗi thao tác ≤1 giây. |
| NFR-02 | Dùng ít nhất 3 máy/phiên độc lập. Đo từ lúc máy A nhận cập nhật thành công đến lúc máy B/C hiển thị trạng thái mới, tối đa 3 giây. Lặp lại với mở, chuyển, gộp và thanh toán. |
| NFR-03 | Bấm giờ từ lúc người mới bắt đầu ở màn Quầy đến khi gửi lượt đầu thành công, ≤5 phút, không hướng dẫn. Ghi thao tác làm họ mất thời gian. |
| NFR-04 | Đối chiếu DB trước/sau khi gửi, hủy, giảm và thanh toán. Giá trị tiền là số nguyên VND. Dòng đã gửi, hóa đơn đã thanh toán và nhật ký giữ nguyên; kiểm tra yêu cầu lỗi giữa các bước ghi không để lại bản ghi dở dang. |
| NFR-05 | Chạy ma trận quyền ở API bằng cả ba vai trò và token thiếu/hết hạn; so mã trạng thái với đặc tả. Xác nhận bcrypt và không lộ thông tin xác thực trong response. `/health` là endpoint công khai ngoài `/api`. |
| NFR-06 | Kiểm tra tiếng Việt, dấu và định dạng tiền; nút chính ≥44×44 px; màn Quầy 1366×768 và Báo cáo 375 px; văn bản tiếng Việt và ghi chú dài trên phiếu 80 mm. |
| NFR-07 | Ghi phiên bản Chrome và Edge ở ngày chạy. Lặp luồng đăng nhập, gọi món, in, thanh toán và báo cáo trên cả hai. |
| NFR-08 | Kiểm tra URL demo bằng trình duyệt ngoài môi trường dev. Đăng nhập, tải sơ đồ và chạy một luồng mẫu qua frontend/API đã triển khai. |

## 5. Trình tự thực hiện và nghiệm thu

1. **Bản hiện tại.** QA chạy build, typecheck, ba nhóm test `khoi-tao`, `dang-nhap`, `danh-muc`. Kiểm tra thủ công các ca API bổ sung ở KT-11 đến KT-13 và NFR-05. Ghi nhận phần còn chờ theo endpoint hoặc màn hình.
2. **Khi có API nghiệp vụ.** Backend phối hợp QA chạy REST tích hợp theo nhóm phiên bàn → thanh toán → ca/keg → báo cáo. Chạy lại bộ kiểm thử hiện có sau mỗi nhóm thay đổi. Ưu tiên giao dịch đồng thời, đối soát tiền và dữ liệu ghi dở.
3. **Khi có giao diện tích hợp.** Frontend phối hợp QA chạy E2E, in 80 mm, VietQR, kiểm thử đa máy và các ngưỡng NFR. Chạy lại các ca thất bại sau sửa và các luồng liên quan.
4. **UAT.** Đại diện Quầy thực hiện mở bàn, gửi một lượt món qua ba khu, hủy món có duyệt, chuyển/gộp, in tạm tính, thanh toán hỗn hợp và thay keg. Đại diện Chủ quán đối soát doanh thu, hao hụt 8%, nhật ký hủy và thử tắt một món. Chọn bàn theo trạng thái seed thực tế và ghi mã bàn, hóa đơn, keg để đối soát.

**Điều kiện bắt đầu** có mã nguồn định danh được, DB thử đã migrate và seed, tài khoản đủ vai trò. Ca cần UI, máy in, QR hoặc đa máy chỉ bắt đầu khi có đúng môi trường tương ứng.

**Điều kiện kết thúc từng đợt** Build, typecheck và bộ hồi quy tương ứng đạt. Nghiệm thu UAT khi **≥ 95% ca mức M đạt, 0 lỗi nghiêm trọng** và kịch bản UAT được xác nhận. Tính tỷ lệ theo số ca M đạt chia cho tổng số ca M trong phạm vi nghiệm thu, kể cả ca chưa chạy hoặc bị chặn.

## 6. Ghi kết quả và quản lý lỗi

Dùng trạng thái `Not Run`, `Pass`, `Fail`, `Blocked`. Ghi lý do và điều kiện để chạy lại mỗi ca `Blocked`. Báo cáo số ca theo từng trạng thái và tính tỷ lệ đạt trên số đã chạy, `Pass / (Pass + Fail)`.

Ví dụ minh họa cách ghi một ca lỗi:

| Mã ca | Yêu cầu | Mức độ lỗi | Trạng thái | Các bước tái hiện | Kết quả mong đợi | Kết quả thực tế (kèm ảnh nếu có) |
|---|---|---|---|---|---|---|
| KT-01-01 | FR-11 | Trung bình | Fail |  Tạo món với mã tắt đã tồn tại và bấm Lưu. | API trả `409 DUPLICATE_SHORTCUT` và không tạo món trùng. | Món thứ hai được lưu với cùng mã tắt. |

### Mức độ lỗi

| Mức độ | Tiêu chí |
|---|---|
| Nghiêm trọng | Sai tiền, mất dữ liệu, lộ dữ liệu hoặc thao tác trái quyền, hoặc hệ thống sập. |
| Cao | Chức năng mức M không dùng được. |
| Trung bình | Chức năng vẫn dùng được nhưng một phần hoạt động sai hoặc phải dùng cách xử lý tạm. |
| Thấp | Lỗi trình bày hoặc câu chữ, không ảnh hưởng đến việc hoàn tất thao tác. |

**Mẫu báo lỗi** Dùng issue mẫu [Báo lỗi](../.github/ISSUE_TEMPLATE/bao-loi.md) trên GitHub, ghi mã ca KT-xx và mức độ lỗi. Ví dụ `KT-xx-xx · Trung bình · FR-11 · Tạo được món có mã tắt trùng`.
