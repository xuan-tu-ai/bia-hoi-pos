# bia-hoi-pos — Hệ thống quản lý quầy nhà hàng bia hơi

Bài tập nhóm môn **Quản trị dự án** — Nhóm 7, ĐH Bách Khoa.

Một web app có phân quyền (Nhân viên quầy, Quản lý ca, Chủ quán) gồm 3 phân hệ: **Quầy** (sơ đồ bàn, gọi món, thanh toán), **Quản trị** (thực đơn, bàn, nhân viên, kho keg) và **Báo cáo** (doanh thu, hao hụt bia, nhật ký hủy món).

| Thư mục | Nội dung |
|---|---|
| `web/` | Web app — React + Vite + TypeScript |
| `supabase/` | Migration CSDL, phân quyền (Row Level Security), dữ liệu mẫu |
| `docs/` | Tài liệu dự án |

## Tài liệu

- [Đặc tả yêu cầu (SRS)](docs/srs.md)
- [Kế hoạch quản lý dự án](docs/ke-hoach-quan-ly-du-an.md)
- [Hướng phát triển (ngoài phạm vi)](docs/tam-nhin.md)
- Biên bản họp: `docs/meetings/` · Báo cáo tuần: `docs/reports/`

## Quy trình làm việc

1. Nhận việc qua **GitHub Issues** (cả tài liệu lẫn code), theo dõi trên GitHub Projects.
2. Tạo nhánh từ `develop`: `docs/<ten-tai-lieu>` cho tài liệu, `feature/FR-xx-ten-ngan` cho code.
3. Mở **Pull Request vào `develop`** theo mẫu. Tài liệu do nhóm trưởng duyệt; chức năng do phụ trách kiểm thử duyệt.
4. Không push thẳng vào `main` / `develop`. `main` chỉ được cập nhật tại các mốc Gate (tag `v0.x-Gn`).

```bash
git clone https://github.com/xuan-tu-ai/bia-hoi-pos.git
cd bia-hoi-pos
git checkout develop
git checkout -b docs/nghien-cuu-yeu-cau
```

Yêu cầu thay đổi phạm vi: tạo issue theo mẫu **Yêu cầu thay đổi** (xem mục 9 của kế hoạch).
