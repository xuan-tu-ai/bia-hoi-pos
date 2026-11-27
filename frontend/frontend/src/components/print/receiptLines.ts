import type { OrderLine } from '../../types/index.ts';

export interface ReceiptLine {
  name: string;
  quantity: number;
  total: number;
}

export function groupReceiptLines(lines: OrderLine[]): ReceiptLine[] {
  const grouped = new Map<string, { name: string; quantity: number; price: number }>();
  const voids = new Map<string, number>();
  const discounts = new Map<string, number>();

  lines.forEach((line) => {
    if (!line.adjustment) {
      const key = `${line.name}\u0000${line.price}`;
      const item = grouped.get(key);
      if (item) item.quantity += line.quantity;
      else grouped.set(key, { name: line.name, quantity: line.quantity, price: line.price });
      return;
    }

    if (line.name.startsWith('Hủy: ')) {
      const name = line.name.slice(5);
      const key = `${name}\u0000${line.price}`;
      voids.set(key, (voids.get(key) ?? 0) + Math.abs(line.quantity));
    } else if (line.name.startsWith('Giảm: ')) {
      const name = line.name.slice(6);
      discounts.set(name, (discounts.get(name) ?? 0) + Math.abs(line.price * line.quantity));
    }
  });

  voids.forEach((quantity, key) => {
    const item = grouped.get(key);
    if (item) item.quantity = Math.max(0, item.quantity - quantity);
  });

  return [...grouped.entries()].flatMap(([key, item]) => {
    if (item.quantity <= 0) return [];
    const discount = Math.min(item.quantity * item.price, discounts.get(item.name) ?? 0);
    discounts.set(item.name, Math.max(0, (discounts.get(item.name) ?? 0) - discount));
    return [{ name: item.name, quantity: item.quantity, total: item.quantity * item.price - discount }];
  });
}
