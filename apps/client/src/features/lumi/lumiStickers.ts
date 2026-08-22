export const LUMI_STICKER_SHEET = "/lumi/posts/lumi_sticker_sheet.webp";
export const LUMI_STICKER_SHEET_WIDTH = 1254;
export const LUMI_STICKER_SHEET_HEIGHT = 1254;

export type LumiStickerName =
  | "big-pink-heart"
  | "purple-heart"
  | "cyan-sparkle"
  | "black-star"
  | "angry"
  | "broken-heart"
  | "pink-flower"
  | "pink-arrow"
  | "moth"
  | "cat"
  | "crown"
  | "kazoo"
  | "question"
  | "heart-bubble"
  | "ghost";

export type LumiStickerCrop = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

/** Source-pixel crops measured against the canonical transparent WebP sheet. */
export const lumiStickerAtlas = {
  "big-pink-heart": { x: 25, y: 25, width: 140, height: 141 },
  "purple-heart": { x: 214, y: 51, width: 76, height: 69 },
  "cyan-sparkle": { x: 386, y: 68, width: 76, height: 99 },
  "black-star": { x: 658, y: 22, width: 55, height: 56 },
  angry: { x: 1087, y: 27, width: 147, height: 151 },
  "broken-heart": { x: 1104, y: 194, width: 119, height: 105 },
  "pink-flower": { x: 608, y: 188, width: 79, height: 116 },
  "pink-arrow": { x: 271, y: 378, width: 147, height: 82 },
  moth: { x: 700, y: 364, width: 251, height: 174 },
  cat: { x: 15, y: 589, width: 225, height: 187 },
  crown: { x: 420, y: 620, width: 230, height: 190 },
  kazoo: { x: 646, y: 734, width: 189, height: 105 },
  question: { x: 916, y: 627, width: 139, height: 137 },
  "heart-bubble": { x: 1053, y: 653, width: 149, height: 123 },
  ghost: { x: 1037, y: 776, width: 136, height: 148 },
} satisfies Record<LumiStickerName, LumiStickerCrop>;

/** Throws immediately if an authored crop can escape the source texture. */
export function validateLumiStickerAtlas() {
  for (const [name, crop] of Object.entries(lumiStickerAtlas)) {
    const valid =
      crop.x >= 0 &&
      crop.y >= 0 &&
      crop.width > 0 &&
      crop.height > 0 &&
      crop.x + crop.width <= LUMI_STICKER_SHEET_WIDTH &&
      crop.y + crop.height <= LUMI_STICKER_SHEET_HEIGHT;
    if (!valid) throw new Error(`Lumi sticker crop is out of bounds: ${name}`);
  }
  return true;
}

validateLumiStickerAtlas();
