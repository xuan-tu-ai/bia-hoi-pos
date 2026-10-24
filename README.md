# bia-hoi-pos — Hệ thống quản lý quầy nhà hàng bia hơi

Bài tập nhóm môn **Quản trị dự án** — Nhóm 7, ĐH Bách Khoa.

Một web app có phân quyền (Nhân viên quầy, Quản lý ca, Chủ quán) gồm 3 phân hệ: **Quầy** (sơ đồ bàn, gọi món, thanh toán), **Quản trị** (thực đơn, bàn, nhân viên, kho keg) và **Báo cáo** (doanh thu, hao hụt bia, nhật ký hủy món).

> 📌 **Bắt đầu từ [docs/srs.md](docs/srs.md)** — tài liệu chính: chức năng, công nghệ, cấu trúc thư mục, API, cơ sở dữ liệu, phân công và hạn hoàn thành.

| Thư mục | Nội dung | Phụ trách |
|---|---|---|
| `frontend/` | React + Vite + TypeScript + Tailwind + shadcn/ui | Trung |
| `backend/` | Node.js + Express + TypeScript + Prisma + PostgreSQL | Hiếu |
| `docs/` | Tài liệu dự án | Cả nhóm |

## Tài liệu

- [Đặc tả yêu cầu (SRS) — tài liệu chính](docs/srs.md)
- [Kế hoạch quản lý dự án](docs/ke-hoach-quan-ly-du-an.md)
- [Hướng phát triển (ngoài phạm vi)](docs/tam-nhin.md)
- Biên bản họp: `docs/meetings/` · Báo cáo tuần: `docs/reports/`

## Chạy dự án

Xem hướng dẫn chi tiết ở [mục 9.3 của SRS](docs/srs.md).

```bash
cd backend && npm install && npx prisma migrate dev && npx prisma db seed && npm run dev
cd frontend && npm install && npm run dev
```

## Quy trình làm việc

1. Mỗi việc là một **GitHub Issue** (ghi mã việc như `BE-04`, `FE-03`, `QA-01` theo bảng ở mục 10 của SRS).
2. Tạo nhánh từ `develop`: `feature/BE-04-order-api`, `docs/test-cases`…
3. Mở **Pull Request vào `develop`** theo mẫu. Nhóm trưởng duyệt mọi PR; PR chức năng được kiểm thử trước khi merge.
4. Không push thẳng vào `main` / `develop`. `main` chỉ được cập nhật tại các mốc Gate.

```bash
git clone https://github.com/xuan-tu-ai/bia-hoi-pos.git
cd bia-hoi-pos
git checkout develop
git checkout -b feature/BE-01-khoi-tao-backend
```
