import { formatMoney } from '../../lib/format.ts';

export function MoneyText({ value }: { value: number }) {
  return <>{formatMoney(value)}</>;
}
