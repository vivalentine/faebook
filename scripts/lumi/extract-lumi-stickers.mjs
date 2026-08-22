import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
// Sharp is already a server dependency; resolve it from that package without
// adding an asset-preparation library to the browser application.
const require = createRequire(path.join(root, "apps/server/package.json"));
const sharp = require("sharp");
const source = path.join(root, "apps/client/public/lumi/posts/lumi_sticker_sheet.webp");
const outputDirectory = path.join(root, "apps/client/public/lumi/stickers");

const stickers = {
  "big-pink-heart": { left: 28, top: 26, width: 137, height: 141 },
  "purple-heart": { left: 214, top: 51, width: 76, height: 69 },
  "cyan-sparkle": { left: 375, top: 34, width: 91, height: 125 },
  "black-star": { left: 658, top: 22, width: 55, height: 56 },
  angry: { left: 1077, top: 33, width: 147, height: 94 },
  "broken-heart": { left: 1104, top: 194, width: 119, height: 105 },
  "pink-flower": { left: 608, top: 188, width: 79, height: 116 },
  "pink-arrow": { left: 271, top: 378, width: 147, height: 82 },
  moth: { left: 690, top: 297, width: 241, height: 240 },
  cat: { left: 15, top: 589, width: 225, height: 187 },
  crown: { left: 420, top: 599, width: 190, height: 200 },
  kazoo: { left: 646, top: 734, width: 189, height: 105 },
  question: { left: 908, top: 627, width: 133, height: 133 },
  "heart-bubble": { left: 1053, top: 653, width: 149, height: 123 },
  ghost: { left: 1037, top: 776, width: 136, height: 148 },
};

await mkdir(outputDirectory, { recursive: true });
await Promise.all(
  Object.entries(stickers).map(([name, crop]) =>
    sharp(source)
      .extract(crop)
      .webp({ lossless: true })
      .toFile(path.join(outputDirectory, `${name}.webp`)),
  ),
);

console.log(`Extracted ${Object.keys(stickers).length} Lumi stickers to ${outputDirectory}`);
