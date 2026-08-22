import type { CSSProperties } from "react";
import { lumiStickerAssets, type LumiStickerName } from "./lumiStickers";

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
  const clampedRotation = Math.max(-12, Math.min(12, rotate));
  const style = {
    "--sticker-size": `${size}px`,
    "--sticker-rotate": `${clampedRotation}deg`,
    "--sticker-flip": flip ? -1 : 1,
    "--sticker-duration": `${duration}s`,
    opacity,
    zIndex,
  } as CSSProperties;

  return (
    <img
      className={`lumi-sticker${animated ? " lumi-sticker-twinkle" : ""} ${className}`.trim()}
      style={style}
      src={lumiStickerAssets[sticker]}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
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
