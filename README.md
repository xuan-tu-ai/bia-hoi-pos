# bia-hoi-pos — Hệ thống quản lý quầy nhà hàng bia hơi

Bài tập nhóm môn **Quản trị dự án** — Nhóm 7, ĐH Bách Khoa.

| Thành phần | Thư mục | Công nghệ |
|---|---|---|
| App quầy (Windows) | `apps/counter` | Electron + React + Vite |
| Web quản trị & PWA chủ quán | `apps/admin` | React + Vite (PWA) |
| Backend API | `apps/api` | Node.js + Fastify + Prisma + PostgreSQL |
| Mã dùng chung | `packages/shared` | TypeScript |

## Tài liệu

- [Đặc tả yêu cầu (SRS)](docs/srs.md)
- [Kế hoạch quản lý dự án](docs/ke-hoach-quan-ly-du-an.md)
- [Tầm nhìn dài hạn (ngoài phạm vi)](docs/tam-nhin.md)
- Biên bản họp: `docs/meetings/` · Báo cáo tuần: `docs/reports/`

## Quy trình làm việc

1. Nhận việc qua **GitHub Issues** (mỗi issue ghi mã yêu cầu `FR-xx`), theo dõi trên GitHub Projects.
2. Tạo nhánh từ `develop`: `feature/FR-xx-ten-ngan` (hoặc `fix/...`, `docs/...`).
3. Commit nhỏ, rõ nghĩa. Mở **Pull Request vào `develop`** theo mẫu, PR ≤ 400 dòng thay đổi.
4. Nhóm trưởng duyệt PR (trong 24 giờ) rồi merge. Không push thẳng vào `main` / `develop`.
5. `main` chỉ được merge từ `develop` tại các mốc Gate (tag `v0.x-Gn`).

```bash
git clone https://github.com/xuan-tu-ai/bia-hoi-pos.git
cd bia-hoi-pos
git checkout develop
git checkout -b feature/FR-01-dang-nhap-pin
```

Yêu cầu thay đổi phạm vi: tạo issue theo mẫu **Yêu cầu thay đổi** (xem mục 9 của kế hoạch).
