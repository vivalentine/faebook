const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");
const { createArchiveRecord, createAuditLog } = require("./archive");

const STAGED_IMPORTS = new Map();
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VISIBILITY_VALUES = new Set(["hidden", "visible"]);
const IMAGE_EXTENSIONS = new Set([".png", ".webp", ".jpg", ".jpeg"]);

function getNow() {
  return new Date().toISOString();
}

function normalizeString(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : null;
}

function normalizeAlias(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeNameToSlug(name) {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getPortraitUploadsDir() {
  const dir = path.join(__dirname, "../../uploads/npc-portraits");
  ensureDir(dir);
  return dir;
}

function getStage(dmUserId) {
  if (!STAGED_IMPORTS.has(dmUserId)) {
    STAGED_IMPORTS.set(dmUserId, {
      markdownFiles: [],
      portraitFiles: [],
      createdAt: getNow(),
      updatedAt: getNow(),
    });
  }

  return STAGED_IMPORTS.get(dmUserId);
}

function clearStage(dmUserId) {
  STAGED_IMPORTS.set(dmUserId, {
    markdownFiles: [],
    portraitFiles: [],
    createdAt: getNow(),
    updatedAt: getNow(),
  });

  return STAGED_IMPORTS.get(dmUserId);
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

function addStagedPortraitFiles(dmUserId, files) {
  const stage = getStage(dmUserId);

  for (const file of files || []) {
    const ext = path.extname(String(file.originalname || "")).toLowerCase();
    const issues = [];

    if (!IMAGE_EXTENSIONS.has(ext)) {
      issues.push("Unsupported extension");
    }

    if (Number(file.size || 0) > 10 * 1024 * 1024) {
      issues.push("File is larger than 10MB");
    }

    stage.portraitFiles.push({
      filename: file.originalname,
      ext,
      buffer: file.buffer,
      size: Number(file.size || 0),
      mimeType: String(file.mimetype || ""),
      uploadedAt: getNow(),
      validationIssues: issues,
    });
  }

  stage.updatedAt = getNow();
  return stage;
}

function parseMarkdownFile(markdownFile) {
  const issues = [];
  let parsed;

  try {
    parsed = matter(markdownFile.content);
  } catch (_error) {
    return {
      filename: markdownFile.filename,
      state: "invalid",
      parsedName: null,
      parsedSlug: null,
      status: null,
      matchedPortrait: null,
      validationIssues: ["Invalid frontmatter format"],
      warnings: [],
      unmatchedPortraitState: "unmatched-portrait",
      frontmatter: null,
      body: "",
    };
  }

  const data = parsed.data || {};
  const name = normalizeString(data.name);
  const slug = normalizeString(data.slug);
  const roleType = normalizeString(data.role_type);
  const visibility = normalizeString(data.visibility);

  if (!name) issues.push("Missing required field: name");
  if (!slug) issues.push("Missing required field: slug");
  if (!roleType) issues.push("Missing required field: role_type");
  if (!visibility) issues.push("Missing required field: visibility");

  if (roleType && roleType !== "npc") {
    issues.push("role_type must equal 'npc'");
  }

  if (slug && !SLUG_PATTERN.test(slug)) {
    issues.push("Invalid slug format");
  }

  if (visibility && !VISIBILITY_VALUES.has(visibility)) {
    issues.push("Invalid visibility value");
  }

  const canonicalAliases = Array.isArray(data.canonical_aliases)
    ? data.canonical_aliases
        .map((alias) => normalizeString(alias))
        .filter(Boolean)
        .reduce((acc, alias) => {
          if (!acc.some((existing) => existing.toLowerCase() === alias.toLowerCase())) {
            acc.push(alias);
          }
          return acc;
        }, [])
    : [];

  const preview = {
    filename: markdownFile.filename,
    state: issues.length ? "invalid" : "warning",
    parsedName: name,
    parsedSlug: slug,
    status: null,
    matchedPortrait: null,
    validationIssues: issues,
    warnings: [],
    unmatchedPortraitState: "unmatched-portrait",
    frontmatter: {
      name,
      slug,
      role_type: roleType,
      visibility,
      rank_title: normalizeString(data.rank_title),
      house: normalizeString(data.house),
      faction: normalizeString(data.faction),
      court: normalizeString(data.court),
      ring: normalizeString(data.ring),
      introduced_in: normalizeString(data.introduced_in),
      met_summary: normalizeString(data.met_summary),
      short_blurb: normalizeString(data.short_blurb),
      portrait_filename: normalizeString(data.portrait_filename),
      source_file_label: normalizeString(data.source_file_label),
      sort_name: normalizeString(data.sort_name),
      canonical_aliases: canonicalAliases,
    },
    body: parsed.content || "",
  };

  if (!preview.frontmatter.portrait_filename) {
    preview.warnings.push("portrait_filename missing");
  }
  if (!preview.frontmatter.source_file_label) {
    preview.warnings.push("source_file_label missing");
  }
  if (!canonicalAliases.length) {
    preview.warnings.push("no canonical aliases present");
  }

  return preview;
}

function findPortraitMatch(previewItem, portraitsByFilename) {
  const candidates = [];
  const frontmatter = previewItem.frontmatter || {};

  const portraitFilename = frontmatter.portrait_filename;
  if (portraitFilename && portraitsByFilename.has(portraitFilename)) {
    return portraitsByFilename.get(portraitFilename);
  }

  const slug = previewItem.parsedSlug;
  if (slug) {
    for (const ext of IMAGE_EXTENSIONS) {
      const slugFilename = `${slug}${ext}`;
      if (portraitsByFilename.has(slugFilename)) {
        return portraitsByFilename.get(slugFilename);
      }
      if (portraitsByFilename.has(slugFilename.toLowerCase())) {
        return portraitsByFilename.get(slugFilename.toLowerCase());
      }
    }
  }

  const normalizedName = normalizeNameToSlug(previewItem.parsedName || "");
  if (normalizedName) {
    for (const ext of IMAGE_EXTENSIONS) {
      const nameFilename = `${normalizedName}${ext}`;
      if (portraitsByFilename.has(nameFilename)) {
        candidates.push(portraitsByFilename.get(nameFilename));
      }
      if (portraitsByFilename.has(nameFilename.toLowerCase())) {
        candidates.push(portraitsByFilename.get(nameFilename.toLowerCase()));
      }
    }
  }

  return candidates[0] || null;
}

function buildImportPreview(db, dmUserId) {
  const stage = getStage(dmUserId);
  const markdownPreview = stage.markdownFiles.map(parseMarkdownFile);
  const portraitsByFilename = new Map();

  for (const portrait of stage.portraitFiles) {
    portraitsByFilename.set(portrait.filename, portrait);
    portraitsByFilename.set(String(portrait.filename).toLowerCase(), portrait);
  }

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

    const portraitMatch = findPortraitMatch(item, portraitsByFilename);
    if (portraitMatch) {
      item.matchedPortrait = portraitMatch.filename;
      item.unmatchedPortraitState = "matched";
    } else {
      item.warnings.push("portrait not found");
      item.unmatchedPortraitState = "unmatched-portrait";
    }

    if (!item.validationIssues.length) {
      const existing = db
        .prepare(
          `
            SELECT id
            FROM npcs
            WHERE slug = ?
          `
        )
        .get(item.parsedSlug);
      item.status = existing ? "update" : "create";
      item.state = item.unmatchedPortraitState === "matched" ? item.status : "warning";
    }
  }

  const matchedPortraits = new Set(
    markdownPreview
      .map((item) => item.matchedPortrait)
      .filter(Boolean)
      .map((value) => String(value))
  );

  const unmatchedPortraitFiles = stage.portraitFiles
    .filter((portrait) => !matchedPortraits.has(String(portrait.filename)))
    .map((portrait) => ({
      filename: portrait.filename,
      size: portrait.size,
      validationIssues: portrait.validationIssues || [],
    }));

  return {
    staged_markdown_count: stage.markdownFiles.length,
    staged_portrait_count: stage.portraitFiles.length,
    files: markdownPreview.map((item) => ({
      filename: item.filename,
      parsed_name: item.parsedName,
      slug: item.parsedSlug,
      status: item.status,
      state: item.state,
      matched_portrait: item.matchedPortrait,
      unmatched_portrait_state: item.unmatchedPortraitState,
      validation_issues: item.validationIssues,
      warnings: item.warnings,
    })),
    unmatched_files: unmatchedPortraitFiles,
    internal: {
      markdownPreview,
      portraitsByFilename,
    },
  };
}

function persistPortrait({ slug, portrait, dmUserId, now }) {
  if (!portrait || !portrait.buffer) {
    return null;
  }

  const uploadsDir = getPortraitUploadsDir();
  const ext = portrait.ext || path.extname(portrait.filename || "").toLowerCase() || ".png";
  const base = `${slug}-${now.replace(/[^0-9]/g, "")}`;
  const fileName = `${base}${ext}`;
  const diskPath = path.join(uploadsDir, fileName);
  fs.writeFileSync(diskPath, portrait.buffer);

  return {
    assetPath: `/uploads/npc-portraits/${fileName}`,
    originalFilename: portrait.filename,
    mimeType: portrait.mimeType || null,
    fileSizeBytes: portrait.size || null,
    uploadedByUserId: dmUserId,
  };
}

function archivePortraitIfReplaced(db, npcRow, newPortraitPath, dmUserId, now) {
  if (!npcRow?.portrait_path || !newPortraitPath || npcRow.portrait_path === newPortraitPath) {
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
      source_action: "import-replacement",
    },
    objectLabel: `Portrait replaced for ${npcRow.slug}`,
    sourceTable: "npcs",
    archiveReason: "import-replacement",
  });

  createAuditLog(db, {
    actorUserId: dmUserId,
    actionType: "portrait_replace",
    objectType: "npc",
    objectId: npcRow.id,
    message: `Replaced portrait during import: ${npcRow.slug}`,
    createdAt: now,
  });
}

function importCanonicalAliases(db, npcId, canonicalAliases, dmUserId, now) {
  const incoming = Array.isArray(canonicalAliases) ? canonicalAliases : [];
  const existing = db
    .prepare(
      `
        SELECT *
        FROM npc_aliases
        WHERE npc_id = ?
          AND alias_type = 'canonical'
          AND archived_at IS NULL
      `
    )
    .all(npcId);

  const existingByNormalized = new Map();
  for (const row of existing) {
    existingByNormalized.set(row.alias_normalized, row);
  }

  const incomingNormalized = new Set();

  for (const alias of incoming) {
    const normalized = normalizeAlias(alias);
    if (!normalized) continue;
    if (incomingNormalized.has(normalized)) continue;
    incomingNormalized.add(normalized);

    if (!existingByNormalized.has(normalized)) {
      db.prepare(
        `
          INSERT INTO npc_aliases (
            npc_id,
            user_id,
            alias,
            alias_normalized,
            alias_type,
            created_at,
            updated_at
          )
          VALUES (?, NULL, ?, ?, 'canonical', ?, ?)
        `
      ).run(npcId, alias, normalized, now, now);

      createAuditLog(db, {
        actorUserId: dmUserId,
        actionType: "canonical_alias_imported",
        objectType: "npc",
        objectId: npcId,
        message: `Imported canonical alias for npc ${npcId}: ${alias}`,
        createdAt: now,
      });
    }
  }

  for (const row of existing) {
    if (incomingNormalized.has(row.alias_normalized)) {
      continue;
    }

    db.prepare(
      `
        UPDATE npc_aliases
        SET archived_at = ?, archived_by_user_id = ?, updated_at = ?
        WHERE id = ?
      `
    ).run(now, dmUserId, now, row.id);

    createArchiveRecord(db, {
      objectType: "npc_alias",
      objectId: row.id,
      ownerUserId: dmUserId,
      archivedByUserId: dmUserId,
      archivedAt: now,
      payload: { row },
      objectLabel: row.alias,
      sourceTable: "npc_aliases",
      archiveReason: "import-removed",
    });

    createAuditLog(db, {
      actorUserId: dmUserId,
      actionType: "canonical_alias_archived",
      objectType: "npc_alias",
      objectId: row.id,
      message: `Archived canonical alias during import: ${row.alias}`,
      createdAt: now,
    });
  }
}

function finalizeImport(db, dmUserId) {
  const preview = buildImportPreview(db, dmUserId);
  const now = getNow();
  const results = [];

  const tx = db.transaction(() => {
    for (const file of preview.internal.markdownPreview) {
      if (file.validationIssues.length) {
        db.prepare(
          `
            INSERT INTO import_logs (
              dm_user_id,
              filename,
              result,
              message,
              created_at
            )
            VALUES (?, ?, 'invalid', ?, ?)
          `
        ).run(dmUserId, file.filename, file.validationIssues.join("; "), now);

        results.push({ filename: file.filename, result: "invalid", slug: file.parsedSlug || null });
        continue;
      }

      const frontmatter = file.frontmatter;
      const portrait = file.matchedPortrait
        ? preview.internal.portraitsByFilename.get(file.matchedPortrait) ||
          preview.internal.portraitsByFilename.get(String(file.matchedPortrait).toLowerCase())
        : null;
      const portraitPersisted = persistPortrait({
        slug: frontmatter.slug,
        portrait,
        dmUserId,
        now,
      });

      const existing = db
        .prepare(
          `
            SELECT *
            FROM npcs
            WHERE slug = ?
          `
        )
        .get(frontmatter.slug);

      if (existing) {
        archivePortraitIfReplaced(
          db,
          existing,
          portraitPersisted ? portraitPersisted.assetPath : existing.portrait_path,
          dmUserId,
          now
        );

        db.prepare(
          `
            UPDATE npcs
            SET
              name = ?,
              rank_title = ?,
              house = ?,
              faction = ?,
              court = ?,
              ring = ?,
              introduced_in = ?,
              met_summary = ?,
              short_blurb = ?,
              is_visible = ?,
              portrait_path = ?,
              source_file = ?,
              source_file_label = ?,
              sort_name = ?,
              raw_markdown_body = ?,
              last_imported_at = ?,
              updated_at = ?
            WHERE id = ?
          `
        ).run(
          frontmatter.name,
          frontmatter.rank_title,
          frontmatter.house,
          frontmatter.faction,
          frontmatter.court,
          frontmatter.ring,
          frontmatter.introduced_in,
          frontmatter.met_summary,
          frontmatter.short_blurb,
          frontmatter.visibility === "visible" ? 1 : 0,
          portraitPersisted ? portraitPersisted.assetPath : existing.portrait_path,
          file.filename,
          frontmatter.source_file_label,
          frontmatter.sort_name,
          file.body,
          now,
          now,
          existing.id
        );

        importCanonicalAliases(db, existing.id, frontmatter.canonical_aliases, dmUserId, now);

        db.prepare(
          `
            INSERT INTO import_logs (dm_user_id, filename, result, message, created_at)
            VALUES (?, ?, 'updated', ?, ?)
          `
        ).run(dmUserId, file.filename, `Updated NPC ${frontmatter.slug}`, now);

        createAuditLog(db, {
          actorUserId: dmUserId,
          actionType: "npc_import_updated",
          objectType: "npc",
          objectId: existing.id,
          message: `Updated NPC from import: ${frontmatter.slug}`,
          createdAt: now,
        });

        results.push({ filename: file.filename, result: "updated", slug: frontmatter.slug });
      } else {
        const inserted = db
          .prepare(
            `
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
                source_file_label,
                sort_name,
                raw_markdown_body,
                last_imported_at,
                created_at,
                updated_at
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, 'npc', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `
          )
          .run(
            frontmatter.slug,
            frontmatter.name,
            frontmatter.house,
            frontmatter.faction,
            frontmatter.court,
            frontmatter.ring,
            frontmatter.rank_title,
            frontmatter.introduced_in,
            portraitPersisted ? portraitPersisted.assetPath : null,
            frontmatter.met_summary,
            frontmatter.short_blurb,
            frontmatter.visibility === "visible" ? 1 : 0,
            file.filename,
            frontmatter.source_file_label,
            frontmatter.sort_name,
            file.body,
            now,
            now,
            now
          );

        const npcId = Number(inserted.lastInsertRowid);
        importCanonicalAliases(db, npcId, frontmatter.canonical_aliases, dmUserId, now);

        db.prepare(
          `
            INSERT INTO import_logs (dm_user_id, filename, result, message, created_at)
            VALUES (?, ?, 'created', ?, ?)
          `
        ).run(dmUserId, file.filename, `Created NPC ${frontmatter.slug}`, now);

        createAuditLog(db, {
          actorUserId: dmUserId,
          actionType: "npc_import_created",
          objectType: "npc",
          objectId: npcId,
          message: `Created NPC from import: ${frontmatter.slug}`,
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
    staged_portrait_count: preview.staged_portrait_count,
    files: preview.files,
    unmatched_files: preview.unmatched_files,
  };
}

function stageFixtures(dmUserId) {
  const stage = clearStage(dmUserId);
  const markdownDir = path.join(__dirname, "../../fixtures/npcs");
  const portraitDir = path.join(__dirname, "../../fixtures/npc-images");

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

  const portraitFiles = fs
    .readdirSync(portraitDir)
    .filter((name) => IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()))
    .sort();

  for (const filename of portraitFiles) {
    const filePath = path.join(portraitDir, filename);
    stage.portraitFiles.push({
      filename,
      ext: path.extname(filename).toLowerCase(),
      buffer: fs.readFileSync(filePath),
      size: fs.statSync(filePath).size,
      mimeType: null,
      uploadedAt: getNow(),
      validationIssues: [],
    });
  }

  stage.updatedAt = getNow();

  return stage;
}

module.exports = {
  addStagedMarkdownFiles,
  addStagedPortraitFiles,
  clearStage,
  getStagingSummary,
  finalizeImport,
  stageFixtures,
};
