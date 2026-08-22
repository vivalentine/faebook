export const LUMI_STICKER_SHEET = "/lumi/posts/lumi_sticker_sheet.webp";
export const LUMI_STICKER_SHEET_SIZE = 1254;

export type LumiStickerName =
  | "big-heart" | "purple-heart" | "star" | "sparkle" | "sweat-drops"
  | "angry" | "scribble" | "broken-heart" | "flower" | "arrow"
  | "moth" | "cat" | "crown" | "kazoo" | "ghost" | "music-note"
  | "speech-heart" | "speech-question" | "blush" | "crying"
  | "excited" | "sleepy";

export type LumiStickerCrop = Readonly<{ x: number; y: number; width: number; height: number }>;

/** Pixel crops measured against the original 1254 x 1254 transparent sheet. */
export const lumiStickerAtlas: Record<LumiStickerName, LumiStickerCrop> = {
  "big-heart": { x: 16, y: 17, width: 158, height: 153 },
  "purple-heart": { x: 207, y: 43, width: 91, height: 83 },
  star: { x: 305, y: 17, width: 70, height: 94 },
  sparkle: { x: 378, y: 42, width: 94, height: 126 },
  "sweat-drops": { x: 705, y: 28, width: 191, height: 171 },
  angry: { x: 1091, y: 28, width: 151, height: 145 },
  scribble: { x: 913, y: 23, width: 170, height: 169 },
  "broken-heart": { x: 1095, y: 193, width: 144, height: 125 },
  flower: { x: 500, y: 196, width: 109, height: 153 },
  arrow: { x: 260, y: 377, width: 172, height: 101 },
  moth: { x: 694, y: 364, width: 267, height: 178 },
  cat: { x: 9, y: 589, width: 226, height: 199 },
  crown: { x: 457, y: 624, width: 176, height: 186 },
  kazoo: { x: 634, y: 746, width: 198, height: 91 },
  ghost: { x: 1034, y: 779, width: 144, height: 155 },
  "music-note": { x: 621, y: 347, width: 85, height: 113 },
  "speech-heart": { x: 1036, y: 648, width: 177, height: 133 },
  "speech-question": { x: 916, y: 627, width: 139, height: 137 },
  blush: { x: 790, y: 846, width: 175, height: 102 },
  crying: { x: 210, y: 859, width: 189, height: 135 },
  excited: { x: 558, y: 964, width: 210, height: 128 },
  sleepy: { x: 1001, y: 932, width: 222, height: 120 },
};

/** Stable variation for authored placements; never depends on render order. */
export function stickerRotation(seed: string, range = 10) {
  let hash = 0;
  for (const character of seed) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return (Math.abs(hash) % (range * 2 + 1)) - range;
}
