# frontend

Web app có phân quyền (React 18 + Vite + TypeScript + Tailwind + shadcn/ui, TanStack Query, axios, react-hook-form + zod, Recharts). Phụ trách: Trung. Xem `docs/srs.md` mục 4, 5, 6 và [`docs/api.md`](../docs/api.md).

## Chạy trên máy

```bash
cd frontend
cp .env.example .env    # VITE_API_URL=http://localhost:3000/api
npm install
npm run dev             # http://localhost:5173
```

Cần backend đang chạy (xem `backend/README.md`).

## Cấu trúc

```text
src/
├── main.tsx, App.tsx, router.tsx   # trang & chặn trang theo vai trò
├── api/                            # mỗi file một nhóm API; client.ts gắn token, xử lý 401
├── stores/auth.ts                  # người dùng đang đăng nhập
├── components/
│   ├── ui/                         # component kiểu shadcn/ui
│   ├── layout/                     # thanh bên theo vai trò, khung trang
│   └── print/                      # phiếu bếp, tạm tính, hóa đơn (khổ 80 mm)
├── features/
│   ├── auth/                       # đăng nhập (FR-01)
│   ├── counter/                    # Quầy: sơ đồ bàn, phiên bàn, thanh toán, vòi bia, ca (FR-02 → FR-10)
│   ├── admin/                      # Quản trị: thực đơn, khu & bàn, nhân viên, kho keg, giờ vàng (FR-11 → FR-15)
│   └── reports/                    # Báo cáo: hôm nay, hao hụt keg, hủy/giảm, bán chạy (FR-16 → FR-19)
├── lib/format.ts                   # định dạng tiền "15.000 ₫", ngày giờ
└── types/                          # kiểu dữ liệu khớp response API
```

- Menu chỉ ẩn/hiện cho gọn; quyền thật do backend kiểm tra.
- In: nút **In** gọi `window.print()`, CSS `@media print` chỉ in phần phiếu (xem `components/print`).
- Sơ đồ bàn tự tải lại mỗi 3 giây; báo cáo hôm nay mỗi 30 giây.

## Triển khai (Vercel)

Root directory `frontend`, build `npm run build`, output `dist`. Đặt biến `VITE_API_URL` = địa chỉ backend trên Render (có `/api`). `vercel.json` đã chuyển mọi đường dẫn về `index.html`.
