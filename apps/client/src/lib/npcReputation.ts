import type { NpcReputationDisplay } from "../types";

export function getFallbackReputation(): NpcReputationDisplay {
  return {
    bucket: "neutral",
    card_indicator: "neutral",
    card_label: "Neutral reputation",
    detail_text:
      "The bond is unreadable and unclaimed; you are known, but not yet favored nor spurned.",
    dm_hint: "Neutral footing.",
  };
}

export function getReputationIndicatorClassName(reputation: NpcReputationDisplay) {
  return `npc-reputation-indicator npc-reputation-${reputation.card_indicator}`;
}

