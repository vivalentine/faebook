export type FaeIconName =
  | "home"
  | "search"
  | "book-open"
  | "file-text"
  | "message-circle"
  | "users"
  | "pinboard"
  | "map"
  | "journal"
  | "map-pin"
  | "archive"
  | "sliders"
  | "heart"
  | "eye"
  | "x";

type FaeIconProps = {
  icon: FaeIconName;
  className?: string;
  filled?: boolean;
};

function FaeIconPath({ icon, filled = false }: { icon: FaeIconName; filled?: boolean }) {
  switch (icon) {
    case "home":
      return <path d="M3 10.5 12 3l9 7.5M6.5 8.5V21h11V8.5" />;
    case "search":
      return (
        <>
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="M15.5 15.5 21 21" />
        </>
      );
    case "book-open":
      return (
        <>
          <path d="M3 5.8c2.8-1.3 5.9-1.4 9 0v13.9c-3.1-1.4-6.2-1.3-9 0z" />
          <path d="M21 5.8c-2.8-1.3-5.9-1.4-9 0v13.9c3.1-1.4 6.2-1.3 9 0z" />
        </>
      );
    case "file-text":
      return (
        <>
          <path d="M7 3h8l4 4v14H7z" />
          <path d="M15 3v4h4M10 11h6M10 15h6M10 19h4" />
        </>
      );
    case "message-circle":
      return <path d="M21 11.4a8.5 8.5 0 0 1-8.5 8.5H5l-2 2v-7.5A8.5 8.5 0 1 1 21 11.4Z" />;
    case "users":
      return (
        <>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5.5a2.5 2.5 0 1 1 0 5M16.5 20a4.5 4.5 0 0 0-2.2-3.9" />
        </>
      );
    case "pinboard":
      return (
        <>
          <rect x="3" y="4" width="18" height="16" rx="2.5" />
          <circle cx="8" cy="9" r="1.2" />
          <circle cx="16" cy="8" r="1.2" />
          <circle cx="13.5" cy="15.5" r="1.2" />
          <path d="M9 9.6 15 8.6M15.2 9.2l-1.2 5.2M12.8 15.8 9.2 10.2" />
        </>
      );
    case "map":
      return (
        <>
          <path d="M3 6.5 8.8 4l6.4 2.5L21 4v13.5L15.2 20l-6.4-2.5L3 20z" />
          <path d="M9 4.2v13.1M15 6.3v13.4" />
        </>
      );
    case "journal":
      return (
        <>
          <rect x="5" y="3" width="14" height="18" rx="2.2" />
          <path d="M9 3v18M12 8h4M12 12h4M12 16h3" />
        </>
      );
    case "map-pin":
      return (
        <>
          <path d="M12 21s6-5.8 6-10a6 6 0 1 0-12 0c0 4.2 6 10 6 10Z" />
          <circle cx="12" cy="11" r="2.2" />
        </>
      );
    case "archive":
      return <path d="M3 7h18v4H3zM5 11h14v10H5zM10 15h4" />;
    case "sliders":
      return (
        <>
          <path d="M4 6h16M4 12h16M4 18h16" />
          <circle cx="9" cy="6" r="1.8" />
          <circle cx="15" cy="12" r="1.8" />
          <circle cx="11" cy="18" r="1.8" />
        </>
      );
    case "heart":
      return filled ? (
        <path d="m12 20.6-1.2-1c-3.9-3.2-6.5-5.4-6.5-8.2A4.3 4.3 0 0 1 8.7 7a4.8 4.8 0 0 1 3.3 1.4A4.8 4.8 0 0 1 15.3 7a4.3 4.3 0 0 1 4.4 4.4c0 2.8-2.6 5-6.5 8.2z" />
      ) : (
        <path d="m12 20.6-1.2-1c-3.9-3.2-6.5-5.4-6.5-8.2A4.3 4.3 0 0 1 8.7 7a4.8 4.8 0 0 1 3.3 1.4A4.8 4.8 0 0 1 15.3 7a4.3 4.3 0 0 1 4.4 4.4c0 2.8-2.6 5-6.5 8.2z" />
      );
    case "eye":
      return (
        <>
          <path d="M2.5 12s3.6-6 9.5-6 9.5 6 9.5 6-3.6 6-9.5 6-9.5-6-9.5-6Z" />
          <circle cx="12" cy="12" r="2.8" />
        </>
      );
    case "x":
      return <path d="M6 6 18 18M18 6 6 18" />;
    default:
      return null;
  }
}

export default function FaeIcon({ icon, className, filled = false }: FaeIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <FaeIconPath icon={icon} filled={filled} />
    </svg>
  );
}
