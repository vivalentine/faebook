const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");
const { createAuditLog } = require("./archive");

const STAGED_LOCATION_IMPORTS = new Map();
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAP_LAYER_IDS = new Set(["overworld", "inner-ring", "outer-ring"]);

function getNow() {
  return new Date().toISOString();
}

function normalizeString(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : null;
}

function normalizeSlug(value) {
  const slug = normalizeString(value);
  if (!slug) return null;
  return slug.toLowerCase();
}

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeString(entry))
      .filter(Boolean)
      .slice(0, 24);
  }

  const scalar = normalizeString(value);
  if (!scalar) return [];

  return scalar
    .split(",")
    .map((entry) => String(entry).trim())
    .filter(Boolean)
    .slice(0, 24);
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }
  return null;
}

function normalizeForPreview(markdownText) {
  return String(markdownText || "")
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/`{3}[\s\S]*?`{3}/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 220);
}

function getStage(dmUserId) {
  if (!STAGED_LOCATION_IMPORTS.has(dmUserId)) {
    STAGED_LOCATION_IMPORTS.set(dmUserId, {
      markdownFiles: [],
      createdAt: getNow(),
      updatedAt: getNow(),
    });
  }

  return STAGED_LOCATION_IMPORTS.get(dmUserId);
}

function clearStage(dmUserId) {
  STAGED_LOCATION_IMPORTS.set(dmUserId, {
    markdownFiles: [],
    createdAt: getNow(),
    updatedAt: getNow(),
  });

  return STAGED_LOCATION_IMPORTS.get(dmUserId);
}

function addStagedMarkdownFiles(dmUserId, files) {
  const stage = getStage(dmUserId);

  for (const file of files || []) {
    if (!String(file.originalname || "").toLowerCase().endsWith(".md")) {
      continue;
    }

    stage.markdownFiles.push({
      filename: file.originalname,
      content: String(file.buffer || Buffer.from("")).toString("utf8"),
      size: Number(file.size || 0),
      uploadedAt: getNow(),
    });
  }

  stage.updatedAt = getNow();
  return stage;
}

function parseMarkdownFile(markdownFile) {
  const warnings = [];
  const validationIssues = [];
  let parsed;

  try {
    parsed = matter(markdownFile.content || "");
  } catch (error) {
    return {
      filename: markdownFile.filename,
      parsedName: null,
      parsedSlug: null,
      status: null,
      state: "invalid",
      validationIssues: ["Invalid YAML frontmatter"],
      warnings: [],
      previewSnippet: "",
      body: "",
      frontmatter: null,
    };
  }

  const data = parsed.data || {};
  const contentType = normalizeString(data.type);
  const name = normalizeString(data.name);
  const slug = normalizeSlug(data.slug);
  const mapId = normalizeString(data.map_id);
  const landmarkSlug = normalizeSlug(data.landmark_slug);
  const published = Object.prototype.hasOwnProperty.call(data, "published")
    ? normalizeBoolean(data.published)
    : false;

  if (!contentType) {
    validationIssues.push("Missing required field: type");
  } else if (contentType !== "location") {
    validationIssues.push("type must equal 'location'");
  }

  if (!name) {
    validationIssues.push("Missing required field: name");
  }

  if (!slug) {
    validationIssues.push("Missing required field: slug");
  } else if (!SLUG_PATTERN.test(slug)) {
    validationIssues.push("Invalid slug format");
  }

  if (mapId && !MAP_LAYER_IDS.has(mapId)) {
    validationIssues.push("Invalid map_id");
  }

  if (landmarkSlug && !SLUG_PATTERN.test(landmarkSlug)) {
    validationIssues.push("Invalid landmark_slug format");
  }

  if (Object.prototype.hasOwnProperty.call(data, "published") && published === null) {
    validationIssues.push("published must be a boolean");
  }

  const body = String(parsed.content || "").trim();
  if (!body) {
    warnings.push("body markdown is empty");
  }

  return {
    filename: markdownFile.filename,
    parsedName: name,
    parsedSlug: slug,
    status: null,
    state: validationIssues.length ? "invalid" : "staged",
    validationIssues,
    warnings,
    previewSnippet: normalizeForPreview(body),
    body,
    frontmatter: {
      name,
      slug,
      ring: normalizeString(data.ring),
      court: normalizeString(data.court),
      faction: normalizeString(data.faction),
      district: normalizeString(data.district),
      summary: normalizeString(data.summary),
      tags: normalizeTags(data.tags),
      map_id: mapId || null,
      landmark_slug: landmarkSlug,
      is_published: published ? 1 : 0,
    },
  };
}

function buildImportPreview(db, dmUserId) {
  const stage = getStage(dmUserId);
  const markdownPreview = stage.markdownFiles.map(parseMarkdownFile);

  const duplicateSlugSet = new Set();
  const seenSlug = new Set();

  for (const item of markdownPreview) {
    if (!item.parsedSlug) continue;
    if (seenSlug.has(item.parsedSlug)) {
      duplicateSlugSet.add(item.parsedSlug);
    }
    seenSlug.add(item.parsedSlug);
  }

  for (const item of markdownPreview) {
    if (item.parsedSlug && duplicateSlugSet.has(item.parsedSlug)) {
      item.validationIssues.push("Duplicate slug in staged batch");
      item.state = "invalid";
    }

    if (item.validationIssues.length) continue;

    const existing = db
      .prepare(
        `
          SELECT id
          FROM locations
          WHERE slug = ?
        `
      )
      .get(item.parsedSlug);

    item.status = existing ? "update" : "create";
    item.state = item.status;
  }

  return {
    staged_markdown_count: stage.markdownFiles.length,
    files: markdownPreview.map((item) => ({
      filename: item.filename,
      parsed_name: item.parsedName,
      slug: item.parsedSlug,
      status: item.status,
      state: item.state,
      validation_issues: item.validationIssues,
      warnings: item.warnings,
      preview_snippet: item.previewSnippet,
    })),
    internal: {
      markdownPreview,
    },
  };
}

async function finalizeImport(db, dmUserId) {
  const preview = buildImportPreview(db, dmUserId);
  const now = getNow();
  const results = [];

  const tx = db.transaction(() => {
    for (const file of preview.internal.markdownPreview) {
      if (file.validationIssues.length || !file.frontmatter) {
        db.prepare(
          `
            INSERT INTO import_logs (dm_user_id, filename, result, message, created_at)
            VALUES (?, ?, 'invalid', ?, ?)
          `
        ).run(dmUserId, file.filename, file.validationIssues.join("; ") || "Invalid file", now);

        results.push({ filename: file.filename, result: "invalid", slug: file.parsedSlug || null });
        continue;
      }

      const frontmatter = file.frontmatter;
      const existing = db
        .prepare(
          `
            SELECT *
            FROM locations
            WHERE slug = ?
          `
        )
        .get(frontmatter.slug);

      if (existing) {
        db.prepare(
          `
            UPDATE locations
            SET
              name = ?,
              ring = ?,
              court = ?,
              faction = ?,
              district = ?,
              summary = ?,
              body_markdown = ?,
              tags_json = ?,
              map_id = ?,
              landmark_slug = ?,
              is_published = ?,
              updated_at = ?
            WHERE id = ?
          `
        ).run(
          frontmatter.name,
          frontmatter.ring,
          frontmatter.court,
          frontmatter.faction,
          frontmatter.district,
          frontmatter.summary,
          file.body,
          JSON.stringify(frontmatter.tags),
          frontmatter.map_id,
          frontmatter.landmark_slug,
          frontmatter.is_published,
          now,
          existing.id
        );

        db.prepare(
          `
            INSERT INTO import_logs (dm_user_id, filename, result, message, created_at)
            VALUES (?, ?, 'updated', ?, ?)
          `
        ).run(dmUserId, file.filename, `Updated location ${frontmatter.slug}`, now);

        createAuditLog(db, {
          actorUserId: dmUserId,
          actionType: "location_import_updated",
          objectType: "location",
          objectId: existing.id,
          message: `Updated location from import: ${frontmatter.slug}`,
          createdAt: now,
        });

        results.push({ filename: file.filename, result: "updated", slug: frontmatter.slug });
      } else {
        const inserted = db
          .prepare(
            `
              INSERT INTO locations (
                slug,
                name,
                ring,
                court,
                faction,
                district,
                summary,
                body_markdown,
                tags_json,
                map_id,
                landmark_slug,
                is_published,
                created_at,
                updated_at
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `
          )
          .run(
            frontmatter.slug,
            frontmatter.name,
            frontmatter.ring,
            frontmatter.court,
            frontmatter.faction,
            frontmatter.district,
            frontmatter.summary,
            file.body,
            JSON.stringify(frontmatter.tags),
            frontmatter.map_id,
            frontmatter.landmark_slug,
            frontmatter.is_published,
            now,
            now
          );

        db.prepare(
          `
            INSERT INTO import_logs (dm_user_id, filename, result, message, created_at)
            VALUES (?, ?, 'created', ?, ?)
          `
        ).run(dmUserId, file.filename, `Created location ${frontmatter.slug}`, now);

        createAuditLog(db, {
          actorUserId: dmUserId,
          actionType: "location_import_created",
          objectType: "location",
          objectId: Number(inserted.lastInsertRowid),
          message: `Created location from import: ${frontmatter.slug}`,
          createdAt: now,
        });

        results.push({ filename: file.filename, result: "created", slug: frontmatter.slug });
      }
    }
  });

  tx();
  clearStage(dmUserId);

  return {
    finalized_at: now,
    results,
  };
}

function getStagingSummary(db, dmUserId) {
  const preview = buildImportPreview(db, dmUserId);
  return {
    staged_markdown_count: preview.staged_markdown_count,
    files: preview.files,
  };
}

function stageFixtures(dmUserId) {
  const stage = clearStage(dmUserId);
  const markdownDir = path.join(__dirname, "../../fixtures/locations");

  if (!fs.existsSync(markdownDir)) {
    return stage;
  }

  const markdownFiles = fs
    .readdirSync(markdownDir)
    .filter((name) => name.toLowerCase().endsWith(".md"))
    .sort();

  for (const filename of markdownFiles) {
    const filePath = path.join(markdownDir, filename);
    stage.markdownFiles.push({
      filename,
      content: fs.readFileSync(filePath, "utf8"),
      size: fs.statSync(filePath).size,
      uploadedAt: getNow(),
    });
  }

  stage.updatedAt = getNow();
  return stage;
}

module.exports = {
  addStagedMarkdownFiles,
  clearStage,
  finalizeImport,
  getStagingSummary,
  stageFixtures,
};
