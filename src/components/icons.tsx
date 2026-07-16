// SVG monolínea consistente (stroke 1.6) — sistema v6
const base = {
  fill: "none", stroke: "currentColor", strokeWidth: 1.6,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
};
type P = { className?: string };

export const IconGrid = ({ className = "w-[18px] h-[18px]" }: P) => (
  <svg {...base} className={className}><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" /></svg>);
export const IconHome = ({ className = "w-[18px] h-[18px]" }: P) => (
  <svg {...base} className={className}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>);
export const IconCamera = ({ className = "w-[18px] h-[18px]" }: P) => (
  <svg {...base} className={className}><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-5-5L5 21" /></svg>);
export const IconPen = ({ className = "w-[18px] h-[18px]" }: P) => (
  <svg {...base} className={className}><path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18z" /></svg>);
export const IconVideo = ({ className = "w-[18px] h-[18px]" }: P) => (
  <svg {...base} className={className}><rect x="2" y="6" width="14" height="12" rx="2" /><path d="M16 10l6-4v12l-6-4" /></svg>);
export const IconMegaphone = ({ className = "w-[18px] h-[18px]" }: P) => (
  <svg {...base} className={className}><path d="M4 11v2a1 1 0 001 1h2l4 4V6L7 10H5a1 1 0 00-1 1z" /><path d="M16 8a5 5 0 010 8" /></svg>);
export const IconClock = ({ className = "w-[18px] h-[18px]" }: P) => (
  <svg {...base} className={className}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>);
export const IconCheck = ({ className = "w-[18px] h-[18px]" }: P) => (
  <svg {...base} className={className} strokeWidth={2.2}><polyline points="20 6 9 17 4 12" /></svg>);
export const IconX = ({ className = "w-[18px] h-[18px]" }: P) => (
  <svg {...base} className={className} strokeWidth={2.2}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>);
export const IconTrash = ({ className = "w-[18px] h-[18px]" }: P) => (
  <svg {...base} className={className}><path d="M4 7h16" /><path d="M9 7V4.5a1 1 0 011-1h4a1 1 0 011 1V7" /><path d="M6.5 7l.8 12.5a2 2 0 002 1.9h5.4a2 2 0 002-1.9L17.5 7" /><path d="M10 11v6M14 11v6" /></svg>);
export const IconPlus = ({ className = "w-[18px] h-[18px]" }: P) => (
  <svg {...base} className={className} strokeWidth={2}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>);
export const IconCalendar = ({ className = "w-[18px] h-[18px]" }: P) => (
  <svg {...base} className={className}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>);
export const IconUsers = ({ className = "w-[18px] h-[18px]" }: P) => (
  <svg {...base} className={className}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></svg>);
export const IconUserPlus = ({ className = "w-[18px] h-[18px]" }: P) => (
  <svg {...base} className={className}><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="17" y1="11" x2="23" y2="11" /></svg>);
export const IconFolder = ({ className = "w-[18px] h-[18px]" }: P) => (
  <svg {...base} className={className}><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /></svg>);
export const IconApprove = ({ className = "w-[18px] h-[18px]" }: P) => (
  <svg {...base} className={className}><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg>);
export const IconBell = ({ className = "w-[18px] h-[18px]" }: P) => (
  <svg {...base} className={className}><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" /></svg>);
export const IconMoon = ({ className = "w-[18px] h-[18px]" }: P) => (
  <svg {...base} className={className}><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg>);
export const IconSun = ({ className = "w-[18px] h-[18px]" }: P) => (
  <svg {...base} className={className}><circle cx="12" cy="12" r="4" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.2" y1="4.2" x2="5.6" y2="5.6" /><line x1="18.4" y1="18.4" x2="19.8" y2="19.8" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.2" y1="19.8" x2="5.6" y2="18.4" /><line x1="18.4" y1="5.6" x2="19.8" y2="4.2" /></svg>);
export const IconPalm = ({ className = "w-[18px] h-[18px]" }: P) => (
  <svg {...base} className={className}><path d="M12 22V8" /><path d="M12 8C12 5 9 3 6 4c1 2 3 4 6 4z" /><path d="M12 8c0-3 3-5 6-4-1 2-3 4-6 4z" /><path d="M12 8C10 6 6 6 4 9c2 1 6 1 8-1z" /><path d="M12 8c2-2 6-2 8 1-2 1-6 1-8-1z" /></svg>);
export const IconDownload = ({ className = "w-[18px] h-[18px]" }: P) => (
  <svg {...base} className={className}><polyline points="8 17 12 21 16 17" /><line x1="12" y1="12" x2="12" y2="21" /><path d="M20.88 18.09A5 5 0 0018 9h-1.26A8 8 0 103 16.29" /></svg>);
export const IconMapPin = ({ className = "w-[18px] h-[18px]" }: P) => (
  <svg {...base} className={className}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>);
export const IconAlert = ({ className = "w-[18px] h-[18px]" }: P) => (
  <svg {...base} className={className}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>);
export const IconLogout = ({ className = "w-[18px] h-[18px]" }: P) => (
  <svg {...base} className={className}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>);
export const IconChevronLeft = ({ className = "w-[18px] h-[18px]" }: P) => (
  <svg {...base} className={className}><polyline points="15 18 9 12 15 6" /></svg>);
export const IconClipboard = ({ className = "w-[18px] h-[18px]" }: P) => (
  <svg {...base} className={className}><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /></svg>);
export const IconSettings = ({ className = "w-[18px] h-[18px]" }: P) => (
  <svg {...base} className={className}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 005 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9c.23.5.7.85 1.25 1H21a2 2 0 010 4h-.09c-.55.15-1.02.5-1.25 1z" /></svg>);
