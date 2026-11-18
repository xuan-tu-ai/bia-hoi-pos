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

| Ca / Yêu cầu | Ưu tiên | Thao tác và kết quả mong đợi | Điều kiện chạy |
|---|---|---|---|
| KT-00 Khởi tạo | M | Gọi `/health` nhận 200; đường dẫn không tồn tại nhận 404; JSON lỗi nhận 400 `VALIDATION_ERROR`. Đếm 80 bàn và 20 phiên đang mở trong dữ liệu seed. | Hiện có |
| KT-01 Đăng nhập và quyền · FR-01 | M | Đăng nhập ba vai trò và gọi `/auth/me`; đăng nhập sai hoặc email lạ trả cùng thông báo; token thiếu, sai hoặc hết hạn nhận 401; khóa tài khoản sau đăng nhập rồi thử token cũ, truy cập bị từ chối. Gọi API quản trị bằng Quầy và Quản lý ca, nhận 403. | Hiện có |
| KT-02 Sơ đồ bàn · FR-02 | M | Kiểm tra 80 bàn không cuộn ngang ở 1366×768, đúng số bàn và chú thích màu xám/xanh/vàng, đúng tổng bàn có khách và tạm tính. Máy A mở bàn, máy B thấy màu đổi trong ≤3 giây mà không tải lại thủ công. | API danh mục có sẵn; màn hình và đồng bộ cần bản tích hợp |
| KT-03 Mở phiên · FR-03 | M | Mở bàn có và không nhập số khách. Hai máy đồng thời mở cùng bàn trống, chỉ tạo một phiên; máy nhận lỗi `TABLE_ALREADY_OPEN` nhận `tabId` và mở đúng phiên đó. | Cần API phiên bàn và UI |
| KT-04 Gọi món và in phiếu · FR-04 | M | Gửi món từ hai khu chế biến, nhận hai phiếu đúng khu, số bàn, người gửi, số lượng và ghi chú. Kiểm tra in lại giữ nguyên nội dung, món hết hàng bị chặn, lượt đã gửi giữ giá sau khi đổi giá và không sửa trực tiếp được. Người đã quen gửi ba món trong ≤10 giây. | API thực đơn có sẵn; gửi/in cần bản tích hợp |
| KT-05 Chuyển và gộp · FR-05 | M | Chuyển sang bàn trống, giữ nguyên món/tổng tiền. Gộp hai bàn đang có khách, bàn đích bằng tổng trước gộp và bàn nguồn về trống. Chặn chuyển vào bàn bận và gộp vào bàn trống, giữ nguyên dữ liệu khi bị chặn. Đối chiếu nhật ký người thực hiện, giờ, bàn nguồn/đích. | Cần API phiên bàn |
| KT-06 Hủy và giảm · FR-06 | M | Với Quầy, thử thiếu PIN, PIN sai, PIN hợp lệ; Quản lý ca/Chủ quán tự duyệt. Thử hủy đúng số lượng còn lại và vượt một đơn vị; kiểm tra lý do “Khác” kèm ghi chú. Hủy/giảm hợp lệ thêm dòng âm liên kết dòng gốc, giữ nguyên dòng đã gửi và ghi người yêu cầu/duyệt. | Có test hàm duyệt PIN; cần API nghiệp vụ |
| KT-07 Tạm tính · FR-07 | M | In hai lần, số lần in tăng, bàn chuyển vàng và vẫn gọi thêm món. Gộp các dòng cùng món/cùng giá, giữ riêng món khác giá, loại lượng đã hủy và tính tiền sau giảm. | Cần API tạm tính và UI |
| KT-08 Thanh toán · FR-08 | M | Thử tiền mặt có tiền thừa, chuyển khoản và thanh toán hỗn hợp. Chặn thiếu tiền và chuyển khoản vượt số phải trả. Giảm cả hóa đơn bằng vai trò Quầy yêu cầu PIN. Quét QR kiểm tra số tiền và nội dung `BH<số hóa đơn>`. Khi thành công, bàn về trống và hóa đơn giữ nguyên khi gửi lại thao tác hoặc truy cập từ máy khác. Đối chiếu chỉ có một kết quả thanh toán cho phiên. | Cần API thanh toán và UI |
| KT-09 Ca · FR-09 | S | Thử mở hai ca đồng thời và đóng ca bằng Quầy. Chỉ có một ca mở và chỉ Quản lý ca/Chủ quán được đóng. Ví dụ đầu ca 500.000 đ, tiền mặt thu 300.000 đ, đếm 780.000 đ, chênh lệch −20.000 đ; tiền chuyển khoản không cộng vào két. Khi chưa mở ca, hiển thị nhắc và vẫn cho mở bàn, gọi món, thanh toán. | Cần API ca và UI |
| KT-10 Thay keg · FR-10 | M | Thử thay bằng keg trong kho và keg đang dùng. Dùng mốc 89%, 90% để kiểm tra xác nhận thay sớm, hủy xác nhận giữ nguyên trạng thái. Keg cũ đóng, keg mới gắn đúng vòi; lít bán được tính theo thể tích ròng, đúng khoảng gắn keg. | Cần API vòi/keg và UI |
| KT-11 Thực đơn · FR-11 | M | Chủ quán thêm/sửa nhóm, khu chế biến và món; kiểm tra mã tắt trùng, bia có thể tích nhưng thiếu vòi, giá và trạng thái hết món trong API. Món hết hàng vẫn có cờ `available: false`; món ẩn không xuất hiện trên thực đơn. UI khóa chọn món hết và đổi giá không làm đổi lượt đã gửi. | API hiện có; UI và giá lịch sử chờ tích hợp |
| KT-12 Khu và bàn · FR-12 | M | Chủ quán thêm, sửa, sắp xếp, ẩn/xóa theo tình trạng. Chặn mã bàn trùng, ẩn/xóa bàn bận, xóa khu còn bàn; bàn có lịch sử được ẩn theo đặc tả API. Kiểm tra nhật ký và quyền đọc danh mục của cả ba vai trò. | Hiện có |
| KT-13 Nhân viên · FR-13 | M | Tạo tài khoản, thử email trùng, đặt lại mật khẩu và khóa tài khoản. Chặn tự khóa và hạ quyền chủ quán cuối cùng. Kiểm tra PIN được bỏ đối với vai trò Quầy. Đối chiếu bcrypt trong DB thử và phản hồi API không trả mật khẩu, PIN hoặc giá trị băm. | Hiện có |
| KT-14 Nhập keg · FR-14 | M | Nhập 3 keg, kiểm tra 3 mã duy nhất và lọc theo trạng thái. Quầy bị từ chối, Quản lý ca/Chủ quán được nhập. Kiểm tra lỗi dữ liệu không tạo dở một phần lô. | Cần API keg |
| KT-15 Giờ vàng · FR-15 | S | Kiểm tra ngay trước, tại và sau mỗi biên thời gian theo quy tắc đã xác nhận, ngày không áp dụng, khung tắt và hai khung cùng hiệu lực lấy giá thấp nhất. Gửi cùng món ở hai mức giá, đối chiếu hóa đơn có hai dòng; giảm giá áp trên giá đã chốt. | Có logic giá thực đơn; cần API quản trị và gửi lượt |
| KT-16 Tổng quan · FR-16 | M | Đối soát doanh thu với hóa đơn đã thu theo ngày giờ Việt Nam, số bàn mở, tổng tạm tính, số hóa đơn và tỷ trọng theo phương thức. Kiểm tra làm mới 30 giây, so sánh cùng giờ hôm qua và bố cục 375 px. | Cần API báo cáo và UI |
| KT-17 Hao hụt · FR-17 | M | Keg 50 L bán ròng 92 cốc × 0,5 L cho kết quả 4 L, 8%, tô đỏ với ngưỡng 5%. Đối chiếu tổng lít và giá trị hao hụt với dữ liệu nhập; kiểm tra lọc ngày/ngưỡng và quyền Chủ quán. | Cần API báo cáo và UI |
| KT-18 Nhật ký · FR-18 | M | Hủy, giảm món và giảm cả hóa đơn xuất hiện với người yêu cầu/duyệt, lý do, thời gian và số tiền đúng. So khớp số lần/tổng tiền và thử từng bộ lọc hoặc kết hợp. | Cần API báo cáo |
| KT-19 Món bán chạy và giờ cao điểm · FR-19 | S | Kiểm tra top 10 theo số lượng/doanh thu và nhóm theo giờ thanh toán. Khoảng 31 ngày hợp lệ, trên 31 ngày bị chặn. Tải ≤3 giây với dữ liệu mẫu. | Cần API báo cáo và UI |

## 4. Kiểm thử phi chức năng và toàn vẹn

| Mã SRS | Phương pháp và tiêu chí |
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

**Điều kiện kết thúc từng đợt** build/typecheck và bộ hồi quy tương ứng đạt; toàn bộ ca bắt buộc trong phạm vi đợt đạt; lỗi chặn luồng, sai tiền, mất dữ liệu hoặc sai quyền đã được sửa và kiểm tra lại. Để nghiệm thu toàn hệ thống, tất cả ca M và NFR phải đạt và UAT được xác nhận. Ca S còn tồn cần được người phụ trách sản phẩm ghi nhận khi chốt nghiệm thu.

## 6. Ghi kết quả và quản lý lỗi

Dùng trạng thái `Not Run`, `Pass`, `Fail`, `Blocked`. Ghi lý do và điều kiện để chạy lại mỗi ca `Blocked`. Báo cáo số ca theo từng trạng thái và tính tỷ lệ đạt trên số đã chạy, `Pass / (Pass + Fail)`.

| Ca | Bản build | Ngày/người chạy | Trạng thái | Thực tế và bằng chứng | Mã lỗi hoặc lý do chặn |
|---|---|---|---|---|---|
| KT-01 |  |  | Not Run |  |  |
