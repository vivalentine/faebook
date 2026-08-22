export type SpriteHotspot = { id: string; x: number; y: number; width: number; height: number; action: { type: "route"; href: string }; ariaLabel?: string };

export const npcSpriteHotspots: Record<string, SpriteHotspot[]> = {
  "lumi-turnleaf": [
    { id: "notebook", x: 53, y: 34, width: 20, height: 15, action: { type: "route", href: "/secret/faeo3" }, ariaLabel: "Lumi's notebook" },
    { id: "satchel", x: 53, y: 49, width: 17, height: 17, action: { type: "route", href: "/secret/pixie" }, ariaLabel: "Lumi's satchel" },
  ],
};
