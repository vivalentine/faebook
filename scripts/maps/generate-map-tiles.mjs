#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(new URL("../..", import.meta.url).pathname);
const sourceDir = path.join(repoRoot, "apps/client/public/maps");
const tilesRoot = path.join(repoRoot, "apps/client/public/maps/tiles");
const sharpModulePath = path.join(repoRoot, "apps/server/node_modules/sharp/lib/index.js");

const MAPS = [
  { mapId: "overworld", sourceFile: "overworld-map.png" },
  { mapId: "inner-ring", sourceFile: "inner-ring-map.png" },
  { mapId: "outer-ring", sourceFile: "outer-ring-map.png" },
];

async function generateTiles() {
  const sharpImport = await import(`file://${sharpModulePath}`);
  const sharp = sharpImport.default;

  for (const map of MAPS) {
    const sourcePath = path.join(sourceDir, map.sourceFile);
    const mapOutputDir = path.join(tilesRoot, map.mapId);
    const outputBasePath = path.join(mapOutputDir, map.mapId);
    const dzOutputPath = `${outputBasePath}.dz`;
    const dziOutputPath = `${outputBasePath}.dzi`;

    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Missing map source image: ${sourcePath}`);
    }

    fs.rmSync(mapOutputDir, { recursive: true, force: true });
    fs.mkdirSync(mapOutputDir, { recursive: true });

    await sharp(sourcePath)
      .webp({ quality: 82 })
      .tile({
        layout: "dz",
        container: "fs",
        size: 256,
        overlap: 1,
      })
      .toFile(dzOutputPath);

    process.stdout.write(`Generated tiles for ${map.mapId}: ${path.relative(repoRoot, dziOutputPath)}\n`);
  }
}

generateTiles().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
