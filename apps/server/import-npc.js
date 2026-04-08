const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");
const db = require("./db");

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ensureUploadsDir() {
  const uploadsDir = path.join(__dirname, "../../uploads/npcs");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  return uploadsDir;
}

function copyPortraitIfNeeded(mdFilePath, portraitFileName, slug) {
  if (!portraitFileName) {
    return null;
  }

  const sourceDir = path.dirname(mdFilePath);
  const sourcePath = path.join(sourceDir, portraitFileName);

  if (!fs.existsSync(sourcePath)) {
    console.warn(`Portrait file not found: ${sourcePath}`);
    return null;
  }

  const uploadsDir = ensureUploadsDir();
  const ext = path.extname(portraitFileName).toLowerCase() || ".png";
  const finalFileName = `${slug}${ext}`;
  const destPath = path.join(uploadsDir, finalFileName);

  fs.copyFileSync(sourcePath, destPath);

  return `/uploads/npcs/${finalFileName}`;
}

function importNpc(mdFilePath) {
  if (!fs.existsSync(mdFilePath)) {
    throw new Error(`Markdown file not found: ${mdFilePath}`);
  }

  const raw = fs.readFileSync(mdFilePath, "utf8");
  const { data } = matter(raw);

  if (!data.name) {
    throw new Error("Missing required frontmatter field: name");
  }

  const slug = data.slug || slugify(data.name);
  const playerCard = data.player_card || {};
  const now = new Date().toISOString();

  const portraitPath = copyPortraitIfNeeded(mdFilePath, playerCard.portrait, slug);

  const npc = {
    slug,
    name: data.name || "",
    house: data.house || "",
    faction: data.faction || "",
    court: data.court || "",
    ring: data.ring || "",
    rank_title: data.rank_title || "",
    role: data.role || "",
    introduced_in: data.introduced_in || "",
    portrait_path: portraitPath,
    met_summary: playerCard.met_summary || "",
    short_blurb: playerCard.short_blurb || "",
    is_visible: playerCard.visible ? 1 : 0,
    source_file: mdFilePath,
    created_at: now,
    updated_at: now,
  };

  const existing = db
    .prepare("SELECT id, portrait_path FROM npcs WHERE slug = ?")
    .get(npc.slug);

  if (existing && !npc.portrait_path) {
    npc.portrait_path = existing.portrait_path;
  }

  if (existing) {
    db.prepare(`
      UPDATE npcs
      SET
        name = @name,
        house = @house,
        faction = @faction,
        court = @court,
        ring = @ring,
        rank_title = @rank_title,
        role = @role,
        introduced_in = @introduced_in,
        portrait_path = @portrait_path,
        met_summary = @met_summary,
        short_blurb = @short_blurb,
        is_visible = @is_visible,
        source_file = @source_file,
        updated_at = @updated_at
      WHERE slug = @slug
    `).run(npc);

    console.log(`Updated NPC: ${npc.name}`);
  } else {
    db.prepare(`
      INSERT INTO npcs (
        slug,
        name,
        house,
        faction,
        court,
        ring,
        rank_title,
        role,
        introduced_in,
        portrait_path,
        met_summary,
        short_blurb,
        is_visible,
        source_file,
        created_at,
        updated_at
      ) VALUES (
        @slug,
        @name,
        @house,
        @faction,
        @court,
        @ring,
        @rank_title,
        @role,
        @introduced_in,
        @portrait_path,
        @met_summary,
        @short_blurb,
        @is_visible,
        @source_file,
        @created_at,
        @updated_at
      )
    `).run(npc);

    console.log(`Imported NPC: ${npc.name}`);
  }
}

const mdFilePath = process.argv[2];

if (!mdFilePath) {
  console.error('Usage: node import-npc.js "C:\\path\\to\\npc-file.md"');
  process.exit(1);
}

try {
  importNpc(path.resolve(mdFilePath));
  process.exit(0);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}