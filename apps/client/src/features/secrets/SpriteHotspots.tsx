import { useNavigate } from "react-router-dom";
import type { SpriteHotspot } from "./spriteHotspots";

export default function SpriteHotspots({ hotspots, debug = false }: { hotspots: SpriteHotspot[]; debug?: boolean }) {
  const navigate = useNavigate();
  return <div className={`sprite-hotspots${debug ? " sprite-hotspots-debug" : ""}`} aria-label="Hidden details">
    {hotspots.map((spot) => <button key={spot.id} type="button" className="sprite-hotspot" aria-label={spot.ariaLabel || spot.id}
      style={{ left: `${spot.x}%`, top: `${spot.y}%`, width: `${spot.width}%`, height: `${spot.height}%` }}
      onClick={() => navigate(spot.action.href)} />)}
  </div>;
}
