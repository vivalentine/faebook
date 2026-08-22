import { useNavigate } from "react-router-dom";
import type { SpriteHotspot } from "./npcSpriteHotspots";

export function SpriteHotspots({ hotspots, debug = false }: { hotspots: SpriteHotspot[]; debug?: boolean }) {
  const navigate = useNavigate();
  return <svg
    className={`sprite-hotspot-overlay${debug ? " sprite-hotspots-debug" : ""}`}
    viewBox="0 0 1536 1536"
    preserveAspectRatio="xMidYMid meet"
    aria-label="Hidden details"
  >
    {hotspots.map((spot) => <a
      key={spot.id}
      href={spot.href}
      aria-label={spot.label}
      onClick={(event) => {
        if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
          event.preventDefault();
          navigate(spot.href);
        }
      }}
    >
      <path className="sprite-hotspot" d={spot.path} />
    </a>)}
  </svg>;
}
