# Hai giao diện web, phục vụ bằng nginx: Web quản trị + PWA ở /, App quầy ở /quay/.
# /api và /socket.io chuyển sang backend.
# Build từ thư mục gốc monorepo: docker compose build web
FROM node:22-slim AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/admin/package.json apps/admin/
COPY apps/counter/package.json apps/counter/
RUN pnpm install --frozen-lockfile --filter @biahoi/admin... --filter @biahoi/counter...
COPY packages/shared packages/shared
COPY apps/admin apps/admin
COPY apps/counter apps/counter
# Không đặt VITE_API_URL: web gọi /api cùng origin, nginx chuyển tiếp sang backend
RUN pnpm --filter @biahoi/admin exec vite build && pnpm --filter @biahoi/counter exec vite build

FROM nginx:1.27-alpine
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/admin/dist /usr/share/nginx/html
COPY --from=build /app/apps/counter/dist /usr/share/nginx/html/quay
EXPOSE 80
