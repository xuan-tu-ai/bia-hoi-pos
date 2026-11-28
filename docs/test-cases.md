# Ca kiểm thử chức năng

- **Ca đúng** dùng dữ liệu hợp lệ và quyền phù hợp để kiểm tra luồng thành công.
- **Ca lỗi** thử nhập sai, thiếu quyền hoặc thao tác sai trạng thái để xác nhận hệ thống xử lý đúng. Ca lỗi vẫn **Pass** nếu ứng dụng từ chối hoặc áp dụng quy tắc thay thế như mong đợi.

## Ma trận ca kiểm thử chức năng

M là bắt buộc, S là nên có.

| Ca / Yêu cầu | Ưu tiên | Thao tác và kết quả mong đợi |
|---|---|--- |
| KT-00 Khởi tạo | M | Gọi `/health` nhận 200; đường dẫn không tồn tại nhận 404; JSON lỗi nhận 400 `VALIDATION_ERROR`. Đếm 80 bàn và 20 phiên đang mở trong dữ liệu seed. |
| KT-01 Đăng nhập và quyền · FR-01 | M | Đăng nhập ba vai trò và gọi `/auth/me`; đăng nhập sai hoặc email lạ trả cùng thông báo; token thiếu, sai hoặc hết hạn nhận 401; khóa tài khoản sau đăng nhập rồi thử token cũ, truy cập bị từ chối. Gọi API quản trị bằng Quầy và Quản lý ca, nhận 403. |
| KT-02 Sơ đồ bàn · FR-02 | M | Kiểm tra 80 bàn không cuộn ngang ở 1366×768, đúng số bàn và chú thích màu xám/xanh/vàng, đúng tổng bàn có khách và tạm tính. Máy A mở bàn, máy B thấy màu đổi trong ≤3 giây mà không tải lại thủ công. |
| KT-03 Mở phiên · FR-03 | M | Mở bàn có và không nhập số khách. Hai máy đồng thời mở cùng bàn trống, chỉ tạo một phiên; máy nhận lỗi `TABLE_ALREADY_OPEN` nhận `tabId` và mở đúng phiên đó. |
| KT-04 Gọi món và in phiếu · FR-04 | M | Gửi món từ hai khu chế biến, nhận hai phiếu đúng khu, số bàn, người gửi, số lượng và ghi chú. Kiểm tra in lại giữ nguyên nội dung, món hết hàng bị chặn, lượt đã gửi giữ giá sau khi đổi giá và không sửa trực tiếp được. Người đã quen gửi ba món trong ≤10 giây. |
| KT-05 Chuyển và gộp · FR-05 | M | Chuyển sang bàn trống, giữ nguyên món/tổng tiền. Gộp hai bàn đang có khách, bàn đích bằng tổng trước gộp và bàn nguồn về trống. Chặn chuyển vào bàn bận và gộp vào bàn trống, giữ nguyên dữ liệu khi bị chặn. Đối chiếu nhật ký người thực hiện, giờ, bàn nguồn/đích. |
| KT-06 Hủy và giảm · FR-06 | M | Với Quầy, thử thiếu PIN, PIN sai, PIN hợp lệ; Quản lý ca/Chủ quán tự duyệt. Thử hủy đúng số lượng còn lại và vượt một đơn vị; kiểm tra lý do “Khác” kèm ghi chú. Hủy/giảm hợp lệ thêm dòng âm liên kết dòng gốc, giữ nguyên dòng đã gửi và ghi người yêu cầu/duyệt. |
| KT-07 Tạm tính · FR-07 | M | In hai lần, số lần in tăng, bàn chuyển vàng và vẫn gọi thêm món. Gộp các dòng cùng món/cùng giá, giữ riêng món khác giá, loại lượng đã hủy và tính tiền sau giảm. |
| KT-08 Thanh toán · FR-08 | M | Thử tiền mặt có tiền thừa, chuyển khoản và thanh toán hỗn hợp. Chặn thiếu tiền và chuyển khoản vượt số phải trả. Giảm cả hóa đơn bằng vai trò Quầy yêu cầu PIN. Quét QR kiểm tra số tiền và nội dung `BH<số hóa đơn>`. Khi thành công, bàn về trống và hóa đơn giữ nguyên khi gửi lại thao tác hoặc truy cập từ máy khác. Đối chiếu chỉ có một kết quả thanh toán cho phiên. |
| KT-09 Ca · FR-09 | S | Thử mở hai ca đồng thời và đóng ca bằng Quầy. Chỉ có một ca mở và chỉ Quản lý ca/Chủ quán được đóng. Ví dụ đầu ca 500.000 đ, tiền mặt thu 300.000 đ, đếm 780.000 đ, chênh lệch −20.000 đ; tiền chuyển khoản không cộng vào két. Khi chưa mở ca, hiển thị nhắc và vẫn cho mở bàn, gọi món, thanh toán. |
| KT-10 Thay keg · FR-10 | M | Thử thay bằng keg trong kho và keg đang dùng. Dùng mốc 89%, 90% để kiểm tra xác nhận thay sớm, hủy xác nhận giữ nguyên trạng thái. Keg cũ đóng, keg mới gắn đúng vòi; lít bán được tính theo thể tích ròng, đúng khoảng gắn keg. |
| KT-11 Thực đơn · FR-11 | M | Chủ quán thêm/sửa nhóm, khu chế biến và món; kiểm tra mã tắt trùng, bia có thể tích nhưng thiếu vòi, giá và trạng thái hết món trong API. Món hết hàng vẫn có cờ `available: false`; món ẩn không xuất hiện trên thực đơn. UI khóa chọn món hết và đổi giá không làm đổi lượt đã gửi. |
| KT-12 Khu và bàn · FR-12 | M | Chủ quán thêm, sửa, sắp xếp, ẩn/xóa theo tình trạng. Chặn mã bàn trùng, ẩn/xóa bàn bận, xóa khu còn bàn; bàn có lịch sử được ẩn theo đặc tả API. Kiểm tra nhật ký và quyền đọc danh mục của cả ba vai trò. |
| KT-13 Nhân viên · FR-13 | M | Tạo tài khoản, thử email trùng, đặt lại mật khẩu và khóa tài khoản. Chặn tự khóa và hạ quyền chủ quán cuối cùng. Kiểm tra PIN được bỏ đối với vai trò Quầy. Đối chiếu bcrypt trong DB thử và phản hồi API không trả mật khẩu, PIN hoặc giá trị băm. |
| KT-14 Nhập keg · FR-14 | M | Nhập 3 keg, kiểm tra 3 mã duy nhất và lọc theo trạng thái. Quầy bị từ chối, Quản lý ca/Chủ quán được nhập. Kiểm tra lỗi dữ liệu không tạo dở một phần lô. |
| KT-15 Giờ vàng · FR-15 | S | Kiểm tra ngay trước, tại và sau mỗi biên thời gian theo quy tắc đã xác nhận, ngày không áp dụng, khung tắt và hai khung cùng hiệu lực lấy giá thấp nhất. Gửi cùng món ở hai mức giá, đối chiếu hóa đơn có hai dòng; giảm giá áp trên giá đã chốt. |
| KT-16 Tổng quan · FR-16 | M | Đối soát doanh thu với hóa đơn đã thu theo ngày giờ Việt Nam, số bàn mở, tổng tạm tính, số hóa đơn và tỷ trọng theo phương thức. Kiểm tra làm mới 30 giây, so sánh cùng giờ hôm qua và bố cục 375 px. |
| KT-17 Hao hụt · FR-17 | M | Keg 50 L bán ròng 92 cốc × 0,5 L cho kết quả 4 L, 8%, tô đỏ với ngưỡng 5%. Đối chiếu tổng lít và giá trị hao hụt với dữ liệu nhập; kiểm tra lọc ngày/ngưỡng và quyền Chủ quán. |
| KT-18 Nhật ký · FR-18 | M | Hủy, giảm món và giảm cả hóa đơn xuất hiện với người yêu cầu/duyệt, lý do, thời gian và số tiền đúng. So khớp số lần/tổng tiền và thử từng bộ lọc hoặc kết hợp. |
| KT-19 Món bán chạy và giờ cao điểm · FR-19 | S | Kiểm tra top 10 theo số lượng/doanh thu và nhóm theo giờ thanh toán. Khoảng 31 ngày hợp lệ, trên 31 ngày bị chặn. Tải ≤3 giây với dữ liệu mẫu. |

## Ca thực thi

M là bắt buộc, S là nên có.

| Mã ca | Yêu cầu | Mức | Loại | Dữ liệu, thao tác và kết quả mong đợi |
|---|---|---|---|---|
| KT-00 | Khởi tạo | M | Smoke | Gọi `/health` → 200; xác nhận seed có 80 bàn và 20 phiên mở. |
| KT-01-01 | FR-01 | M | Đúng | Đăng nhập bằng tài khoản Quầy đang hoạt động, dùng token gọi /api/auth/me → trả đúng người và vai trò, không trả mật khẩu/PIN. |
| KT-01-02 | FR-01 | M | Lỗi | Sai mật khẩu → 401 INVALID_CREDENTIALS, không cấp token. |
| KT-02-01 | FR-02 | M | Đúng | Mở sơ đồ với seed 80 bàn ở 1366×768 → đủ bàn, màu và số liệu khớp trạng thái, không cuộn ngang. |
| KT-02-02 | FR-02 | M | Lỗi | Gọi /api/areas?include=tables khi thiếu token → 401, không trả sơ đồ. |
| KT-03-01 | FR-03 | M | Đúng | Mở một bàn trống với 4 khách → tạo đúng một phiên mở và bàn đổi trạng thái. |
| KT-03-02 | FR-03 | M | Lỗi | Hai máy cùng mở một bàn trống → chỉ một phiên được tạo, yêu cầu còn lại nhận TABLE_ALREADY_OPEN kèm tabId của phiên đó. |
| KT-04-01 | FR-04 | M | Đúng | Gửi món từ hai khu chế biến trong một lượt → lưu lượt, tách đúng hai phiếu và giữ giá đã chốt khi đổi giá danh mục. |
| KT-04-02 | FR-04 | M | Lỗi | Thử chọn món hết hàng → món không chọn được và không xuất hiện trong lượt gửi. |
| KT-05-01 | FR-05 | M | Đúng | Chuyển phiên sang bàn trống rồi gộp với bàn đang có khách → giữ món, tổng sau gộp bằng tổng hai phiên, bàn nguồn trống và có nhật ký. |
| KT-05-02 | FR-05 | M | Lỗi | Dùng Chuyển vào bàn đang có khách → bị chặn, giữ nguyên cả hai phiên. |
| KT-06-01 | FR-06 | M | Đúng | Quầy hủy một phần món bằng PIN hợp lệ và lý do “Nhập nhầm” → thêm dòng âm liên kết dòng gốc, có người yêu cầu và người duyệt. |
| KT-06-02 | FR-06 | M | Lỗi | Quầy hủy với PIN sai → bị từ chối, không thêm dòng âm và tổng tiền giữ nguyên. |
| KT-07-01 | FR-07 | M | Đúng | In tạm tính hai lần trên phiên còn mở → số lần in tăng, bàn vàng, lượng hủy được trừ, còn gọi thêm món được. |
| KT-07-02 | FR-07 | M | Lỗi | Yêu cầu tạm tính cho phiên đã đóng → 409 `TAB_NOT_OPEN`, không tạo bản tạm tính. |
| KT-08-01 | FR-08 | M | Đúng | Hóa đơn 150.000 đ, thu 100.000 đ tiền mặt và xác nhận 50.000 đ chuyển khoản → QR ghi 50.000 đ, thanh toán đúng tổng, bàn về trống. |
| KT-08-02 | FR-08 | M | Lỗi | Nhập tổng tiền nhận 149.000 đ cho hóa đơn 150.000 đ → không hoàn tất, phiên vẫn mở, không ghi nhận thanh toán thành công. |
| KT-09-01 | FR-09 | S | Đúng | Mở ca với 500.000 đ, thu tiền mặt 300.000 đ, Quản lý ca đóng với 780.000 đ → chênh lệch −20.000 đ. |
| KT-09-02 | FR-09 | S | Lỗi | Mở ca lần hai khi ca trước còn mở → bị chặn, chỉ một ca đang mở. |
| KT-10-01 | FR-10 | M | Đúng | Thay keg cũ bằng keg trong kho và xác nhận nếu dưới 90% → keg cũ Đã hết, keg mới Đang dùng đúng vòi. |
| KT-10-02 | FR-10 | M | Lỗi | Chọn keg đang dùng ở vòi khác để thay → bị chặn, trạng thái hai vòi và các keg giữ nguyên. |
| KT-11-01 | FR-11 | M | Đúng | Chủ quán tạo món với mã tắt duy nhất rồi đặt hết món → /api/menu trả available=false. |
| KT-11-02 | FR-11 | M | Lỗi | Tạo món thứ hai có cùng mã tắt → 409 DUPLICATE_SHORTCUT, không tạo món trùng. |
| KT-12-01 | FR-12 | M | Đúng | Chủ quán tạo khu và bàn mới có mã duy nhất → sơ đồ trả bàn thuộc đúng khu. |
| KT-12-02 | FR-12 | M | Lỗi | Xóa bàn đang có khách → 409 TABLE_NOT_EMPTY, bàn và phiên giữ nguyên. |
| KT-13-01 | FR-13 | M | Đúng | Chủ quán tạo Quản lý ca bằng email mới → tài khoản đăng nhập được, API danh sách không trả mật khẩu/PIN. |
| KT-13-02 | FR-13 | M | Lỗi | Tạo thêm tài khoản với email đã dùng → 409 DUPLICATE_EMAIL, không tạo tài khoản trùng. |
| KT-14-01 | FR-14 | M | Đúng | Quản lý ca nhập 3 keg hợp lệ → có 3 mã riêng, xuất hiện ở bộ lọc Trong kho. |
| KT-14-02 | FR-14 | M | Lỗi | Quầy gọi API nhập keg với cùng dữ liệu → 403, số keg trong kho giữ nguyên. |
| KT-15-01 | FR-15 | S | Đúng | Gửi món 15.000 đ lúc 17:00 trong khung giờ vàng 16:00–18:00 đang bật, giá ưu đãi 12.000 đ → lượt chốt 12.000 đ. |
| KT-15-02 | FR-15 | S | Lỗi | Gửi cùng món lúc 18:01, không có khung ưu đãi khác → áp đúng giá thường 15.000 đ. |
| KT-16-01 | FR-16 | M | Đúng | Chủ quán xem tổng quan trong ngày có hai hóa đơn đã thu 100.000 đ và 150.000 đ, một phiên mở 50.000 đ → doanh thu 250.000 đ, tạm tính 50.000 đ. |
| KT-16-02 | FR-16 | M | Lỗi | Quầy gọi API tổng quan → 403, không trả số liệu kinh doanh. |
| KT-17-01 | FR-17 | M | Đúng | Chủ quán xem keg 50 L đã hết, bán ròng 92 cốc 0,5 L → hao hụt 4 L (8%), tô đỏ ở ngưỡng 5%. |
| KT-17-02 | FR-17 | M | Lỗi | Quản lý ca gọi API hao hụt → 403, không trả dữ liệu hao hụt. |
| KT-18-01 | FR-18 | M | Đúng | Quản lý ca lọc nhật ký theo người duyệt của một lượt hủy đã biết → thấy mục tương ứng với đúng lý do, người yêu cầu/duyệt và số tiền. |
| KT-18-02 | FR-18 | M | Lỗi | Quầy gọi API nhật ký hủy/giảm → 403, không trả dữ liệu nhật ký. |
| KT-19-01 | FR-19 | S | Đúng | Chủ quán xem khoảng 7 ngày có dữ liệu → top món theo tiêu chí chọn, doanh thu nhóm theo giờ thanh toán, tải trong ≤3 giây với dữ liệu mẫu. |
| KT-19-02 | FR-19 | S | Lỗi | Chọn khoảng 32 ngày → báo vượt giới hạn 31 ngày. |

## Kết quả QA-02 ngày 28/11/2026

Backend trên `develop` đạt **58/58 test tự động** theo kết quả đợt QA-02 ngày 28/11/2026. Bảng dưới ghi các ca có kịch bản backend tương ứng. Dấu “—” ở cột mức độ lỗi nghĩa là ca đạt.

| Mã ca | Yêu cầu | Mức độ lỗi | Trạng thái | Ngày | Thao tác kiểm thử | Kết quả mong đợi | Kết quả ghi nhận và test đối chiếu |
|---|---|---|---|---|---|---|---|
| KT-00 | Khởi tạo | — | Pass | 28/11/2026 | Gọi `/health` và kiểm tra seed. | HTTP 200, 80 bàn, 20 phiên mở. | Đạt trong [01-khoi-tao](../backend/test/01-khoi-tao.test.ts). |
| KT-01-01 | FR-01 | — | Pass | 28/11/2026 | Đăng nhập và gọi `/auth/me`. | Đúng tài khoản, có token, không lộ mật khẩu/PIN. | Đạt trong [02-dang-nhap](../backend/test/02-dang-nhap.test.ts). |
| KT-01-02 | FR-01 | — | Pass | 28/11/2026 | Đăng nhập sai mật khẩu. | HTTP 401, `INVALID_CREDENTIALS`. | Đạt trong [02-dang-nhap](../backend/test/02-dang-nhap.test.ts). |
| KT-03-01 | FR-03 | — | Pass | 28/11/2026 | Mở bàn trống với 4 khách. | HTTP 201, đúng bàn, 4 khách, phiên mở. | Đạt trong [04-phien-ban](../backend/test/04-phien-ban.test.ts). |
| KT-03-02 | FR-03 | — | Pass | 28/11/2026 | Gửi yêu cầu mở bàn đồng thời và mở lại bàn đã có khách. | Một phiên mở. Mở lại nhận `TABLE_ALREADY_OPEN` kèm `tabId`. | Đạt trong hai test của [04-phien-ban](../backend/test/04-phien-ban.test.ts). |
| KT-09-01 | FR-09 | — | Pass | 28/11/2026 | Mở ca, thu tiền mặt và đóng ca bằng Quản lý ca. | Chênh lệch bằng tiền đếm trừ tiền đầu ca và tiền thu. | Công thức đạt với bộ số liệu tự động trong [05-thanh-toan-ca](../backend/test/05-thanh-toan-ca.test.ts). |
| KT-09-02 | FR-09 | — | Pass | 28/11/2026 | Mở ca lần hai khi còn ca đang mở. | Lỗi `SHIFT_ALREADY_OPEN` kèm ID ca hiện tại. | Đạt trong [05-thanh-toan-ca](../backend/test/05-thanh-toan-ca.test.ts). |
| KT-10-01 | FR-10 | — | Pass | 28/11/2026 | Thay keg chưa đạt ngưỡng 90% bằng keg trong kho và xác nhận. | Keg cũ hết, keg mới đang dùng đúng vòi. | Đạt trong [06-keg-gio-vang](../backend/test/06-keg-gio-vang.test.ts). |
| KT-11-01 | FR-11 | — | Pass | 28/11/2026 | Tạo món có mã tắt duy nhất rồi đặt hết món. | Thực đơn trả `available: false`. | Đạt trong [03-danh-muc](../backend/test/03-danh-muc.test.ts). |
| KT-11-02 | FR-11 | — | Pass | 28/11/2026 | Tạo món trùng mã tắt. | HTTP 409, `DUPLICATE_SHORTCUT`. | Đạt trong [03-danh-muc](../backend/test/03-danh-muc.test.ts). |
| KT-12-01 | FR-12 | — | Pass | 28/11/2026 | Tạo khu và bàn có mã duy nhất. | Tạo thành công, bàn thuộc đúng khu. | Đạt trong [03-danh-muc](../backend/test/03-danh-muc.test.ts). |
| KT-12-02 | FR-12 | — | Pass | 28/11/2026 | Xóa bàn đang có khách. | HTTP 409, `TABLE_NOT_EMPTY`. | Đạt trong [03-danh-muc](../backend/test/03-danh-muc.test.ts). |
| KT-13-01 | FR-13 | — | Pass | 28/11/2026 | Tạo tài khoản Quản lý ca, đăng nhập và kiểm tra danh sách nhân viên. | Đăng nhập được, danh sách không trả mật khẩu/PIN. | Đạt trong [03-danh-muc](../backend/test/03-danh-muc.test.ts). |
| KT-13-02 | FR-13 | — | Pass | 28/11/2026 | Tạo tài khoản bằng email đã tồn tại. | HTTP 409, `DUPLICATE_EMAIL`. | Đạt trong [03-danh-muc](../backend/test/03-danh-muc.test.ts). |
| KT-14-01 | FR-14 | — | Pass | 28/11/2026 | Nhập 3 keg và lọc Trong kho. | Ba mã riêng, đúng trạng thái kho. | Đạt trong [06-keg-gio-vang](../backend/test/06-keg-gio-vang.test.ts). |
| KT-15-01 | FR-15 | — | Pass | 28/11/2026 | Gửi lượt trong khung giờ vàng. | Lượt chốt giá ưu đãi. | Đạt với khung giờ và giá mẫu của [06-keg-gio-vang](../backend/test/06-keg-gio-vang.test.ts). |
| KT-16-01 | FR-16 | — | Pass | 28/11/2026 | Đối soát báo cáo hôm nay với hóa đơn và phiên đang mở từ seed. | Doanh thu và tạm tính khớp nguồn đối soát. | Đạt ở API với dữ liệu seed trong [07-bao-cao](../backend/test/07-bao-cao.test.ts). |
| KT-16-02 | FR-16 | — | Pass | 28/11/2026 | Quầy gọi API tổng quan. | HTTP 403. | Đạt trong [07-bao-cao](../backend/test/07-bao-cao.test.ts). |
| KT-17-02 | FR-17 | — | Pass | 28/11/2026 | Quản lý ca gọi API hao hụt. | HTTP 403. | Đạt trong [07-bao-cao](../backend/test/07-bao-cao.test.ts). |
| KT-18-02 | FR-18 | — | Pass | 28/11/2026 | Quầy gọi API nhật ký hủy/giảm. | HTTP 403. | Đạt trong [07-bao-cao](../backend/test/07-bao-cao.test.ts). |
| KT-19-02 | FR-19 | — | Pass | 28/11/2026 | Gọi API với khoảng ngày vượt 31 ngày. | HTTP 400, `RANGE_TOO_LARGE`. | Đạt ở API trong [07-bao-cao](../backend/test/07-bao-cao.test.ts). |

Các ca chưa có đủ bằng chứng tương ứng trong lần chạy backend vẫn ở trạng thái `Not Run` đối với phần chưa được kiểm tra. Ví dụ, KT-02-01 cần kiểm tra bố cục ở 1366×768 và KT-17-01 có kết quả API hao hụt 4 L (8%) nhưng còn cần xác minh tô đỏ trên giao diện.
