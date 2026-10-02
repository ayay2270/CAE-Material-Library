import type { ReactNode, SVGProps } from 'react';

function Icon({ children, size = 14, ...rest }: { children: ReactNode; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

type P = { size?: number };

export const SearchIcon = (p: P) => (
  <Icon {...p}>
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5 14 14" />
  </Icon>
);
export const GridIcon = (p: P) => (
  <Icon {...p}>
    <rect x="2" y="2" width="5" height="5" />
    <rect x="9" y="2" width="5" height="5" />
    <rect x="2" y="9" width="5" height="5" />
    <rect x="9" y="9" width="5" height="5" />
  </Icon>
);
export const CompareIcon = (p: P) => (
  <Icon {...p}>
    <rect x="2" y="2.5" width="12" height="11" />
    <path d="M8 2.5v11M2 6.5h12" />
  </Icon>
);
export const ImportExportIcon = (p: P) => (
  <Icon {...p}>
    <path d="M8 2v8M5 7l3 3 3-3M2.5 11v2.5h11V11" />
  </Icon>
);
export const HelpIcon = (p: P) => (
  <Icon {...p}>
    <circle cx="8" cy="8" r="6" />
    <path d="M6.3 6.3a1.8 1.8 0 1 1 2.5 1.7c-.5.3-.8.6-.8 1.2M8 11.5v.1" />
  </Icon>
);
export const UserIcon = (p: P) => (
  <Icon {...p}>
    <circle cx="8" cy="5.5" r="2.8" />
    <path d="M2.5 14c.6-2.6 2.8-4 5.5-4s4.9 1.4 5.5 4" />
  </Icon>
);
export const MapIcon = (p: P) => (
  <Icon {...p}>
    <path d="M2 2v12h12" />
    <circle cx="5.5" cy="9.5" r="1" />
    <circle cx="8.5" cy="6" r="1" />
    <circle cx="12" cy="4" r="1" />
  </Icon>
);
export const RulerIcon = (p: P) => (
  <Icon {...p}>
    <rect x="1.5" y="5" width="13" height="6" />
    <path d="M4.5 5v2.5M7.5 5v3M10.5 5v2.5" />
  </Icon>
);
export const DownloadIcon = (p: P) => (
  <Icon {...p}>
    <path d="M8 2v8M5 7l3 3 3-3M2.5 13.5h11" />
  </Icon>
);
export const UploadIcon = (p: P) => (
  <Icon {...p}>
    <path d="M8 10V2M5 5l3-3 3 3M2.5 13.5h11" />
  </Icon>
);
export const PlusIcon = (p: P) => (
  <Icon {...p}>
    <path d="M8 3v10M3 8h10" />
  </Icon>
);
export const EditIcon = (p: P) => (
  <Icon {...p}>
    <path d="M10.5 2.5 13.5 5.5 5.5 13.5 2 14l.5-3.5z" />
  </Icon>
);
export const TrashIcon = (p: P) => (
  <Icon {...p}>
    <path d="M2.5 4.5h11M6 4.5V2.5h4v2M4 4.5l.6 9h6.8l.6-9M6.5 7v4M9.5 7v4" />
  </Icon>
);
export const CloseIcon = (p: P) => (
  <Icon {...p}>
    <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
  </Icon>
);
export const InfoIcon = (p: P) => (
  <Icon {...p}>
    <circle cx="8" cy="8" r="6" />
    <path d="M8 7.2v4M8 4.8v.1" />
  </Icon>
);
export const ArrowLeftIcon = (p: P) => (
  <Icon {...p}>
    <path d="M13 8H3M7 4 3 8l4 4" />
  </Icon>
);
export const ChevronLeftIcon = (p: P) => (
  <Icon {...p}>
    <path d="M10 3 5 8l5 5" />
  </Icon>
);
export const ChevronRightIcon = (p: P) => (
  <Icon {...p}>
    <path d="M6 3l5 5-5 5" />
  </Icon>
);
export const ResetIcon = (p: P) => (
  <Icon {...p}>
    <path d="M2.5 8a5.5 5.5 0 1 0 1.8-4.1M2.5 2.5v3h3" />
  </Icon>
);

export function SortArrows({ dir }: { dir: 'asc' | 'desc' | null }) {
  return (
    <svg width="8" height="11" viewBox="0 0 8 11" aria-hidden="true" className="sort-arrows">
      <path d="M4 0.8 7 4.6H1z" fill="currentColor" opacity={dir === 'asc' ? 1 : 0.28} />
      <path d="M4 10.2 1 6.4h6z" fill="currentColor" opacity={dir === 'desc' ? 1 : 0.28} />
    </svg>
  );
}
