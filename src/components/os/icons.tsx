import type { SVGProps } from "react";

const P: Record<string, React.ReactNode> = {
  home: <path d="M4 11.5 12 4l8 7.5M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" />,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></>,
  inbox: <><path d="M3 12h4l2 3h6l2-3h4" /><path d="M5 6h14a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" /></>,
  calendar: <><rect x="3.5" y="4.5" width="17" height="16" rx="2.5" /><path d="M3.5 9h17M8 3v3M16 3v3" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" /></>,
  alert: <><path d="M12 4.5 21 20H3L12 4.5Z" /><path d="M12 10v4.5M12 17.5h.01" /></>,
  users: <><circle cx="9" cy="8.5" r="3.5" /><path d="M3.5 20c.6-3.2 3-5 5.5-5s4.9 1.8 5.5 5" /><path d="M16 5.2a3.5 3.5 0 0 1 0 6.6M17.5 20c-.3-2-1.2-3.6-2.5-4.6" /></>,
  book: <><path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4Z" /><path d="M5 17h13" /></>,
  chart: <><path d="M4 20V4M20 20H4" /><path d="M8 16v-4M12 16V8M16 16v-6" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 3v2.2M12 18.8V21M4.2 7l1.9 1.1M17.9 15.9 19.8 17M4.2 17l1.9-1.1M17.9 8.1 19.8 7" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-3.6-3.6" /></>,
  bell: <><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" /><path d="M10 19a2 2 0 0 0 4 0" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />,
  command: <path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6Z" />,
  logout: <><path d="M15 12H4M8 8l-4 4 4 4" /><path d="M12 4h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" /></>,
  dot: <circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  sparkle: <path d="M12 3v6M12 15v6M3 12h6M15 12h6M6.5 6.5l3 3M14.5 14.5l3 3M17.5 6.5l-3 3M9.5 14.5l-3 3" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  camera: <><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.2-2h6.6l1.2 2h2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-9Z" /><circle cx="12" cy="13" r="3.3" /></>,
};

export function Icon({ name, size = 20, ...rest }: { name: string; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden {...rest}
    >
      {P[name] ?? P.dot}
    </svg>
  );
}

/** Marca de Nexus (isotipo). */
export function NexusMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <path d="M10 22V10l12 12V10" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
