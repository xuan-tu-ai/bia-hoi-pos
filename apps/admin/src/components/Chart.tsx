// Bọc các biểu đồ SVG của tasteskill (src/vendor/charts.js) cho React.
import { useEffect, useRef } from 'react';
import '../vendor/charts.js';
import { useTheme } from '../lib/theme';

type Fmt = (v: number) => string;

export interface ChartsApi {
  bars(el: HTMLElement, opts: { labels: string[]; values: number[]; format?: Fmt; tickFormat?: Fmt; height?: number; highlight?: number | number[] | null; dim?: number[]; reference?: { value: number; label: string } }): void;
  barList(el: HTMLElement, rows: { label: string; value: number }[], opts?: { format?: Fmt; colour?: string; thin?: boolean }): void;
  bullet(el: HTMLElement, rows: { label: string; value: number; target: number }[], opts?: { format?: Fmt; max?: number }): void;
}

declare global {
  interface Window {
    Charts: ChartsApi;
  }
}

/**
 * Vẽ lại vào một thẻ con mới mỗi khi dữ liệu đổi: charts.js gắn ResizeObserver vào thẻ nó vẽ,
 * nên thẻ cũ bị bỏ đi cùng observer của nó.
 */
export function Chart({ draw, deps, label, minHeight }: { draw: (el: HTMLElement, charts: ChartsApi) => void; deps: unknown[]; label: string; minHeight?: number }) {
  const host = useRef<HTMLDivElement>(null);
  // charts.js đọc màu từ CSS lúc vẽ, nên đổi sáng/tối thì vẽ lại
  const theme = useTheme();
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const inner = document.createElement('div');
    el.replaceChildren(inner);
    draw(inner, window.Charts);
  }, [...deps, theme]);
  return <div className="chart" ref={host} aria-label={label} style={minHeight ? { minHeight } : undefined} />;
}
