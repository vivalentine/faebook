import type { CSSProperties } from "react";
import {
  LUMI_STICKER_SHEET,
  LUMI_STICKER_SHEET_HEIGHT,
  LUMI_STICKER_SHEET_WIDTH,
  lumiStickerAtlas,
  type LumiStickerName,
} from "./lumiStickers";

type LumiStickerProps = {
  sticker: LumiStickerName;
  size?: number;
  rotate?: number;
  flip?: boolean;
  opacity?: number;
  zIndex?: number;
  animated?: boolean;
  duration?: number;
  className?: string;
};

export default function LumiSticker({
  sticker,
  size = 56,
  rotate = 0,
  flip = false,
  opacity = 1,
  zIndex,
  animated = false,
  duration = 1.1,
  className = "",
}: LumiStickerProps) {
  const crop = lumiStickerAtlas[sticker];
  const scale = size / Math.max(crop.width, crop.height);
  const clampedRotation = Math.max(-12, Math.min(12, rotate));
  const style = {
    "--sticker-width": `${crop.width * scale}px`,
    "--sticker-height": `${crop.height * scale}px`,
    "--sticker-rotate": `${clampedRotation}deg`,
    "--sticker-flip": flip ? -1 : 1,
    "--sticker-duration": `${duration}s`,
    overflow: "hidden",
    opacity,
    zIndex,
  } as CSSProperties;

  return (
    <svg
      className={`lumi-sticker${animated ? " lumi-sticker-twinkle" : ""} ${className}`.trim()}
      style={style}
      viewBox={`${crop.x} ${crop.y} ${crop.width} ${crop.height}`}
      aria-hidden="true"
      focusable="false"
    >
      <image
        href={LUMI_STICKER_SHEET}
        width={LUMI_STICKER_SHEET_WIDTH}
        height={LUMI_STICKER_SHEET_HEIGHT}
      />
    </svg>
  );
}

export function LumiStickerDivider({ className = "" }: { className?: string }) {
  return (
    <div className={`lumi-sticker-divider ${className}`.trim()} aria-hidden="true">
      <LumiSticker sticker="cyan-sparkle" size={24} rotate={-8} animated duration={1.4} />
      <LumiSticker sticker="big-pink-heart" size={30} rotate={6} />
      <LumiSticker sticker="black-star" size={24} rotate={-4} animated duration={1.1} />
    </div>
  );
}
