import type { CSSProperties } from "react";
import { LUMI_STICKER_SHEET, LUMI_STICKER_SHEET_SIZE, lumiStickerAtlas, type LumiStickerName } from "./lumiStickers";

type LumiStickerProps = {
  sticker: LumiStickerName;
  size?: number;
  rotate?: number;
  flip?: boolean;
  opacity?: number;
  zIndex?: number;
  className?: string;
};

export default function LumiSticker({ sticker, size = 56, rotate = 0, flip = false, opacity = 1, zIndex, className = "" }: LumiStickerProps) {
  const crop = lumiStickerAtlas[sticker];
  const scale = size / Math.max(crop.width, crop.height);
  const style: CSSProperties = {
    width: crop.width * scale,
    height: crop.height * scale,
    opacity,
    zIndex,
    transform: `rotate(${Math.max(-12, Math.min(12, rotate))}deg) scaleX(${flip ? -1 : 1})`,
  };
  return <svg className={`lumi-sticker ${className}`.trim()} style={style} viewBox={`${crop.x} ${crop.y} ${crop.width} ${crop.height}`} aria-hidden="true" focusable="false">
    <image href={LUMI_STICKER_SHEET} width={LUMI_STICKER_SHEET_SIZE} height={LUMI_STICKER_SHEET_SIZE} />
  </svg>;
}

export function LumiStickerDivider({ className = "" }: { className?: string }) {
  return <div className={`lumi-sticker-divider ${className}`.trim()} aria-hidden="true">
    <LumiSticker sticker="sparkle" size={28} rotate={-8} />
    <LumiSticker sticker="big-heart" size={34} rotate={6} />
    <LumiSticker sticker="star" size={29} rotate={-4} />
    <LumiSticker sticker="sparkle" size={25} rotate={9} flip />
  </div>;
}
