/**
 * Minimal line glyphs, used everywhere an emoji would otherwise creep in.
 * One geometric family, one stroke weight, so they read as a set.
 */
export type GlyphName =
  | "book" | "check" | "flame" | "chart" | "calendar" | "seal" | "users"
  | "settings" | "arrow-right" | "arrow-up" | "arrow-down" | "clock" | "plus"
  | "note" | "chat" | "bell" | "sun" | "moon" | "chevron" | "chevron-left" | "chevron-right"
  | "close" | "trash"
  | "link" | "scroll" | "trophy" | "quote" | "logout" | "copy";

export function Glyph({
  name,
  className = "h-4 w-4",
}: {
  name: GlyphName;
  className?: string;
}) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };

  switch (name) {
    case "book":
      return (
        <svg {...common}>
          <path d="M3 5.5c2.6-1.4 5.4-1.4 8 .3v13c-2.6-1.7-5.4-1.7-8-.3Z" />
          <path d="M21 5.5c-2.6-1.4-5.4-1.4-8 .3v13c2.6-1.7 5.4-1.7 8-.3Z" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <path d="m4.5 12.5 5 5 10-11" />
        </svg>
      );
    case "flame":
      return (
        <svg {...common}>
          <path d="M12 3c.9 3.3 4.1 4.6 4.1 8.6A4.1 4.1 0 0 1 7.9 12c0-1.1.4-2 1.1-2.6C10.4 10.9 12 9 12 3Z" />
        </svg>
      );
    case "chart":
      return (
        <svg {...common}>
          <path d="M4 20V4" />
          <path d="M4 20h16" />
          <path d="M8 20v-6M12.5 20V8M17 20v-9" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
          <path d="M3.5 10h17M8 3.5v3M16 3.5v3" />
        </svg>
      );
    case "seal":
      return (
        <svg {...common}>
          <path d="M12 3.2 14 5l2.6-.5.8 2.5 2.3 1.3-1 2.4 1 2.4-2.3 1.3-.8 2.5L14 16.4 12 18.2l-2-1.8-2.6.5-.8-2.5-2.3-1.3 1-2.4-1-2.4L6.6 7l.8-2.5L10 5Z" />
          <path d="m9.5 10.7 1.8 1.8 3.4-3.6" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <circle cx="9" cy="8.5" r="3.3" />
          <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" />
          <path d="M16 6.2a3.3 3.3 0 0 1 0 6.4" />
          <path d="M17.5 15a5.5 5.5 0 0 1 3 4.5" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <path d="M4 7.5h16M4 16.5h16" />
          <circle cx="9.5" cy="7.5" r="2.3" />
          <circle cx="15" cy="16.5" r="2.3" />
        </svg>
      );
    case "arrow-right":
      return (
        <svg {...common}>
          <path d="M4.5 12h15M13.5 6l6 6-6 6" />
        </svg>
      );
    case "arrow-up":
      return (
        <svg {...common}>
          <path d="M12 19.5v-15M6 10.5l6-6 6 6" />
        </svg>
      );
    case "arrow-down":
      return (
        <svg {...common}>
          <path d="M12 4.5v15M6 13.5l6 6 6-6" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.6" />
          <path d="M12 7v5.3l3.3 2" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "note":
      return (
        <svg {...common}>
          <path d="M5 4.5h14v15l-3.5-2.5L12 19.5 8.5 17 5 19.5Z" />
          <path d="M8.5 9h7M8.5 12.5h4.5" />
        </svg>
      );
    case "chat":
      return (
        <svg {...common}>
          <path d="M20.5 12.4c0 3.8-3.8 6.9-8.5 6.9-1 0-2-.15-2.9-.42L4.5 20.5l1.3-3.6C4.4 15.7 3.5 14.15 3.5 12.4c0-3.8 3.8-6.9 8.5-6.9s8.5 3.1 8.5 6.9Z" />
        </svg>
      );
    case "bell":
      return (
        <svg {...common}>
          <path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4 1.5 5.5 1.5 5.5h-14S6.5 14 6.5 10Z" />
          <path d="M10.2 19a2 2 0 0 0 3.6 0" />
        </svg>
      );
    case "sun":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.6v2.2M12 19.2v2.2M21.4 12h-2.2M4.8 12H2.6M18.6 5.4 17 7M7 17l-1.6 1.6M18.6 18.6 17 17M7 7 5.4 5.4" />
        </svg>
      );
    case "moon":
      return (
        <svg {...common}>
          <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
        </svg>
      );
    case "chevron":
      return (
        <svg {...common}>
          <path d="m8 10 4 4 4-4" />
        </svg>
      );
    case "chevron-left":
      return (
        <svg {...common}>
          <path d="m14 6-6 6 6 6" />
        </svg>
      );
    case "chevron-right":
      return (
        <svg {...common}>
          <path d="m10 6 6 6-6 6" />
        </svg>
      );
    case "close":
      return (
        <svg {...common}>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      );
    case "trash":
      return (
        <svg {...common}>
          <path d="M4.5 7h15M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7" />
          <path d="M6.5 7l.9 12a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-12" />
        </svg>
      );
    case "link":
      return (
        <svg {...common}>
          <path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.5 1.5" />
          <path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1.5-1.5" />
        </svg>
      );
    case "scroll":
      return (
        <svg {...common}>
          <path d="M6.5 4.5h11v13a2.5 2.5 0 0 1-2.5 2.5H9a2.5 2.5 0 0 1-2.5-2.5Z" />
          <path d="M9.5 8.5h5M9.5 12h5M9.5 15.5h3" />
        </svg>
      );
    case "trophy":
      return (
        <svg {...common}>
          <path d="M7.5 4.5h9v4.8a4.5 4.5 0 0 1-9 0Z" />
          <path d="M7.5 5.5h-3v1a2.8 2.8 0 0 0 2.8 2.8" />
          <path d="M16.5 5.5h3v1a2.8 2.8 0 0 1-2.8 2.8" />
          <path d="M12 13.8V16M9 20h6M10 20a2 2 0 0 1 4 0" />
        </svg>
      );
    case "quote":
      return (
        <svg {...common}>
          <path d="M9.5 6.5C7 7.6 5.5 9.8 5.5 12.5v5h5v-5h-3c0-1.8.8-3.2 2.6-4Z" />
          <path d="M18.5 6.5c-2.5 1.1-4 3.3-4 6v5h5v-5h-3c0-1.8.8-3.2 2.6-4Z" />
        </svg>
      );
    case "logout":
      return (
        <svg {...common}>
          <path d="M10 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H10" />
          <path d="M15 8.5l3.5 3.5L15 15.5M18.5 12H9" />
        </svg>
      );
    case "copy":
      return (
        <svg {...common}>
          <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
          <path d="M15.5 8.5v-2a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" />
        </svg>
      );
  }
}
