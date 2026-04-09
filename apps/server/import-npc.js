const fs = require("fs");
const path = require("path");
const db = require("./db");
const {
  addStagedMarkdownFiles,
  addStagedPortraitFiles,
  clearStage,
  getStagingSummary,
  finalizeImport,
} = require("./dm-npc-import");

function getDmUserId() {
  const dm = db
    .prepare(
      `
        SELECT id
        FROM users
        WHERE role = 'dm'
        ORDER BY id ASC
        LIMIT 1
      `
    )
    .get();

  if (!dm) {
    throw new Error("No DM user found. Seed users before running import.");
  }

  return dm.id;
}

function stageSingleMarkdown(dmUserId, mdFilePath) {
  if (!fs.existsSync(mdFilePath)) {
    throw new Error(`Markdown file not found: ${mdFilePath}`);
  }

  const fileBuffer = fs.readFileSync(mdFilePath);
  addStagedMarkdownFiles(dmUserId, [
    {
      originalname: path.basename(mdFilePath),
      size: fileBuffer.length,
      buffer: fileBuffer,
    },
  ]);
}

function stageSiblingPortraits(dmUserId, mdFilePath) {
  const sourceDir = path.dirname(mdFilePath);
  const supportedExts = new Set([".png", ".webp", ".jpg", ".jpeg"]);
  const portraitFiles = fs
    .readdirSync(sourceDir)
    .filter((name) => supportedExts.has(path.extname(name).toLowerCase()));

  const asUploads = portraitFiles.map((filename) => {
    const filePath = path.join(sourceDir, filename);
    const buffer = fs.readFileSync(filePath);
    return {
      originalname: filename,
      size: buffer.length,
      buffer,
      mimetype: "",
    };
  });

  if (asUploads.length) {
    addStagedPortraitFiles(dmUserId, asUploads);
  }
}

function main() {
  const mdFilePath = process.argv[2];

  if (!mdFilePath) {
    console.error('Usage: node import-npc.js "path/to/npc-file.md"');
    process.exit(1);
  }

  const resolvedPath = path.resolve(mdFilePath);
  const dmUserId = getDmUserId();
  clearStage(dmUserId);

  stageSingleMarkdown(dmUserId, resolvedPath);
  stageSiblingPortraits(dmUserId, resolvedPath);

  const preview = getStagingSummary(db, dmUserId);
  const item = preview.files[0];

  if (!item) {
    throw new Error("No markdown file was staged.");
  }

  if ((item.validation_issues || []).length) {
    throw new Error(`Import validation failed: ${item.validation_issues.join("; ")}`);
  }

  const result = finalizeImport(db, dmUserId);
  console.log(`Import complete for ${item.filename}: ${result.results.map((r) => r.result).join(", ")}`);
}

try {
  main();
  process.exit(0);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
