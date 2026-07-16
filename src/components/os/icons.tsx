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
  device: <><rect x="7" y="2.5" width="10" height="19" rx="2" /><path d="M11 18.3h2" /></>,
  tag: <><path d="M3.5 12.3 12 3.8h6.7a1.5 1.5 0 0 1 1.5 1.5V12l-8.5 8.5a1.5 1.5 0 0 1-2.1 0l-5.6-5.6a1.5 1.5 0 0 1 0-2.1Z" /><circle cx="15.7" cy="8.3" r="1.3" fill="currentColor" stroke="none" /></>,
  toggle: <><rect x="2.5" y="7" width="19" height="10" rx="5" /><circle cx="16.5" cy="12" r="3.3" fill="currentColor" stroke="none" /></>,
  mail: <><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="m4 7 8 6 8-6" /></>,
  idcard: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="12" r="2" /><path d="M6.5 16c.4-1.6 1.6-2.4 2.5-2.4s2.1.8 2.5 2.4M14 9.5h4M14 13h4" /></>,
  cake: <><path d="M4 20v-6.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2V20" /><path d="M4 16.5h16M9 11.5V8M12 11.5V8M15 11.5V8" /></>,
  lock: <><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></>,
  star: <path d="m12 3 2.6 5.9 6.4.6-4.8 4.3 1.4 6.3L12 16.9 6.4 20.1l1.4-6.3-4.8-4.3 6.4-.6L12 3Z" />,
  signal: <><path d="M4 20v-4M9.5 20v-8M15 20V9M20.5 20V4" /></>,
  building: <><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M8 7.5h2M14 7.5h2M8 12h2M14 12h2M8 16.5h2M14 16.5h2" /></>,
  food: <><path d="M6.5 3v7a2.5 2.5 0 0 0 5 0V3M9 10v11M15.5 3c-1.4 0-2.5 2-2.5 4.5S14.1 12 15.5 12s2.5-2 2.5-4.5S16.9 3 15.5 3ZM15.5 12v9" /></>,
  walk: <><circle cx="14" cy="4.5" r="1.8" /><path d="M11 21l1.5-6-2-1.5.7-4.5 3-1 2.5 2.5 3 1.2M9.5 13.5 6 15l-1.5 5" /></>,
  medical: <><rect x="3.5" y="3.5" width="17" height="17" rx="3" /><path d="M12 8v8M8 12h8" /></>,
  package: <><path d="M21 8v8a1.2 1.2 0 0 1-.6 1L12.6 21a1.2 1.2 0 0 1-1.2 0L3.6 17a1.2 1.2 0 0 1-.6-1V8a1.2 1.2 0 0 1 .6-1L11.4 3a1.2 1.2 0 0 1 1.2 0L20.4 7a1.2 1.2 0 0 1 .6 1Z" /><path d="M3.3 7.5 12 12l8.7-4.5M12 21V12" /></>,
  flag: <><path d="M5 21V4" /><path d="M5 4h13l-3 4.5L18 13H5" /></>,
  person: <><circle cx="12" cy="8" r="3.8" /><path d="M4.5 20c1-4 4-6 7.5-6s6.5 2 7.5 6" /></>,
  flame: <path d="M12 3s4 3.5 4 7.5a4 4 0 0 1-8 0c0-1 .5-2 1-2.7.3 1 1 1.7 1.5 1.2C9.7 8 9.5 5.5 12 3Zm0 8c-1.3 0-2.3 1-2.3 2.4C9.7 15 10.6 16 12 16s2.3-1 2.3-2.6c0-.6-.2-1.1-.5-1.5-.3.5-.8.8-1.3.5.1-.4.3-.9.5-1.4Z" />,
  palm: <><path d="M12 21V10.5" /><path d="M12 11c0-4-3-6-7-5.5C5.5 9 8 11 12 11ZM12 11c0-4 3-6 7-5.5C18.5 9 16 11 12 11ZM12 9.5c0-3.5-2-6-4.5-6.5C7 6 9 9 12 9.5ZM12 9.5c0-3.5 2-6 4.5-6.5C17 6 15 9 12 9.5Z" /></>,
  alarm: <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M8 3l-2.5 2M16 3l2.5 2" /></>,
  pause: <><rect x="6" y="4.5" width="4" height="15" rx="1" /><rect x="14" y="4.5" width="4" height="15" rx="1" /></>,
  login: <><path d="M9 12h11M15 8l4 4-4 4" /><path d="M12 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6" /></>,
  plane: <g transform="rotate(45 12 12)"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2.5 2v1.5l4-1 4 1V21l-2.5-2v-5.5z" fill="currentColor" stroke="none" /></g>,
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
