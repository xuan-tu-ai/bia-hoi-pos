export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (code: string, message: string, details?: unknown) => new AppError(400, code, message, details);
export const unauthorized = (message = 'Chưa đăng nhập hoặc phiên đã hết hạn') => new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'Không có quyền thực hiện thao tác này') => new AppError(403, 'FORBIDDEN', message);
export const notFound = (what: string) => new AppError(404, 'NOT_FOUND', `Không tìm thấy ${what}`);
export const conflict = (code: string, message: string, details?: unknown) => new AppError(409, code, message, details);
