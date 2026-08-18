const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "../../uploads/tactical");

function safeExtension(file) {
  const extensions = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp" };
  return extensions[String(file?.mimetype || "").toLowerCase()] || null;
}

async function storeTacticalImage(file, encounterId, kind) {
  const extension = safeExtension(file);
  if (!file?.buffer || !extension) throw new Error("Unsupported tactical image");
  const metadata = await sharp(file.buffer).metadata();
  if (!metadata.width || !metadata.height || !["png", "jpeg", "webp"].includes(metadata.format)) {
    throw new Error("Image could not be validated");
  }
  const directory = path.join(ROOT, String(encounterId), kind);
  fs.mkdirSync(directory, { recursive: true });
  const filename = `${Date.now()}-${crypto.randomUUID()}${extension}`;
  const diskPath = path.join(directory, filename);
  fs.writeFileSync(diskPath, file.buffer, { flag: "wx" });
  return {
    path: `/uploads/tactical/${encounterId}/${kind}/${filename}`,
    originalName: path.basename(file.originalname || filename).slice(0, 180),
    width: metadata.width,
    height: metadata.height,
    fileSize: file.size,
    mimeType: file.mimetype,
    uploadedAt: new Date().toISOString(),
  };
}

module.exports = { storeTacticalImage };
