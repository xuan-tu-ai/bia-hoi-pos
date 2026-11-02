// Một bộ icon nét 16px, nét 1.5px, màu theo chữ (app-screens §9.4).

const paths = {
  today: 'M3 13.5h10M4.5 11V7.5M8 11V4.5M11.5 11V9',
  keg: 'M4.5 3h7M4 3.5c0 3-.5 6.5 0 9.5h8c.5-3 0-6.5 0-9.5M4.2 6.5h7.6M4.2 10h7.6',
  voids: 'M3.5 3.5h9v9h-9zM6 6l4 4M10 6l-4 4',
  ranking: 'M3 4h6M3 8h10M3 12h4',
  shift: 'M8 2.8a5.2 5.2 0 1 0 0 10.4A5.2 5.2 0 0 0 8 2.8zM8 5v3l2 1.5',
  menu: 'M4 2.8h7.5a1 1 0 0 1 1 1v9.4H5a1 1 0 0 1-1-1zM4 11.5h8.5M6.5 5.5h3.5M6.5 8h3.5',
  printer: 'M5 6V2.8h6V6M4.5 11H3V6h10v5h-1.5M5 9.5h6v3.7H5z',
  tables: 'M2.8 2.8h4.4v4.4H2.8zM8.8 2.8h4.4v4.4H8.8zM2.8 8.8h4.4v4.4H2.8zM8.8 8.8h4.4v4.4H8.8z',
  staff: 'M6 7.5a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6zM2.5 13c.4-2.2 1.8-3.5 3.5-3.5s3.1 1.3 3.5 3.5M10.5 3.2a2.2 2.2 0 0 1 0 4.2M11.5 9.6c1 .5 1.8 1.6 2 3.4',
  stock: 'M2.8 5.2 8 2.8l5.2 2.4v5.6L8 13.2l-5.2-2.4zM2.8 5.2 8 7.6l5.2-2.4M8 7.6v5.6',
  happy: 'M8 4.5V2.5M8 13.5v-2M4.5 8h-2M13.5 8h-2M5.5 5.5 4.1 4.1M11.9 11.9l-1.4-1.4M10.5 5.5l1.4-1.4M4.1 11.9l1.4-1.4M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  logout: 'M9.5 5V3.5h-6v9h6V11M7 8h6.5M11.5 6l2 2-2 2',
  burger: 'M2.5 4.5h11M2.5 8h11M2.5 11.5h11',
  close: 'M4 4l8 8M12 4l-8 8',
  plus: 'M8 3.5v9M3.5 8h9',
  sun: 'M8 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM8 1.8v1.4M8 12.8v1.4M1.8 8h1.4M12.8 8h1.4M3.6 3.6l1 1M11.4 11.4l1 1M3.6 12.4l1-1M11.4 4.6l1-1',
  moon: 'M13 9.6A5.5 5.5 0 0 1 6.4 3a5.5 5.5 0 1 0 6.6 6.6z',
  download: 'M8 2.5v7.5M5 7l3 3 3-3M3 12.5h10',
  refresh: 'M12.5 6.5A4.6 4.6 0 0 0 4 5M3.5 9.5A4.6 4.6 0 0 0 12 11M4 2.5V5h2.5M12 13.5V11H9.5',
  edit: 'M10.5 3 13 5.5 6 12.5H3.5V10z',
  trash: 'M3.5 4.5h9M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5',
  search: 'M7 11.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM10.3 10.3 13.5 13.5',
  alert: 'M8 2.5 14 13H2zM8 6.5v3M8 11.2v.1',
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 16, label }: { name: IconName; size?: number; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      <path d={paths[name]} />
    </svg>
  );
}

/** Dấu của sản phẩm: một cốc bia hơi, bọt trắng, bia màu hổ phách. */
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      <path d="M7 9h12.5l-1.4 14.2a1.5 1.5 0 0 1-1.5 1.3H9.9a1.5 1.5 0 0 1-1.5-1.3z" fill="var(--accent)" />
      <path d="M6.2 9.2c-.6-2.6 1.4-4.7 3.8-4.2.9-1.7 3.3-2.2 4.8-.9 1.6-1.3 4.4-.6 4.9 1.7 1.6.3 2.3 2 1.6 3.4z" fill="#fff" stroke="var(--accent-ink)" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M19.4 12h1.9a1.7 1.7 0 0 1 1.7 1.7v4.1a1.7 1.7 0 0 1-1.7 1.7h-2.5" fill="none" stroke="var(--accent-ink)" strokeWidth="1.6" />
      <path d="M11 13.5v7M14.5 13.5v7" stroke="var(--accent-ink)" strokeWidth="1.2" opacity=".45" />
    </svg>
  );
}
