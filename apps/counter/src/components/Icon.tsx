// Bộ icon nét 1.5px, màu theo chữ; cùng nét vẽ với Web quản trị.

const paths = {
  map: 'M2.8 2.8h4.4v4.4H2.8zM8.8 2.8h4.4v4.4H8.8zM2.8 8.8h4.4v4.4H2.8zM8.8 8.8h4.4v4.4H8.8z',
  keg: 'M4.5 3h7M4 3.5c0 3-.5 6.5 0 9.5h8c.5-3 0-6.5 0-9.5M4.2 6.5h7.6M4.2 10h7.6',
  shift: 'M8 2.8a5.2 5.2 0 1 0 0 10.4A5.2 5.2 0 0 0 8 2.8zM8 5v3l2 1.5',
  user: 'M8 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM3.5 13.5c.5-2.6 2.2-4 4.5-4s4 1.4 4.5 4',
  back: 'M9.5 3.5 5 8l4.5 4.5',
  close: 'M4 4l8 8M12 4l-8 8',
  plus: 'M8 3.5v9M3.5 8h9',
  sun: 'M8 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM8 1.8v1.4M8 12.8v1.4M1.8 8h1.4M12.8 8h1.4M3.6 3.6l1 1M11.4 11.4l1 1M3.6 12.4l1-1M11.4 4.6l1-1',
  moon: 'M13 9.6A5.5 5.5 0 0 1 6.4 3a5.5 5.5 0 1 0 6.6 6.6z',
  minus: 'M3.5 8h9',
  search: 'M7 11.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM10.3 10.3 13.5 13.5',
  printer: 'M5 6V2.8h6V6M4.5 11H3V6h10v5h-1.5M5 9.5h6v3.7H5z',
  move: 'M2.5 8h9M8.5 5l3 3-3 3M13.5 3v10',
  merge: 'M3 3.5v3a3 3 0 0 0 3 3h6.5M10 7l2.5 2.5L10 12M3 12.5h2',
  pay: 'M2.5 4.5h11v7h-11zM2.5 7h11M5 9.5h2',
  note: 'M3.5 3h9v10h-9zM5.5 6h5M5.5 8.5h5M5.5 11h3',
  alert: 'M8 2.5 14 13H2zM8 6.5v3M8 11.2v.1',
  del: 'M13 4.5H6L2.5 8 6 11.5h7zM8 6.5l3 3M11 6.5l-3 3',
  settings: 'M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 2v1.6M8 12.4V14M2 8h1.6M12.4 8H14M3.8 3.8l1.1 1.1M11.1 11.1l1.1 1.1M3.8 12.2l1.1-1.1M11.1 4.9l1.1-1.1',
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}

/** Dấu sản phẩm: cốc bia hơi (giống Web quản trị). */
export function Mark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      <path d="M7 9h12.5l-1.4 14.2a1.5 1.5 0 0 1-1.5 1.3H9.9a1.5 1.5 0 0 1-1.5-1.3z" fill="var(--accent)" />
      <path d="M6.2 9.2c-.6-2.6 1.4-4.7 3.8-4.2.9-1.7 3.3-2.2 4.8-.9 1.6-1.3 4.4-.6 4.9 1.7 1.6.3 2.3 2 1.6 3.4z" fill="#fff" stroke="var(--accent-ink)" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M19.4 12h1.9a1.7 1.7 0 0 1 1.7 1.7v4.1a1.7 1.7 0 0 1-1.7 1.7h-2.5" fill="none" stroke="var(--accent-ink)" strokeWidth="1.6" />
    </svg>
  );
}
