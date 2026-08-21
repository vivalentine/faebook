import { apiUrl } from "../lib/api";
import type { Npc } from "../types";
import LongNoonPortrait from "./LongNoonPortrait";

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
    return <img className={className} src={apiUrl(npc.portrait_path)} alt={npc.name} />;
  }

  return <div className={`${className} placeholder`}>No image</div>;
}
