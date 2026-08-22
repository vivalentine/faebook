import { apiUrl } from "../lib/api";
import type { Npc } from "../types";
import LongNoonPortrait from "./LongNoonPortrait";
import { SpriteHotspots } from "../features/secrets/SpriteHotspots";
import { npcSpriteHotspots } from "../features/secrets/npcSpriteHotspots";

type Props = {
  npc: Npc;
  variant?: "card" | "detail";
};

export default function NpcPortrait({ npc, variant = "card" }: Props) {
  const className = variant === "detail" ? "detail-image" : "npc-image";

  if (npc.slug === "long-noon") {
    return <LongNoonPortrait className={className} name={npc.name} />;
  }

  if (npc.portrait_path) {
    const hotspots = variant === "detail" ? npcSpriteHotspots[npc.slug] : undefined;
    const debug = import.meta.env.DEV && import.meta.env.VITE_SPRITE_HOTSPOTS_DEBUG !== "0";
    if (!hotspots) return <img className={className} src={apiUrl(npc.portrait_path)} alt={npc.name} />;
    return <div className="sprite-hotspot-image-wrap"><img className={className} src={apiUrl(npc.portrait_path)} alt={npc.name} /><SpriteHotspots hotspots={hotspots} debug={debug} /></div>;
  }

  return <div className={`${className} placeholder`}>No image</div>;
}
