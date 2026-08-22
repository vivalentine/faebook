export const lumiStickerAssets = {
  "big-pink-heart": "/lumi/stickers/big-pink-heart.webp",
  "purple-heart": "/lumi/stickers/purple-heart.webp",
  "cyan-sparkle": "/lumi/stickers/cyan-sparkle.webp",
  "black-star": "/lumi/stickers/black-star.webp",
  angry: "/lumi/stickers/angry.webp",
  "broken-heart": "/lumi/stickers/broken-heart.webp",
  "pink-flower": "/lumi/stickers/pink-flower.webp",
  "pink-arrow": "/lumi/stickers/pink-arrow.webp",
  moth: "/lumi/stickers/moth.webp",
  cat: "/lumi/stickers/cat.webp",
  crown: "/lumi/stickers/crown.webp",
  kazoo: "/lumi/stickers/kazoo.webp",
  question: "/lumi/stickers/question.webp",
  "heart-bubble": "/lumi/stickers/heart-bubble.webp",
  ghost: "/lumi/stickers/ghost.webp",
} as const;

export type LumiStickerName = keyof typeof lumiStickerAssets;
