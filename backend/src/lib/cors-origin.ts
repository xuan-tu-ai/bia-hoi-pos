/**
 * Kiểm tra địa chỉ frontend có được gọi API không (CORS_ORIGIN).
 * Mỗi mục là một origin đầy đủ, ví dụ `https://bia-hoi.vercel.app`.
 * Dấu `*` thay cho một đoạn tên miền, dùng cho bản preview của Vercel:
 * `https://bia-hoi-*.vercel.app` khớp `https://bia-hoi-git-feature-abc.vercel.app`.
 */
export function createOriginMatcher(allowed: string[]) {
  const exact = new Set<string>();
  const patterns: RegExp[] = [];
  for (const raw of allowed) {
    const origin = raw.replace(/\/+$/, '');
    if (origin.includes('*')) {
      const escaped = origin.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'));
      patterns.push(new RegExp(`^${escaped.join('[a-z0-9-]+')}$`, 'i'));
    } else {
      exact.add(origin.toLowerCase());
    }
  }
  return (origin: string | undefined): boolean => {
    if (!origin) return true; // không phải trình duyệt (curl, Render health check)
    return exact.has(origin.toLowerCase()) || patterns.some((p) => p.test(origin));
  };
}
