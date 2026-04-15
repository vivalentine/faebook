const fs = require("fs");
const path = require("path");
const { createArchiveRecord, createAuditLog } = require("./archive");

let sharp = null;
try {
  // Optional dependency in constrained environments.
  // eslint-disable-next-line global-require
  sharp = require("sharp");
} catch (_error) {
  sharp = null;
}

const SUPPORTED_EXTENSIONS = new Set([".png", ".webp", ".jpg", ".jpeg"]);
const MAX_PORTRAIT_BYTES = 10 * 1024 * 1024;
const PORTRAIT_DIR = path.join(__dirname, "../../uploads/npc-portraits");
const PORTRAIT_ORIGINALS_DIR = path.join(PORTRAIT_DIR, "originals");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function ensurePortraitDirs() {
  ensureDir(PORTRAIT_DIR);
  ensureDir(PORTRAIT_ORIGINALS_DIR);
}

function sanitizeSlug(slug) {
  return (
    String(slug || "npc")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "npc"
  );
}

function nowToken(now) {
  return String(now || new Date().toISOString()).replace(/[^0-9]/g, "");
}

function getFileExtension(filename) {
  return path.extname(String(filename || "")).toLowerCase();
}

function toAbsoluteUploadPath(uploadPath) {
  if (!uploadPath || !String(uploadPath).startsWith("/uploads/")) {
    return null;
  }
  return path.join(__dirname, "../../", uploadPath.replace(/^\//, ""));
}

async function readImageMetadata(buffer) {
  if (!sharp) {
    return {
      width: null,
      height: null,
      has_alpha: null,
    };
  }

  const metadata = await sharp(buffer).metadata();
  return {
    width: Number(metadata.width || 0) || null,
    height: Number(metadata.height || 0) || null,
    has_alpha: typeof metadata.hasAlpha === "boolean" ? metadata.hasAlpha : null,
  };
}

async function processPortraitUpload({ slug, portrait, now }) {
  if (!portrait || !portrait.buffer) {
    return null;
  }

  const ext = portrait.ext || getFileExtension(portrait.filename);
  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    throw new Error("Unsupported portrait file type");
  }

  const size = Number(portrait.size || portrait.buffer.length || 0);
  if (size > MAX_PORTRAIT_BYTES) {
    throw new Error("Portrait file exceeds 10MB");
  }

  ensurePortraitDirs();

  const safeSlug = sanitizeSlug(slug);
  const stamp = nowToken(now);
  const base = `${safeSlug}-${stamp}`;

  const sourceFileName = `${base}-source${ext}`;
  const sourceDiskPath = path.join(PORTRAIT_ORIGINALS_DIR, sourceFileName);
  fs.writeFileSync(sourceDiskPath, portrait.buffer);

  let assetPath = `/uploads/npc-portraits/originals/${sourceFileName}`;
  let mimeType = portrait.mimeType || null;
  let fileExtension = ext;
  let optimizedSizeBytes = size;

  if (sharp) {
    const optimizedFileName = `${base}.webp`;
    const optimizedDiskPath = path.join(PORTRAIT_DIR, optimizedFileName);

    await sharp(portrait.buffer, { animated: true })
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({
        quality: 84,
        alphaQuality: 92,
        effort: 4,
        nearLossless: false,
      })
      .toFile(optimizedDiskPath);

    const optimizedBuffer = fs.readFileSync(optimizedDiskPath);
    assetPath = `/uploads/npc-portraits/${optimizedFileName}`;
    mimeType = "image/webp";
    fileExtension = ".webp";
    optimizedSizeBytes = optimizedBuffer.byteLength;
  }

  const imageMetadata = await readImageMetadata(portrait.buffer);

  return {
    assetPath,
    originalAssetPath: `/uploads/npc-portraits/originals/${sourceFileName}`,
    originalFilename: portrait.filename,
    mimeType,
    sourceMimeType: portrait.mimeType || null,
    fileSizeBytes: optimizedSizeBytes,
    sourceFileSizeBytes: size,
    fileExtension,
    sourceFileExtension: ext,
    optimizer: sharp ? "sharp-webp" : "none",
    ...imageMetadata,
  };
}

function buildPortraitMetadata(portraitPath) {
  if (!portraitPath) {
    return null;
  }

  const absolutePath = toAbsoluteUploadPath(portraitPath);
  if (!absolutePath || !fs.existsSync(absolutePath)) {
    return {
      active_path: portraitPath,
      exists_on_disk: false,
    };
  }

  const stat = fs.statSync(absolutePath);
  return {
    active_path: portraitPath,
    file_name: path.basename(absolutePath),
    extension: getFileExtension(absolutePath),
    size_bytes: stat.size,
    updated_at: stat.mtime.toISOString(),
    exists_on_disk: true,
    optimization_pipeline: sharp ? "sharp-webp" : "none",
  };
}

function archiveCurrentPortrait({ db, npcRow, dmUserId, now, sourceAction, replacement }) {
  if (!npcRow?.portrait_path) {
    return;
  }

  createArchiveRecord(db, {
    objectType: "portrait_asset",
    objectId: `${npcRow.id}:${now}`,
    ownerUserId: dmUserId,
    archivedByUserId: dmUserId,
    archivedAt: now,
    payload: {
      npc_id: npcRow.id,
      prior_portrait_path: npcRow.portrait_path,
      next_portrait_path: replacement?.assetPath || null,
      optimized_asset_path: replacement?.assetPath || null,
      source_asset_path: replacement?.originalAssetPath || null,
      source_action: sourceAction,
      archived_file_metadata: buildPortraitMetadata(npcRow.portrait_path),
      replacement_file_metadata: replacement
        ? {
            asset_path: replacement.assetPath,
            original_asset_path: replacement.originalAssetPath,
            optimized_size_bytes: replacement.fileSizeBytes,
            source_size_bytes: replacement.sourceFileSizeBytes,
            width: replacement.width,
            height: replacement.height,
            has_alpha: replacement.has_alpha,
            optimizer: replacement.optimizer,
          }
        : null,
    },
    objectLabel: `Portrait replaced for ${npcRow.slug}`,
    sourceTable: "npcs",
    archiveReason: sourceAction,
  });
}

function replaceNpcPortrait({
  db,
  npcRow,
  replacement,
  dmUserId,
  now,
  sourceAction,
  auditActionType,
  auditMessage,
}) {
  if (!replacement?.assetPath) {
    return npcRow;
  }

  if (npcRow.portrait_path && npcRow.portrait_path !== replacement.assetPath) {
    archiveCurrentPortrait({
      db,
      npcRow,
      dmUserId,
      now,
      sourceAction,
      replacement,
    });
  }

  db.prepare(
    `
      UPDATE npcs
      SET portrait_path = ?, updated_at = ?
      WHERE id = ?
    `
  ).run(replacement.assetPath, now, npcRow.id);

  createAuditLog(db, {
    actorUserId: dmUserId,
    actionType: auditActionType,
    objectType: "npc",
    objectId: npcRow.id,
    message: auditMessage,
    createdAt: now,
  });

  return db
    .prepare(
      `
        SELECT *
        FROM npcs
        WHERE id = ?
      `
    )
    .get(npcRow.id);
}

function clearNpcPortrait({ db, npcRow, dmUserId, now, sourceAction }) {
  if (!npcRow?.portrait_path) {
    return npcRow;
  }

  archiveCurrentPortrait({
    db,
    npcRow,
    dmUserId,
    now,
    sourceAction,
    replacement: null,
  });

  db.prepare(
    `
      UPDATE npcs
      SET portrait_path = NULL, updated_at = ?
      WHERE id = ?
    `
  ).run(now, npcRow.id);

  createAuditLog(db, {
    actorUserId: dmUserId,
    actionType: "npc_portrait_clear",
    objectType: "npc",
    objectId: npcRow.id,
    message: `DM cleared portrait in-app: ${npcRow.slug}`,
    createdAt: now,
  });

  return db
    .prepare(
      `
        SELECT *
        FROM npcs
        WHERE id = ?
      `
    )
    .get(npcRow.id);
}

module.exports = {
  buildPortraitMetadata,
  clearNpcPortrait,
  getFileExtension,
  processPortraitUpload,
  replaceNpcPortrait,
  SUPPORTED_EXTENSIONS,
  MAX_PORTRAIT_BYTES,
};
