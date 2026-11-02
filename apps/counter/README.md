# App quầy (bản web)

React 18 + Vite 5 + TypeScript, chạy trên Chrome hoặc Edge của máy quầy. Gói WBS 1.4.3, FR-01 đến FR-10.
App quầy làm dạng web thay cho Electron theo [CR-01](../../docs/change-requests/CR-01-app-quay-web.md); phiếu này đang chờ CCB duyệt.

## Chạy

```bash
# backend phải đang chạy ở cổng 3000 (docker compose up -d, hoặc pnpm --filter @biahoi/api dev)
pnpm --filter @biahoi/counter dev        # http://127.0.0.1:5174/quay/
```

Khi chạy bằng Docker, App quầy nằm ở **http://<ip máy chủ>:8080/quay/**. Các máy quầy trong cùng mạng LAN mở địa chỉ này.

PIN demo: nhân viên quầy `1111`, `2222`; quản lý ca `8888` (dùng để duyệt hủy/giảm và đóng ca).

### Cài đặt máy quầy

1. **Chế độ kiosk**: nhân viên không thoát nhầm, và phiếu in thẳng ra máy in mặc định, không hiện hộp thoại in. Tạo shortcut trên máy quầy:
   ```text
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --kiosk-printing http://192.168.1.10:8080/quay/
   ```
2. **Máy in**: mỗi trạm in (cài trong Web quản trị → Trạm in) chọn một trong hai cách:
   - **Máy in mạng** (khuyến nghị cho bếp): máy in nhiệt 80 mm có cổng LAN, đặt IP tĩnh. Máy chủ gửi phiếu thẳng tới máy in đó, nên phiếu bếp tự ra ở bếp. Bấm "In thử" để kiểm tra.
   - **Máy in của máy quầy**: phiếu in ra máy in mặc định của máy quầy (khổ 80 mm). Không có máy in thì chọn "Microsoft Print to PDF" (NFR-08). Hóa đơn và tạm tính luôn in theo cách này.
3. **Khóa thiết bị**: nếu máy chủ đặt `COUNTER_DEVICE_KEYS`, bấm "Cài đặt máy quầy" ở màn khóa và nhập khóa chủ quán cấp.

## Các màn

| Màn | Đường dẫn | FR |
|---|---|---|
| Màn khóa PIN, nút "Đổi người" ở thanh trên | `/quay/` khi chưa đăng nhập | FR-01 |
| Sơ đồ bàn theo khu, cập nhật realtime | `/quay/` | FR-02, FR-03 |
| Màn bàn: gọi món, in phiếu theo trạm, in lại, hủy/giảm có duyệt, tạm tính, chuyển/gộp | `/quay/ban/:id` | FR-04 đến FR-07 |
| Thanh toán: tiền mặt (tiền thừa), VietQR, kết hợp, giảm giá hóa đơn | `/quay/ban/:id/thanh-toan` | FR-08 |
| Vòi bia và thay keg | `/quay/voi-bia` | FR-10 |
| Mở / đóng ca, in báo cáo đóng ca | `/quay/ca` | FR-09 |

**Một số hành vi đáng chú ý:**
- **In phiếu**: mỗi lượt gọi in mỗi trạm một phiếu. Thông báo sau khi gửi cho biết từng trạm, vd "Bếp: đã in · Quầy rót bia: in ở máy quầy".
  - Máy in mạng không phản hồi thì bàn **tự chuyển đỏ** và có nút "In lại".
  - Với phiếu in ở máy quầy, nếu phiếu không ra thì bấm "Phiếu không ra? Báo lỗi in".
- **Font**: Be Vietnam Pro đóng gói cùng ứng dụng, nên mất Internet vẫn hiển thị và in đúng font.
- **Hủy món đã gửi** (FR-06): chạm vào món → chọn hủy hoặc giảm → chọn lý do → quản lý ca nhập PIN. Hủy thành công thì in phiếu báo hủy xuống trạm. Hủy món trong lượt đang nhập (chưa gửi) thì không cần duyệt.
- **Đồng bộ giữa các máy**:
  - Màn bàn và màn thanh toán chỉ tải lại khi chính bàn đó đổi, và nhiều thay đổi dồn dập được gộp thành một lần tải.
  - Đang thanh toán mà máy khác gọi thêm hoặc hủy món: số phải trả tự cập nhật, có dòng báo, và dấu "đã nhận chuyển khoản" bị bỏ để nhân viên kiểm tra lại số tiền.
  - Bàn đã được thanh toán ở máy khác thì màn thanh toán tự quay về sơ đồ.
- **Mất kết nối máy chủ** quá 2 giây: hiện dải đỏ trên cùng; có mạng lại thì dải tự ẩn và màn tự cập nhật.
- **Phiếu hủy không in được** ở máy in mạng: hiện thông báo để nhân viên báo trực tiếp cho bếp.
- **Nút món có ảnh**: ảnh do chủ quán tải lên ở Web quản trị. Món chưa có ảnh hiện mã tắt chữ to (vd `BHN`), để nhân viên nhớ mã. Món đã hết thì ảnh chuyển xám.
- **Màn khóa** có ảnh quán bia hơi vỉa hè Hà Nội ban đêm (ảnh của ben klocek trên Wikimedia Commons, CC BY 2.0).
- **Giao diện tối**: nút ở thanh trên (sau khi đăng nhập) và ở màn khóa. Quán đông nhất buổi tối nên màn tối đỡ chói mắt nhân viên. Màu bàn vẫn giữ đúng ý nghĩa theo FR-02 (xám, xanh, vàng, đỏ), chỉ chỉnh sắc độ cho nền tối. Lựa chọn lưu trên từng máy quầy.
- **Mã tắt**: gõ vào ô tìm món rồi Enter, vd `b` là bia hơi cốc, `c` là bia ca.

## Thiết kế

- **Phong cách**: theo skill `design-taste-frontend`, dùng phong cách `framed-sheet`, giữ màu và font của Web quản trị (`--keep palette,type`).
- **Khung**: viền xám ấm hình chữ L với thanh trái 88px có nhãn, thanh trên 48px; phần làm việc nằm trên một tấm trắng.
- **Màu bàn theo SRS FR-02**: xám = trống, xanh = đang ngồi, vàng = đã in tạm tính, đỏ = lỗi in.
- **Màn hình chuẩn**: 1366×768 (sơ đồ 10 cột, khu 30 bàn không phải cuộn ngang).
- **NFR-06**: chữ ≥ 14px, nút ≥ 44px (nút chính 56px, phím PIN 68px).
- **Kiểm tra**: `inspect.mjs --app` cho 0 FAIL trên 6 màn ở 1366px và 1024px. Cảnh báo khoảng trống còn lại là do tấm trắng luôn phủ kín màn máy quầy.

## Kiểm thử đầu-cuối

```bash
docker compose up -d --build
E2E_BASE_URL=http://127.0.0.1:8080 pnpm --filter @biahoi/counter e2e   # bỏ biến này để chạy với bản dev ở cổng 5174
```

10 test, mỗi test chạy như nhân viên quầy thật:
1. Đăng nhập PIN (cả PIN sai) và đổi người.
2. Hai máy quầy cùng lúc: máy B thấy bàn máy A vừa mở trong ≤ 3 giây.
3. Trọn một bàn: gọi món bằng mã tắt và bằng chạm, báo lỗi in và in lại, hủy món (PIN nhân viên bị từ chối, PIN quản lý được), tạm tính, chuyển bàn, gộp bàn, thanh toán tiền mặt có tiền thừa.
4. Chuyển khoản VietQR (phải đánh dấu đã nhận) kèm giảm giá hóa đơn.
5. Thay keg.
6. Đóng ca bằng PIN quản lý rồi mở ca mới.
7. Máy in mạng ở bếp: phiếu in thẳng; máy in tắt thì bàn đỏ; bật lại rồi "In lại".
8. Đang thanh toán ở máy A, máy B gọi thêm món: số phải trả của máy A đổi trong ≤ 3 giây.
9. Mất mạng thì hiện dải "Mất kết nối máy chủ", có mạng lại thì dải tự ẩn.
10. Đổi giao diện tối ở màn khóa và thanh trên, tải lại trang vẫn giữ.

Test máy in mạng tự dựng một máy in giả ở cổng 9105. Khi backend chạy trong Docker, nó gọi máy in qua `host.docker.internal`.

Bộ test tự seed lại dữ liệu demo trước khi chạy.
