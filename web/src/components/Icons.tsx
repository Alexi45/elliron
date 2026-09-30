type IconProps = { size?: number; className?: string };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const
});

export const IconSparkles = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
    <path d="M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z" />
    <path d="M5 15l.6 1.6L7 17l-1.4.4L5 19l-.6-1.6L3 17l1.4-.4L5 15z" />
  </svg>
);

export const IconDice = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <circle cx="8.5" cy="8.5" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="8.5" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="8.5" cy="15.5" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="15.5" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);

export const IconBook = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M4 4.5A1.5 1.5 0 015.5 3H19v16H5.5A1.5 1.5 0 004 20.5V4.5z" />
    <path d="M4 17.5A1.5 1.5 0 015.5 16H19" />
    <path d="M9 7h6" />
  </svg>
);

export const IconManga = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M21 12.5a8 8 0 01-8 8c-1.3 0-2.6-.3-3.7-.9L3 21l1.4-5.1A8 8 0 1121 12.5z" />
    <path d="M12 8.5l1 2.2 2.4.3-1.8 1.7.5 2.4-2.1-1.2-2.1 1.2.5-2.4L8.6 11l2.4-.3L12 8.5z" />
  </svg>
);

export const IconCoffee = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M4 9h12v6a5 5 0 01-5 5H9a5 5 0 01-5-5V9z" />
    <path d="M16 10.5h1.8a2.7 2.7 0 010 5.4H16" />
    <path d="M7.5 3.5c-.6.9-.6 1.6 0 2.5M11 3c-.6.9-.6 1.6 0 2.5" />
  </svg>
);

export const IconUsers = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M16 19v-1.5a3.5 3.5 0 00-3.5-3.5h-5A3.5 3.5 0 004 17.5V19" />
    <circle cx="10" cy="8" r="3.2" />
    <path d="M20 19v-1.5a3.5 3.5 0 00-2.6-3.4M15.5 5.2a3.2 3.2 0 010 5.6" />
  </svg>
);

export const IconTrophy = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M7 4h10v5a5 5 0 01-10 0V4z" />
    <path d="M7 6H4.5v1A3.5 3.5 0 008 10.5M17 6h2.5v1a3.5 3.5 0 01-3.5 3.5" />
    <path d="M12 14v3M9 20h6M10 17h4l.5 3h-5l.5-3z" />
  </svg>
);

export const IconMapPin = ({ size = 20 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M12 21s7-5.3 7-11a7 7 0 10-14 0c0 5.7 7 11 7 11z" />
    <circle cx="12" cy="10" r="2.6" />
  </svg>
);

export const IconClock = ({ size = 20 }: IconProps) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 1.8" />
  </svg>
);

export const IconCalendar = ({ size = 20 }: IconProps) => (
  <svg {...base(size)}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4" />
  </svg>
);

export const IconTicket = ({ size = 20 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M4 8.5A1.5 1.5 0 015.5 7h13A1.5 1.5 0 0120 8.5v2a2 2 0 000 4v2a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 16.5v-2a2 2 0 000-4v-2z" />
    <path d="M14 7v10" strokeDasharray="2 2.5" />
  </svg>
);

export const IconInstagram = ({ size = 20 }: IconProps) => (
  <svg {...base(size)}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17" cy="7" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);

export const IconTikTok = ({ size = 20 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M14 4v9.8a3.2 3.2 0 11-2.6-3.15" />
    <path d="M14 4.5c.4 2.2 2 3.7 4.3 3.9" />
  </svg>
);

export const IconPhone = ({ size = 20 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M6.5 3.5h3l1.4 3.5-2 1.4a11 11 0 005 5l1.4-2 3.5 1.4v3a2 2 0 01-2.2 2A16.5 16.5 0 014.5 5.7a2 2 0 012-2.2z" />
  </svg>
);

export const IconArrow = ({ size = 18 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M4.5 12h14M13 6.5l5.5 5.5-5.5 5.5" />
  </svg>
);

export const IconRefresh = ({ size = 16 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M20 11a8 8 0 10-1.6 5.6" />
    <path d="M20 5.5V11h-5.5" />
  </svg>
);

export const IconLock = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <rect x="4.5" y="10" width="15" height="10" rx="3" />
    <path d="M8 10V7.5a4 4 0 018 0V10" />
  </svg>
);

export const IconShield = ({ size = 20 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M12 3l7.5 2.8v5.4c0 4.4-3 8.3-7.5 9.8-4.5-1.5-7.5-5.4-7.5-9.8V5.8L12 3z" />
    <path d="M9 12.2l2.2 2.2 4-4.2" />
  </svg>
);

export { Logo, LironMark } from './Logo';
