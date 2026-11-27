import type { AuthSession, User } from '../types/index.ts';

const demoAccounts: Array<User & { password: string }> = [
  { email: 'lan@biahoi.vn', password: '123456', role: 'staff', name: 'Nguyễn Thị Lan' },
  { email: 'minh@biahoi.vn', password: '123456', role: 'staff', name: 'Trần Văn Minh' },
  { email: 'hung@biahoi.vn', password: '123456', role: 'manager', name: 'Lê Văn Hùng' },
  { email: 'hoa@biahoi.vn', password: '123456', role: 'owner', name: 'Phạm Thị Hoa' }
];

export async function mockLogin(email: string, password: string): Promise<AuthSession> {
  const account = demoAccounts.find((item) => item.email === email.trim().toLocaleLowerCase('vi') && item.password === password);
  if (!account) throw new Error('Email hoặc mật khẩu không đúng');
  const { name, role } = account;
  return { token: `mock-token-${Date.now()}`, user: { name, email: account.email, role } };
}
