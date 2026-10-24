# Đặc tả yêu cầu phần mềm (SRS): Hệ thống quản lý quầy nhà hàng bia hơi

> Nhóm 7 — môn Quản trị dự án — ĐH Bách Khoa
> Phiên bản: 0.2 — 2026-10-24
> Người soạn: Nguyễn Xuân Tự (quản lý dự án)
> Tài liệu liên quan: `ke-hoach-quan-ly-du-an.md` (kế hoạch quản lý dự án), `tam-nhin.md` (hướng phát triển — ngoài phạm vi)

| Phiên bản | Ngày | Nội dung thay đổi |
|---|---|---|
| 0.1 | 24/10/2026 | Bản đầu: một web app có phân quyền |
| 0.2 | 24/10/2026 | Phân công mới sau buổi họp 24/10: tách backend (Node.js + Express) và frontend (React); thêm cấu trúc thư mục, sơ đồ phân rã chức năng, đặc tả API, bảng phân công & hạn hoàn thành |

> **Lưu ý:** phân công trong tài liệu này (mục 10) là bản mới nhất, thống nhất tại buổi họp 24/10. Nếu khác với kế hoạch quản lý dự án thì theo tài liệu này.

---

## 0. Cách dùng tài liệu này

Đây là **tài liệu chính** của dự án. Mọi thứ cần biết để làm sản phẩm đều nằm ở đây: làm gì, làm bằng công nghệ gì, code đặt ở đâu, API trông như thế nào, ai làm phần nào, hạn khi nào.

| Bạn là | Đọc kỹ các mục |
|---|---|
| Mọi người | 1, 2, 3, 10 |
| Hiếu (backend) | 4, 5, 6, 7, 8, 9 |
| Trung (frontend) | 4, 5, 6, 7 (để biết gọi API nào), 9 |
| Thái (kiểm thử) | 5, 6 (tiêu chí nghiệm thu chính là căn cứ viết test case), 10 |
| Tự (quản lý, duyệt PR) | Toàn bộ |

Khi bắt đầu một việc, hãy mở bảng ở mục 10, tìm việc của mình, rồi đọc các chức năng (FR) liên quan ở mục 6 và API liên quan ở mục 7. Mỗi chức năng có **tiêu chí nghiệm thu** — làm xong mà chưa đạt hết các tiêu chí này thì chưa tính là xong.

---

## 1. Giới thiệu

### 1.1 Bài toán

Một nhà hàng bia hơi đông khách có khoảng 80 bàn chia theo khu (trong nhà, sân, tầng 2). Phục vụ nhận yêu cầu tại bàn rồi báo về **quầy**. Nhân viên quầy nhập order, in phiếu cho bếp và người rót bia, cuối bữa tính tiền.

Khi làm bằng giấy, quán thường gặp các vấn đề:

- Sót món, ra nhầm bàn lúc đông khách.
- Tính tiền chậm và sai khi khách chuyển hoặc gộp bàn.
- **Thất thoát bia hơi:** không biết một keg (bom) bia 50 lít thực tế bán được bao nhiêu cốc.
- Hủy món tùy tiện, chủ quán không kiểm soát được.

### 1.2 Sản phẩm

Nhóm làm **một web app có phân quyền**, chạy trên trình duyệt (máy tính ở quầy, laptop, điện thoại). Người dùng đăng nhập và chỉ thấy những chức năng hợp với vai trò của mình.

| Phân hệ | Ai dùng | Làm gì |
|---|---|---|
| **Quầy** | Nhân viên quầy, Quản lý ca | Xem sơ đồ bàn, gọi món, in phiếu, chuyển/gộp bàn, hủy món (có duyệt), in tạm tính, thanh toán, mở/đóng ca, thay keg |
| **Quản trị** | Chủ quán | Quản lý thực đơn, khu & bàn, nhân viên, kho keg, giá giờ vàng |
| **Báo cáo** | Chủ quán (Quản lý ca xem một phần) | Doanh thu hôm nay, hao hụt keg, nhật ký hủy món, món bán chạy |

**Không làm** (xem `tam-nhin.md`): app desktop riêng, app điện thoại, chạy khi mất mạng, máy in nhiệt chuyên dụng (chỉ in qua trình duyệt), hóa đơn điện tử, tự xác nhận chuyển khoản qua ngân hàng, nhiều chi nhánh, app cho phục vụ, khách tự gọi món bằng QR, màn hình bếp, định lượng nguyên liệu, đặt bàn, combo, tách bill theo người, thông báo đẩy.

### 1.3 Thu thập yêu cầu

Yêu cầu được thu thập bằng **nghiên cứu tài liệu**: phân tích tài liệu hướng dẫn, video demo của các phần mềm quản lý nhà hàng phổ biến tại Việt Nam (KiotViet, iPOS, Sapo FnB, CukCuk), kết hợp tài liệu về vận hành quán bia hơi.

### 1.4 Từ điển thuật ngữ

| Thuật ngữ | Nghĩa | Tên trong code |
|---|---|---|
| Khu | Nhóm bàn theo vị trí (Trong nhà, Sân, Tầng 2) | `Area` |
| Bàn | Bàn vật lý | `DiningTable` |
| Phiên bàn | Một lượt khách ngồi, từ lúc mở bàn đến lúc thanh toán = một hóa đơn | `Tab` |
| Lượt gọi | Một lần gửi order cho một phiên bàn, có thể gồm nhiều món | `OrderRound` |
| Dòng món | Một món trong lượt gọi, kèm số lượng và đơn giá | `OrderLine` |
| Khu chế biến | Nơi nhận phiếu: Quầy rót bia, Bếp nướng, Bếp chiên… | `KitchenStation` |
| Keg | Thùng/bom bia hơi (30 L, 50 L) | `Keg` |
| Vòi | Vòi rót bia, mỗi lúc gắn một keg | `Tap` |
| Tạm tính | Hóa đơn in cho khách xem trước khi thanh toán | `PROVISIONAL` |
| PIN duyệt | Mã 4–6 số của Quản lý ca/Chủ quán, dùng để duyệt hủy/giảm giá | `approvalPin` |
| Giờ vàng | Khung giờ bán giá ưu đãi (happy hour) | `HappyHour` |

### 1.5 Mức ưu tiên

- **M (Bắt buộc):** phải có trong bản demo cuối kỳ.
- **S (Nên có):** làm sau khi xong hết M; được cắt nếu trễ.
- **C (Có thì tốt):** chỉ làm khi dư thời gian.

---

## 2. Người dùng & phân quyền

### 2.1 Ba vai trò

| Vai trò | Mã trong code | Mô tả |
|---|---|---|
| Nhân viên quầy | `COUNTER` | Nhập order, in phiếu, tính tiền |
| Quản lý ca | `SHIFT_MANAGER` | Như nhân viên quầy + duyệt hủy/giảm, đóng ca, xem báo cáo trong ngày |
| Chủ quán | `OWNER` | Toàn quyền: cấu hình hệ thống, xem mọi báo cáo |

### 2.2 Ma trận phân quyền

✔ = được · ◐ = được nếu có PIN của Quản lý ca/Chủ quán · — = không được

| Chức năng | COUNTER | SHIFT_MANAGER | OWNER |
|---|---|---|---|
| Sơ đồ bàn, mở bàn, gọi món, in phiếu | ✔ | ✔ | ✔ |
| Chuyển / gộp bàn | ✔ | ✔ | ✔ |
| Hủy / giảm món đã gửi | ◐ | ✔ | ✔ |
| Tạm tính, thanh toán | ✔ | ✔ | ✔ |
| Giảm giá cả hóa đơn | ◐ | ✔ | ✔ |
| Mở ca | ✔ | ✔ | ✔ |
| Đóng ca | — | ✔ | ✔ |
| Thay keg | ✔ | ✔ | ✔ |
| Nhập kho keg | — | ✔ | ✔ |
| Quản trị thực đơn, khu & bàn, giờ vàng | — | — | ✔ |
| Quản trị nhân viên | — | — | ✔ |
| Báo cáo hôm nay, nhật ký hủy/giảm | — | ✔ | ✔ |
| Báo cáo hao hụt keg, món bán chạy | — | — | ✔ |

**Quan trọng:** quyền phải được kiểm tra ở **backend** (middleware kiểm tra vai trò cho từng API). Frontend chỉ ẩn menu cho gọn; ẩn ở frontend không thay cho kiểm tra ở backend.

---

## 3. Sơ đồ phân rã chức năng

```mermaid
flowchart TD
  ROOT["Hệ thống quản lý quầy bia hơi"]
  ROOT --> C0["0. Chung"]
  ROOT --> C1["1. Phân hệ Quầy"]
  ROOT --> C2["2. Phân hệ Quản trị"]
  ROOT --> C3["3. Phân hệ Báo cáo"]

  C0 --> F01["FR-01 Đăng nhập & phân quyền"]

  C1 --> F02["FR-02 Sơ đồ bàn"]
  C1 --> F03["FR-03 Mở phiên bàn"]
  C1 --> F04["FR-04 Gọi món & in phiếu"]
  C1 --> F05["FR-05 Chuyển / gộp bàn"]
  C1 --> F06["FR-06 Hủy / giảm món có duyệt"]
  C1 --> F07["FR-07 In tạm tính"]
  C1 --> F08["FR-08 Thanh toán & VietQR"]
  C1 --> F09["FR-09 Mở / đóng ca (S)"]
  C1 --> F10["FR-10 Thay keg"]

  C2 --> F11["FR-11 Thực đơn & khu chế biến"]
  C2 --> F12["FR-12 Khu & bàn"]
  C2 --> F13["FR-13 Nhân viên"]
  C2 --> F14["FR-14 Nhập kho keg"]
  C2 --> F15["FR-15 Giá giờ vàng (S)"]

  C3 --> F16["FR-16 Tổng quan hôm nay"]
  C3 --> F17["FR-17 Hao hụt keg"]
  C3 --> F18["FR-18 Nhật ký hủy/giảm"]
  C3 --> F19["FR-19 Món bán chạy & giờ cao điểm (S)"]
```

Mỗi ô trong sơ đồ được mô tả chi tiết ở mục 6. Các chức năng không ghi (S) là mức **M (bắt buộc)**.

---

## 4. Công nghệ sử dụng

| Phần | Công nghệ | Ghi chú |
|---|---|---|
| Ngôn ngữ | **TypeScript** cho cả backend và frontend | Dùng chung một ngôn ngữ, dễ đọc code của nhau |
| Frontend | **React 18 + Vite** | |
| Giao diện | **Tailwind CSS + shadcn/ui** | Bộ component đẹp, dễ dùng |
| Điều hướng trang | React Router | |
| Gọi API | **axios + TanStack Query** | TanStack Query lo việc tải dữ liệu, tự làm mới |
| Form | react-hook-form + zod | |
| Biểu đồ | Recharts | Dùng cho phân hệ Báo cáo |
| Backend | **Node.js 20 + Express** | REST API, trả về JSON |
| Truy cập CSDL | **Prisma** | Định nghĩa bảng trong `schema.prisma`, tự sinh migration |
| Kiểm tra dữ liệu đầu vào | zod | Dùng ở mọi API nhận dữ liệu |
| Đăng nhập | bcrypt (băm mật khẩu & PIN) + jsonwebtoken (JWT) | |
| CSDL | **PostgreSQL** (gói miễn phí trên Neon hoặc Supabase, chỉ dùng như máy chủ Postgres) | Không cần cài Postgres trên máy |
| Triển khai | Backend: **Render** (gói miễn phí) · Frontend: **Vercel** (gói miễn phí) | Có đường dẫn công khai để demo |
| Quản lý mã nguồn | GitHub: `xuan-tu-ai/bia-hoi-pos` | Quy trình ở mục 9.4 |

---

## 5. Cấu trúc thư mục

Khi hoàn thành, repo trên GitHub sẽ trông như sau:

```
bia-hoi-pos/
├── README.md                     # Giới thiệu, cách chạy dự án
├── .gitignore
├── .github/                      # Mẫu issue & pull request
│
├── docs/                         # Toàn bộ tài liệu dự án
│   ├── srs.md                    # Tài liệu này (tài liệu chính)
│   ├── ke-hoach-quan-ly-du-an.md # Kế hoạch quản lý dự án
│   ├── tam-nhin.md               # Hướng phát triển
│   ├── thiet-ke-csdl.md          # Hiếu: giải thích các bảng, sơ đồ ERD
│   ├── api.md                    # Hiếu: đặc tả API chi tiết (mở rộng từ mục 7)
│   ├── man-hinh.md               # Trung: mô tả/phác thảo từng màn hình
│   ├── huong-dan-su-dung.md      # Trung: hướng dẫn sử dụng có ảnh chụp
│   ├── ke-hoach-kiem-thu.md      # Thái
│   ├── test-cases.md             # Thái
│   ├── bao-cao-kiem-thu.md       # Thái
│   ├── meetings/                 # Thái: biên bản họp (BB-<tuần>-<số>.md)
│   └── reports/                  # Tự: báo cáo tiến độ tuần (tuan-<n>.md)
│
├── backend/                      # Hiếu
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example              # Mẫu biến môi trường (KHÔNG commit file .env thật)
│   ├── prisma/
│   │   ├── schema.prisma         # Định nghĩa toàn bộ bảng (mục 8)
│   │   ├── migrations/           # Prisma tự sinh
│   │   └── seed.ts               # Dữ liệu mẫu (mục 8.3)
│   └── src/
│       ├── index.ts              # Khởi động server
│       ├── app.ts                # Tạo Express app, gắn middleware & routes
│       ├── config/env.ts         # Đọc biến môi trường
│       ├── lib/
│       │   ├── prisma.ts         # Prisma client dùng chung
│       │   ├── pricing.ts        # Tính giá (giá thường / giờ vàng)
│       │   ├── tab-total.ts      # Tính tổng tiền một phiên bàn
│       │   └── vietqr.ts         # Tạo đường dẫn ảnh VietQR
│       ├── middlewares/
│       │   ├── auth.ts           # Kiểm tra JWT, gắn req.user
│       │   ├── require-role.ts   # Kiểm tra vai trò
│       │   └── error-handler.ts  # Trả lỗi theo định dạng chung (mục 7.1)
│       └── modules/              # Mỗi nhóm chức năng một thư mục
│           ├── auth/             #   auth.routes.ts, auth.service.ts, auth.schema.ts
│           ├── areas/            #   khu & bàn
│           ├── menu/             #   nhóm món, món, khu chế biến
│           ├── staff/
│           ├── tabs/             #   mở bàn, chuyển, gộp, gọi món, hủy, tạm tính
│           ├── payments/
│           ├── shifts/
│           ├── kegs/             #   kho keg, vòi, thay keg
│           ├── happy-hours/
│           └── reports/
│
└── frontend/                     # Trung
    ├── package.json
    ├── vite.config.ts
    ├── index.html
    ├── .env.example              # VITE_API_URL=...
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── router.tsx            # Khai báo các trang & chặn trang theo vai trò
        ├── api/                  # Mỗi file gọi một nhóm API (auth.ts, tabs.ts, ...)
        │   └── client.ts         # axios: gắn token, xử lý lỗi 401
        ├── stores/auth.ts        # Lưu người dùng đang đăng nhập
        ├── components/
        │   ├── ui/               # Component của shadcn/ui
        │   ├── layout/           # Thanh bên, thanh trên, khung trang
        │   └── print/            # Mẫu in: phiếu bếp, tạm tính, hóa đơn
        ├── features/
        │   ├── auth/             # Trang đăng nhập
        │   ├── counter/          # Phân hệ Quầy
        │   ├── admin/            # Phân hệ Quản trị
        │   └── reports/          # Phân hệ Báo cáo
        ├── lib/format.ts         # Định dạng tiền, ngày giờ
        └── types/                # Kiểu dữ liệu khớp với response của API
```

---

## 6. Mô tả chức năng

Mỗi chức năng gồm: **mô tả**, **cách hoạt động**, **API dùng** (xem mục 7) và **tiêu chí nghiệm thu**.

### 6.0 Chung

#### FR-01 Đăng nhập & phân quyền — M

- **Mô tả:** người dùng đăng nhập bằng email + mật khẩu. Sau khi đăng nhập, menu bên trái chỉ hiện các chức năng hợp với vai trò (mục 2.2).
- **Cách hoạt động:** backend kiểm tra email/mật khẩu, trả về JWT (hết hạn sau 12 giờ) và thông tin người dùng. Frontend lưu token, gắn vào header `Authorization: Bearer <token>` cho mọi request. Khi token hết hạn (lỗi 401), tự chuyển về trang đăng nhập.
- **API:** `POST /api/auth/login`, `GET /api/auth/me`
- **Tiêu chí nghiệm thu:**
  - [ ] Sai email hoặc mật khẩu → báo "Email hoặc mật khẩu không đúng".
  - [ ] Tài khoản bị khóa không đăng nhập được.
  - [ ] Nhân viên quầy gõ thẳng đường dẫn trang Quản trị → thấy trang "Bạn không có quyền truy cập trang này"; gọi thẳng API quản trị → nhận lỗi 403.
  - [ ] Mọi thao tác thay đổi dữ liệu đều lưu lại ai làm.

### 6.1 Phân hệ Quầy

#### FR-02 Sơ đồ bàn — M

- **Mô tả:** màn hình chính của nhân viên quầy. Mỗi khu là một tab; bàn hiển thị dạng lưới ô vuông.
- **Cách hoạt động:**
  - Mỗi ô bàn hiện: số bàn (chữ to), tổng tiền đang có, thời gian đã ngồi (vd "1g 25p").
  - Màu theo trạng thái: **xám** = trống; **xanh** = đang ngồi; **vàng** = đã in tạm tính.
  - Phía trên có: chú thích màu, "Đang ngồi 25/80", "Tạm tính đang mở: 6.420.000 ₫".
  - Frontend tự tải lại dữ liệu mỗi 3 giây (TanStack Query `refetchInterval`) để thấy thay đổi từ máy khác.
- **API:** `GET /api/areas?include=tables`, `GET /api/tabs/summary`
- **Tiêu chí nghiệm thu:**
  - [ ] Hiển thị đủ 80 bàn trên màn hình 1366×768 mà không phải cuộn ngang.
  - [ ] Máy A mở bàn → máy B thấy bàn đổi màu trong ≤ 3 giây, không cần bấm tải lại.
  - [ ] Bấm bàn trống → mở bàn (FR-03); bấm bàn đang ngồi → vào màn phiên bàn.

#### FR-03 Mở phiên bàn — M

- **Mô tả:** bấm vào bàn trống để bắt đầu một phiên bàn mới.
- **Cách hoạt động:** hiện hộp thoại nhập số khách (không bắt buộc), bấm "Mở bàn".
- **API:** `POST /api/tabs`
- **Tiêu chí nghiệm thu:**
  - [ ] Một bàn chỉ có tối đa 1 phiên đang mở.
  - [ ] Hai máy cùng mở một bàn → máy sau nhận thông báo "Bàn đã được mở" và được đưa vào phiên đó (backend trả lỗi `TABLE_ALREADY_OPEN` kèm `tabId`).

#### FR-04 Gọi món & in phiếu — M

- **Mô tả:** màn phiên bàn, nơi nhân viên chọn món và gửi đi.
- **Cách hoạt động:**
  - Bên trái: món chia theo nhóm (Bia, Đồ nướng, Đồ chiên, Đồ nhắm) dạng nút to có giá; ô tìm kiếm theo tên hoặc mã tắt (vd gõ `b` ra "Bia hơi cốc"). Món "Hết món" bị mờ, không bấm được.
  - Bên phải: "Lượt đang nhập" với nút +/– và ô ghi chú cho từng món; nút **Gửi**. Bên dưới là lịch sử các lượt đã gửi (giờ, người gửi, món).
  - Bấm **Gửi** → backend lưu lượt gọi, **chốt giá tại thời điểm gửi** (nếu đang giờ vàng thì lấy giá giờ vàng), trả về danh sách phiếu đã tách theo khu chế biến. Frontend hiện bản xem trước phiếu khổ 80 mm (số bàn, giờ, tên nhân viên, món, số lượng, ghi chú) và nút **In** (gọi `window.print()`, chỉ in phần phiếu).
  - Mỗi lượt đã gửi có nút "In lại phiếu".
- **API:** `GET /api/menu`, `GET /api/tabs/:id`, `POST /api/tabs/:id/rounds`
- **Tiêu chí nghiệm thu:**
  - [ ] Gửi một lượt có món ở 2 khu chế biến → ra đúng 2 phiếu, mỗi phiếu chỉ có món của khu đó.
  - [ ] Đổi giá món trong Quản trị không làm đổi giá các lượt đã gửi.
  - [ ] Lượt đã gửi không sửa trực tiếp được (chỉ hủy qua FR-06).
  - [ ] Người đã quen gửi được một lượt 3 món trong ≤ 10 giây.

#### FR-05 Chuyển / gộp bàn — M

- **Mô tả:** khách đổi chỗ, hoặc hai nhóm muốn ngồi chung và trả chung.
- **Cách hoạt động:**
  - **Chuyển bàn:** chọn một bàn đích đang trống → cả phiên chuyển sang bàn đó.
  - **Gộp bàn:** chọn một bàn đích đang có khách → toàn bộ món của bàn hiện tại chuyển vào phiên của bàn đích; bàn hiện tại trở về trống.
- **API:** `POST /api/tabs/:id/move`, `POST /api/tabs/:id/merge`
- **Tiêu chí nghiệm thu:**
  - [ ] Sau khi gộp, tổng tiền bàn đích = tổng hai bàn trước khi gộp.
  - [ ] Chuyển vào bàn đang có khách bị chặn (phải dùng Gộp); gộp vào bàn trống bị chặn (phải dùng Chuyển).
  - [ ] Thao tác chuyển/gộp được lưu lại: ai, lúc nào, từ bàn nào sang bàn nào.

#### FR-06 Hủy / giảm món đã gửi (có duyệt) — M

- **Mô tả:** khi khách đổi ý, bếp hết món hoặc nhập nhầm, nhân viên cần hủy hoặc giảm giá món đã gửi. Đây là chỗ dễ gian lận nên phải có duyệt.
- **Cách hoạt động:**
  - Chọn món trong một lượt đã gửi → "Hủy" (chọn số lượng) hoặc "Giảm giá" (theo % hoặc số tiền).
  - Bắt buộc chọn lý do: Khách đổi ý, Bếp hết món, Nhập nhầm, Món lỗi, Khác (kèm ghi chú).
  - Nếu người đang đăng nhập là **Nhân viên quầy** → hiện hộp thoại "Nhập PIN Quản lý ca". Quản lý ca/Chủ quán thì không cần.
  - Backend **không xóa** dòng món cũ mà tạo thêm một **dòng âm** (`VOID` hoặc `DISCOUNT`) trỏ về dòng gốc, lưu lý do, người yêu cầu, người duyệt.
  - Bỏ món khi đang nhập (chưa gửi) thì xóa thoải mái, không cần duyệt.
- **API:** `POST /api/order-lines/:id/void`, `POST /api/order-lines/:id/discount`
- **Tiêu chí nghiệm thu:**
  - [ ] Nhân viên quầy không hủy được nếu thiếu PIN hoặc PIN sai (báo "PIN không đúng").
  - [ ] Không hủy được nhiều hơn số lượng còn lại của món đó.
  - [ ] Mỗi lần hủy/giảm xuất hiện trong Nhật ký hủy/giảm (FR-18) với đủ: món, số lượng, số tiền, lý do, người yêu cầu, người duyệt, thời gian.

#### FR-07 In tạm tính — M

- **Mô tả:** khách muốn xem bill trước khi trả tiền.
- **Cách hoạt động:** in hóa đơn tạm tính, gộp các món cùng tên và cùng đơn giá thành một dòng (vd "Bia hơi cốc ×10 — 150.000 ₫"). Cuối hóa đơn ghi "Tạm tính — lần in N — HH:mm".
- **API:** `POST /api/tabs/:id/provisional`
- **Tiêu chí nghiệm thu:**
  - [ ] In bao nhiêu lần cũng được, số lần in tăng dần.
  - [ ] Sau khi in, bàn chuyển màu vàng nhưng vẫn gọi thêm món được.
  - [ ] Món đã hủy không hiện; món bị giảm giá hiện đúng số tiền sau giảm.

#### FR-08 Thanh toán & VietQR — M

- **Mô tả:** tính tiền và đóng phiên bàn.
- **Cách hoạt động:**
  - Màn thanh toán hiện: tổng tiền, ô giảm giá cả hóa đơn (nhân viên quầy cần PIN), chọn phương thức:
    - **Tiền mặt:** nhập tiền khách đưa (có nút nhanh 100k/200k/500k) → hiện tiền thừa.
    - **Chuyển khoản:** hiện ảnh mã **VietQR** có sẵn số tiền và nội dung `BH<số hóa đơn>`. Nhân viên kiểm tra điện thoại rồi bấm "Đã nhận tiền".
    - Có thể chia một phần tiền mặt, một phần chuyển khoản.
  - Bấm hoàn tất → backend lưu thanh toán, đóng phiên, bàn về trống; frontend hiện hóa đơn để in.
  - Ảnh VietQR dùng dịch vụ miễn phí `https://img.vietqr.io/image/<mã ngân hàng>-<số tài khoản>-compact2.png?amount=<số tiền>&addInfo=<nội dung>&accountName=<tên>`. Thông tin tài khoản của quán lấy từ biến môi trường backend.
- **API:** `GET /api/tabs/:id/vietqr?amount=...`, `POST /api/tabs/:id/pay`
- **Tiêu chí nghiệm thu:**
  - [ ] Không hoàn tất được khi tổng tiền nhận nhỏ hơn số phải trả.
  - [ ] Mã QR quét bằng app ngân hàng điền đúng số tiền.
  - [ ] Hóa đơn đã thanh toán không sửa được; bàn trở về trống ngay sau thanh toán.

#### FR-09 Mở / đóng ca — S

- **Mô tả:** theo dõi tiền trong két theo ca.
- **Cách hoạt động:** mở ca nhập tiền đầu ca. Đóng ca (chỉ Quản lý ca/Chủ quán): hệ thống tính tổng tiền mặt và chuyển khoản thu trong ca; người đóng ca nhập tiền mặt đếm được → hiện chênh lệch.
- **API:** `POST /api/shifts/open`, `GET /api/shifts/current`, `POST /api/shifts/:id/close`, `GET /api/shifts`
- **Tiêu chí nghiệm thu:**
  - [ ] Không mở được ca mới khi đang có ca chưa đóng.
  - [ ] Chênh lệch = tiền đếm − (tiền đầu ca + tiền mặt thu trong ca).

#### FR-10 Thay keg — M

- **Mô tả:** khi keg trên vòi hết, nhân viên thay keg mới. Dữ liệu này dùng để tính hao hụt bia.
- **Cách hoạt động:**
  - Màn "Vòi bia": mỗi vòi một thẻ, hiện keg đang gắn, gắn từ lúc nào, số lít đã bán và thanh tiến độ so với dung tích.
  - Mỗi món bia hơi có **thể tích** (cốc 500 ml, ca 1.500 ml, tháp 3.000 ml) và **vòi mặc định**. Số lít đã bán của keg = tổng thể tích các món bia (trừ món đã hủy) được gửi trong thời gian keg đó gắn trên vòi.
  - Bấm "Thay keg" → chọn keg mới từ kho → keg cũ chuyển "Đã hết" (lưu thời điểm và số lít đã bán), keg mới chuyển "Đang dùng".
- **API:** `GET /api/taps`, `POST /api/taps/:id/change-keg`
- **Tiêu chí nghiệm thu:**
  - [ ] Chỉ chọn được keg đang "Trong kho".
  - [ ] Keg vừa thay ra xuất hiện đúng trong báo cáo hao hụt (FR-17).

### 6.2 Phân hệ Quản trị

#### FR-11 Thực đơn & khu chế biến — M

- **Mô tả:** chủ quán quản lý danh sách món.
- **Cách hoạt động:**
  - Bảng món có lọc theo nhóm và ô tìm kiếm. Cột: tên, mã tắt, nhóm, giá, đơn vị, khu chế biến, trạng thái (nút gạt Còn / Hết món).
  - Thêm/sửa món: tên, mã tắt (không trùng), nhóm, giá, đơn vị, khu chế biến; nếu tích "Là bia hơi" thì nhập thể tích (ml) và vòi mặc định.
  - Thêm/sửa/sắp xếp nhóm món; thêm/sửa khu chế biến.
  - Không xóa hẳn món đã từng bán, chỉ cho ẩn (`active = false`).
- **API:** `GET/POST/PATCH /api/menu-groups`, `GET/POST/PATCH /api/menu-items`, `GET/POST/PATCH /api/kitchen-stations`
- **Tiêu chí nghiệm thu:**
  - [ ] Món "Hết món" hiện mờ và không bấm được ở màn gọi món.
  - [ ] Mã tắt trùng → báo lỗi "Mã tắt đã tồn tại".
  - [ ] Đổi giá không ảnh hưởng các lượt đã gửi.

#### FR-12 Khu & bàn — M

- **Mô tả:** chủ quán cấu hình sơ đồ quán.
- **Cách hoạt động:** thêm/sửa/sắp xếp khu; thêm/sửa/xóa/sắp xếp bàn trong mỗi khu.
- **API:** `GET/POST/PATCH/DELETE /api/areas`, `POST/PATCH/DELETE /api/tables`
- **Tiêu chí nghiệm thu:**
  - [ ] Không xóa được bàn đang có khách (báo "Bàn đang có khách, không thể xóa").
  - [ ] Không xóa được khu còn bàn.

#### FR-13 Nhân viên — M

- **Mô tả:** chủ quán tạo tài khoản và phân quyền.
- **Cách hoạt động:** bảng nhân viên (họ tên, email, vai trò, trạng thái). Thêm/sửa: họ tên, email, mật khẩu (khi tạo mới hoặc đặt lại), vai trò, PIN duyệt (chỉ cho Quản lý ca và Chủ quán), Hoạt động/Đã khóa.
- **API:** `GET/POST/PATCH /api/staff`
- **Tiêu chí nghiệm thu:**
  - [ ] Tài khoản bị khóa không đăng nhập được.
  - [ ] Không tự khóa chính mình; không hạ quyền hoặc khóa chủ quán cuối cùng.
  - [ ] Mật khẩu và PIN được lưu dạng băm, API không bao giờ trả chúng về.

#### FR-14 Nhập kho keg — M

- **Mô tả:** ghi nhận keg nhập về.
- **Cách hoạt động:** thẻ tổng: Trong kho / Đang dùng / Đã hết. Bảng keg: mã keg, loại bia, dung tích, giá nhập, ngày nhập, trạng thái, vòi. Nút "Nhập keg": loại bia, dung tích (30 L/50 L), giá nhập, ngày nhập, số lượng (tạo nhiều keg một lần).
- **API:** `GET /api/kegs`, `POST /api/kegs`
- **Tiêu chí nghiệm thu:**
  - [ ] Nhập số lượng 3 → tạo 3 keg với mã khác nhau.
  - [ ] Lọc được theo trạng thái.

#### FR-15 Giá giờ vàng — S

- **Mô tả:** bán giá ưu đãi theo khung giờ (vd bia hơi cốc 12.000 ₫ từ 16:00–18:00, thứ 2 đến thứ 6).
- **Cách hoạt động:** danh sách khung giờ vàng: tên, các thứ trong tuần, giờ bắt đầu – kết thúc, bật/tắt; mỗi khung chọn món và giá ưu đãi. Khi gửi lượt gọi trong khung giờ đang bật, backend dùng giá ưu đãi.
- **API:** `GET/POST/PATCH/DELETE /api/happy-hours`
- **Tiêu chí nghiệm thu:**
  - [ ] Gửi trong khung giờ → giá ưu đãi; ngoài khung → giá thường.
  - [ ] Cùng một món nhưng hai giá khác nhau → hóa đơn tách thành 2 dòng.

### 6.3 Phân hệ Báo cáo

Các màn báo cáo phải hiển thị tốt trên điện thoại (chiều ngang 375 px), vì chủ quán thường xem bằng điện thoại.

#### FR-16 Tổng quan hôm nay — M

- **Mô tả:** chủ quán nắm nhanh tình hình trong ngày.
- **Cách hoạt động:** các thẻ số liệu: Doanh thu đã thu, Tạm tính đang mở, Bàn đang ngồi (x/80), Số hóa đơn — mỗi thẻ có so sánh "so với cùng giờ hôm qua" (+/– %). Biểu đồ doanh thu theo giờ hôm nay so với hôm qua; tỉ lệ tiền mặt / chuyển khoản. Tự làm mới mỗi 30 giây.
- **API:** `GET /api/reports/today`
- **Tiêu chí nghiệm thu:**
  - [ ] Doanh thu đã thu khớp tổng các hóa đơn đã thanh toán trong ngày.
  - [ ] Hiển thị gọn trên điện thoại, không vỡ bố cục.

#### FR-17 Hao hụt keg — M

- **Mô tả:** điểm khác biệt của sản phẩm — cho chủ quán biết mỗi keg thất thoát bao nhiêu.
- **Cách hoạt động:** bảng các keg đã hết: mã keg, loại bia, vòi, dung tích, đã bán (L), **hao hụt (L) = dung tích − đã bán**, tỉ lệ %, thời gian dùng. Keg vượt ngưỡng (mặc định 5%, chỉnh được) tô đỏ. Dòng tổng: "Tổng hao hụt: x L ≈ y ₫".
- **API:** `GET /api/reports/keg-loss?from=&to=&threshold=`
- **Tiêu chí nghiệm thu:**
  - [ ] Dữ liệu mẫu có keg 50 L đã bán 92 cốc 0,5 L → hiện hao hụt 4 L = 8%, tô đỏ.

#### FR-18 Nhật ký hủy/giảm — M

- **Mô tả:** chủ quán kiểm soát việc hủy món.
- **Cách hoạt động:** bộ lọc: khoảng ngày, nhân viên, người duyệt, lý do. Bảng: thời gian, bàn, món, số lượng, số tiền, loại (Hủy/Giảm), lý do, người yêu cầu, người duyệt. Phía trên: số lần và tổng tiền bị hủy/giảm.
- **API:** `GET /api/reports/voids?from=&to=&staffId=&approverId=&reason=`
- **Tiêu chí nghiệm thu:**
  - [ ] Mọi lần hủy/giảm ở FR-06 và giảm giá hóa đơn ở FR-08 đều có mặt.

#### FR-19 Món bán chạy & giờ cao điểm — S

- **Mô tả:** giúp chủ quán biết món nào bán tốt, giờ nào đông.
- **Cách hoạt động:** chọn khoảng ngày (tối đa 31 ngày), chọn xếp theo số lượng hoặc doanh thu. Biểu đồ cột top 10 món; biểu đồ doanh thu theo giờ trong ngày.
- **API:** `GET /api/reports/top-items?from=&to=&by=`, `GET /api/reports/hourly?from=&to=`
- **Tiêu chí nghiệm thu:**
  - [ ] Chọn khoảng quá 31 ngày → báo lỗi.
  - [ ] Tải xong trong ≤ 3 giây với dữ liệu mẫu.

### 6.4 Yêu cầu chung (phi chức năng)

| Mã | Yêu cầu |
|---|---|
| NFR-01 | Mỗi thao tác ở phân hệ Quầy phản hồi ≤ 1 giây với 80 bàn đang mở |
| NFR-02 | Ít nhất 3 máy dùng cùng lúc; thay đổi ở máy này hiện ở máy khác trong ≤ 3 giây |
| NFR-03 | Người mới tự gửi được lượt gọi đầu tiên trong ≤ 5 phút mà không cần hướng dẫn |
| NFR-04 | Lượt gọi, hóa đơn đã thanh toán, nhật ký không bao giờ bị xóa/sửa; tiền lưu bằng số nguyên VND |
| NFR-05 | Mật khẩu & PIN băm bằng bcrypt; mọi API (trừ đăng nhập) yêu cầu token; quyền kiểm tra ở backend |
| NFR-06 | Giao diện tiếng Việt; màn Quầy dùng tốt trên màn hình ≥ 1366×768, nút chính ≥ 44×44 px; màn Báo cáo dùng được trên điện thoại |
| NFR-07 | Chạy đúng trên Chrome và Edge bản mới nhất |
| NFR-08 | Truy cập được qua đường dẫn công khai để demo |

---

## 7. Đặc tả API

Đây là "hợp đồng" giữa backend (Hiếu) và frontend (Trung). **Muốn đổi bất kỳ API nào thì hai bạn phải thống nhất và cập nhật lại mục này (hoặc `docs/api.md`) trước khi code.** Hiếu sẽ viết `docs/api.md` chi tiết hơn ở pha Thiết kế, dựa trên mục này.

### 7.1 Quy ước chung

- Địa chỉ gốc: `/api`. Dữ liệu gửi/nhận là JSON.
- Mọi API trừ `POST /api/auth/login` đều cần header `Authorization: Bearer <token>`.
- Tên trường dùng `camelCase`. Tiền là **số nguyên VND** (vd `15000`). Thời gian là chuỗi ISO 8601 (vd `"2026-11-20T19:30:00.000Z"`).
- Thành công: trả về dữ liệu trực tiếp (object hoặc mảng). Danh sách dài có phân trang: `?page=1&pageSize=20` → `{ "items": [...], "total": 120 }`.
- Lỗi: luôn trả về dạng

```json
{ "error": { "code": "TABLE_ALREADY_OPEN", "message": "Bàn đã được mở", "details": { "tabId": 42 } } }
```

| HTTP | Khi nào | Ví dụ `code` |
|---|---|---|
| 400 | Dữ liệu gửi lên sai | `VALIDATION_ERROR`, `INVALID_PIN`, `INSUFFICIENT_PAYMENT` |
| 401 | Chưa đăng nhập / token hết hạn | `UNAUTHORIZED` |
| 403 | Không đủ quyền | `FORBIDDEN` |
| 404 | Không tìm thấy | `NOT_FOUND` |
| 409 | Xung đột trạng thái | `TABLE_ALREADY_OPEN`, `TABLE_NOT_EMPTY`, `DUPLICATE_SHORTCUT`, `SHIFT_ALREADY_OPEN` |

`message` viết bằng tiếng Việt để frontend hiển thị thẳng cho người dùng.

### 7.2 Danh sách API

Cột **Quyền**: C = COUNTER, M = SHIFT_MANAGER, O = OWNER.

| Nhóm | Phương thức & đường dẫn | Mục đích | Quyền | FR |
|---|---|---|---|---|
| Auth | `POST /api/auth/login` | Đăng nhập | Ai cũng gọi được | 01 |
| | `GET /api/auth/me` | Thông tin người đang đăng nhập | C M O | 01 |
| Khu & bàn | `GET /api/areas?include=tables` | Danh sách khu kèm bàn | C M O | 02, 12 |
| | `POST /api/areas` · `PATCH /api/areas/:id` · `DELETE /api/areas/:id` | Thêm/sửa/xóa khu | O | 12 |
| | `POST /api/tables` · `PATCH /api/tables/:id` · `DELETE /api/tables/:id` | Thêm/sửa/xóa bàn | O | 12 |
| Phiên bàn | `GET /api/tabs/summary` | Trạng thái mọi bàn (cho sơ đồ bàn) | C M O | 02 |
| | `POST /api/tabs` | Mở phiên bàn | C M O | 03 |
| | `GET /api/tabs/:id` | Chi tiết phiên: các lượt, các dòng, tổng tiền | C M O | 04 |
| | `POST /api/tabs/:id/rounds` | Gửi lượt gọi | C M O | 04 |
| | `POST /api/tabs/:id/move` | Chuyển bàn | C M O | 05 |
| | `POST /api/tabs/:id/merge` | Gộp vào phiên khác | C M O | 05 |
| | `POST /api/order-lines/:id/void` | Hủy món đã gửi | C (cần PIN) M O | 06 |
| | `POST /api/order-lines/:id/discount` | Giảm giá món đã gửi | C (cần PIN) M O | 06 |
| | `POST /api/tabs/:id/provisional` | Ghi nhận in tạm tính, trả về hóa đơn | C M O | 07 |
| Thanh toán | `GET /api/tabs/:id/vietqr?amount=` | Lấy đường dẫn ảnh VietQR | C M O | 08 |
| | `POST /api/tabs/:id/pay` | Thanh toán & đóng phiên | C M O | 08 |
| Ca | `POST /api/shifts/open` · `GET /api/shifts/current` | Mở ca / ca hiện tại | C M O | 09 |
| | `POST /api/shifts/:id/close` · `GET /api/shifts` | Đóng ca / danh sách ca | M O | 09 |
| Vòi & keg | `GET /api/taps` | Danh sách vòi, keg đang gắn, số lít đã bán | C M O | 10 |
| | `POST /api/taps/:id/change-keg` | Thay keg | C M O | 10 |
| | `GET /api/kegs?status=` · `POST /api/kegs` | Danh sách / nhập keg | M O | 14 |
| Thực đơn | `GET /api/menu` | Toàn bộ thực đơn cho màn gọi món (nhóm → món, kèm giá hiện hành) | C M O | 04 |
| | `GET/POST /api/menu-groups` · `PATCH /api/menu-groups/:id` | Nhóm món | O | 11 |
| | `GET/POST /api/menu-items` · `PATCH /api/menu-items/:id` | Món | O | 11 |
| | `GET/POST /api/kitchen-stations` · `PATCH /api/kitchen-stations/:id` | Khu chế biến | O | 11 |
| Nhân viên | `GET/POST /api/staff` · `PATCH /api/staff/:id` | Nhân viên | O | 13 |
| Giờ vàng | `GET/POST /api/happy-hours` · `PATCH/DELETE /api/happy-hours/:id` | Khung giờ vàng & giá | O | 15 |
| Báo cáo | `GET /api/reports/today` | Tổng quan hôm nay | M O | 16 |
| | `GET /api/reports/keg-loss` | Hao hụt keg | O | 17 |
| | `GET /api/reports/voids` | Nhật ký hủy/giảm | M O | 18 |
| | `GET /api/reports/top-items` · `GET /api/reports/hourly` | Món bán chạy, doanh thu theo giờ | O | 19 |

### 7.3 Ví dụ các API quan trọng

**Đăng nhập** — `POST /api/auth/login`

```json
// Request
{ "email": "lan@biahoi.vn", "password": "123456" }

// Response 200
{
  "token": "eyJhbGciOi...",
  "user": { "id": 2, "fullName": "Nguyễn Thị Lan", "email": "lan@biahoi.vn", "role": "COUNTER" }
}
```

**Trạng thái bàn** — `GET /api/tabs/summary`

```json
// Response 200
{
  "occupied": 25,
  "totalTables": 80,
  "openAmount": 6420000,
  "tables": [
    { "tableId": 12, "code": "12", "areaId": 1, "status": "OCCUPIED", "tabId": 301, "total": 345000, "openedAt": "2026-11-20T11:05:00.000Z" },
    { "tableId": 13, "code": "13", "areaId": 1, "status": "EMPTY" },
    { "tableId": 14, "code": "14", "areaId": 1, "status": "PROVISIONAL_PRINTED", "tabId": 298, "total": 1210000, "openedAt": "2026-11-20T10:20:00.000Z" }
  ]
}
```

**Mở bàn** — `POST /api/tabs`

```json
// Request
{ "tableId": 13, "guestCount": 6 }

// Response 201
{ "id": 302, "tableId": 13, "guestCount": 6, "status": "OPEN", "openedAt": "2026-11-20T12:01:00.000Z" }

// Response 409 (bàn đã được máy khác mở)
{ "error": { "code": "TABLE_ALREADY_OPEN", "message": "Bàn đã được mở", "details": { "tabId": 302 } } }
```

**Gửi lượt gọi** — `POST /api/tabs/:id/rounds`

```json
// Request
{
  "items": [
    { "menuItemId": 1, "qty": 4 },
    { "menuItemId": 10, "qty": 1, "note": "ít cay" }
  ]
}

// Response 201
{
  "round": { "id": 901, "tabId": 302, "createdAt": "2026-11-20T12:03:00.000Z", "createdBy": { "id": 2, "fullName": "Nguyễn Thị Lan" } },
  "tickets": [
    { "stationId": 1, "stationName": "Quầy rót bia", "tableCode": "13",
      "lines": [ { "name": "Bia hơi cốc 0,5L", "qty": 4, "note": null } ] },
    { "stationId": 2, "stationName": "Bếp nướng", "tableCode": "13",
      "lines": [ { "name": "Ngô nướng", "qty": 1, "note": "ít cay" } ] }
  ],
  "tabTotal": 85000
}
```

**Hủy món** — `POST /api/order-lines/:id/void`

```json
// Request (approverPin bắt buộc nếu người gọi là COUNTER)
{ "qty": 1, "reason": "CUSTOMER_CHANGED_MIND", "note": null, "approverPin": "1234" }

// Response 201: dòng âm vừa tạo
{ "id": 5521, "lineType": "VOID", "refLineId": 5502, "qty": -1, "unitPrice": 39000,
  "reason": "CUSTOMER_CHANGED_MIND", "requestedBy": 2, "approvedBy": 3 }

// Response 400
{ "error": { "code": "INVALID_PIN", "message": "PIN không đúng" } }
```

Giá trị `reason`: `CUSTOMER_CHANGED_MIND` (Khách đổi ý), `OUT_OF_STOCK` (Bếp hết món), `WRONG_ENTRY` (Nhập nhầm), `DEFECTIVE` (Món lỗi), `OTHER` (Khác — bắt buộc có `note`).

**Thanh toán** — `POST /api/tabs/:id/pay`

```json
// Request
{
  "billDiscount": { "type": "PERCENT", "value": 10 },
  "approverPin": "1234",
  "payments": [
    { "method": "CASH", "amount": 200000 },
    { "method": "TRANSFER", "amount": 106500 }
  ]
}

// Response 200
{
  "billNo": "HD-20261120-0042",
  "subtotal": 340500, "discount": 34000, "total": 306500,
  "paid": 306500, "change": 0,
  "lines": [ { "name": "Bia hơi cốc 0,5L", "qty": 10, "unitPrice": 15000, "amount": 150000 } ],
  "paidAt": "2026-11-20T14:30:00.000Z"
}

// Response 400
{ "error": { "code": "INSUFFICIENT_PAYMENT", "message": "Số tiền nhận chưa đủ" } }
```

**Hao hụt keg** — `GET /api/reports/keg-loss?from=2026-11-01&to=2026-11-30&threshold=5`

```json
// Response 200
{
  "threshold": 5,
  "totalLossLiters": 6.5,
  "totalLossAmount": 195000,
  "kegs": [
    { "kegId": 7, "code": "KEG-0007", "beerName": "Bia hơi Hà Nội", "tapName": "Vòi 1",
      "capacityMl": 50000, "soldMl": 46000, "lossMl": 4000, "lossPercent": 8.0,
      "tappedAt": "2026-11-18T09:00:00.000Z", "emptiedAt": "2026-11-18T22:10:00.000Z", "overThreshold": true }
  ]
}
```

---

## 8. Cơ sở dữ liệu

### 8.1 Quy tắc

- `OrderLine` và `Payment` **chỉ thêm, không sửa, không xóa**. Hủy/giảm = thêm dòng âm.
- **Tổng tiền phiên bàn = Σ (qty × unitPrice) của mọi dòng** (dòng `VOID`/`DISCOUNT` có giá trị âm) − giảm giá hóa đơn.
- `unitPrice` được chốt khi gửi lượt gọi, không lấy lại từ bảng món.
- Mọi thao tác quan trọng (mở/chuyển/gộp bàn, hủy/giảm, thanh toán, thay keg, sửa danh mục) ghi một dòng vào `AuditLog`.
- Món, nhân viên, bàn đã có dữ liệu liên quan thì không xóa hẳn, chỉ ẩn/khóa.

### 8.2 Prisma schema (bản khởi đầu)

Hiếu dùng bản này làm điểm xuất phát cho `backend/prisma/schema.prisma`, được phép bổ sung trong pha Thiết kế.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role { COUNTER SHIFT_MANAGER OWNER }
enum TabStatus { OPEN PAID }
enum LineType { NORMAL VOID DISCOUNT }
enum PaymentMethod { CASH TRANSFER }
enum BillPrintKind { PROVISIONAL FINAL }
enum KegStatus { IN_STOCK TAPPED EMPTY }

model Staff {
  id           Int      @id @default(autoincrement())
  fullName     String
  email        String   @unique
  passwordHash String
  role         Role
  pinHash      String?  // chỉ SHIFT_MANAGER, OWNER
  active       Boolean  @default(true)
  createdAt    DateTime @default(now())
}

model Area {
  id        Int           @id @default(autoincrement())
  name      String
  sortOrder Int           @default(0)
  tables    DiningTable[]
}

model DiningTable {
  id        Int     @id @default(autoincrement())
  areaId    Int
  area      Area    @relation(fields: [areaId], references: [id])
  code      String  @unique
  sortOrder Int     @default(0)
  active    Boolean @default(true)
  tabs      Tab[]
}

model KitchenStation {
  id    Int        @id @default(autoincrement())
  name  String
  items MenuItem[]
}

model MenuGroup {
  id        Int        @id @default(autoincrement())
  name      String
  sortOrder Int        @default(0)
  items     MenuItem[]
}

model MenuItem {
  id           Int            @id @default(autoincrement())
  groupId      Int
  group        MenuGroup      @relation(fields: [groupId], references: [id])
  name         String
  shortcut     String         @unique
  price        Int
  unit         String
  stationId    Int
  station      KitchenStation @relation(fields: [stationId], references: [id])
  beerVolumeMl Int?           // chỉ món bia hơi
  defaultTapId Int?
  defaultTap   Tap?           @relation(fields: [defaultTapId], references: [id])
  available    Boolean        @default(true)  // false = Hết món
  active       Boolean        @default(true)  // false = đã ẩn
}

model HappyHour {
  id        Int              @id @default(autoincrement())
  name      String
  weekdays  Int[]            // 1 = Thứ 2 ... 7 = Chủ nhật
  startTime String           // "16:00"
  endTime   String           // "18:00"
  enabled   Boolean          @default(true)
  prices    HappyHourPrice[]
}

model HappyHourPrice {
  id          Int       @id @default(autoincrement())
  happyHourId Int
  happyHour   HappyHour @relation(fields: [happyHourId], references: [id], onDelete: Cascade)
  menuItemId  Int
  price       Int
}

model Tab {
  id            Int         @id @default(autoincrement())
  tableId       Int
  table         DiningTable @relation(fields: [tableId], references: [id])
  guestCount    Int?
  status        TabStatus   @default(OPEN)
  openedAt      DateTime    @default(now())
  openedById    Int
  closedAt      DateTime?
  billNo        String?     @unique
  billDiscount  Int         @default(0)
  mergedIntoId  Int?        // phiên đã bị gộp vào phiên khác
  rounds        OrderRound[]
  payments      Payment[]
  prints        BillPrint[]
}

model OrderRound {
  id          Int         @id @default(autoincrement())
  tabId       Int
  tab         Tab         @relation(fields: [tabId], references: [id])
  createdAt   DateTime    @default(now())
  createdById Int
  lines       OrderLine[]
}

model OrderLine {
  id            Int       @id @default(autoincrement())
  roundId       Int
  round         OrderRound @relation(fields: [roundId], references: [id])
  menuItemId    Int
  qty           Int       // âm với VOID
  unitPrice     Int       // âm với DISCOUNT
  note          String?
  lineType      LineType  @default(NORMAL)
  refLineId     Int?      // dòng gốc bị hủy/giảm
  reason        String?
  requestedById Int?
  approvedById  Int?
  tapId         Int?      // vòi tính thể tích (món bia hơi)
  kegId         Int?      // keg đang gắn trên vòi lúc gửi
  createdAt     DateTime  @default(now())
}

model Payment {
  id           Int           @id @default(autoincrement())
  tabId        Int
  tab          Tab           @relation(fields: [tabId], references: [id])
  method       PaymentMethod
  amount       Int
  receivedById Int
  createdAt    DateTime      @default(now())
}

model BillPrint {
  id        Int           @id @default(autoincrement())
  tabId     Int
  tab       Tab           @relation(fields: [tabId], references: [id])
  kind      BillPrintKind
  printNo   Int
  printedAt DateTime      @default(now())
}

model Shift {
  id          Int       @id @default(autoincrement())
  staffId     Int
  openedAt    DateTime  @default(now())
  openingCash Int
  closedAt    DateTime?
  closedById  Int?
  countedCash Int?
}

model Tap {
  id           Int        @id @default(autoincrement())
  name         String
  currentKegId Int?       @unique
  menuItems    MenuItem[]
}

model Keg {
  id         Int       @id @default(autoincrement())
  code       String    @unique
  beerName   String
  capacityMl Int
  cost       Int
  receivedAt DateTime
  status     KegStatus @default(IN_STOCK)
  tapId      Int?
  tappedAt   DateTime?
  emptiedAt  DateTime?
  soldMl     Int?      // chốt khi keg chuyển sang EMPTY
}

model AuditLog {
  id        Int      @id @default(autoincrement())
  actorId   Int
  action    String   // vd "TAB_MERGED", "LINE_VOIDED"
  entity    String
  entityId  Int
  payload   Json?
  createdAt DateTime @default(now())
}
```

### 8.3 Dữ liệu mẫu (seed)

`backend/prisma/seed.ts` phải tạo đủ dữ liệu để demo và để Thái kiểm thử:

- **3 khu:** Trong nhà (bàn 1–30), Sân (31–60), Tầng 2 (61–80).
- **3 khu chế biến:** Quầy rót bia, Bếp nướng, Bếp chiên.
- **4 nhóm, ~30 món**, ví dụ: Bia hơi cốc 0,5L (`b`, 15.000 ₫, 500 ml); Ca bia 1,5L (`ca`, 42.000 ₫, 1.500 ml); Tháp bia 3L (`thap`, 80.000 ₫, 3.000 ml); Ngô nướng (`ngo`, 25.000 ₫); Chân gà nướng (`cg`, 69.000 ₫); Khoai tây chiên (`khoai`, 39.000 ₫); Đậu rán (`dau`, 35.000 ₫); Lạc rang (`lac`, 15.000 ₫); Khăn lạnh (`khan`, 2.000 ₫)… Có 1–2 món "Hết món".
- **2 vòi**, mỗi vòi đang gắn một keg 50 L; **4 keg** trong kho; vài keg đã hết, trong đó **1 keg 50 L bán được 92 cốc 0,5 L (hao hụt 8%)**.
- **5 tài khoản** (mật khẩu chung `123456`):

| Email | Họ tên | Vai trò | PIN |
|---|---|---|---|
| lan@biahoi.vn | Nguyễn Thị Lan | COUNTER | — |
| minh@biahoi.vn | Trần Văn Minh | COUNTER | — |
| hung@biahoi.vn | Lê Văn Hùng | SHIFT_MANAGER | 1234 |
| hoa@biahoi.vn | Phạm Thị Hoa | OWNER | 9999 |
| khoa@biahoi.vn | Đỗ Minh Khoa | COUNTER (đã khóa) | — |

- **Lịch sử bán 7 ngày** gần nhất (hóa đơn đã thanh toán, có vài lần hủy/giảm) để các báo cáo có số liệu, và khoảng 20 bàn đang có khách cho hôm nay.

---

## 9. Quy ước làm việc

### 9.1 Quy ước code

- Tên biến, hàm, file, API viết **tiếng Anh**; chữ hiển thị cho người dùng viết **tiếng Việt**.
- Tên file: `kebab-case` (vd `tab-total.ts`); component React: `PascalCase` (vd `TableGrid.tsx`).
- Tiền luôn là số nguyên VND. Frontend hiển thị dạng `15.000 ₫` bằng hàm chung trong `frontend/src/lib/format.ts`.
- Backend: mỗi module gồm `*.routes.ts` (khai báo đường dẫn), `*.service.ts` (xử lý nghiệp vụ, gọi Prisma), `*.schema.ts` (kiểm tra dữ liệu bằng zod). Các thao tác ghi nhiều bảng cùng lúc (gửi lượt gọi, gộp bàn, thanh toán, thay keg) phải nằm trong `prisma.$transaction`.
- Không bao giờ commit file `.env`, mật khẩu hay khóa bí mật. Chỉ commit `.env.example`.

### 9.2 Biến môi trường

| File | Biến | Ví dụ |
|---|---|---|
| `backend/.env` | `DATABASE_URL` | `postgresql://user:pass@host/db` |
| | `JWT_SECRET` | chuỗi ngẫu nhiên dài |
| | `CORS_ORIGIN` | `http://localhost:5173` |
| | `VIETQR_BANK`, `VIETQR_ACCOUNT`, `VIETQR_ACCOUNT_NAME` | `MB`, `0123456789`, `QUAN BIA HOI DEMO` |
| `frontend/.env` | `VITE_API_URL` | `http://localhost:3000/api` |

### 9.3 Chạy dự án trên máy

```bash
# Backend (cổng 3000)
cd backend
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev

# Frontend (cổng 5173) — mở terminal khác
cd frontend
npm install
npm run dev
```

### 9.4 Quy trình GitHub

1. Mỗi việc trong bảng mục 10 là một **issue** trên GitHub (ghi mã việc, vd `BE-04`, và các FR liên quan).
2. Tạo nhánh từ `develop`: `feature/BE-04-order-api`, `feature/FE-03-table-panel`, `docs/test-cases`…
3. Commit nhỏ, nội dung rõ ràng (vd `feat(tabs): thêm API gửi lượt gọi`).
4. Mở **Pull Request vào `develop`**, điền mẫu PR: làm gì, cách kiểm tra, FR liên quan.
5. **Tự duyệt mọi PR** trước khi merge. Với PR chức năng, Thái kiểm thử theo tiêu chí nghiệm thu và ghi kết quả vào PR.
6. Không push thẳng vào `main`/`develop`. `main` chỉ được cập nhật ở các mốc Gate.

### 9.5 Phối hợp backend – frontend

- Trung không cần chờ backend xong mới làm giao diện: dùng **dữ liệu giả** đúng định dạng response ở mục 7.3, khi backend xong chỉ cần đổi sang gọi API thật.
- Hiếu làm xong API nào thì báo trên nhóm Zalo kèm ví dụ request/response; nên có file `backend/requests.http` (hoặc bộ Postman) để Trung và Thái thử nhanh.
- Thứ tự ưu tiên: backend làm theo đúng thứ tự frontend cần (đăng nhập → bàn → gọi món → thanh toán → quản trị → báo cáo).

---

## 10. Phân công & hạn hoàn thành

### 10.1 Vai trò

| Thành viên | Vai trò | Phụ trách tài liệu |
|---|---|---|
| **Nguyễn Xuân Tự** | Quản lý dự án; duyệt mọi Pull Request; chủ trì họp | Kế hoạch QLDA, SRS, báo cáo tuần, báo cáo cuối kỳ |
| **Phí Việt Hiếu** | Lập trình **backend** (API, CSDL, triển khai backend) | Thiết kế CSDL (`thiet-ke-csdl.md`), đặc tả API (`api.md`) |
| **Dương Tất Trung** | Lập trình **frontend** (giao diện, gọi API, triển khai frontend) | Đặc tả màn hình (`man-hinh.md`), hướng dẫn sử dụng (`huong-dan-su-dung.md`) |
| **Nguyễn Chính Thái** | **Kiểm thử** (tester); thư ký họp | Kế hoạch kiểm thử, test case, báo cáo kiểm thử, biên bản họp |

### 10.2 Các mốc chính

| Mốc | Ngày | Điều kiện để qua |
|---|---|---|
| G1 — Duyệt yêu cầu | 05/11/2026 (Thứ 5) | SRS này được cả nhóm thống nhất |
| G2 — Duyệt thiết kế | 11/11/2026 (Thứ 4) | Có `schema.prisma`, `api.md`, `man-hinh.md`, `ke-hoach-kiem-thu.md` |
| G3 — Đóng băng mã | 01/12/2026 (Thứ 3) | Mọi chức năng M chạy được trên đường dẫn công khai |
| G4 — Nghiệm thu (UAT) | 07/12/2026 (Thứ 2) | ≥ 95% test case mức M đạt, không còn lỗi nghiêm trọng |
| G5 — Sẵn sàng bảo vệ | 11/12/2026 (Thứ 6) | Báo cáo, slide, demo đã sẵn sàng |

### 10.3 Bảng công việc chi tiết

Hạn là **cuối ngày** ghi trong bảng. Ai thấy có nguy cơ trễ thì báo trên nhóm **sớm nhất có thể**, đừng đợi đến hạn.

**Pha 1 — Yêu cầu & chuẩn bị (đến 05/11)**

| Mã | Việc | Người làm | FR | Hạn | Kết quả cần có |
|---|---|---|---|---|---|
| PM-01 | Hoàn thiện SRS, chốt với cả nhóm | Tự | Tất cả | 04/11 | SRS v1.0 |
| BE-00 | Làm quen Node.js + Express + Prisma: dựng thử một API "hello" kết nối Postgres | Hiếu | — | 04/11 | Chạy được trên máy, chụp màn hình gửi nhóm |
| FE-00 | Làm quen React + Vite + Tailwind + shadcn/ui: dựng thử một trang có bảng và form | Trung | — | 04/11 | Chạy được trên máy, chụp màn hình gửi nhóm |
| QA-00 | Đọc kỹ SRS, liệt kê chỗ chưa rõ / thiếu | Thái | Tất cả | 04/11 | Danh sách câu hỏi gửi Tự |

**Pha 2 — Thiết kế (06/11 – 11/11)**

| Mã | Việc | Người làm | FR | Hạn | Kết quả cần có |
|---|---|---|---|---|---|
| BE-D1 | Thiết kế CSDL: hoàn thiện `schema.prisma`, vẽ sơ đồ ERD, giải thích các bảng | Hiếu | Tất cả | 10/11 | `backend/prisma/schema.prisma`, `docs/thiet-ke-csdl.md` |
| BE-D2 | Đặc tả API chi tiết (mở rộng mục 7) | Hiếu | Tất cả | 10/11 | `docs/api.md` |
| FE-D1 | Đặc tả màn hình: phác thảo bố cục từng màn hình ở mục 6, luồng chuyển trang | Trung | Tất cả | 10/11 | `docs/man-hinh.md` |
| QA-D1 | Kế hoạch kiểm thử: phạm vi, cách kiểm thử, mức độ lỗi, mẫu báo lỗi | Thái | Tất cả | 10/11 | `docs/ke-hoach-kiem-thu.md` |
| PM-02 | Duyệt thiết kế (họp G2) | Tự + cả nhóm | — | 11/11 | Biên bản G2 |

**Pha 3 — Lập trình (12/11 – 01/12)** — backend và frontend làm song song

| Mã | Việc | Người làm | FR | Hạn | Kết quả cần có |
|---|---|---|---|---|---|
| BE-01 | Khởi tạo backend, kết nối CSDL, migration, dữ liệu mẫu (mục 8.3) | Hiếu | — | 13/11 | `npm run dev` chạy được; seed đủ dữ liệu |
| BE-02 | Đăng nhập, JWT, middleware kiểm tra vai trò, xác minh PIN | Hiếu | 01 | 16/11 | API Auth; gọi API không đủ quyền trả 403 |
| BE-03 | API danh mục: khu, bàn, nhóm món, món, khu chế biến, nhân viên, `GET /menu` | Hiếu | 11, 12, 13 | 18/11 | Các API CRUD hoạt động |
| BE-04 | API phiên bàn: tổng quan bàn, mở bàn, chi tiết, gửi lượt (chốt giá, tách phiếu), chuyển, gộp, hủy/giảm | Hiếu | 02–06 | 23/11 | Các API ở mục 7 nhóm "Phiên bàn" |
| BE-05 | API tạm tính, VietQR, thanh toán, ca | Hiếu | 07, 08, 09 | 25/11 | |
| BE-06 | API vòi, thay keg, kho keg, giờ vàng (áp giá khi gửi lượt) | Hiếu | 10, 14, 15 | 26/11 | |
| BE-07 | API báo cáo: hôm nay, hao hụt keg, nhật ký hủy, bán chạy, theo giờ | Hiếu | 16–19 | 27/11 | Số liệu khớp dữ liệu mẫu |
| BE-08 | Triển khai backend lên Render, hỗ trợ tích hợp & sửa lỗi | Hiếu | — | 01/12 | Đường dẫn API công khai |
| FE-01 | Khởi tạo frontend, khung trang (thanh bên theo vai trò), trang đăng nhập, chặn trang theo quyền | Trung | 01 | 16/11 | Đăng nhập được bằng 4 tài khoản mẫu |
| FE-02 | Sơ đồ bàn, mở bàn | Trung | 02, 03 | 18/11 | |
| FE-03 | Màn phiên bàn: gọi món, gửi lượt, xem & in phiếu | Trung | 04 | 23/11 | |
| FE-04 | Chuyển/gộp bàn, hủy/giảm có PIN, tạm tính, thanh toán & VietQR, ca, màn vòi bia | Trung | 05–10 | 26/11 | |
| FE-05 | Phân hệ Quản trị: thực đơn, khu & bàn, nhân viên, kho keg, giờ vàng | Trung | 11–15 | 28/11 | |
| FE-06 | Phân hệ Báo cáo (giao diện điện thoại) | Trung | 16–19 | 30/11 | |
| FE-07 | Triển khai frontend lên Vercel, tích hợp với backend thật | Trung | — | 01/12 | Đường dẫn web công khai |
| QA-01 | Viết test case cho mọi FR (ít nhất 1 trường hợp đúng + 1 trường hợp lỗi mỗi FR) | Thái | Tất cả | 20/11 | `docs/test-cases.md` |
| QA-02 | Kiểm thử từng PR chức năng khi được mở, ghi kết quả vào PR | Thái | Tất cả | 01/12 | Nhận xét kiểm thử trên các PR |
| PM-03 | Duyệt PR trong vòng 24 giờ; họp tuần; báo cáo tiến độ tuần | Tự | — | Hằng tuần | |

**Pha 4 — Kiểm thử (02/12 – 07/12)**

| Mã | Việc | Người làm | FR | Hạn | Kết quả cần có |
|---|---|---|---|---|---|
| QA-03 | Kiểm thử toàn hệ thống theo test case, báo lỗi bằng issue mẫu "Báo lỗi" | Thái | Tất cả | 04/12 | Danh sách lỗi trên GitHub |
| BE-09 | Sửa lỗi backend | Hiếu | — | 04/12 | Lỗi nghiêm trọng & cao đã đóng |
| FE-08 | Sửa lỗi frontend | Trung | — | 04/12 | Lỗi nghiêm trọng & cao đã đóng |
| FE-09 | Viết hướng dẫn sử dụng có ảnh chụp màn hình | Trung | Tất cả | 05/12 | `docs/huong-dan-su-dung.md` |
| QA-04 | Báo cáo kiểm thử: số test case đạt/không đạt, lỗi còn lại | Thái | Tất cả | 06/12 | `docs/bao-cao-kiem-thu.md` |
| PM-04 | Nghiệm thu UAT theo kịch bản demo (họp G4) | Tự + cả nhóm | — | 07/12 | Biên bản G4 |

**Pha 5 — Bàn giao (08/12 – 11/12)**

| Mã | Việc | Người làm | Hạn | Kết quả cần có |
|---|---|---|---|---|
| ALL-01 | Mỗi người viết phần báo cáo cuối kỳ về mảng mình phụ trách | Cả nhóm | 09/12 | Bản nháp từng phần |
| PM-05 | Tổng hợp báo cáo cuối kỳ & slide | Tự | 10/12 | Báo cáo, slide |
| ALL-02 | Diễn tập demo, quay video demo dự phòng, nộp bài | Cả nhóm | 11/12 | Sẵn sàng bảo vệ |

**Suốt dự án:** Thái ghi biên bản mọi buổi họp (đăng trong `docs/meetings/` trong vòng 24 giờ); Tự viết báo cáo tiến độ tuần (`docs/reports/`) mỗi Chủ nhật.

### 10.4 Kịch bản demo (dùng cho UAT và buổi bảo vệ)

1. Đăng nhập bằng `lan@biahoi.vn` (nhân viên quầy), xem sơ đồ bàn.
2. Mở bàn 15, gọi 4 Bia hơi cốc + 1 Ngô nướng + 1 Khoai tây chiên → gửi, xem 3 phiếu theo khu chế biến.
3. Hủy 1 Khoai tây chiên → hệ thống đòi PIN, nhập `1234`.
4. Chuyển bàn 15 sang bàn 40, gộp bàn 41 vào bàn 40.
5. In tạm tính bàn 40, rồi thanh toán bằng VietQR + một phần tiền mặt.
6. Thay keg cho Vòi 1.
7. Đăng nhập bằng `hoa@biahoi.vn` (chủ quán): xem Tổng quan hôm nay, Hao hụt keg (keg 8% tô đỏ), Nhật ký hủy/giảm (thấy món vừa hủy ở bước 3).
8. Vào Quản trị: đánh dấu một món "Hết món", quay lại màn gọi món thấy món bị mờ.

---

## 11. Giả định & ràng buộc

- Một quán duy nhất, không có nhiều chi nhánh.
- Máy dùng hệ thống luôn có Internet.
- Chuyển khoản do nhân viên tự kiểm tra rồi xác nhận.
- In qua hộp thoại in của trình duyệt (máy in thường hoặc lưu PDF).
- Chỉ dùng gói miễn phí (Neon/Supabase Postgres, Render, Vercel). Gói miễn phí của Render có thể "ngủ" khi lâu không dùng, nên trước buổi demo cần mở trước vài phút.
- Thời gian: 26/10/2026 – 11/12/2026.
