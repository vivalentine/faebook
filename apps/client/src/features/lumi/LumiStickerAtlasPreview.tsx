import LumiSticker from "./LumiSticker";
import {
  LUMI_STICKER_SHEET,
  LUMI_STICKER_SHEET_HEIGHT,
  LUMI_STICKER_SHEET_WIDTH,
  lumiStickerAtlas,
  type LumiStickerName,
} from "./lumiStickers";

export default function LumiStickerAtlasPreview() {
  return (
    <main className="lumi-atlas-preview">
      <h1>Lumi sticker atlas</h1>
      <p>Development-only crop inspection for the {LUMI_STICKER_SHEET_WIDTH} × {LUMI_STICKER_SHEET_HEIGHT} source.</p>
      <section className="lumi-atlas-grid">
        {(Object.entries(lumiStickerAtlas) as [LumiStickerName, (typeof lumiStickerAtlas)[LumiStickerName]][]).map(([name, crop]) => (
          <figure key={name}>
            <LumiSticker sticker={name} size={120} />
            <figcaption><strong>{name}</strong><code>x {crop.x}, y {crop.y}</code><code>{crop.width} × {crop.height}</code></figcaption>
          </figure>
        ))}
      </section>
      <section className="lumi-atlas-sheet">
        <h2>Full sheet and crop rectangles</h2>
        <svg viewBox={`0 0 ${LUMI_STICKER_SHEET_WIDTH} ${LUMI_STICKER_SHEET_HEIGHT}`}>
          <image href={LUMI_STICKER_SHEET} width={LUMI_STICKER_SHEET_WIDTH} height={LUMI_STICKER_SHEET_HEIGHT} />
          {Object.entries(lumiStickerAtlas).map(([name, crop]) => <g key={name}><rect x={crop.x} y={crop.y} width={crop.width} height={crop.height} /><text x={crop.x + 4} y={crop.y + 14}>{name}</text></g>)}
        </svg>
      </section>
    </main>
  );
}
