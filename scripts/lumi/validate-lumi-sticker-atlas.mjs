import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(path.join(root, "apps/server/package.json"));
const sharp = require("sharp");
const sheet = path.join(root, "apps/client/public/lumi/posts/lumi_sticker_sheet.webp");
const atlasSource = await readFile(path.join(root, "apps/client/src/features/lumi/lumiStickers.ts"), "utf8");
const metadata = await sharp(sheet).metadata();

if (metadata.width !== 1254 || metadata.height !== 1254 || !metadata.hasAlpha || metadata.channels !== 4) {
  throw new Error(`Unexpected Lumi sheet metadata: ${JSON.stringify(metadata)}`);
}

const atlasBody = atlasSource.match(/export const lumiStickerAtlas = \{([\s\S]*?)\n\} satisfies/)?.[1];
if (!atlasBody) throw new Error("Unable to locate the Lumi sticker atlas");

const crops = [...atlasBody.matchAll(/(?:"([^"]+)"|(\w+)):\s*\{ x: (\d+), y: (\d+), width: (\d+), height: (\d+) \}/g)];
if (crops.length === 0) throw new Error("No Lumi sticker crops found");

for (const match of crops) {
  const [, quotedName, bareName, xValue, yValue, widthValue, heightValue] = match;
  const [x, y, width, height] = [xValue, yValue, widthValue, heightValue].map(Number);
  if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > metadata.width || y + height > metadata.height) {
    throw new Error(`Out-of-bounds crop: ${quotedName || bareName}`);
  }
}

console.log(`Validated ${crops.length} crops against ${metadata.width}x${metadata.height} RGBA WebP`);
