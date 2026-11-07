import { useMemo, useRef, useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { MenuEntry, MenuGroupWithItems } from '@/types';

/** Bỏ dấu tiếng Việt để tìm "ngo" ra "Ngô nướng". */
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

/**
 * Bên trái màn phiên bàn (FR-04): món theo nhóm dạng nút to có giá; ô tìm theo tên hoặc mã tắt.
 * Gõ mã tắt rồi Enter để thêm nhanh. Món "Hết món" bị mờ, không bấm được.
 */
export function MenuPicker({ groups, onPick, disabled }: { groups: MenuGroupWithItems[]; onPick: (item: MenuEntry) => void; disabled?: boolean }) {
  const [groupId, setGroupId] = useState<number | 'all'>('all');
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const all = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const results = useMemo(() => {
    const needle = fold(q.trim());
    if (!needle) return null;
    const exact = all.filter((i) => i.shortcut === needle);
    const starts = all.filter((i) => i.shortcut !== needle && i.shortcut.startsWith(needle));
    const named = all.filter((i) => !i.shortcut.startsWith(needle) && fold(i.name).includes(needle));
    return [...exact, ...starts, ...named];
  }, [q, all]);

  const shown = results ?? (groupId === 'all' ? all : groups.find((g) => g.id === groupId)?.items ?? []);

  const pick = (item: MenuEntry) => {
    if (!item.available || disabled) return;
    onPick(item);
    if (results) {
      setQ('');
      inputRef.current?.focus();
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              const first = results?.find((i) => i.available);
              if (first) pick(first);
            } else if (e.key === 'Escape') setQ('');
          }}
          placeholder="Tìm món hoặc gõ mã tắt (vd: b) rồi Enter"
          className="pl-9"
          aria-label="Tìm món"
        />
      </div>

      {!results && (
        <div className="flex flex-wrap gap-1.5">
          {[{ id: 'all' as const, name: 'Tất cả' }, ...groups].map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setGroupId(g.id)}
              className={cn(
                'h-9 rounded-full border px-3 text-sm font-medium transition-colors',
                groupId === g.id ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-accent',
              )}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {shown.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Không tìm thấy món</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(136px,1fr))] gap-2">
            {shown.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={!item.available || disabled}
                onClick={() => pick(item)}
                className={cn(
                  'relative flex min-h-[76px] flex-col justify-between rounded-lg border bg-card p-2.5 text-left shadow-sm transition hover:border-primary hover:bg-accent/60 active:scale-[0.98]',
                  'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:bg-card',
                )}
              >
                <span className="line-clamp-2 text-sm font-semibold leading-tight">{item.name}</span>
                <span className="mt-1 flex items-end justify-between gap-1">
                  <span className={cn('text-sm font-bold tabular-nums', item.isHappyHour ? 'text-amber-700' : 'text-primary')}>
                    {formatMoney(item.price)}
                  </span>
                  <span className="rounded bg-muted px-1 font-mono text-[10px] text-muted-foreground">{item.shortcut}</span>
                </span>
                {item.isHappyHour && (
                  <span className="absolute right-1.5 top-1.5 text-amber-600" title={`Giờ vàng (giá thường ${formatMoney(item.regularPrice)})`}>
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                )}
                {!item.available && <span className="absolute right-1.5 top-1.5 rounded bg-stone-800 px-1 text-[10px] font-semibold text-white">Hết món</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
