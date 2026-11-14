import React from 'react';

export interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

const baseProps = (size = 18, className?: string, style?: React.CSSProperties) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className,
  style: { flexShrink: 0, verticalAlign: 'middle', ...style },
});

export const IconDashboard: React.FC<IconProps> = ({ size = 18, className, style }) => (
  <svg {...baseProps(size, className, style)}>
    <rect width="7" height="9" x="3" y="3" rx="1.5" />
    <rect width="7" height="5" x="14" y="3" rx="1.5" />
    <rect width="7" height="9" x="14" y="12" rx="1.5" />
    <rect width="7" height="5" x="3" y="16" rx="1.5" />
  </svg>
);

export const IconZap: React.FC<IconProps> = ({ size = 18, className, style }) => (
  <svg {...baseProps(size, className, style)}>
    <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
  </svg>
);

export const IconRefreshCw: React.FC<IconProps> = ({ size = 18, className, style }) => (
  <svg {...baseProps(size, className, style)}>
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M8 16H3v5" />
  </svg>
);

export const IconFlask: React.FC<IconProps> = ({ size = 18, className, style }) => (
  <svg {...baseProps(size, className, style)}>
    <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2" />
    <path d="M8.5 2h7" />
    <path d="M7 16h10" />
  </svg>
);

export const IconCreditCard: React.FC<IconProps> = ({ size = 18, className, style }) => (
  <svg {...baseProps(size, className, style)}>
    <rect width="20" height="14" x="2" y="5" rx="2" />
    <line x1="2" x2="22" y1="10" y2="10" />
  </svg>
);

export const IconShieldAlert: React.FC<IconProps> = ({ size = 18, className, style }) => (
  <svg {...baseProps(size, className, style)}>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="M12 8v4" />
    <path d="M12 16h.01" />
  </svg>
);

export const IconGlobe: React.FC<IconProps> = ({ size = 18, className, style }) => (
  <svg {...baseProps(size, className, style)}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
    <path d="M2 12h20" />
  </svg>
);

export const IconKeyRound: React.FC<IconProps> = ({ size = 18, className, style }) => (
  <svg {...baseProps(size, className, style)}>
    <path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z" />
    <circle cx="16.5" cy="7.5" r=".5" fill="currentColor" />
  </svg>
);

export const IconPanelLeftClose: React.FC<IconProps> = ({ size = 18, className, style }) => (
  <svg {...baseProps(size, className, style)}>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M9 3v18" />
    <path d="m16 15-3-3 3-3" />
  </svg>
);

export const IconPanelLeftOpen: React.FC<IconProps> = ({ size = 18, className, style }) => (
  <svg {...baseProps(size, className, style)}>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M9 3v18" />
    <path d="m14 9 3 3-3 3" />
  </svg>
);

export const IconSun: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg {...baseProps(size, className, style)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="m17.66 17.66 1.41 1.41" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="m6.34 17.66-1.41 1.41" />
    <path d="m19.07 4.93-1.41 1.41" />
  </svg>
);

export const IconMoon: React.FC<IconProps> = ({ size = 16, className, style }) => (
  <svg {...baseProps(size, className, style)}>
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </svg>
);

export const IconExternalLink: React.FC<IconProps> = ({ size = 15, className, style }) => (
  <svg {...baseProps(size, className, style)}>
    <path d="M15 3h6v6" />
    <path d="M10 14 21 3" />
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </svg>
);

export const IconLogOut: React.FC<IconProps> = ({ size = 15, className, style }) => (
  <svg {...baseProps(size, className, style)}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" x2="9" y1="12" y2="12" />
  </svg>
);

export const IconCheckCircle: React.FC<IconProps> = ({ size = 14, className, style }) => (
  <svg {...baseProps(size, className, style)}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <path d="m9 11 3 3L22 4" />
  </svg>
);

export const IconClock: React.FC<IconProps> = ({ size = 14, className, style }) => (
  <svg {...baseProps(size, className, style)}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

export const IconXCircle: React.FC<IconProps> = ({ size = 14, className, style }) => (
  <svg {...baseProps(size, className, style)}>
    <circle cx="12" cy="12" r="10" />
    <path d="m15 9-6 6" />
    <path d="m9 9 6 6" />
  </svg>
);

export const IconPlay: React.FC<IconProps> = ({ size = 15, className, style }) => (
  <svg {...baseProps(size, className, style)}>
    <polygon points="6 3 20 12 6 21 6 3" />
  </svg>
);

export const IconPlus: React.FC<IconProps> = ({ size = 15, className, style }) => (
  <svg {...baseProps(size, className, style)}>
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </svg>
);

export const IconSparkles: React.FC<IconProps> = ({ size = 15, className, style }) => (
  <svg {...baseProps(size, className, style)}>
    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
  </svg>
);

export const IconArrowRight: React.FC<IconProps> = ({ size = 15, className, style }) => (
  <svg {...baseProps(size, className, style)}>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

