require("dotenv").config();

const express = require("express");
const cors = require("cors");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const db = require("./db");
const { createArchiveRecord, createAuditLog, getRestoreStrategy } = require("./archive");
const {
  addStagedMarkdownFiles,
  addStagedPortraitFiles,
  clearStage,
  getStagingSummary,
  finalizeImport,
  stageFixtures,
} = require("./dm-npc-import");
const { runGlobalSearch, runGlobalSearchSuggestions } = require("./search");

const app = express();
const PORT = Number(process.env.PORT || 3001);
const SESSION_COOKIE_NAME = "faebook.sid";
const CLIENT_DIST_DIR = path.join(__dirname, "../client/dist");
const CLIENT_INDEX_PATH = path.join(CLIENT_DIST_DIR, "index.html");
const MAPS_CONFIG_DIR = path.join(__dirname, "../../config/maps");
const MAP_LAYER_IDS = ["overworld", "inner-ring", "outer-ring"];
const MAP_PIN_CATEGORIES = ["clue", "lead", "suspect", "danger", "meeting", "theory"];
const MAP_LANDMARK_MARKER_STYLES = ["district", "landmark", "estate", "civic", "market"];
const MAP_LANDMARK_VISIBILITY_SCOPES = ["public", "dm_only"];
const upload = multer({ storage: multer.memoryStorage() });

const allowedOrigins = new Set(
  String(process.env.CLIENT_URLS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);

if (process.env.TRUST_PROXY === "1") {
  app.set("trust proxy", 1);
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.has(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json());

app.use(
  session({
    name: SESSION_COOKIE_NAME,
    secret:
      process.env.SESSION_SECRET ||
      "dev-only-secret-change-this-in-apps-server-env",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === "1",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

function getSessionUser(row) {
  return {
    id: row.id,
    username: row.username,
    display_name: row.display_name,
    role: row.role,
  };
}

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!roles.includes(req.session.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    next();
  };
}

function mapNpcForPlayer(npc) {
  if (!npc) return null;

  return {
    id: npc.id,
    slug: npc.slug,
    name: npc.name,
    tier: npc.tier || "major",
    house: npc.house,
    faction: npc.faction,
    court: npc.court,
    ring: npc.ring,
    rank_title: npc.rank_title,
    role: npc.role,
    introduced_in: npc.introduced_in,
    portrait_path: npc.portrait_path,
    met_summary: npc.met_summary,
    short_blurb: npc.short_blurb,
    is_visible: npc.is_visible,
    canonical_aliases: Array.isArray(npc.canonical_aliases)
      ? npc.canonical_aliases
      : [],
    personal_aliases: Array.isArray(npc.personal_aliases)
      ? npc.personal_aliases
      : [],
    reputation: npc.reputation || null,
    created_at: npc.created_at,
    updated_at: npc.updated_at,
  };
}

function clampNpcReputationScore(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(-5, Math.min(5, Math.round(parsed)));
}

function getNpcReputationBucket(scoreValue) {
  const score = clampNpcReputationScore(scoreValue);

  if (score >= 5) {
    return {
      key: "extremely_high",
      card_indicator: "heart",
      card_label: "Extremely high reputation",
      detail_text:
        "Their gaze lingers on you with dangerous warmth; the thread between you hums like fate.",
      dm_hint: "Romance may be possible.",
    };
  }
  if (score >= 3) {
    return {
      key: "high",
      card_indicator: "green",
      card_label: "High reputation",
      detail_text:
        "You stand in trusted favor. If you call through the mirror, this soul is likely to answer.",
      dm_hint: "Will answer mirror calls.",
    };
  }
  if (score >= 1) {
    return {
      key: "warming",
      card_indicator: "yellow",
      card_label: "Warming reputation",
      detail_text:
        "Your standing is cautiously warm. A mirror call may be answered, though never without risk.",
      dm_hint: "Might answer a mirror call.",
    };
  }
  if (score === 0) {
    return {
      key: "neutral",
      card_indicator: "neutral",
      card_label: "Neutral reputation",
      detail_text:
        "The bond is unreadable and unclaimed; you are known, but not yet favored nor spurned.",
      dm_hint: "Neutral footing.",
    };
  }
  if (score >= -2) {
    return {
      key: "low",
      card_indicator: "red",
      card_label: "Low reputation",
      detail_text:
        "Distrust has crept in. This NPC will refuse your mirror calls unless forced by circumstance.",
      dm_hint: "Will not take calls.",
    };
  }
  if (score >= -4) {
    return {
      key: "very_negative",
      card_indicator: "black",
      card_label: "Very negative reputation",
      detail_text:
        "Resentment runs deep. They speak your name with bitterness and sharpened intent.",
      dm_hint: "Strongly dislikes the player.",
    };
  }

  return {
    key: "hated",
    card_indicator: "knife",
    card_label: "Hated reputation",
    detail_text:
      "Hatred is absolute. If paths cross, steel and spell are likely to follow at once.",
    dm_hint: "Will fight on sight.",
  };
}

function mapNpcReputationForClient(scoreValue, includeNumericScore = false) {
  const score = clampNpcReputationScore(scoreValue);
  const bucket = getNpcReputationBucket(score);
  const payload = {
    bucket: bucket.key,
    card_indicator: bucket.card_indicator,
    card_label: bucket.card_label,
    detail_text: bucket.detail_text,
    dm_hint: bucket.dm_hint,
  };

  if (includeNumericScore) {
    payload.score = score;
  }

  return payload;
}

function normalizeAlias(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function mapAliasForClient(aliasRow) {
  return {
    id: aliasRow.id,
    npc_id: aliasRow.npc_id,
    user_id: aliasRow.user_id,
    owner_display_name: aliasRow.owner_display_name || null,
    owner_username: aliasRow.owner_username || null,
    alias: aliasRow.alias,
    alias_type: aliasRow.alias_type,
    created_at: aliasRow.created_at,
    updated_at: aliasRow.updated_at,
  };
}

function mapNpcNoteForClient(noteRow) {
  if (!noteRow) return null;

  return {
    id: noteRow.id,
    npc_id: noteRow.npc_id,
    author_user_id: noteRow.author_user_id,
    author_name: noteRow.author_name,
    author_display_name: noteRow.author_display_name || null,
    author_username: noteRow.author_username || null,
    content: noteRow.content,
    created_at: noteRow.created_at,
    updated_at: noteRow.updated_at,
  };
}

function mapWhisperPostForClient(postRow) {
  if (!postRow) return null;

  return {
    id: postRow.id,
    title: postRow.title,
    body: postRow.body,
    like_count: Number(postRow.like_count || 0),
    comment_count: Number(postRow.comment_count || 0),
    view_count: Number(postRow.view_count || 0),
    created_at: postRow.created_at,
    updated_at: postRow.updated_at,
    liked_by_me: Number(postRow.liked_by_me || 0) === 1,
    can_moderate: Number(postRow.can_moderate || 0) === 1,
  };
}

function mapWhisperCommentForClient(commentRow) {
  if (!commentRow) return null;

  return {
    id: commentRow.id,
    post_id: commentRow.post_id,
    body: commentRow.body,
    created_at: commentRow.created_at,
    updated_at: commentRow.updated_at,
    can_moderate: Number(commentRow.can_moderate || 0) === 1,
  };
}

function getDefaultBoard() {
  return {
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

function getUserById(userId) {
  return db
    .prepare(
      `
        SELECT *
        FROM users
        WHERE id = ?
      `
    )
    .get(userId);
}

function ensureUserProfileRow(userId) {
  const now = new Date().toISOString();
  db.prepare(
    `
      INSERT INTO user_profiles (
        user_id,
        bio,
        status_line,
        pronouns,
        profile_image_path,
        created_at,
        updated_at
      )
      VALUES (?, '', '', '', NULL, ?, ?)
      ON CONFLICT(user_id) DO NOTHING
    `
  ).run(userId, now, now);
}

function getUserProfileForUserId(userId) {
  ensureUserProfileRow(userId);

  return db
    .prepare(
      `
        SELECT
          users.id AS user_id,
          users.username,
          users.display_name,
          users.role,
          user_profiles.bio,
          user_profiles.status_line,
          user_profiles.pronouns,
          user_profiles.profile_image_path,
          user_profiles.updated_at
        FROM users
        LEFT JOIN user_profiles
          ON user_profiles.user_id = users.id
        WHERE users.id = ?
      `
    )
    .get(userId);
}

function getBoardOwnerForRequest(req) {
  const sessionUser = req.session.user;

  if (!sessionUser) {
    return null;
  }

  if (sessionUser.role !== "dm") {
    return getUserById(sessionUser.id);
  }

  const requestedUserId = Number(req.query.userId);

  if (Number.isInteger(requestedUserId) && requestedUserId > 0) {
    return getUserById(requestedUserId) || null;
  }

  return getUserById(sessionUser.id);
}

function getDefaultBoardRow(ownerUserId) {
  return db
    .prepare(
      `
        SELECT *
        FROM boards
        WHERE owner_user_id = ?
          AND archived_at IS NULL
          AND is_default = 1
        LIMIT 1
      `
    )
    .get(ownerUserId);
}

function getBoardByIdForOwner(boardId, ownerUserId) {
  return db
    .prepare(
      `
        SELECT *
        FROM boards
        WHERE id = ?
          AND owner_user_id = ?
          AND archived_at IS NULL
      `
    )
    .get(boardId, ownerUserId);
}

function clearActiveBoardDefaults(ownerUserId, now, exceptBoardId = null) {
  if (exceptBoardId && Number.isInteger(exceptBoardId)) {
    db.prepare(
      `
        UPDATE boards
        SET is_default = 0,
            updated_at = ?
        WHERE owner_user_id = ?
          AND archived_at IS NULL
          AND is_default = 1
          AND id != ?
      `
    ).run(now, ownerUserId, exceptBoardId);
    return;
  }

  db.prepare(
    `
      UPDATE boards
      SET is_default = 0,
          updated_at = ?
      WHERE owner_user_id = ?
        AND archived_at IS NULL
        AND is_default = 1
    `
  ).run(now, ownerUserId);
}

function setSingleDefaultBoardForOwnerInTransaction(ownerUserId, boardId, now) {
  clearActiveBoardDefaults(ownerUserId, now, boardId);
  db.prepare(
    `
      UPDATE boards
      SET is_default = 1,
          updated_at = ?
      WHERE id = ?
        AND owner_user_id = ?
        AND archived_at IS NULL
    `
  ).run(now, boardId, ownerUserId);
}

function setSingleDefaultBoardForOwner(ownerUserId, boardId, now) {
  const tx = db.transaction(() => {
    setSingleDefaultBoardForOwnerInTransaction(ownerUserId, boardId, now);
  });

  tx();
}

function getLatestActiveBoardRow(ownerUserId) {
  return db
    .prepare(
      `
        SELECT *
        FROM boards
        WHERE owner_user_id = ?
          AND archived_at IS NULL
        ORDER BY updated_at DESC, id DESC
        LIMIT 1
      `
    )
    .get(ownerUserId);
}

function ensureBoardForOwner(ownerUserId) {
  const existingDefault = getDefaultBoardRow(ownerUserId);
  if (existingDefault) {
    return existingDefault;
  }

  const existingAny = getLatestActiveBoardRow(ownerUserId);

  const now = new Date().toISOString();

  if (existingAny) {
    setSingleDefaultBoardForOwner(ownerUserId, existingAny.id, now);
    return getBoardByIdForOwner(existingAny.id, ownerUserId);
  }

  const defaultBoard = getDefaultBoard();
  const tx = db.transaction(() => {
    const result = db
      .prepare(
        `
          INSERT INTO boards (
            owner_user_id,
            name,
            is_default,
            json_data,
            created_at,
            updated_at,
            archived_at,
            archived_by_user_id
          )
          VALUES (?, ?, 0, ?, ?, ?, NULL, NULL)
        `
      )
      .run(ownerUserId, "Investigation Board", JSON.stringify(defaultBoard), now, now);

    const newId = Number(result.lastInsertRowid);
    setSingleDefaultBoardForOwnerInTransaction(ownerUserId, newId, now);
    return newId;
  });

  const newBoardId = tx();

  return db
    .prepare(
      `
        SELECT *
        FROM boards
        WHERE id = ?
      `
    )
    .get(newBoardId);
}

function getBoardForRequest(req) {
  const ownerUser = getBoardOwnerForRequest(req);
  if (!ownerUser) {
    return { ownerUser: null, boardRow: null };
  }

  const boardId = Number(req.query.boardId);
  if (Number.isInteger(boardId) && boardId > 0) {
    const byId = getBoardByIdForOwner(boardId, ownerUser.id);
    if (byId) {
      return { ownerUser, boardRow: byId };
    }
    return { ownerUser, boardRow: null };
  }

  const boardRow = ensureBoardForOwner(ownerUser.id);
  return { ownerUser, boardRow };
}

function mapBoardSummary(row) {
  return {
    id: row.id,
    owner_user_id: row.owner_user_id,
    name: row.name,
    is_default: Number(row.is_default) === 1,
    updated_at: row.updated_at,
    created_at: row.created_at,
  };
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function limitString(value, maxLength) {
  return String(value || "").slice(0, maxLength);
}

function normalizeDocumentSlug(value) {
  return limitString(value, 120)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function deriveDocumentTitleFromMarkdown(bodyMarkdown, fallback = "Untitled Document") {
  const lines = String(bodyMarkdown || "").split(/\r?\n/);
  for (const line of lines) {
    const heading = line.trim().match(/^#{1,3}\s+(.+)$/);
    if (heading && heading[1]) {
      return limitString(heading[1].trim(), 160) || fallback;
    }
  }
  return fallback;
}

function formatTimestampForFilename(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}-${hour}${minute}`;
}

function safeMkdir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function parseSimpleYamlMap(rawText) {
  const result = {};
  const lines = String(rawText || "").split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf(":");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const valueRaw = line.slice(separatorIndex + 1).trim();
    const unquoted =
      (valueRaw.startsWith('"') && valueRaw.endsWith('"')) ||
      (valueRaw.startsWith("'") && valueRaw.endsWith("'"))
        ? valueRaw.slice(1, -1)
        : valueRaw;
    const asNumber = Number(unquoted);

    result[key] = Number.isFinite(asNumber) && unquoted !== "" ? asNumber : unquoted;
  }

  return result;
}

function loadMapsConfig() {
  const configs = [];
  const files = fs
    .readdirSync(MAPS_CONFIG_DIR)
    .filter((filename) => filename.toLowerCase().endsWith(".yml"))
    .sort();

  for (const filename of files) {
    const filePath = path.join(MAPS_CONFIG_DIR, filename);
    const parsed = parseSimpleYamlMap(fs.readFileSync(filePath, "utf8"));

    if (!MAP_LAYER_IDS.includes(parsed.map_id)) {
      continue;
    }

    const width = Number(parsed.width);
    const height = Number(parsed.height);
    const minZoom = Number(parsed.min_zoom);
    const maxZoom = Number(parsed.max_zoom);
    const defaultZoomRaw = Number(parsed.default_zoom);
    const defaultZoom = Number.isFinite(defaultZoomRaw)
      ? Math.min(Math.max(defaultZoomRaw, minZoom), maxZoom)
      : 1;

    if (!parsed.image_filename || !Number.isFinite(width) || !Number.isFinite(height)) {
      continue;
    }

    configs.push({
      map_id: parsed.map_id,
      label: String(parsed.label || parsed.map_id),
      image_filename: String(parsed.image_filename),
      image_path: `/maps/${String(parsed.image_filename)}`,
      width,
      height,
      default_zoom: defaultZoom,
      min_zoom: Number.isFinite(minZoom) ? minZoom : 0.5,
      max_zoom: Number.isFinite(maxZoom) ? maxZoom : 4,
      pin_scale: Number.isFinite(Number(parsed.pin_scale)) ? Number(parsed.pin_scale) : 1,
    });
  }

  configs.sort((a, b) => MAP_LAYER_IDS.indexOf(a.map_id) - MAP_LAYER_IDS.indexOf(b.map_id));
  return configs;
}

const MAP_CONFIGS = loadMapsConfig();

function sanitizeSuspectStatus(value) {
  return ["active", "cleared", "unknown"].includes(value) ? value : "unknown";
}

function archiveRecordAndLog({
  objectType,
  objectId,
  ownerUserId,
  archivedByUserId,
  payload,
  objectLabel,
  sourceTable,
  archiveReason,
  auditMessage,
}) {
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    const archiveRecord = createArchiveRecord(db, {
      objectType,
      objectId,
      ownerUserId,
      archivedByUserId,
      archivedAt: now,
      payload,
      objectLabel,
      sourceTable,
      archiveReason,
    });

    createAuditLog(db, {
      actorUserId: archivedByUserId,
      actionType: "archive",
      objectType,
      objectId,
      message: auditMessage,
      createdAt: now,
    });

    return archiveRecord;
  });

  return tx();
}

function getNpcCleanupImpact(npcId) {
  const aliases = db
    .prepare(
      `
        SELECT alias_type, COUNT(*) AS count
        FROM npc_aliases
        WHERE npc_id = ?
        GROUP BY alias_type
      `
    )
    .all(npcId);

  const aliasCounts = {
    canonical: 0,
    personal: 0,
  };

  for (const row of aliases) {
    if (row.alias_type === "canonical") {
      aliasCounts.canonical = Number(row.count || 0);
    }
    if (row.alias_type === "personal") {
      aliasCounts.personal = Number(row.count || 0);
    }
  }

  const notesCountRow = db
    .prepare(
      `
        SELECT COUNT(*) AS count
        FROM npc_notes
        WHERE npc_id = ?
      `
    )
    .get(npcId);

  return {
    aliases: aliasCounts,
    private_notes: Number(notesCountRow?.count || 0),
    has_player_content: aliasCounts.personal > 0 || Number(notesCountRow?.count || 0) > 0,
  };
}

function mapSuspectForClient(row) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    note: row.note,
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapDashboardNoteForClient(row) {
  return {
    id: row.id,
    content: row.content,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function clampNormalizedCoordinate(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function sanitizeMapLayer(value) {
  return MAP_LAYER_IDS.includes(value) ? value : MAP_LAYER_IDS[0];
}

function sanitizeMapPinCategory(value) {
  return MAP_PIN_CATEGORIES.includes(value) ? value : "clue";
}

function sanitizeMapLandmarkMarkerStyle(value) {
  return MAP_LANDMARK_MARKER_STYLES.includes(value) ? value : "landmark";
}

function sanitizeMapLandmarkVisibilityScope(value) {
  return MAP_LANDMARK_VISIBILITY_SCOPES.includes(value) ? value : "public";
}

function sanitizeOptionalSlug(value, fallback = "") {
  const candidate = String(value || fallback || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return limitString(candidate, 120);
}

function mapMapPinForClient(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    map_layer: row.map_layer,
    x: Number(row.x),
    y: Number(row.y),
    title: row.title,
    note: row.note || "",
    category: row.category,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapMapLandmarkForClient(row) {
  let linkedLocation = null;
  if (row.location_slug && row.location_name) {
    linkedLocation = {
      slug: row.location_slug,
      name: row.location_name,
      ring: row.location_ring || null,
      summary: row.location_summary || null,
    };
  }

  return {
    id: row.id,
    map_id: row.map_id,
    slug: row.slug,
    label: row.label,
    x: Number(row.x),
    y: Number(row.y),
    marker_style: row.marker_style,
    visibility_scope: row.visibility_scope,
    description: row.description || "",
    linked_page_slug: row.linked_page_slug || null,
    linked_entity_slug: row.linked_entity_slug || null,
    sort_order: Number(row.sort_order || 0),
    unlock_chapter: row.unlock_chapter == null ? null : Number(row.unlock_chapter),
    linked_location: linkedLocation,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function sanitizeLocationSlug(value, fallback = "") {
  return sanitizeOptionalSlug(value, fallback);
}

function parseLocationTags(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((tag) => String(tag || "").trim())
      .filter(Boolean)
      .slice(0, 24);
  }
  return String(value)
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 24);
}

function mapLocationForClient(row) {
  let parsedTags = [];
  try {
    const maybeTags = JSON.parse(row.tags_json || "[]");
    if (Array.isArray(maybeTags)) {
      parsedTags = maybeTags.map((tag) => String(tag)).filter(Boolean);
    }
  } catch {
    parsedTags = [];
  }

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    ring: row.ring || null,
    court: row.court || null,
    faction: row.faction || null,
    district: row.district || null,
    summary: row.summary || null,
    body_markdown: row.body_markdown || "",
    tags: parsedTags,
    map_id: row.map_id || null,
    landmark_slug: row.landmark_slug || null,
    is_published: Number(row.is_published) === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function getActiveDashboardNoteByUserId(userId) {
  return db
    .prepare(
      `
        SELECT id, content, created_at, updated_at
        FROM dashboard_notes
        WHERE user_id = ? AND archived_at IS NULL
        ORDER BY updated_at DESC, id DESC
        LIMIT 1
      `
    )
    .get(userId);
}

function getLatestRecap() {
  return db
    .prepare(
      `
        SELECT
          session_recaps.id,
          session_recaps.chapter_number,
          session_recaps.chapter_title,
          session_recaps.title,
          session_recaps.content,
          session_recaps.published_at,
          session_recaps.updated_at,
          session_recaps.published_by_user_id,
          users.display_name AS published_by_display_name,
          users.username AS published_by_username
        FROM session_recaps
        LEFT JOIN users
          ON users.id = session_recaps.published_by_user_id
        WHERE session_recaps.is_published = 1
        ORDER BY session_recaps.chapter_number DESC, session_recaps.published_at DESC, session_recaps.id DESC
        LIMIT 1
      `
    )
    .get();
}

function mapSessionRecapRow(row) {
  return {
    id: row.id,
    chapter_number: row.chapter_number,
    chapter_title: row.chapter_title,
    title: row.title,
    content: row.content,
    is_published: Number(row.is_published) === 1,
    published_at: row.published_at,
    updated_at: row.updated_at,
    published_by_user_id: row.published_by_user_id,
    published_by_display_name: row.published_by_display_name ?? null,
    published_by_username: row.published_by_username ?? null,
  };
}

function mapDocumentRow(row) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    document_type: row.document_type,
    body_markdown: row.body_markdown,
    published: Number(row.published) === 1,
    sort_order: Number(row.sort_order || 0),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function getCanonicalAliasesByNpcIds(npcIds) {
  if (!npcIds.length) return new Map();

  const placeholders = npcIds.map(() => "?").join(",");
  const rows = db
    .prepare(
      `
        SELECT npc_id, alias
        FROM npc_aliases
        WHERE npc_id IN (${placeholders})
          AND alias_type = 'canonical'
          AND archived_at IS NULL
        ORDER BY alias COLLATE NOCASE ASC
      `
    )
    .all(...npcIds);

  const byNpcId = new Map();
  for (const row of rows) {
    if (!byNpcId.has(row.npc_id)) {
      byNpcId.set(row.npc_id, []);
    }
    byNpcId.get(row.npc_id).push(row.alias);
  }

  return byNpcId;
}

function getPersonalAliasesByNpcIds(npcIds, userId) {
  if (!npcIds.length || !userId) return new Map();

  const placeholders = npcIds.map(() => "?").join(",");
  const rows = db
    .prepare(
      `
        SELECT npc_id, alias
        FROM npc_aliases
        WHERE npc_id IN (${placeholders})
          AND alias_type = 'personal'
          AND user_id = ?
          AND archived_at IS NULL
        ORDER BY alias COLLATE NOCASE ASC
      `
    )
    .all(...npcIds, userId);

  const byNpcId = new Map();
  for (const row of rows) {
    if (!byNpcId.has(row.npc_id)) {
      byNpcId.set(row.npc_id, []);
    }
    byNpcId.get(row.npc_id).push(row.alias);
  }

  return byNpcId;
}

function getReputationByNpcIdsForUser(npcIds, userId) {
  if (!npcIds.length || !Number.isInteger(Number(userId))) {
    return new Map();
  }

  const placeholders = npcIds.map(() => "?").join(",");
  const rows = db
    .prepare(
      `
        SELECT npc_id, score
        FROM npc_reputations
        WHERE user_id = ?
          AND npc_id IN (${placeholders})
      `
    )
    .all(userId, ...npcIds);

  const byNpcId = new Map();
  for (const row of rows) {
    byNpcId.set(row.npc_id, clampNpcReputationScore(row.score));
  }
  return byNpcId;
}

function getReputationForNpcAndUser(npcId, userId) {
  const row = db
    .prepare(
      `
        SELECT score
        FROM npc_reputations
        WHERE npc_id = ?
          AND user_id = ?
        LIMIT 1
      `
    )
    .get(npcId, userId);

  return row ? clampNpcReputationScore(row.score) : 0;
}

function safeParseBoard(rawJson) {
  try {
    const parsed = JSON.parse(rawJson);
    return sanitizeBoardPayload(parsed);
  } catch (_error) {
    return getDefaultBoard();
  }
}

function sanitizeViewport(viewport) {
  const x = isFiniteNumber(viewport?.x) ? viewport.x : 0;
  const y = isFiniteNumber(viewport?.y) ? viewport.y : 0;
  const zoom = isFiniteNumber(viewport?.zoom) ? viewport.zoom : 1;

  return {
    x,
    y,
    zoom: Math.min(Math.max(zoom, 0.1), 4),
  };
}

function sanitizeBoardNode(node, index) {
  if (!node || typeof node !== "object") {
    return null;
  }

  const id = limitString(node.id || `node-${index}`, 120);
  const kind = node.data?.kind === "npc" ? "npc" : "note";
  const noteColors = new Set(["yellow", "pink", "mint", "blue"]);
  const noteColor = noteColors.has(node.data?.noteColor) ? node.data.noteColor : "yellow";
  const noteRotation = isFiniteNumber(node.data?.noteRotation)
    ? Math.min(Math.max(node.data.noteRotation, -7), 7)
    : 0;
  const npcId = Number(node.data?.npcId);

  return {
    id,
    type: "boardCard",
    position: {
      x: isFiniteNumber(node.position?.x) ? node.position.x : 0,
      y: isFiniteNumber(node.position?.y) ? node.position.y : 0,
    },
    data: {
      kind,
      title: limitString(node.data?.title || "", 160),
      body: limitString(node.data?.body || "", 4000),
      npcId: kind === "npc" && Number.isInteger(npcId) && npcId > 0 ? npcId : undefined,
      imageUrl: kind === "npc" ? limitString(node.data?.imageUrl || "", 500) : undefined,
      noteColor: kind === "note" ? noteColor : undefined,
      noteRotation: kind === "note" ? noteRotation : undefined,
    },
  };
}

function sanitizeBoardEdge(edge, index) {
  if (!edge || typeof edge !== "object") {
    return null;
  }

  const source = limitString(edge.source || "", 120);
  const target = limitString(edge.target || "", 120);

  if (!source || !target) {
    return null;
  }

  return {
    id: limitString(edge.id || `edge-${index}`, 120),
    source,
    target,
    type: "boardEdge",
    data: {
      label: limitString(edge.data?.label || "", 160),
    },
    style: {
      stroke: "#c63b44",
      strokeWidth: 3,
    },
  };
}

function sanitizeBoardPayload(payload) {
  const nodes = Array.isArray(payload?.nodes)
    ? payload.nodes.map(sanitizeBoardNode).filter(Boolean)
    : [];

  const nodeIds = new Set(nodes.map((node) => node.id));

  const edges = Array.isArray(payload?.edges)
    ? payload.edges
        .map(sanitizeBoardEdge)
        .filter(Boolean)
        .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    : [];

  return {
    nodes,
    edges,
    viewport: sanitizeViewport(payload?.viewport),
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, app: "faebook-server" });
});

app.get("/api/auth/me", (req, res) => {
  res.json({
    user: req.session.user || null,
  });
});

app.patch("/api/auth/profile", requireRole("player", "dm"), (req, res) => {
  const displayName = String(req.body.display_name || "").trim();

  if (!displayName) {
    return res.status(400).json({ error: "display_name is required" });
  }

  if (displayName.length > 60) {
    return res.status(400).json({ error: "display_name must be 60 characters or fewer" });
  }

  const now = new Date().toISOString();
  const result = db
    .prepare(
      `
        UPDATE users
        SET display_name = ?,
            updated_at = ?
        WHERE id = ?
      `
    )
    .run(displayName, now, req.session.user.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: "User not found" });
  }

  const userRow = getUserById(req.session.user.id);
  if (!userRow) {
    return res.status(404).json({ error: "User not found" });
  }

  req.session.user = getSessionUser(userRow);
  return res.json({ user: req.session.user });
});

app.get("/api/profile", requireRole("player", "dm"), (req, res) => {
  const profile = getUserProfileForUserId(req.session.user.id);
  if (!profile) {
    return res.status(404).json({ error: "Profile not found" });
  }

  return res.json({ profile, can_manage_image: req.session.user.role === "dm" });
});

app.patch("/api/profile", requireRole("player", "dm"), (req, res) => {
  const displayName = String(req.body.display_name || "").trim();
  const bio = String(req.body.bio || "").trim();
  const statusLine = String(req.body.status_line || "").trim();
  const pronouns = String(req.body.pronouns || "").trim();

  if (!displayName) {
    return res.status(400).json({ error: "display_name is required" });
  }

  if (displayName.length > 60) {
    return res.status(400).json({ error: "display_name must be 60 characters or fewer" });
  }
  if (bio.length > 1500) {
    return res.status(400).json({ error: "bio must be 1500 characters or fewer" });
  }
  if (statusLine.length > 120) {
    return res.status(400).json({ error: "status_line must be 120 characters or fewer" });
  }
  if (pronouns.length > 60) {
    return res.status(400).json({ error: "pronouns must be 60 characters or fewer" });
  }

  const now = new Date().toISOString();
  ensureUserProfileRow(req.session.user.id);

  const tx = db.transaction(() => {
    db.prepare(
      `
        UPDATE users
        SET display_name = ?, updated_at = ?
        WHERE id = ?
      `
    ).run(displayName, now, req.session.user.id);

    db.prepare(
      `
        UPDATE user_profiles
        SET bio = ?,
            status_line = ?,
            pronouns = ?,
            updated_at = ?
        WHERE user_id = ?
      `
    ).run(bio, statusLine, pronouns, now, req.session.user.id);
  });

  tx();

  const userRow = getUserById(req.session.user.id);
  if (!userRow) {
    return res.status(404).json({ error: "User not found" });
  }

  req.session.user = getSessionUser(userRow);
  const profile = getUserProfileForUserId(req.session.user.id);
  return res.json({ profile, user: req.session.user });
});

app.post("/api/auth/login", (req, res) => {
  const username = String(req.body.username || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!username || !password) {
    return res.status(400).json({ error: "username and password are required" });
  }

  const userRow = db
    .prepare(
      `
        SELECT *
        FROM users
        WHERE username = ?
      `
    )
    .get(username);

  if (!userRow || !bcrypt.compareSync(password, userRow.password_hash)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  req.session.regenerate((regenError) => {
    if (regenError) {
      return res.status(500).json({ error: "Failed to start session" });
    }

    req.session.user = getSessionUser(userRow);

    req.session.save((saveError) => {
      if (saveError) {
        return res.status(500).json({ error: "Failed to save session" });
      }

      res.json({ user: req.session.user });
    });
  });
});

app.post("/api/auth/logout", requireAuth, (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({ error: "Failed to destroy session" });
    }

    res.clearCookie(SESSION_COOKIE_NAME);
    res.json({ ok: true });
  });
});

app.get("/api/dm/npcs", requireRole("dm"), (_req, res) => {
  const includeArchived = String(_req.query.include_archived || "") === "1";
  const rows = db
    .prepare(
      `
        SELECT *
        FROM npcs
        ${includeArchived ? "" : "WHERE archived_at IS NULL"}
        ORDER BY name ASC
      `
    )
    .all();

  const npcIds = rows.map((row) => row.id);
  const canonicalByNpcId = getCanonicalAliasesByNpcIds(npcIds);
  const payload = rows.map((row) => ({
    ...row,
    canonical_aliases: canonicalByNpcId.get(row.id) || [],
    personal_aliases: [],
  }));

  res.json(payload);
});

app.get("/api/dm/npcs/:slug", requireRole("dm"), (req, res) => {
  const npc = db
    .prepare(
      `
        SELECT *
        FROM npcs
        WHERE slug = ?
          AND archived_at IS NULL
      `
    )
    .get(req.params.slug);

  if (!npc) {
    return res.status(404).json({ error: "NPC not found" });
  }

  const myReputationScore = getReputationForNpcAndUser(npc.id, req.session.user.id);
  res.json({
    ...npc,
    reputation: mapNpcReputationForClient(myReputationScore, true),
  });
});

app.patch("/api/dm/npcs/:slug", requireRole("dm"), (req, res) => {
  const { slug } = req.params;
  const now = new Date().toISOString();
  const existing = db
    .prepare(
      `
        SELECT *
        FROM npcs
        WHERE slug = ?
          AND archived_at IS NULL
      `
    )
    .get(slug);

  if (!existing) {
    return res.status(404).json({ error: "NPC not found" });
  }

  const payload = req.body || {};
  const name = limitString(payload.name, 120).trim();
  if (!name) {
    return res.status(400).json({ error: "name is required" });
  }

  const visibility =
    payload.visibility === "visible" || payload.is_visible === 1 || payload.is_visible === true
      ? 1
      : 0;
  const tier = payload.tier === "minor" ? "minor" : "major";

  db.prepare(
    `
      UPDATE npcs
      SET
        name = ?,
        tier = ?,
        rank_title = ?,
        house = ?,
        faction = ?,
        court = ?,
        ring = ?,
        introduced_in = ?,
        met_summary = ?,
        short_blurb = ?,
        source_file_label = ?,
        sort_name = ?,
        is_visible = ?,
        updated_at = ?
      WHERE slug = ?
    `
  ).run(
    name,
    tier,
    limitString(payload.rank_title, 120).trim() || null,
    limitString(payload.house, 80).trim() || null,
    limitString(payload.faction, 80).trim() || null,
    limitString(payload.court, 40).trim() || null,
    limitString(payload.ring, 40).trim() || null,
    limitString(payload.introduced_in, 120).trim() || null,
    limitString(payload.met_summary, 240).trim() || null,
    limitString(payload.short_blurb, 500).trim() || null,
    limitString(payload.source_file_label, 255).trim() || null,
    limitString(payload.sort_name, 120).trim() || null,
    visibility,
    now,
    slug
  );

  createAuditLog(db, {
    actorUserId: req.session.user.id,
    actionType: "npc_edit",
    objectType: "npc",
    objectId: existing.id,
    message: `DM edited NPC fields in-app: ${slug}`,
    createdAt: now,
  });

  const updated = db
    .prepare(
      `
        SELECT *
        FROM npcs
        WHERE slug = ?
          AND archived_at IS NULL
      `
    )
    .get(slug);

  res.json(updated);
});

app.post(
  "/api/dm/npcs/:slug/portrait",
  requireRole("dm"),
  upload.single("portrait"),
  (req, res) => {
    const { slug } = req.params;
    const existing = db
      .prepare(
        `
          SELECT *
          FROM npcs
          WHERE slug = ?
            AND archived_at IS NULL
        `
      )
      .get(slug);

    if (!existing) {
      return res.status(404).json({ error: "NPC not found" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "portrait file is required" });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    if (![".png", ".webp", ".jpg", ".jpeg"].includes(ext)) {
      return res.status(400).json({ error: "Unsupported portrait file type" });
    }
    if (Number(req.file.size || 0) > 10 * 1024 * 1024) {
      return res.status(400).json({ error: "Portrait file exceeds 10MB" });
    }

    const now = new Date().toISOString();
    const uploadsDir = path.join(__dirname, "../../uploads/npc-portraits");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const fileName = `${slug}-${now.replace(/[^0-9]/g, "")}${ext}`;
    fs.writeFileSync(path.join(uploadsDir, fileName), req.file.buffer);
    const portraitPath = `/uploads/npc-portraits/${fileName}`;

    if (existing.portrait_path && existing.portrait_path !== portraitPath) {
      createArchiveRecord(db, {
        objectType: "portrait_asset",
        objectId: `${existing.id}:${now}`,
        ownerUserId: req.session.user.id,
        archivedByUserId: req.session.user.id,
        archivedAt: now,
        payload: {
          npc_id: existing.id,
          prior_portrait_path: existing.portrait_path,
          source_action: "manual-replacement",
        },
        objectLabel: `Portrait replaced for ${slug}`,
        sourceTable: "npcs",
        archiveReason: "manual-replacement",
      });
    }

    db.prepare(
      `
        UPDATE npcs
        SET portrait_path = ?, updated_at = ?
        WHERE id = ?
      `
    ).run(portraitPath, now, existing.id);

    createAuditLog(db, {
      actorUserId: req.session.user.id,
      actionType: "npc_portrait_replace",
      objectType: "npc",
      objectId: existing.id,
      message: `DM replaced portrait in-app: ${slug}`,
      createdAt: now,
    });

    const updated = db
      .prepare(
        `
          SELECT *
          FROM npcs
          WHERE id = ?
            AND archived_at IS NULL
        `
      )
      .get(existing.id);

    res.json(updated);
  }
);

app.get("/api/dm/npcs/:slug/aliases", requireRole("dm"), (req, res) => {
  const npc = db
    .prepare(
      `
        SELECT id
        FROM npcs
        WHERE slug = ?
          AND archived_at IS NULL
      `
    )
    .get(req.params.slug);

  if (!npc) {
    return res.status(404).json({ error: "NPC not found" });
  }

  const aliases = db
    .prepare(
      `
        SELECT
          npc_aliases.id,
          npc_aliases.npc_id,
          npc_aliases.user_id,
          npc_aliases.alias,
          npc_aliases.alias_type,
          npc_aliases.created_at,
          npc_aliases.updated_at,
          users.display_name AS owner_display_name,
          users.username AS owner_username
        FROM npc_aliases
        LEFT JOIN users
          ON users.id = npc_aliases.user_id
        WHERE npc_id = ?
          AND npc_aliases.archived_at IS NULL
        ORDER BY
          CASE WHEN npc_aliases.alias_type = 'canonical' THEN 0 ELSE 1 END,
          users.display_name COLLATE NOCASE ASC,
          npc_aliases.alias COLLATE NOCASE ASC
      `
    )
    .all(npc.id);

  const canonical = aliases
    .filter((alias) => alias.alias_type === "canonical")
    .map(mapAliasForClient);

  const personalByUser = {};
  for (const aliasRow of aliases.filter((alias) => alias.alias_type === "personal")) {
    const key = String(aliasRow.user_id);
    if (!personalByUser[key]) {
      personalByUser[key] = {
        user_id: aliasRow.user_id,
        display_name: aliasRow.owner_display_name || aliasRow.owner_username || "Unknown User",
        username: aliasRow.owner_username || "",
        aliases: [],
      };
    }
    personalByUser[key].aliases.push(mapAliasForClient(aliasRow));
  }

  res.json({
    canonical,
    personal_by_user: Object.values(personalByUser),
  });
});

app.get("/api/dm/npcs/:slug/notes", requireRole("dm"), (req, res) => {
  const npc = db
    .prepare(
      `
        SELECT id
        FROM npcs
        WHERE slug = ?
          AND archived_at IS NULL
      `
    )
    .get(req.params.slug);

  if (!npc) {
    return res.status(404).json({ error: "NPC not found" });
  }

  const notes = db
    .prepare(
      `
        SELECT
          npc_notes.id,
          npc_notes.npc_id,
          npc_notes.author_user_id,
          npc_notes.author_name,
          npc_notes.content,
          npc_notes.created_at,
          npc_notes.updated_at,
          users.display_name AS author_display_name,
          users.username AS author_username
        FROM npc_notes
        LEFT JOIN users
          ON users.id = npc_notes.author_user_id
        WHERE npc_notes.npc_id = ?
          AND npc_notes.author_user_id IS NOT NULL
        ORDER BY users.display_name COLLATE NOCASE ASC, users.username COLLATE NOCASE ASC
      `
    )
    .all(npc.id);

  const groupedByUser = {};
  for (const noteRow of notes) {
    const key = String(noteRow.author_user_id);
    if (!groupedByUser[key]) {
      groupedByUser[key] = {
        user_id: noteRow.author_user_id,
        display_name:
          noteRow.author_display_name || noteRow.author_username || noteRow.author_name || "Unknown User",
        username: noteRow.author_username || "",
        note: null,
      };
    }

    groupedByUser[key].note = mapNpcNoteForClient(noteRow);
  }

  return res.json({
    personal_by_user: Object.values(groupedByUser),
  });
});

app.get("/api/dm/npcs/:slug/reputations", requireRole("dm"), (req, res) => {
  const npc = db
    .prepare(
      `
        SELECT id, slug, name
        FROM npcs
        WHERE slug = ?
          AND archived_at IS NULL
      `
    )
    .get(req.params.slug);

  if (!npc) {
    return res.status(404).json({ error: "NPC not found" });
  }

  const players = db
    .prepare(
      `
        SELECT id, username, display_name, role
        FROM users
        WHERE role = 'player'
        ORDER BY display_name COLLATE NOCASE ASC, username COLLATE NOCASE ASC
      `
    )
    .all();

  const rows = db
    .prepare(
      `
        SELECT user_id, score
        FROM npc_reputations
        WHERE npc_id = ?
      `
    )
    .all(npc.id);
  const scoreByUserId = new Map(rows.map((row) => [Number(row.user_id), Number(row.score)]));

  return res.json({
    npc: {
      id: npc.id,
      slug: npc.slug,
      name: npc.name,
    },
    reputations: players.map((player) => {
      const score = clampNpcReputationScore(scoreByUserId.get(player.id) ?? 0);
      return {
        user_id: player.id,
        username: player.username,
        display_name: player.display_name,
        role: player.role,
        reputation: mapNpcReputationForClient(score, true),
      };
    }),
  });
});

app.patch("/api/dm/npcs/:slug/reputations/:userId", requireRole("dm"), (req, res) => {
  const targetUserId = Number(req.params.userId);
  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    return res.status(400).json({ error: "Invalid userId" });
  }

  const npc = db
    .prepare(
      `
        SELECT id, slug
        FROM npcs
        WHERE slug = ?
          AND archived_at IS NULL
      `
    )
    .get(req.params.slug);
  if (!npc) {
    return res.status(404).json({ error: "NPC not found" });
  }

  const targetUser = db
    .prepare(
      `
        SELECT id, username, display_name, role
        FROM users
        WHERE id = ?
      `
    )
    .get(targetUserId);

  if (!targetUser) {
    return res.status(404).json({ error: "User not found" });
  }

  if (targetUser.role !== "player") {
    return res.status(400).json({ error: "Reputation can only be edited for player users" });
  }

  const existingScore = getReputationForNpcAndUser(npc.id, targetUserId);
  const hasScoreInput = Object.prototype.hasOwnProperty.call(req.body || {}, "score");
  const hasDeltaInput = Object.prototype.hasOwnProperty.call(req.body || {}, "delta");
  if (!hasScoreInput && !hasDeltaInput) {
    return res.status(400).json({ error: "Provide score or delta" });
  }

  const requestedScore = hasScoreInput
    ? Number(req.body.score)
    : existingScore + Number(req.body.delta);
  if (!Number.isFinite(requestedScore)) {
    return res.status(400).json({ error: "score or delta must be numeric" });
  }

  const score = clampNpcReputationScore(requestedScore);
  const now = new Date().toISOString();

  db.prepare(
    `
      INSERT INTO npc_reputations (
        npc_id,
        user_id,
        score,
        created_at,
        updated_at,
        updated_by_user_id
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(npc_id, user_id) DO UPDATE SET
        score = excluded.score,
        updated_at = excluded.updated_at,
        updated_by_user_id = excluded.updated_by_user_id
    `
  ).run(npc.id, targetUserId, score, now, now, req.session.user.id);

  createAuditLog(db, {
    actorUserId: req.session.user.id,
    actionType: "npc_reputation_update",
    objectType: "npc_reputation",
    objectId: `${npc.id}:${targetUserId}`,
    message: `DM set reputation for ${targetUser.username} on NPC ${npc.slug} to ${score}`,
    createdAt: now,
  });

  return res.json({
    user_id: targetUser.id,
    username: targetUser.username,
    display_name: targetUser.display_name,
    role: targetUser.role,
    reputation: mapNpcReputationForClient(score, true),
  });
});

app.post("/api/dm/npcs/:slug/aliases", requireRole("dm"), (req, res) => {
  const npc = db
    .prepare(
      `
        SELECT id
        FROM npcs
        WHERE slug = ?
          AND archived_at IS NULL
      `
    )
    .get(req.params.slug);

  if (!npc) {
    return res.status(404).json({ error: "NPC not found" });
  }

  const alias = limitString(req.body.alias, 80).trim();
  if (!alias) {
    return res.status(400).json({ error: "alias is required" });
  }

  const aliasNormalized = normalizeAlias(alias);
  const now = new Date().toISOString();

  try {
    const result = db
      .prepare(
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
      )
      .run(npc.id, alias, aliasNormalized, now, now);

    const created = db
      .prepare(
        `
          SELECT id, npc_id, user_id, alias, alias_type, created_at, updated_at
          FROM npc_aliases
          WHERE id = ?
        `
      )
      .get(result.lastInsertRowid);

    return res.status(201).json(mapAliasForClient(created));
  } catch (error) {
    if (String(error.message || "").includes("idx_npc_aliases_canonical_unique")) {
      return res.status(409).json({ error: "Canonical alias already exists for this NPC" });
    }
    return res.status(500).json({ error: "Failed to create alias" });
  }
});

app.patch("/api/dm/npc-aliases/:id", requireRole("dm"), (req, res) => {
  const aliasId = Number(req.params.id);
  const alias = limitString(req.body.alias, 80).trim();

  if (!alias) {
    return res.status(400).json({ error: "alias is required" });
  }

  const existing = db
    .prepare(
      `
        SELECT id, npc_id, alias_type
        FROM npc_aliases
        WHERE id = ? AND archived_at IS NULL
      `
    )
    .get(aliasId);

  if (!existing) {
    return res.status(404).json({ error: "Alias not found" });
  }

  const now = new Date().toISOString();
  const aliasNormalized = normalizeAlias(alias);

  try {
    db.prepare(
      `
        UPDATE npc_aliases
        SET alias = ?, alias_normalized = ?, updated_at = ?
        WHERE id = ?
      `
    ).run(alias, aliasNormalized, now, aliasId);

    const updated = db
      .prepare(
        `
          SELECT id, npc_id, user_id, alias, alias_type, created_at, updated_at
          FROM npc_aliases
          WHERE id = ?
        `
      )
      .get(aliasId);

    return res.json(mapAliasForClient(updated));
  } catch (error) {
    if (String(error.message || "").includes("idx_npc_aliases_")) {
      return res.status(409).json({ error: "Alias already exists in this scope" });
    }
    return res.status(500).json({ error: "Failed to update alias" });
  }
});

app.delete("/api/dm/npc-aliases/:id", requireRole("dm"), (req, res) => {
  const aliasId = Number(req.params.id);

  const existing = db
    .prepare(
      `
        SELECT *
        FROM npc_aliases
        WHERE id = ? AND archived_at IS NULL
      `
    )
    .get(aliasId);

  if (!existing) {
    return res.status(404).json({ error: "Alias not found" });
  }

  const now = new Date().toISOString();
  db.prepare(
    `
      UPDATE npc_aliases
      SET archived_at = ?, archived_by_user_id = ?, updated_at = ?
      WHERE id = ?
    `
  ).run(now, req.session.user.id, now, aliasId);

  archiveRecordAndLog({
    objectType: "npc_alias",
    objectId: aliasId,
    ownerUserId: existing.user_id || req.session.user.id,
    archivedByUserId: req.session.user.id,
    payload: { row: existing },
    objectLabel: existing.alias,
    sourceTable: "npc_aliases",
    archiveReason: "dm-remove",
    auditMessage: `DM archived alias ${aliasId}`,
  });

  res.json({ ok: true, id: aliasId });
});

app.patch("/api/dm/npcs/:slug/reveal", requireRole("dm"), (req, res) => {
  const { slug } = req.params;
  const now = new Date().toISOString();

  const result = db
    .prepare(
      `
        UPDATE npcs
        SET is_visible = 1, updated_at = ?
        WHERE slug = ?
          AND archived_at IS NULL
      `
    )
    .run(now, slug);

  if (result.changes === 0) {
    return res.status(404).json({ error: "NPC not found" });
  }

  const npc = db
    .prepare(
      `
        SELECT *
        FROM npcs
        WHERE slug = ?
          AND archived_at IS NULL
      `
    )
    .get(slug);

  res.json(npc);
});

app.patch("/api/dm/npcs/:slug/hide", requireRole("dm"), (req, res) => {
  const { slug } = req.params;
  const now = new Date().toISOString();

  const result = db
    .prepare(
      `
        UPDATE npcs
        SET is_visible = 0, updated_at = ?
        WHERE slug = ?
          AND archived_at IS NULL
      `
    )
    .run(now, slug);

  if (result.changes === 0) {
    return res.status(404).json({ error: "NPC not found" });
  }

  const npc = db
    .prepare(
      `
        SELECT *
        FROM npcs
        WHERE slug = ?
          AND archived_at IS NULL
      `
    )
    .get(slug);

  res.json(npc);
});

app.get("/api/dm/npcs/:slug/cleanup-impact", requireRole("dm"), (req, res) => {
  const npc = db
    .prepare(
      `
        SELECT *
        FROM npcs
        WHERE slug = ?
      `
    )
    .get(req.params.slug);

  if (!npc) {
    return res.status(404).json({ error: "NPC not found" });
  }

  const impact = getNpcCleanupImpact(npc.id);
  return res.json({
    npc: {
      id: npc.id,
      slug: npc.slug,
      name: npc.name,
      tier: npc.tier || "major",
      archived_at: npc.archived_at || null,
    },
    impact,
    recommended_action: impact.has_player_content ? "archive" : "archive",
    hard_delete_confirmation: `DELETE ${npc.slug}`,
  });
});

app.post("/api/dm/npcs/:slug/archive", requireRole("dm"), (req, res) => {
  const now = new Date().toISOString();
  const npc = db
    .prepare(
      `
        SELECT *
        FROM npcs
        WHERE slug = ?
          AND archived_at IS NULL
      `
    )
    .get(req.params.slug);

  if (!npc) {
    return res.status(404).json({ error: "NPC not found or already archived" });
  }

  const impact = getNpcCleanupImpact(npc.id);

  const tx = db.transaction(() => {
    db.prepare(
      `
        UPDATE npcs
        SET archived_at = ?,
            archived_by_user_id = ?,
            is_visible = 0,
            updated_at = ?
        WHERE id = ?
      `
    ).run(now, req.session.user.id, now, npc.id);

    createArchiveRecord(db, {
      objectType: "npc",
      objectId: npc.id,
      ownerUserId: req.session.user.id,
      archivedByUserId: req.session.user.id,
      archivedAt: now,
      payload: { row: npc, impact },
      objectLabel: `${npc.name} (${npc.slug})`,
      sourceTable: "npcs",
      archiveReason: "dm-remove",
    });

    createAuditLog(db, {
      actorUserId: req.session.user.id,
      actionType: "npc_archive",
      objectType: "npc",
      objectId: npc.id,
      message: `Archived NPC ${npc.slug}`,
      createdAt: now,
    });
  });

  tx();
  return res.json({ ok: true, npc_id: npc.id, slug: npc.slug, impact });
});

app.post("/api/dm/npcs/:slug/restore", requireRole("dm"), (req, res) => {
  const now = new Date().toISOString();
  const npc = db
    .prepare(
      `
        SELECT *
        FROM npcs
        WHERE slug = ?
          AND archived_at IS NOT NULL
      `
    )
    .get(req.params.slug);

  if (!npc) {
    return res.status(404).json({ error: "Archived NPC not found" });
  }

  const tx = db.transaction(() => {
    db.prepare(
      `
        UPDATE npcs
        SET archived_at = NULL,
            archived_by_user_id = NULL,
            updated_at = ?
        WHERE id = ?
      `
    ).run(now, npc.id);

    db.prepare(
      `
        DELETE FROM archive_records
        WHERE object_type = 'npc'
          AND object_id = ?
      `
    ).run(String(npc.id));

    createAuditLog(db, {
      actorUserId: req.session.user.id,
      actionType: "npc_restore",
      objectType: "npc",
      objectId: npc.id,
      message: `Restored archived NPC ${npc.slug}`,
      createdAt: now,
    });
  });

  tx();
  return res.json({ ok: true, npc_id: npc.id, slug: npc.slug });
});

app.delete("/api/dm/npcs/:slug/hard-delete", requireRole("dm"), (req, res) => {
  const now = new Date().toISOString();
  const npc = db
    .prepare(
      `
        SELECT *
        FROM npcs
        WHERE slug = ?
          AND archived_at IS NOT NULL
      `
    )
    .get(req.params.slug);

  if (!npc) {
    return res.status(404).json({ error: "Archived NPC not found" });
  }

  const expectedConfirmation = `DELETE ${npc.slug}`;
  const confirmation = String(req.body?.confirmation || "").trim();
  if (confirmation !== expectedConfirmation) {
    return res.status(400).json({
      error: "Invalid confirmation string for hard delete",
      expected_confirmation: expectedConfirmation,
    });
  }

  const impact = getNpcCleanupImpact(npc.id);

  const tx = db.transaction(() => {
    const canonicalAliasIds = db
      .prepare(
        `
          SELECT id
          FROM npc_aliases
          WHERE npc_id = ?
            AND alias_type = 'canonical'
        `
      )
      .all(npc.id)
      .map((row) => Number(row.id));
    const personalAliasIds = db
      .prepare(
        `
          SELECT id
          FROM npc_aliases
          WHERE npc_id = ?
            AND alias_type = 'personal'
        `
      )
      .all(npc.id)
      .map((row) => Number(row.id));

    db.prepare(
      `
        DELETE FROM npc_aliases
        WHERE npc_id = ?
      `
    ).run(npc.id);

    db.prepare(
      `
        DELETE FROM npc_notes
        WHERE npc_id = ?
      `
    ).run(npc.id);

    db.prepare(
      `
        DELETE FROM npcs
        WHERE id = ?
      `
    ).run(npc.id);

    db.prepare(
      `
        DELETE FROM archive_records
        WHERE object_type = 'npc'
          AND object_id = ?
      `
    ).run(String(npc.id));

    const deleteAliasArchiveRecord = db.prepare(
      `
        DELETE FROM archive_records
        WHERE object_type = 'npc_alias'
          AND object_id = ?
      `
    );
    for (const aliasId of [...canonicalAliasIds, ...personalAliasIds]) {
      deleteAliasArchiveRecord.run(String(aliasId));
    }

    createAuditLog(db, {
      actorUserId: req.session.user.id,
      actionType: "npc_hard_delete",
      objectType: "npc",
      objectId: npc.id,
      message: `Hard deleted NPC ${npc.slug} with ${impact.aliases.canonical} canonical aliases, ${impact.aliases.personal} personal aliases, and ${impact.private_notes} private notes removed.`,
      createdAt: now,
    });
  });

  tx();
  return res.json({
    ok: true,
    hard_deleted_npc_id: npc.id,
    impact_summary: {
      removed: {
        npc: 1,
        canonical_aliases: impact.aliases.canonical,
        personal_aliases: impact.aliases.personal,
        private_notes: impact.private_notes,
      },
      preserved: {
        import_logs: "preserved",
        audit_logs: "preserved",
      },
      potentially_orphaned: ["board JSON references to npc_id are not rewritten in v1"],
    },
  });
});

app.get("/api/dm/import/staging", requireRole("dm"), (req, res) => {
  const summary = getStagingSummary(db, req.session.user.id);
  res.json(summary);
});

app.post(
  "/api/dm/import/staging/markdown",
  requireRole("dm"),
  upload.array("files"),
  (req, res) => {
    addStagedMarkdownFiles(req.session.user.id, req.files || []);
    const summary = getStagingSummary(db, req.session.user.id);
    res.json(summary);
  }
);

app.post(
  "/api/dm/import/staging/portraits",
  requireRole("dm"),
  upload.array("files"),
  (req, res) => {
    addStagedPortraitFiles(req.session.user.id, req.files || []);
    const summary = getStagingSummary(db, req.session.user.id);
    res.json(summary);
  }
);

app.post("/api/dm/import/staging/fixtures", requireRole("dm"), (req, res) => {
  stageFixtures(req.session.user.id);
  const summary = getStagingSummary(db, req.session.user.id);
  res.json(summary);
});

app.post("/api/dm/import/staging/clear", requireRole("dm"), (req, res) => {
  clearStage(req.session.user.id);
  const summary = getStagingSummary(db, req.session.user.id);
  res.json(summary);
});

app.post("/api/dm/import/finalize", requireRole("dm"), (req, res) => {
  const results = finalizeImport(db, req.session.user.id);
  res.json(results);
});

app.get("/api/dm/import/logs", requireRole("dm"), (_req, res) => {
  const rows = db
    .prepare(
      `
        SELECT *
        FROM import_logs
        ORDER BY created_at DESC, id DESC
        LIMIT 100
      `
    )
    .all();
  res.json(rows);
});

app.get("/api/users", requireRole("dm"), (_req, res) => {
  const users = db
    .prepare(
      `
        SELECT
          id,
          username,
          display_name,
          role
        FROM users
        ORDER BY
          CASE WHEN role = 'dm' THEN 0 ELSE 1 END,
          display_name COLLATE NOCASE ASC,
          username COLLATE NOCASE ASC
      `
    )
    .all();

  res.json(users);
});

app.get("/api/dm/profiles/:userId", requireRole("dm"), (req, res) => {
  const targetUserId = Number(req.params.userId);
  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    return res.status(400).json({ error: "Invalid userId" });
  }

  const profile = getUserProfileForUserId(targetUserId);
  if (!profile) {
    return res.status(404).json({ error: "User not found" });
  }

  return res.json({ profile });
});

app.get("/api/dm/profiles/:userId/journal", requireRole("dm"), (req, res) => {
  const targetUserId = Number(req.params.userId);
  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    return res.status(400).json({ error: "Invalid userId" });
  }

  const targetUser = getUserById(targetUserId);
  if (!targetUser) {
    return res.status(404).json({ error: "User not found" });
  }

  const note = getActiveDashboardNoteByUserId(targetUserId);
  return res.json({
    journal_note: note ? mapDashboardNoteForClient(note) : null,
    owner: {
      user_id: targetUser.id,
      username: targetUser.username,
      display_name: targetUser.display_name,
      role: targetUser.role,
    },
  });
});

app.patch("/api/dm/profiles/:userId/image-path", requireRole("dm"), (req, res) => {
  const targetUserId = Number(req.params.userId);
  const profileImagePath = String(req.body.profile_image_path || "").trim();

  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    return res.status(400).json({ error: "Invalid userId" });
  }

  if (!profileImagePath.startsWith("/uploads/")) {
    return res.status(400).json({ error: "profile_image_path must be an uploads path" });
  }

  const targetUser = getUserById(targetUserId);
  if (!targetUser) {
    return res.status(404).json({ error: "User not found" });
  }

  ensureUserProfileRow(targetUserId);
  const now = new Date().toISOString();
  db.prepare(
    `
      UPDATE user_profiles
      SET profile_image_path = ?, updated_at = ?
      WHERE user_id = ?
    `
  ).run(profileImagePath, now, targetUserId);

  createAuditLog(db, {
    actorUserId: req.session.user.id,
    actionType: "player_profile_image_set",
    objectType: "user_profile",
    objectId: targetUserId,
    message: `DM assigned profile image for ${targetUser.username}`,
    createdAt: now,
  });

  return res.json({ profile: getUserProfileForUserId(targetUserId) });
});

app.post(
  "/api/dm/profiles/:userId/image-upload",
  requireRole("dm"),
  upload.single("profile_image"),
  (req, res) => {
    const targetUserId = Number(req.params.userId);
    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({ error: "Invalid userId" });
    }

    const targetUser = getUserById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "profile_image file is required" });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    if (![".png", ".webp", ".jpg", ".jpeg"].includes(ext)) {
      return res.status(400).json({ error: "Unsupported profile image type" });
    }
    if (Number(req.file.size || 0) > 10 * 1024 * 1024) {
      return res.status(400).json({ error: "Profile image exceeds 10MB" });
    }

    ensureUserProfileRow(targetUserId);
    const now = new Date().toISOString();
    const uploadsDir = path.join(__dirname, "../../uploads/player-profiles");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const safeUsername = targetUser.username.replace(/[^a-z0-9_-]/gi, "-");
    const fileName = `${safeUsername}-${now.replace(/[^0-9]/g, "")}${ext}`;
    fs.writeFileSync(path.join(uploadsDir, fileName), req.file.buffer);
    const profileImagePath = `/uploads/player-profiles/${fileName}`;

    db.prepare(
      `
        UPDATE user_profiles
        SET profile_image_path = ?, updated_at = ?
        WHERE user_id = ?
      `
    ).run(profileImagePath, now, targetUserId);

    createAuditLog(db, {
      actorUserId: req.session.user.id,
      actionType: "player_profile_image_upload",
      objectType: "user_profile",
      objectId: targetUserId,
      message: `DM uploaded profile image for ${targetUser.username}`,
      createdAt: now,
    });

    return res.json({ profile: getUserProfileForUserId(targetUserId) });
  }
);

app.get("/api/dm/board-users", requireRole("dm"), (_req, res) => {
  const rows = db
    .prepare(
      `
        SELECT
          users.id,
          users.username,
          users.display_name,
          users.role,
          MAX(boards.updated_at) AS board_updated_at
        FROM users
        LEFT JOIN boards
          ON boards.owner_user_id = users.id
          AND boards.archived_at IS NULL
        GROUP BY users.id, users.username, users.display_name, users.role
        ORDER BY
          CASE WHEN users.role = 'dm' THEN 0 ELSE 1 END,
          users.display_name ASC
      `
    )
    .all();

  res.json(rows);
});

app.get("/api/dashboard", requireRole("player", "dm"), (req, res) => {
  const sessionUser = req.session.user;

  const suspects = db
    .prepare(
      `
        SELECT id, name, status, note, sort_order, created_at, updated_at
        FROM dashboard_suspects
        WHERE user_id = ? AND archived_at IS NULL
        ORDER BY sort_order ASC, id ASC
      `
    )
    .all(sessionUser.id)
    .map(mapSuspectForClient);

  const note = getActiveDashboardNoteByUserId(sessionUser.id);
  const latestRecapRow = getLatestRecap();
  const latestRecap = latestRecapRow ? mapSessionRecapRow(latestRecapRow) : null;

  const recentlyUnlockedNpcs = db
    .prepare(
      `
        SELECT id, slug, name, updated_at
        FROM npcs
        WHERE is_visible = 1
        ORDER BY updated_at DESC, id DESC
        LIMIT 5
      `
    )
    .all();

  const boardUpdated = db
    .prepare(
      `
        SELECT updated_at
        FROM boards
        WHERE owner_user_id = ?
          AND archived_at IS NULL
        ORDER BY is_default DESC, updated_at DESC, id DESC
        LIMIT 1
      `
    )
    .get(sessionUser.id);

  const recentActivity = [
    boardUpdated?.updated_at
      ? { type: "board", label: "Investigation board edited", updated_at: boardUpdated.updated_at }
      : null,
    suspects[0]
      ? { type: "suspect", label: "Suspect list updated", updated_at: suspects[0].updated_at }
      : null,
    note
      ? { type: "note", label: "Personal notes updated", updated_at: note.updated_at }
      : null,
  ]
    .filter(Boolean)
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
    .slice(0, 5);

  const payload = {
    role: sessionUser.role,
    quick_links: {
      board: "/board",
      maps: "/maps",
    },
    recently_unlocked_npcs: recentlyUnlockedNpcs,
    suspects,
    personal_note: note ? mapDashboardNoteForClient(note) : null,
    latest_recap: latestRecap,
    recent_personal_activity: recentActivity,
  };

  if (sessionUser.role === "dm") {
    const archiveSummaryCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const archiveSummary = db
      .prepare(
        `
          SELECT
            SUM(CASE WHEN action_type = 'archive' THEN 1 ELSE 0 END) AS archived_recently,
            SUM(CASE WHEN action_type = 'restore' THEN 1 ELSE 0 END) AS restored_recently
          FROM audit_logs
          WHERE created_at >= ?
            AND action_type IN ('archive', 'restore')
        `
      )
      .get(archiveSummaryCutoff);

    const playerBoardLinks = db
      .prepare(
        `
          SELECT
            users.id,
            users.display_name,
            users.username,
            MAX(boards.updated_at) AS board_updated_at
          FROM users
          LEFT JOIN boards
            ON boards.owner_user_id = users.id
            AND boards.archived_at IS NULL
          WHERE users.role = 'player'
          GROUP BY users.id, users.display_name, users.username
          ORDER BY board_updated_at DESC, users.display_name ASC
        `
      )
      .all();

    payload.player_board_links = playerBoardLinks;
    payload.recent_imports = db
      .prepare(
        `
          SELECT filename, result, created_at AS timestamp
          FROM import_logs
          ORDER BY created_at DESC, id DESC
          LIMIT 8
        `
      )
      .all();
    payload.archive_activity_summary = {
      archived_recently: Number(archiveSummary?.archived_recently || 0),
      restored_recently: Number(archiveSummary?.restored_recently || 0),
      note: "Counts include archive and restore actions from the last 7 days.",
    };
    payload.recently_changed_npcs = db
      .prepare(
        `
          SELECT id, slug, name, updated_at
          FROM npcs
          ORDER BY updated_at DESC, id DESC
          LIMIT 5
        `
      )
      .all();
  }

  res.json(payload);
});

app.get("/api/search", requireRole("player", "dm"), (req, res) => {
  const payload = runGlobalSearch({
    db,
    sessionUser: req.session.user,
    rawQuery: req.query.q,
    rawLimit: req.query.limit,
    rawOffset: req.query.offset,
    rawEntityFilter: req.query.entity,
  });

  return res.json(payload);
});

app.get("/api/search/suggestions", requireRole("player", "dm"), (req, res) => {
  const payload = runGlobalSearchSuggestions({
    db,
    sessionUser: req.session.user,
    rawQuery: req.query.q,
    rawLimit: req.query.limit,
  });

  return res.json(payload);
});

app.post("/api/dashboard/suspects", requireRole("player", "dm"), (req, res) => {
  const name = limitString(req.body.name, 160).trim();
  const note = limitString(req.body.note, 1200).trim();
  const status = sanitizeSuspectStatus(String(req.body.status || "unknown"));

  if (!name) {
    return res.status(400).json({ error: "name is required" });
  }

  const now = new Date().toISOString();
  const maxSortRow = db
    .prepare(
      `
        SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order
        FROM dashboard_suspects
        WHERE user_id = ? AND archived_at IS NULL
      `
    )
    .get(req.session.user.id);

  const sortOrder = Number(maxSortRow?.max_sort_order || 0) + 1;

  const result = db
    .prepare(
      `
        INSERT INTO dashboard_suspects (
          user_id,
          name,
          status,
          note,
          sort_order,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
    )
    .run(req.session.user.id, name, status, note, sortOrder, now, now);

  const suspect = db
    .prepare(
      `
        SELECT id, name, status, note, sort_order, created_at, updated_at
        FROM dashboard_suspects
        WHERE id = ?
      `
    )
    .get(result.lastInsertRowid);

  res.status(201).json(mapSuspectForClient(suspect));
});

app.patch("/api/dashboard/suspects/:id", requireRole("player", "dm"), (req, res) => {
  const suspectId = Number(req.params.id);
  const suspect = db
    .prepare(
      `
        SELECT *
        FROM dashboard_suspects
        WHERE id = ? AND archived_at IS NULL
      `
    )
    .get(suspectId);

  if (!suspect) {
    return res.status(404).json({ error: "Suspect not found" });
  }

  if (suspect.user_id !== req.session.user.id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const hasName = Object.prototype.hasOwnProperty.call(req.body, "name");
  const hasNote = Object.prototype.hasOwnProperty.call(req.body, "note");
  const hasStatus = Object.prototype.hasOwnProperty.call(req.body, "status");
  const hasSortOrder = Object.prototype.hasOwnProperty.call(req.body, "sort_order");

  const name = hasName ? limitString(req.body.name, 160).trim() : suspect.name;
  const note = hasNote ? limitString(req.body.note, 1200).trim() : suspect.note;
  const status = hasStatus
    ? sanitizeSuspectStatus(String(req.body.status || "unknown"))
    : suspect.status;
  const sortOrder = hasSortOrder
    ? Math.max(0, Number.parseInt(String(req.body.sort_order), 10) || 0)
    : suspect.sort_order;

  if (!name) {
    return res.status(400).json({ error: "name is required" });
  }

  const now = new Date().toISOString();
  db.prepare(
    `
      UPDATE dashboard_suspects
      SET name = ?, status = ?, note = ?, sort_order = ?, updated_at = ?
      WHERE id = ?
    `
  ).run(name, status, note, sortOrder, now, suspectId);

  const updated = db
    .prepare(
      `
        SELECT id, name, status, note, sort_order, created_at, updated_at
        FROM dashboard_suspects
        WHERE id = ?
      `
    )
    .get(suspectId);

  res.json(mapSuspectForClient(updated));
});

app.delete("/api/dashboard/suspects/:id", requireRole("player", "dm"), (req, res) => {
  const suspectId = Number(req.params.id);
  const suspect = db
    .prepare(
      `
        SELECT *
        FROM dashboard_suspects
        WHERE id = ? AND archived_at IS NULL
      `
    )
    .get(suspectId);

  if (!suspect) {
    return res.status(404).json({ error: "Suspect not found" });
  }

  if (suspect.user_id !== req.session.user.id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const now = new Date().toISOString();
  db.prepare(
    `
      UPDATE dashboard_suspects
      SET archived_at = ?, archived_by_user_id = ?, updated_at = ?
      WHERE id = ?
    `
  ).run(now, req.session.user.id, now, suspectId);

  archiveRecordAndLog({
    objectType: "dashboard_suspect",
    objectId: suspectId,
    ownerUserId: suspect.user_id,
    archivedByUserId: req.session.user.id,
    payload: { row: suspect },
    objectLabel: suspect.name,
    sourceTable: "dashboard_suspects",
    archiveReason: req.session.user.role === "dm" ? "dm-remove" : "player-remove",
    auditMessage: `Archived dashboard suspect ${suspectId}`,
  });

  res.json({ ok: true, id: suspectId });
});

app.get("/api/dashboard/notes", requireRole("player", "dm"), (req, res) => {
  const note = getActiveDashboardNoteByUserId(req.session.user.id);
  res.json(note ? mapDashboardNoteForClient(note) : null);
});

app.put("/api/dashboard/notes", requireRole("player", "dm"), (req, res) => {
  const content = limitString(req.body.content, 20000).trim();
  const now = new Date().toISOString();
  const existing = getActiveDashboardNoteByUserId(req.session.user.id);

  if (!existing) {
    const result = db
      .prepare(
        `
          INSERT INTO dashboard_notes (user_id, content, created_at, updated_at)
          VALUES (?, ?, ?, ?)
        `
      )
      .run(req.session.user.id, content, now, now);

    const created = db
      .prepare(
        `
          SELECT id, content, created_at, updated_at
          FROM dashboard_notes
          WHERE id = ?
        `
      )
      .get(result.lastInsertRowid);

    return res.status(201).json(mapDashboardNoteForClient(created));
  }

  db.prepare(
    `
      UPDATE dashboard_notes
      SET content = ?, updated_at = ?
      WHERE id = ?
    `
  ).run(content, now, existing.id);

  const updated = db
    .prepare(
      `
        SELECT id, content, created_at, updated_at
        FROM dashboard_notes
        WHERE id = ?
      `
    )
    .get(existing.id);

  res.json(mapDashboardNoteForClient(updated));
});

app.delete("/api/dashboard/notes/:id", requireRole("player", "dm"), (req, res) => {
  const noteId = Number(req.params.id);
  const note = db
    .prepare(
      `
        SELECT *
        FROM dashboard_notes
        WHERE id = ? AND archived_at IS NULL
      `
    )
    .get(noteId);

  if (!note) {
    return res.status(404).json({ error: "Dashboard note not found" });
  }

  if (note.user_id !== req.session.user.id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const now = new Date().toISOString();
  db.prepare(
    `
      UPDATE dashboard_notes
      SET archived_at = ?, archived_by_user_id = ?, updated_at = ?
      WHERE id = ?
    `
  ).run(now, req.session.user.id, now, noteId);

  archiveRecordAndLog({
    objectType: "dashboard_note",
    objectId: noteId,
    ownerUserId: note.user_id,
    archivedByUserId: req.session.user.id,
    payload: { row: note },
    objectLabel: "Personal note",
    sourceTable: "dashboard_notes",
    archiveReason: req.session.user.role === "dm" ? "dm-remove" : "player-remove",
    auditMessage: `Archived dashboard note ${noteId}`,
  });

  return res.json({ ok: true, id: noteId });
});

app.get("/api/session-recaps/latest", requireRole("player", "dm"), (_req, res) => {
  const recap = getLatestRecap();
  if (!recap) {
    return res.json(null);
  }

  res.json(mapSessionRecapRow(recap));
});

app.get("/api/session-recaps", requireRole("player", "dm"), (req, res) => {
  const showAll = req.session.user.role === "dm";
  const rows = db
    .prepare(
      `
        SELECT
          session_recaps.id,
          session_recaps.chapter_number,
          session_recaps.chapter_title,
          session_recaps.title,
          session_recaps.content,
          session_recaps.is_published,
          session_recaps.published_at,
          session_recaps.updated_at,
          session_recaps.published_by_user_id,
          users.display_name AS published_by_display_name,
          users.username AS published_by_username
        FROM session_recaps
        LEFT JOIN users
          ON users.id = session_recaps.published_by_user_id
        WHERE (? = 1 OR session_recaps.is_published = 1)
        ORDER BY session_recaps.chapter_number ASC, session_recaps.id ASC
      `
    )
    .all(showAll ? 1 : 0);

  return res.json(rows.map(mapSessionRecapRow));
});

app.get("/api/session-recaps/chapter/:chapterNumber", requireRole("player", "dm"), (req, res) => {
  const chapterNumber = Number.parseInt(String(req.params.chapterNumber), 10);
  if (!Number.isInteger(chapterNumber) || chapterNumber <= 0) {
    return res.status(400).json({ error: "chapterNumber must be a positive integer" });
  }

  const row = db
    .prepare(
      `
        SELECT
          session_recaps.id,
          session_recaps.chapter_number,
          session_recaps.chapter_title,
          session_recaps.title,
          session_recaps.content,
          session_recaps.is_published,
          session_recaps.published_at,
          session_recaps.updated_at,
          session_recaps.published_by_user_id,
          users.display_name AS published_by_display_name,
          users.username AS published_by_username
        FROM session_recaps
        LEFT JOIN users
          ON users.id = session_recaps.published_by_user_id
        WHERE session_recaps.chapter_number = ?
          AND (? = 1 OR session_recaps.is_published = 1)
        LIMIT 1
      `
    )
    .get(chapterNumber, req.session.user.role === "dm" ? 1 : 0);

  if (!row) {
    return res.status(404).json({ error: "Recap not found" });
  }

  return res.json(mapSessionRecapRow(row));
});

app.post("/api/session-recaps", requireRole("dm"), (req, res) => {
  const chapterNumber = Number.parseInt(String(req.body.chapter_number), 10);
  const chapterTitle = limitString(req.body.chapter_title, 160).trim();
  const title = limitString(req.body.title || "Lumi’s Session Recap", 120).trim();
  const content = limitString(req.body.content, 20000).trim();
  const isPublished = req.body.is_published === false ? 0 : 1;

  if (!Number.isInteger(chapterNumber) || chapterNumber <= 0) {
    return res.status(400).json({ error: "chapter_number must be a positive integer" });
  }

  if (!chapterTitle) {
    return res.status(400).json({ error: "chapter_title is required" });
  }

  if (!content) {
    return res.status(400).json({ error: "content is required" });
  }

  const now = new Date().toISOString();
  const existing = db
    .prepare(
      `
        SELECT id
        FROM session_recaps
        WHERE chapter_number = ?
      `
    )
    .get(chapterNumber);

  if (existing) {
    db.prepare(
      `
        UPDATE session_recaps
        SET session_number = ?,
            chapter_number = ?,
            chapter_title = ?,
            title = ?,
            content = ?,
            is_published = ?,
            published_at = ?,
            published_by_user_id = ?,
            updated_at = ?
        WHERE id = ?
      `
    ).run(
      chapterNumber,
      chapterNumber,
      chapterTitle,
      title,
      content,
      isPublished,
      now,
      req.session.user.id,
      now,
      existing.id
    );
  } else {
    db.prepare(
      `
        INSERT INTO session_recaps (
          session_number,
          chapter_number,
          chapter_title,
          title,
          content,
          is_published,
          published_at,
          published_by_user_id,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(chapterNumber, chapterNumber, chapterTitle, title, content, isPublished, now, req.session.user.id, now);
  }

  createAuditLog(db, {
    actorUserId: req.session.user.id,
    actionType: isPublished ? "recap_publish" : "recap_save_draft",
    objectType: "session_recap",
    objectId: String(chapterNumber),
    message: `${isPublished ? "Published" : "Saved draft for"} recap chapter ${chapterNumber}`,
    createdAt: now,
  });

  const created = db
    .prepare(
      `
        SELECT
          session_recaps.id,
          session_recaps.chapter_number,
          session_recaps.chapter_title,
          session_recaps.title,
          session_recaps.content,
          session_recaps.is_published,
          session_recaps.published_at,
          session_recaps.updated_at,
          session_recaps.published_by_user_id,
          users.display_name AS published_by_display_name,
          users.username AS published_by_username
        FROM session_recaps
        LEFT JOIN users
          ON users.id = session_recaps.published_by_user_id
        WHERE session_recaps.chapter_number = ?
        LIMIT 1
      `
    )
    .get(chapterNumber);

  res.json(created ? mapSessionRecapRow(created) : null);
});

app.patch("/api/session-recaps/:id", requireRole("dm"), (req, res) => {
  const recapId = Number(req.params.id);
  const existing = db
    .prepare(
      `
        SELECT *
        FROM session_recaps
        WHERE id = ?
      `
    )
    .get(recapId);

  if (!existing) {
    return res.status(404).json({ error: "Recap not found" });
  }

  const chapterNumber = Number.parseInt(
    String(
      Object.prototype.hasOwnProperty.call(req.body, "chapter_number")
        ? req.body.chapter_number
        : existing.chapter_number || existing.session_number
    ),
    10
  );
  const chapterTitle = limitString(
    Object.prototype.hasOwnProperty.call(req.body, "chapter_title")
      ? req.body.chapter_title
      : existing.chapter_title,
    160
  ).trim();
  const title = limitString(
    Object.prototype.hasOwnProperty.call(req.body, "title") ? req.body.title : existing.title,
    120
  ).trim();
  const content = limitString(
    Object.prototype.hasOwnProperty.call(req.body, "content") ? req.body.content : existing.content,
    20000
  ).trim();
  const isPublished = Object.prototype.hasOwnProperty.call(req.body, "is_published")
    ? req.body.is_published === true
      ? 1
      : 0
    : Number(existing.is_published || 0) === 1
      ? 1
      : 0;

  if (!Number.isInteger(chapterNumber) || chapterNumber <= 0) {
    return res.status(400).json({ error: "chapter_number must be a positive integer" });
  }

  if (!chapterTitle) {
    return res.status(400).json({ error: "chapter_title is required" });
  }

  if (!content) {
    return res.status(400).json({ error: "content is required" });
  }

  const conflict = db
    .prepare(
      `
        SELECT id
        FROM session_recaps
        WHERE chapter_number = ?
          AND id != ?
      `
    )
    .get(chapterNumber, recapId);

  if (conflict) {
    return res.status(409).json({ error: "A recap already exists for that chapter_number" });
  }

  const now = new Date().toISOString();
  db.prepare(
    `
      UPDATE session_recaps
      SET session_number = ?,
          chapter_number = ?,
          chapter_title = ?,
          title = ?,
          content = ?,
          is_published = ?,
          published_at = ?,
          published_by_user_id = ?,
          updated_at = ?
      WHERE id = ?
    `
  ).run(
    chapterNumber,
    chapterNumber,
    chapterTitle,
    title || "Lumi’s Session Recap",
    content,
    isPublished,
    now,
    req.session.user.id,
    now,
    recapId
  );

  createAuditLog(db, {
    actorUserId: req.session.user.id,
    actionType: isPublished ? "recap_update" : "recap_draft_update",
    objectType: "session_recap",
    objectId: String(recapId),
    message: `Updated ${isPublished ? "published" : "draft"} recap chapter ${chapterNumber}`,
    createdAt: now,
  });

  const updated = db
    .prepare(
      `
        SELECT
          session_recaps.id,
          session_recaps.chapter_number,
          session_recaps.chapter_title,
          session_recaps.title,
          session_recaps.content,
          session_recaps.is_published,
          session_recaps.published_at,
          session_recaps.updated_at,
          session_recaps.published_by_user_id,
          users.display_name AS published_by_display_name,
          users.username AS published_by_username
        FROM session_recaps
        LEFT JOIN users
          ON users.id = session_recaps.published_by_user_id
        WHERE session_recaps.id = ?
        LIMIT 1
      `
    )
    .get(recapId);

  res.json(updated ? mapSessionRecapRow(updated) : null);
});

app.delete("/api/session-recaps/:id", requireRole("dm"), (req, res) => {
  const recapId = Number(req.params.id);
  const existing = db
    .prepare(
      `
        SELECT id, chapter_number
        FROM session_recaps
        WHERE id = ?
      `
    )
    .get(recapId);

  if (!existing) {
    return res.status(404).json({ error: "Recap not found" });
  }

  db.prepare(
    `
      DELETE FROM session_recaps
      WHERE id = ?
    `
  ).run(recapId);

  createAuditLog(db, {
    actorUserId: req.session.user.id,
    actionType: "recap_delete",
    objectType: "session_recap",
    objectId: String(recapId),
    message: `Deleted recap chapter ${existing.chapter_number ?? "unknown"}`,
    createdAt: new Date().toISOString(),
  });

  return res.json({ ok: true, id: recapId });
});

app.get("/api/documents", requireRole("player", "dm"), (req, res) => {
  const showAll = req.session.user.role === "dm";
  const rows = db
    .prepare(
      `
        SELECT
          id,
          slug,
          title,
          document_type,
          body_markdown,
          published,
          sort_order,
          created_at,
          updated_at
        FROM documents
        WHERE (? = 1 OR published = 1)
        ORDER BY sort_order ASC, title COLLATE NOCASE ASC, id ASC
      `
    )
    .all(showAll ? 1 : 0);

  return res.json(rows.map(mapDocumentRow));
});

app.get("/api/locations", requireRole("player", "dm"), (req, res) => {
  const isDm = req.session.user.role === "dm";
  const rows = db
    .prepare(
      `
        SELECT *
        FROM locations
        ${isDm ? "" : "WHERE is_published = 1"}
        ORDER BY ring COLLATE NOCASE ASC, name COLLATE NOCASE ASC, id ASC
      `,
    )
    .all();

  res.json({
    locations: rows.map(mapLocationForClient),
  });
});

app.get("/api/locations/:slug", requireRole("player", "dm"), (req, res) => {
  const isDm = req.session.user.role === "dm";
  const slug = sanitizeLocationSlug(req.params.slug);
  const row = db
    .prepare(
      `
        SELECT *
        FROM locations
        WHERE slug = ?
      `,
    )
    .get(slug);

  if (!row || (!isDm && Number(row.is_published) !== 1)) {
    return res.status(404).json({ error: "Location not found" });
  }

  res.json({ location: mapLocationForClient(row) });
});

app.post("/api/locations", requireRole("dm"), (req, res) => {
  const name = limitString(req.body.name, 160).trim();
  const slug = sanitizeLocationSlug(req.body.slug, name);
  const ring = limitString(req.body.ring, 80).trim() || null;
  const court = limitString(req.body.court, 120).trim() || null;
  const faction = limitString(req.body.faction, 120).trim() || null;
  const district = limitString(req.body.district, 120).trim() || null;
  const summary = limitString(req.body.summary, 360).trim() || null;
  const bodyMarkdown = limitString(req.body.body_markdown, 50000);
  const tags = parseLocationTags(req.body.tags);
  const mapId = req.body.map_id ? sanitizeMapLayer(String(req.body.map_id)) : null;
  const landmarkSlug = req.body.landmark_slug ? sanitizeOptionalSlug(req.body.landmark_slug) : null;
  const isPublished = req.body.is_published ? 1 : 0;

  if (!name || !slug) {
    return res.status(400).json({ error: "name and slug are required" });
  }

  const now = new Date().toISOString();
  try {
    const result = db
      .prepare(
        `
          INSERT INTO locations (
            slug, name, ring, court, faction, district, summary, body_markdown,
            tags_json, map_id, landmark_slug, is_published, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        slug,
        name,
        ring,
        court,
        faction,
        district,
        summary,
        bodyMarkdown,
        JSON.stringify(tags),
        mapId,
        landmarkSlug,
        isPublished,
        now,
        now,
      );
    const created = db.prepare(`SELECT * FROM locations WHERE id = ?`).get(result.lastInsertRowid);
    res.status(201).json({ location: mapLocationForClient(created) });
  } catch (error) {
    if (String(error).includes("UNIQUE")) {
      return res.status(409).json({ error: "Location slug already exists" });
    }
    return res.status(500).json({ error: "Failed to create location" });
  }
});

app.patch("/api/locations/:id", requireRole("dm"), (req, res) => {
  const locationId = Number(req.params.id);
  const existing = db.prepare(`SELECT * FROM locations WHERE id = ?`).get(locationId);
  if (!existing) {
    return res.status(404).json({ error: "Location not found" });
  }

  const nextName = Object.prototype.hasOwnProperty.call(req.body, "name")
    ? limitString(req.body.name, 160).trim()
    : existing.name;
  const nextSlug = Object.prototype.hasOwnProperty.call(req.body, "slug")
    ? sanitizeLocationSlug(req.body.slug, nextName)
    : existing.slug;
  const nextRing = Object.prototype.hasOwnProperty.call(req.body, "ring")
    ? limitString(req.body.ring, 80).trim() || null
    : existing.ring;
  const nextCourt = Object.prototype.hasOwnProperty.call(req.body, "court")
    ? limitString(req.body.court, 120).trim() || null
    : existing.court;
  const nextFaction = Object.prototype.hasOwnProperty.call(req.body, "faction")
    ? limitString(req.body.faction, 120).trim() || null
    : existing.faction;
  const nextDistrict = Object.prototype.hasOwnProperty.call(req.body, "district")
    ? limitString(req.body.district, 120).trim() || null
    : existing.district;
  const nextSummary = Object.prototype.hasOwnProperty.call(req.body, "summary")
    ? limitString(req.body.summary, 360).trim() || null
    : existing.summary;
  const nextBody = Object.prototype.hasOwnProperty.call(req.body, "body_markdown")
    ? limitString(req.body.body_markdown, 50000)
    : existing.body_markdown;
  const nextTags = Object.prototype.hasOwnProperty.call(req.body, "tags")
    ? parseLocationTags(req.body.tags)
    : JSON.parse(existing.tags_json || "[]");
  const nextMapId = Object.prototype.hasOwnProperty.call(req.body, "map_id")
    ? req.body.map_id
      ? sanitizeMapLayer(String(req.body.map_id))
      : null
    : existing.map_id;
  const nextLandmarkSlug = Object.prototype.hasOwnProperty.call(req.body, "landmark_slug")
    ? req.body.landmark_slug
      ? sanitizeOptionalSlug(req.body.landmark_slug)
      : null
    : existing.landmark_slug;
  const nextPublished = Object.prototype.hasOwnProperty.call(req.body, "is_published")
    ? req.body.is_published
      ? 1
      : 0
    : existing.is_published;

  if (!nextName || !nextSlug) {
    return res.status(400).json({ error: "name and slug are required" });
  }

  const duplicate = db
    .prepare(`SELECT id FROM locations WHERE slug = ? AND id != ?`)
    .get(nextSlug, locationId);
  if (duplicate) {
    return res.status(409).json({ error: "Location slug already exists" });
  }

  const now = new Date().toISOString();
  db.prepare(
    `
      UPDATE locations
      SET slug = ?, name = ?, ring = ?, court = ?, faction = ?, district = ?, summary = ?,
          body_markdown = ?, tags_json = ?, map_id = ?, landmark_slug = ?, is_published = ?, updated_at = ?
      WHERE id = ?
    `,
  ).run(
    nextSlug,
    nextName,
    nextRing,
    nextCourt,
    nextFaction,
    nextDistrict,
    nextSummary,
    nextBody,
    JSON.stringify(nextTags),
    nextMapId,
    nextLandmarkSlug,
    nextPublished,
    now,
    locationId,
  );

  const updated = db.prepare(`SELECT * FROM locations WHERE id = ?`).get(locationId);
  res.json({ location: mapLocationForClient(updated) });
});

app.get("/api/documents/:slug", requireRole("player", "dm"), (req, res) => {
  const slug = normalizeDocumentSlug(req.params.slug);
  const row = db
    .prepare(
      `
        SELECT
          id,
          slug,
          title,
          document_type,
          body_markdown,
          published,
          sort_order,
          created_at,
          updated_at
        FROM documents
        WHERE slug = ?
          AND (? = 1 OR published = 1)
        LIMIT 1
      `
    )
    .get(slug, req.session.user.role === "dm" ? 1 : 0);

  if (!row) {
    return res.status(404).json({ error: "Document not found" });
  }

  return res.json(mapDocumentRow(row));
});

app.post("/api/documents", requireRole("dm"), (req, res) => {
  const title = limitString(req.body.title, 160).trim();
  const bodyMarkdown = limitString(req.body.body_markdown, 120000).trim();
  const documentType = limitString(req.body.document_type || "lore", 80).trim() || "lore";
  const published = req.body.published === true ? 1 : 0;
  const sortOrder = Math.max(0, Number.parseInt(String(req.body.sort_order ?? "0"), 10) || 0);
  const candidateSlug = normalizeDocumentSlug(req.body.slug || title);

  if (!title) {
    return res.status(400).json({ error: "title is required" });
  }
  if (!bodyMarkdown) {
    return res.status(400).json({ error: "body_markdown is required" });
  }
  if (!candidateSlug) {
    return res.status(400).json({ error: "slug is required" });
  }

  const now = new Date().toISOString();
  try {
    const result = db
      .prepare(
        `
          INSERT INTO documents (
            slug,
            title,
            document_type,
            body_markdown,
            published,
            sort_order,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(candidateSlug, title, documentType, bodyMarkdown, published, sortOrder, now, now);

    createAuditLog(db, {
      actorUserId: req.session.user.id,
      actionType: published ? "document_publish" : "document_draft_create",
      objectType: "document",
      objectId: String(result.lastInsertRowid),
      message: `Created ${published ? "published" : "draft"} document ${candidateSlug}`,
      createdAt: now,
    });

    const created = db.prepare(`SELECT * FROM documents WHERE id = ?`).get(result.lastInsertRowid);
    return res.status(201).json(mapDocumentRow(created));
  } catch (error) {
    if (String(error && error.message).includes("UNIQUE")) {
      return res.status(409).json({ error: "A document with this slug already exists" });
    }
    return res.status(500).json({ error: "Failed to create document" });
  }
});

app.patch("/api/documents/:id", requireRole("dm"), (req, res) => {
  const documentId = Number(req.params.id);
  const existing = db.prepare(`SELECT * FROM documents WHERE id = ?`).get(documentId);

  if (!existing) {
    return res.status(404).json({ error: "Document not found" });
  }

  const title = limitString(
    Object.prototype.hasOwnProperty.call(req.body, "title") ? req.body.title : existing.title,
    160
  ).trim();
  const bodyMarkdown = limitString(
    Object.prototype.hasOwnProperty.call(req.body, "body_markdown")
      ? req.body.body_markdown
      : existing.body_markdown,
    120000
  ).trim();
  const documentType = limitString(
    Object.prototype.hasOwnProperty.call(req.body, "document_type")
      ? req.body.document_type
      : existing.document_type,
    80
  ).trim();
  const slug = normalizeDocumentSlug(
    Object.prototype.hasOwnProperty.call(req.body, "slug") ? req.body.slug : existing.slug
  );
  const published = Object.prototype.hasOwnProperty.call(req.body, "published")
    ? req.body.published === true
      ? 1
      : 0
    : Number(existing.published) === 1
      ? 1
      : 0;
  const sortOrder = Object.prototype.hasOwnProperty.call(req.body, "sort_order")
    ? Math.max(0, Number.parseInt(String(req.body.sort_order), 10) || 0)
    : Number(existing.sort_order || 0);

  if (!title) {
    return res.status(400).json({ error: "title is required" });
  }
  if (!bodyMarkdown) {
    return res.status(400).json({ error: "body_markdown is required" });
  }
  if (!documentType) {
    return res.status(400).json({ error: "document_type is required" });
  }
  if (!slug) {
    return res.status(400).json({ error: "slug is required" });
  }

  const conflict = db
    .prepare(
      `
        SELECT id
        FROM documents
        WHERE slug = ?
          AND id != ?
      `
    )
    .get(slug, documentId);
  if (conflict) {
    return res.status(409).json({ error: "A document with this slug already exists" });
  }

  const now = new Date().toISOString();
  db.prepare(
    `
      UPDATE documents
      SET slug = ?,
          title = ?,
          document_type = ?,
          body_markdown = ?,
          published = ?,
          sort_order = ?,
          updated_at = ?
      WHERE id = ?
    `
  ).run(slug, title, documentType, bodyMarkdown, published, sortOrder, now, documentId);

  createAuditLog(db, {
    actorUserId: req.session.user.id,
    actionType: "document_update",
    objectType: "document",
    objectId: String(documentId),
    message: `Updated ${published ? "published" : "draft"} document ${slug}`,
    createdAt: now,
  });

  const updated = db.prepare(`SELECT * FROM documents WHERE id = ?`).get(documentId);
  return res.json(mapDocumentRow(updated));
});

app.delete("/api/documents/:id", requireRole("dm"), (req, res) => {
  const documentId = Number(req.params.id);
  const existing = db.prepare(`SELECT id, slug FROM documents WHERE id = ?`).get(documentId);
  if (!existing) {
    return res.status(404).json({ error: "Document not found" });
  }

  db.prepare(`DELETE FROM documents WHERE id = ?`).run(documentId);
  createAuditLog(db, {
    actorUserId: req.session.user.id,
    actionType: "document_delete",
    objectType: "document",
    objectId: String(documentId),
    message: `Deleted document ${existing.slug}`,
    createdAt: new Date().toISOString(),
  });

  return res.json({ ok: true, id: documentId });
});

app.post("/api/documents/import", requireRole("dm"), upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Markdown file is required" });
  }

  const ext = path.extname(req.file.originalname || "").toLowerCase();
  if (ext !== ".md") {
    return res.status(400).json({ error: "Only .md files are supported" });
  }

  const bodyMarkdown = limitString(req.file.buffer.toString("utf8"), 120000).trim();
  if (!bodyMarkdown) {
    return res.status(400).json({ error: "Markdown file is empty" });
  }

  const filenameBase = path.basename(req.file.originalname, ext);
  const title = deriveDocumentTitleFromMarkdown(bodyMarkdown, filenameBase);
  const slug = normalizeDocumentSlug(filenameBase || title);
  const documentType = limitString(req.body.document_type || "imported", 80).trim() || "imported";
  const published = req.body.published === "true" || req.body.published === true ? 1 : 0;
  const sortOrder = Math.max(0, Number.parseInt(String(req.body.sort_order ?? "0"), 10) || 0);
  const now = new Date().toISOString();

  if (!slug) {
    return res.status(400).json({ error: "Could not derive slug from file name" });
  }

  const existing = db.prepare(`SELECT id FROM documents WHERE slug = ?`).get(slug);
  if (existing) {
    db.prepare(
      `
        UPDATE documents
        SET title = ?,
            document_type = ?,
            body_markdown = ?,
            published = ?,
            sort_order = ?,
            updated_at = ?
        WHERE id = ?
      `
    ).run(title, documentType, bodyMarkdown, published, sortOrder, now, existing.id);

    const updated = db.prepare(`SELECT * FROM documents WHERE id = ?`).get(existing.id);
    return res.json({ document: mapDocumentRow(updated), mode: "updated" });
  }

  const result = db
    .prepare(
      `
        INSERT INTO documents (
          slug,
          title,
          document_type,
          body_markdown,
          published,
          sort_order,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .run(slug, title, documentType, bodyMarkdown, published, sortOrder, now, now);

  const created = db.prepare(`SELECT * FROM documents WHERE id = ?`).get(result.lastInsertRowid);
  return res.status(201).json({ document: mapDocumentRow(created), mode: "created" });
});

app.get("/api/npcs", requireRole("player", "dm"), (req, res) => {
  const rows = db
    .prepare(
      `
        SELECT *
        FROM npcs
        WHERE is_visible = 1
          AND archived_at IS NULL
        ORDER BY name ASC
      `
    )
    .all();

  const npcIds = rows.map((row) => row.id);
  const canonicalByNpcId = getCanonicalAliasesByNpcIds(npcIds);
  const personalByNpcId =
    req.session.user.role === "player"
      ? getPersonalAliasesByNpcIds(npcIds, req.session.user.id)
      : new Map();
  const reputationByNpcId = getReputationByNpcIdsForUser(npcIds, req.session.user.id);

  const payload = rows.map((row) =>
    mapNpcForPlayer({
      ...row,
      canonical_aliases: canonicalByNpcId.get(row.id) || [],
      personal_aliases: personalByNpcId.get(row.id) || [],
      reputation: mapNpcReputationForClient(reputationByNpcId.get(row.id) ?? 0, false),
    })
  );

  res.json(payload);
});

app.get("/api/npcs/:slug", requireRole("player", "dm"), (req, res) => {
  const npc = db
    .prepare(
      `
        SELECT *
        FROM npcs
        WHERE slug = ? AND is_visible = 1 AND archived_at IS NULL
      `
    )
    .get(req.params.slug);

  if (!npc) {
    return res.status(404).json({ error: "NPC not found" });
  }

  const score = getReputationForNpcAndUser(npc.id, req.session.user.id);
  res.json(
    mapNpcForPlayer({
      ...npc,
      reputation: mapNpcReputationForClient(score, false),
    })
  );
});

app.get("/api/npcs/:slug/aliases", requireRole("player", "dm"), (req, res) => {
  const npc = db
    .prepare(
      `
        SELECT id
        FROM npcs
        WHERE slug = ? AND is_visible = 1 AND archived_at IS NULL
      `
    )
    .get(req.params.slug);

  if (!npc) {
    return res.status(404).json({ error: "NPC not found" });
  }

  const canonicalAliases = db
    .prepare(
      `
        SELECT id, npc_id, user_id, alias, alias_type, created_at, updated_at
        FROM npc_aliases
        WHERE npc_id = ?
          AND alias_type = 'canonical'
          AND archived_at IS NULL
        ORDER BY alias COLLATE NOCASE ASC
      `
    )
    .all(npc.id);

  const personalAliases = db
    .prepare(
      `
        SELECT id, npc_id, user_id, alias, alias_type, created_at, updated_at
        FROM npc_aliases
        WHERE npc_id = ?
          AND alias_type = 'personal'
          AND user_id = ?
          AND archived_at IS NULL
        ORDER BY alias COLLATE NOCASE ASC
      `
    )
    .all(npc.id, req.session.user.id);

  res.json({
    canonical: canonicalAliases.map(mapAliasForClient),
    personal: personalAliases.map(mapAliasForClient),
  });
});

app.get("/api/npcs/:slug/note", requireRole("player", "dm"), (req, res) => {
  const npc = db
    .prepare(
      `
        SELECT id
        FROM npcs
        WHERE slug = ? AND is_visible = 1 AND archived_at IS NULL
      `
    )
    .get(req.params.slug);

  if (!npc) {
    return res.status(404).json({ error: "NPC not found" });
  }

  const note = db
    .prepare(
      `
        SELECT
          npc_notes.id,
          npc_notes.npc_id,
          npc_notes.author_user_id,
          npc_notes.author_name,
          npc_notes.content,
          npc_notes.created_at,
          npc_notes.updated_at,
          users.display_name AS author_display_name,
          users.username AS author_username
        FROM npc_notes
        LEFT JOIN users
          ON users.id = npc_notes.author_user_id
        WHERE npc_notes.npc_id = ?
          AND npc_notes.author_user_id = ?
        LIMIT 1
      `
    )
    .get(npc.id, req.session.user.id);

  return res.json({
    note: mapNpcNoteForClient(note),
  });
});

app.put("/api/npcs/:slug/note", requireRole("player", "dm"), (req, res) => {
  const npc = db
    .prepare(
      `
        SELECT id
        FROM npcs
        WHERE slug = ? AND is_visible = 1 AND archived_at IS NULL
      `
    )
    .get(req.params.slug);

  if (!npc) {
    return res.status(404).json({ error: "NPC not found" });
  }

  const content = limitString(req.body.content, 20000).trim();
  const now = new Date().toISOString();
  const authorName = req.session.user.display_name || req.session.user.username;

  db.prepare(
    `
      INSERT INTO npc_notes (
        npc_id,
        author_user_id,
        author_name,
        content,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(npc_id, author_user_id)
      DO UPDATE SET
        author_name = excluded.author_name,
        content = excluded.content,
        updated_at = excluded.updated_at
    `
  ).run(npc.id, req.session.user.id, authorName, content, now, now);

  const saved = db
    .prepare(
      `
        SELECT
          npc_notes.id,
          npc_notes.npc_id,
          npc_notes.author_user_id,
          npc_notes.author_name,
          npc_notes.content,
          npc_notes.created_at,
          npc_notes.updated_at,
          users.display_name AS author_display_name,
          users.username AS author_username
        FROM npc_notes
        LEFT JOIN users
          ON users.id = npc_notes.author_user_id
        WHERE npc_notes.npc_id = ?
          AND npc_notes.author_user_id = ?
        LIMIT 1
      `
    )
    .get(npc.id, req.session.user.id);

  return res.json({
    note: mapNpcNoteForClient(saved),
  });
});

app.post("/api/npcs/:slug/aliases", requireRole("player", "dm"), (req, res) => {
  const npc = db
    .prepare(
      `
        SELECT id
        FROM npcs
        WHERE slug = ? AND is_visible = 1 AND archived_at IS NULL
      `
    )
    .get(req.params.slug);

  if (!npc) {
    return res.status(404).json({ error: "NPC not found" });
  }

  const alias = limitString(req.body.alias, 80).trim();
  if (!alias) {
    return res.status(400).json({ error: "alias is required" });
  }

  const now = new Date().toISOString();
  const aliasNormalized = normalizeAlias(alias);

  try {
    const result = db
      .prepare(
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
          VALUES (?, ?, ?, ?, 'personal', ?, ?)
        `
      )
      .run(npc.id, req.session.user.id, alias, aliasNormalized, now, now);

    const created = db
      .prepare(
        `
          SELECT id, npc_id, user_id, alias, alias_type, created_at, updated_at
          FROM npc_aliases
          WHERE id = ?
        `
      )
      .get(result.lastInsertRowid);

    return res.status(201).json(mapAliasForClient(created));
  } catch (error) {
    if (String(error.message || "").includes("idx_npc_aliases_personal_unique")) {
      return res.status(409).json({ error: "You already have this alias for this NPC" });
    }
    return res.status(500).json({ error: "Failed to create alias" });
  }
});

app.get("/api/whisper/posts", requireRole("player", "dm"), (req, res) => {
  const sessionUser = req.session.user;
  const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit || "20"), 10) || 20, 1), 50);
  const offset = Math.max(Number.parseInt(String(req.query.offset || "0"), 10) || 0, 0);

  const posts = db
    .prepare(
      `
        SELECT
          posts.id,
          posts.title,
          posts.body,
          posts.view_count,
          posts.created_at,
          posts.updated_at,
          COUNT(DISTINCT likes.id) AS like_count,
          COUNT(DISTINCT comments.id) AS comment_count,
          CASE WHEN my_like.id IS NULL THEN 0 ELSE 1 END AS liked_by_me,
          CASE WHEN ? = 'dm' THEN 1 ELSE 0 END AS can_moderate
        FROM whisper_posts AS posts
        LEFT JOIN whisper_likes AS likes
          ON likes.post_id = posts.id
        LEFT JOIN whisper_comments AS comments
          ON comments.post_id = posts.id
        LEFT JOIN whisper_likes AS my_like
          ON my_like.post_id = posts.id
         AND my_like.user_id = ?
        GROUP BY posts.id
        ORDER BY posts.updated_at DESC, posts.id DESC
        LIMIT ?
        OFFSET ?
      `
    )
    .all(sessionUser.role, sessionUser.id, limit, offset);

  const totalRow = db
    .prepare(
      `
        SELECT COUNT(*) AS total
        FROM whisper_posts
      `
    )
    .get();

  return res.json({
    posts: posts.map(mapWhisperPostForClient),
    pagination: {
      limit,
      offset,
      total: Number(totalRow?.total || 0),
    },
  });
});

app.get("/api/whisper/posts/:id", requireRole("player", "dm"), (req, res) => {
  const sessionUser = req.session.user;
  const postId = Number(req.params.id);

  if (!Number.isInteger(postId) || postId <= 0) {
    return res.status(400).json({ error: "Invalid post id" });
  }

  const now = new Date().toISOString();
  const viewResult = db
    .prepare(
      `
        INSERT OR IGNORE INTO whisper_post_views (
          post_id,
          user_id,
          viewed_at
        )
        VALUES (?, ?, ?)
      `
    )
    .run(postId, sessionUser.id, now);

  if (viewResult.changes > 0) {
    db.prepare(
      `
        UPDATE whisper_posts
        SET view_count = view_count + 1,
            updated_at = updated_at
        WHERE id = ?
      `
    ).run(postId);
  }

  const post = db
    .prepare(
      `
        SELECT
          posts.id,
          posts.title,
          posts.body,
          posts.view_count,
          posts.created_at,
          posts.updated_at,
          COUNT(DISTINCT likes.id) AS like_count,
          COUNT(DISTINCT comments.id) AS comment_count,
          CASE WHEN my_like.id IS NULL THEN 0 ELSE 1 END AS liked_by_me,
          CASE WHEN ? = 'dm' THEN 1 ELSE 0 END AS can_moderate
        FROM whisper_posts AS posts
        LEFT JOIN whisper_likes AS likes
          ON likes.post_id = posts.id
        LEFT JOIN whisper_comments AS comments
          ON comments.post_id = posts.id
        LEFT JOIN whisper_likes AS my_like
          ON my_like.post_id = posts.id
         AND my_like.user_id = ?
        WHERE posts.id = ?
        GROUP BY posts.id
      `
    )
    .get(sessionUser.role, sessionUser.id, postId);

  if (!post) {
    return res.status(404).json({ error: "Post not found" });
  }

  const comments = db
    .prepare(
      `
        SELECT
          comments.id,
          comments.post_id,
          comments.body,
          comments.created_at,
          comments.updated_at,
          CASE WHEN ? = 'dm' THEN 1 ELSE 0 END AS can_moderate
        FROM whisper_comments AS comments
        WHERE comments.post_id = ?
        ORDER BY comments.created_at ASC, comments.id ASC
      `
    )
    .all(sessionUser.role, postId);

  return res.json({
    post: mapWhisperPostForClient(post),
    comments: comments.map(mapWhisperCommentForClient),
  });
});

app.post("/api/whisper/posts", requireRole("dm"), (req, res) => {
  const sessionUser = req.session.user;
  const title = String(req.body?.title || "").trim();
  const body = String(req.body?.body || "").trim();
  const parsedViewCount = Number.parseInt(String(req.body?.view_count ?? "0"), 10);
  const viewCount = Number.isInteger(parsedViewCount) && parsedViewCount >= 0 ? parsedViewCount : 0;

  if (!title || !body) {
    return res.status(400).json({ error: "Title and body are required" });
  }

  const now = new Date().toISOString();
  const result = db
    .prepare(
      `
        INSERT INTO whisper_posts (
          author_user_id,
          title,
          body,
          view_count,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `
    )
    .run(sessionUser.id, title, body, viewCount, now, now);

  const postId = Number(result.lastInsertRowid);
  createAuditLog(db, {
    actorUserId: sessionUser.id,
    actionType: "whisper_post_created",
    objectType: "whisper_post",
    objectId: String(postId),
    message: `Created whisper post: ${title.slice(0, 80)}`,
  });

  const post = db
    .prepare(
      `
        SELECT
          id,
          title,
          body,
          view_count,
          created_at,
          updated_at,
          0 AS like_count,
          0 AS comment_count,
          0 AS liked_by_me,
          1 AS can_moderate
        FROM whisper_posts
        WHERE id = ?
      `
    )
    .get(postId);

  return res.status(201).json(mapWhisperPostForClient(post));
});

app.patch("/api/whisper/posts/:id", requireRole("dm"), (req, res) => {
  const sessionUser = req.session.user;
  const postId = Number(req.params.id);
  const title = String(req.body?.title || "").trim();
  const body = String(req.body?.body || "").trim();
  const parsedViewCount = Number.parseInt(String(req.body?.view_count ?? "0"), 10);

  if (!Number.isInteger(postId) || postId <= 0) {
    return res.status(400).json({ error: "Invalid post id" });
  }

  if (!title || !body) {
    return res.status(400).json({ error: "Title and body are required" });
  }

  if (!Number.isInteger(parsedViewCount) || parsedViewCount < 0) {
    return res.status(400).json({ error: "view_count must be a non-negative integer" });
  }

  const now = new Date().toISOString();
  const updateResult = db
    .prepare(
      `
        UPDATE whisper_posts
        SET title = ?,
            body = ?,
            view_count = ?,
            updated_at = ?
        WHERE id = ?
      `
    )
    .run(title, body, parsedViewCount, now, postId);

  if (updateResult.changes === 0) {
    return res.status(404).json({ error: "Post not found" });
  }

  createAuditLog(db, {
    actorUserId: sessionUser.id,
    actionType: "whisper_post_updated",
    objectType: "whisper_post",
    objectId: String(postId),
    message: `Updated whisper post: ${title.slice(0, 80)}`,
  });

  const post = db
    .prepare(
      `
        SELECT
          posts.id,
          posts.title,
          posts.body,
          posts.view_count,
          posts.created_at,
          posts.updated_at,
          COUNT(DISTINCT likes.id) AS like_count,
          COUNT(DISTINCT comments.id) AS comment_count,
          0 AS liked_by_me,
          1 AS can_moderate
        FROM whisper_posts AS posts
        LEFT JOIN whisper_likes AS likes
          ON likes.post_id = posts.id
        LEFT JOIN whisper_comments AS comments
          ON comments.post_id = posts.id
        WHERE posts.id = ?
        GROUP BY posts.id
      `
    )
    .get(postId);

  return res.json(mapWhisperPostForClient(post));
});

app.delete("/api/whisper/posts/:id", requireRole("dm"), (req, res) => {
  const sessionUser = req.session.user;
  const postId = Number(req.params.id);

  if (!Number.isInteger(postId) || postId <= 0) {
    return res.status(400).json({ error: "Invalid post id" });
  }

  const existing = db
    .prepare(
      `
        SELECT id, title
        FROM whisper_posts
        WHERE id = ?
      `
    )
    .get(postId);

  if (!existing) {
    return res.status(404).json({ error: "Post not found" });
  }

  const deleteTx = db.transaction(() => {
    db.prepare("DELETE FROM whisper_comments WHERE post_id = ?").run(postId);
    db.prepare("DELETE FROM whisper_likes WHERE post_id = ?").run(postId);
    db.prepare("DELETE FROM whisper_post_views WHERE post_id = ?").run(postId);
    db.prepare("DELETE FROM whisper_posts WHERE id = ?").run(postId);
  });
  deleteTx();

  createAuditLog(db, {
    actorUserId: sessionUser.id,
    actionType: "whisper_post_deleted",
    objectType: "whisper_post",
    objectId: String(postId),
    message: `Deleted whisper post: ${String(existing.title || "").slice(0, 80)}`,
  });

  return res.json({ ok: true });
});

app.post("/api/whisper/posts/:id/comments", requireRole("player", "dm"), (req, res) => {
  const sessionUser = req.session.user;
  const postId = Number(req.params.id);
  const body = String(req.body?.body || "").trim();

  if (!Number.isInteger(postId) || postId <= 0) {
    return res.status(400).json({ error: "Invalid post id" });
  }

  if (!body) {
    return res.status(400).json({ error: "Comment body is required" });
  }

  const postExists = db
    .prepare(
      `
        SELECT id
        FROM whisper_posts
        WHERE id = ?
      `
    )
    .get(postId);

  if (!postExists) {
    return res.status(404).json({ error: "Post not found" });
  }

  const now = new Date().toISOString();
  const result = db
    .prepare(
      `
        INSERT INTO whisper_comments (
          post_id,
          author_user_id,
          body,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?)
      `
    )
    .run(postId, sessionUser.id, body, now, now);

  db.prepare(
    `
      UPDATE whisper_posts
      SET updated_at = ?
      WHERE id = ?
    `
  ).run(now, postId);

  return res.status(201).json(
    mapWhisperCommentForClient({
      id: Number(result.lastInsertRowid),
      post_id: postId,
      body,
      created_at: now,
      updated_at: now,
      can_moderate: sessionUser.role === "dm" ? 1 : 0,
    })
  );
});

app.delete("/api/whisper/comments/:id", requireRole("dm"), (req, res) => {
  const commentId = Number(req.params.id);

  if (!Number.isInteger(commentId) || commentId <= 0) {
    return res.status(400).json({ error: "Invalid comment id" });
  }

  const comment = db
    .prepare(
      `
        SELECT id, post_id
        FROM whisper_comments
        WHERE id = ?
      `
    )
    .get(commentId);

  if (!comment) {
    return res.status(404).json({ error: "Comment not found" });
  }

  const now = new Date().toISOString();
  db.prepare("DELETE FROM whisper_comments WHERE id = ?").run(commentId);
  db.prepare(
    `
      UPDATE whisper_posts
      SET updated_at = ?
      WHERE id = ?
    `
  ).run(now, comment.post_id);

  return res.json({ ok: true });
});

app.post("/api/whisper/posts/:id/likes", requireRole("player", "dm"), (req, res) => {
  const sessionUser = req.session.user;
  const postId = Number(req.params.id);
  const now = new Date().toISOString();

  if (!Number.isInteger(postId) || postId <= 0) {
    return res.status(400).json({ error: "Invalid post id" });
  }

  const postExists = db
    .prepare(
      `
        SELECT id
        FROM whisper_posts
        WHERE id = ?
      `
    )
    .get(postId);

  if (!postExists) {
    return res.status(404).json({ error: "Post not found" });
  }

  const existing = db
    .prepare(
      `
        SELECT id
        FROM whisper_likes
        WHERE post_id = ?
          AND user_id = ?
      `
    )
    .get(postId, sessionUser.id);

  let liked = false;
  if (existing) {
    db.prepare(
      `
        DELETE FROM whisper_likes
        WHERE id = ?
      `
    ).run(existing.id);
  } else {
    db.prepare(
      `
        INSERT INTO whisper_likes (
          post_id,
          user_id,
          created_at
        )
        VALUES (?, ?, ?)
      `
    ).run(postId, sessionUser.id, now);
    liked = true;
  }

  const totals = db
    .prepare(
      `
        SELECT COUNT(*) AS like_count
        FROM whisper_likes
        WHERE post_id = ?
      `
    )
    .get(postId);

  return res.json({
    liked,
    like_count: Number(totals?.like_count || 0),
  });
});

app.patch("/api/npc-aliases/:id", requireRole("player", "dm"), (req, res) => {
  const aliasId = Number(req.params.id);
  const alias = limitString(req.body.alias, 80).trim();

  if (!alias) {
    return res.status(400).json({ error: "alias is required" });
  }

  const existing = db
    .prepare(
      `
        SELECT
          npc_aliases.id,
          npc_aliases.npc_id,
          npc_aliases.user_id,
          npc_aliases.alias_type,
          npcs.is_visible
        FROM npc_aliases
        JOIN npcs ON npcs.id = npc_aliases.npc_id
        WHERE npc_aliases.id = ?
          AND npc_aliases.archived_at IS NULL
      `
    )
    .get(aliasId);

  if (!existing) {
    return res.status(404).json({ error: "Alias not found" });
  }

  if (req.session.user.role !== "dm" && !existing.is_visible) {
    return res.status(404).json({ error: "Alias not found" });
  }

  if (existing.alias_type !== "personal") {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.session.user.role !== "dm" && existing.user_id !== req.session.user.id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const now = new Date().toISOString();
  const aliasNormalized = normalizeAlias(alias);

  try {
    db.prepare(
      `
        UPDATE npc_aliases
        SET alias = ?, alias_normalized = ?, updated_at = ?
        WHERE id = ?
      `
    ).run(alias, aliasNormalized, now, aliasId);

    const updated = db
      .prepare(
        `
          SELECT id, npc_id, user_id, alias, alias_type, created_at, updated_at
          FROM npc_aliases
          WHERE id = ?
        `
      )
      .get(aliasId);

    return res.json(mapAliasForClient(updated));
  } catch (error) {
    if (String(error.message || "").includes("idx_npc_aliases_personal_unique")) {
      return res.status(409).json({ error: "You already have this alias for this NPC" });
    }
    return res.status(500).json({ error: "Failed to update alias" });
  }
});

app.delete("/api/npc-aliases/:id", requireRole("player", "dm"), (req, res) => {
  const aliasId = Number(req.params.id);

  const existing = db
    .prepare(
      `
        SELECT
          npc_aliases.*,
          npcs.is_visible
        FROM npc_aliases
        JOIN npcs ON npcs.id = npc_aliases.npc_id
        WHERE npc_aliases.id = ?
          AND npc_aliases.archived_at IS NULL
      `
    )
    .get(aliasId);

  if (!existing) {
    return res.status(404).json({ error: "Alias not found" });
  }

  if (req.session.user.role !== "dm" && !existing.is_visible) {
    return res.status(404).json({ error: "Alias not found" });
  }

  if (existing.alias_type !== "personal") {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.session.user.role !== "dm" && existing.user_id !== req.session.user.id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const now = new Date().toISOString();
  db.prepare(
    `
      UPDATE npc_aliases
      SET archived_at = ?, archived_by_user_id = ?, updated_at = ?
      WHERE id = ?
    `
  ).run(now, req.session.user.id, now, aliasId);

  archiveRecordAndLog({
    objectType: "npc_alias",
    objectId: aliasId,
    ownerUserId: existing.user_id || req.session.user.id,
    archivedByUserId: req.session.user.id,
    payload: { row: existing },
    objectLabel: existing.alias,
    sourceTable: "npc_aliases",
    archiveReason: req.session.user.role === "dm" ? "dm-remove" : "player-remove",
    auditMessage: `Archived NPC alias ${aliasId}`,
  });

  res.json({ ok: true, id: aliasId });
});

app.get("/api/maps/config", requireRole("player", "dm"), (_req, res) => {
  res.json({
    layers: MAP_CONFIGS,
  });
});

app.get("/api/maps/landmarks", requireRole("player", "dm"), (req, res) => {
  const sessionUser = req.session.user;
  const requestedMapId = String(req.query.map_id || "").trim();
  const values = [];
  const filters = [];

  if (requestedMapId) {
    filters.push("map_landmarks.map_id = ?");
    values.push(sanitizeMapLayer(requestedMapId));
  }

  if (sessionUser.role !== "dm") {
    filters.push("map_landmarks.visibility_scope = 'public'");
    filters.push(
      "(map_landmarks.linked_entity_slug IS NULL OR linked_locations.is_published = 1)",
    );
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
  const rows = db
    .prepare(
      `
        SELECT
          map_landmarks.*,
          linked_locations.slug AS location_slug,
          linked_locations.name AS location_name,
          linked_locations.ring AS location_ring,
          linked_locations.summary AS location_summary
        FROM map_landmarks
        LEFT JOIN locations AS linked_locations
          ON linked_locations.slug = map_landmarks.linked_entity_slug
        ${whereClause}
        ORDER BY map_landmarks.sort_order ASC, map_landmarks.label COLLATE NOCASE ASC, map_landmarks.id ASC
      `
    )
    .all(...values);

  res.json({
    landmarks: rows.map(mapMapLandmarkForClient),
  });
});

app.post("/api/maps/landmarks", requireRole("dm"), (req, res) => {
  const mapId = sanitizeMapLayer(String(req.body.map_id || ""));
  const label = limitString(req.body.label, 120).trim();
  const x = clampNormalizedCoordinate(Number(req.body.x));
  const y = clampNormalizedCoordinate(Number(req.body.y));
  const markerStyle = sanitizeMapLandmarkMarkerStyle(String(req.body.marker_style || "landmark"));
  const visibilityScope = sanitizeMapLandmarkVisibilityScope(String(req.body.visibility_scope || "public"));
  const description = limitString(req.body.description, 1500).trim();
  const linkedPageSlug = limitString(req.body.linked_page_slug, 160).trim() || null;
  const linkedEntitySlug = limitString(req.body.linked_entity_slug, 160).trim() || null;
  const sortOrder = Number.isFinite(Number(req.body.sort_order)) ? Math.round(Number(req.body.sort_order)) : 0;
  const unlockChapter =
    req.body.unlock_chapter == null || req.body.unlock_chapter === ""
      ? null
      : Math.max(0, Math.round(Number(req.body.unlock_chapter)));
  const slug = sanitizeOptionalSlug(req.body.slug, label);

  if (!label) {
    return res.status(400).json({ error: "label is required" });
  }

  if (!slug) {
    return res.status(400).json({ error: "slug is required" });
  }

  const duplicate = db
    .prepare(
      `
        SELECT id
        FROM map_landmarks
        WHERE map_id = ? AND slug = ?
      `
    )
    .get(mapId, slug);

  if (duplicate) {
    return res.status(409).json({ error: "slug already exists for this map" });
  }

  const now = new Date().toISOString();
  const result = db
    .prepare(
      `
        INSERT INTO map_landmarks (
          map_id,
          slug,
          label,
          x,
          y,
          marker_style,
          visibility_scope,
          description,
          linked_page_slug,
          linked_entity_slug,
          sort_order,
          unlock_chapter,
          created_at,
          updated_at,
          created_by_user_id,
          updated_by_user_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .run(
      mapId,
      slug,
      label,
      x,
      y,
      markerStyle,
      visibilityScope,
      description,
      linkedPageSlug,
      linkedEntitySlug,
      sortOrder,
      unlockChapter,
      now,
      now,
      req.session.user.id,
      req.session.user.id
    );

  const created = db.prepare(`SELECT * FROM map_landmarks WHERE id = ?`).get(result.lastInsertRowid);
  res.status(201).json(mapMapLandmarkForClient(created));
});

app.patch("/api/maps/landmarks/:id", requireRole("dm"), (req, res) => {
  const landmarkId = Number(req.params.id);
  const existing = db.prepare(`SELECT * FROM map_landmarks WHERE id = ?`).get(landmarkId);

  if (!existing) {
    return res.status(404).json({ error: "Landmark not found" });
  }

  const hasMapId = Object.prototype.hasOwnProperty.call(req.body, "map_id");
  const hasSlug = Object.prototype.hasOwnProperty.call(req.body, "slug");
  const hasLabel = Object.prototype.hasOwnProperty.call(req.body, "label");
  const hasX = Object.prototype.hasOwnProperty.call(req.body, "x");
  const hasY = Object.prototype.hasOwnProperty.call(req.body, "y");
  const hasMarkerStyle = Object.prototype.hasOwnProperty.call(req.body, "marker_style");
  const hasVisibilityScope = Object.prototype.hasOwnProperty.call(req.body, "visibility_scope");
  const hasDescription = Object.prototype.hasOwnProperty.call(req.body, "description");
  const hasLinkedPageSlug = Object.prototype.hasOwnProperty.call(req.body, "linked_page_slug");
  const hasLinkedEntitySlug = Object.prototype.hasOwnProperty.call(req.body, "linked_entity_slug");
  const hasSortOrder = Object.prototype.hasOwnProperty.call(req.body, "sort_order");
  const hasUnlockChapter = Object.prototype.hasOwnProperty.call(req.body, "unlock_chapter");

  const mapId = hasMapId ? sanitizeMapLayer(String(req.body.map_id || "")) : existing.map_id;
  const label = hasLabel ? limitString(req.body.label, 120).trim() : existing.label;
  const x = hasX ? clampNormalizedCoordinate(Number(req.body.x)) : Number(existing.x);
  const y = hasY ? clampNormalizedCoordinate(Number(req.body.y)) : Number(existing.y);
  const markerStyle = hasMarkerStyle
    ? sanitizeMapLandmarkMarkerStyle(String(req.body.marker_style || "landmark"))
    : existing.marker_style;
  const visibilityScope = hasVisibilityScope
    ? sanitizeMapLandmarkVisibilityScope(String(req.body.visibility_scope || "public"))
    : existing.visibility_scope;
  const description = hasDescription
    ? limitString(req.body.description, 1500).trim()
    : existing.description || "";
  const linkedPageSlug = hasLinkedPageSlug
    ? limitString(req.body.linked_page_slug, 160).trim() || null
    : existing.linked_page_slug;
  const linkedEntitySlug = hasLinkedEntitySlug
    ? limitString(req.body.linked_entity_slug, 160).trim() || null
    : existing.linked_entity_slug;
  const sortOrder = hasSortOrder
    ? Number.isFinite(Number(req.body.sort_order))
      ? Math.round(Number(req.body.sort_order))
      : 0
    : Number(existing.sort_order || 0);
  const unlockChapter = hasUnlockChapter
    ? req.body.unlock_chapter == null || req.body.unlock_chapter === ""
      ? null
      : Math.max(0, Math.round(Number(req.body.unlock_chapter)))
    : existing.unlock_chapter;
  const slug = hasSlug
    ? sanitizeOptionalSlug(req.body.slug, label)
    : hasLabel
      ? sanitizeOptionalSlug(existing.slug, label)
      : existing.slug;

  if (!label) {
    return res.status(400).json({ error: "label is required" });
  }

  if (!slug) {
    return res.status(400).json({ error: "slug is required" });
  }

  const duplicate = db
    .prepare(
      `
        SELECT id
        FROM map_landmarks
        WHERE map_id = ? AND slug = ? AND id != ?
      `
    )
    .get(mapId, slug, landmarkId);

  if (duplicate) {
    return res.status(409).json({ error: "slug already exists for this map" });
  }

  const now = new Date().toISOString();
  db.prepare(
    `
      UPDATE map_landmarks
      SET map_id = ?,
          slug = ?,
          label = ?,
          x = ?,
          y = ?,
          marker_style = ?,
          visibility_scope = ?,
          description = ?,
          linked_page_slug = ?,
          linked_entity_slug = ?,
          sort_order = ?,
          unlock_chapter = ?,
          updated_at = ?,
          updated_by_user_id = ?
      WHERE id = ?
    `
  ).run(
    mapId,
    slug,
    label,
    x,
    y,
    markerStyle,
    visibilityScope,
    description,
    linkedPageSlug,
    linkedEntitySlug,
    sortOrder,
    unlockChapter,
    now,
    req.session.user.id,
    landmarkId
  );

  const updated = db.prepare(`SELECT * FROM map_landmarks WHERE id = ?`).get(landmarkId);
  res.json(mapMapLandmarkForClient(updated));
});

app.delete("/api/maps/landmarks/:id", requireRole("dm"), (req, res) => {
  const landmarkId = Number(req.params.id);
  const result = db.prepare(`DELETE FROM map_landmarks WHERE id = ?`).run(landmarkId);

  if (result.changes < 1) {
    return res.status(404).json({ error: "Landmark not found" });
  }

  res.json({ ok: true, deleted_id: landmarkId });
});

app.get("/api/maps/pins", requireRole("player", "dm"), (req, res) => {
  const sessionUser = req.session.user;
  const requestedUserId = Number(req.query.userId);
  const isDm = sessionUser.role === "dm";
  const ownerUserId =
    isDm && Number.isInteger(requestedUserId) && requestedUserId > 0
      ? requestedUserId
      : sessionUser.id;
  const requestedLayer = String(req.query.map_layer || "").trim();

  const values = [ownerUserId];
  const filters = ["user_id = ?", "archived_at IS NULL"];

  if (requestedLayer) {
    const mapLayer = sanitizeMapLayer(requestedLayer);
    filters.push("map_layer = ?");
    values.push(mapLayer);
  }

  const rows = db
    .prepare(
      `
        SELECT *
        FROM map_pins
        WHERE ${filters.join(" AND ")}
        ORDER BY updated_at DESC, id DESC
      `
    )
    .all(...values);

  res.json({
    pins: rows.map(mapMapPinForClient),
    owner_user_id: ownerUserId,
  });
});

app.post("/api/maps/pins", requireRole("player", "dm"), (req, res) => {
  const mapLayer = sanitizeMapLayer(String(req.body.map_layer || ""));
  const x = clampNormalizedCoordinate(Number(req.body.x));
  const y = clampNormalizedCoordinate(Number(req.body.y));
  const title = limitString(req.body.title, 120).trim();
  const note = limitString(req.body.note, 2000).trim();
  const category = sanitizeMapPinCategory(String(req.body.category || "clue"));

  if (!title) {
    return res.status(400).json({ error: "title is required" });
  }

  const now = new Date().toISOString();
  const result = db
    .prepare(
      `
        INSERT INTO map_pins (
          user_id,
          map_layer,
          x,
          y,
          title,
          note,
          category,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .run(req.session.user.id, mapLayer, x, y, title, note, category, now, now);

  const created = db
    .prepare(
      `
        SELECT *
        FROM map_pins
        WHERE id = ?
      `
    )
    .get(result.lastInsertRowid);

  res.status(201).json(mapMapPinForClient(created));
});

app.patch("/api/maps/pins/:id", requireRole("player", "dm"), (req, res) => {
  const pinId = Number(req.params.id);
  const existing = db
    .prepare(
      `
        SELECT *
        FROM map_pins
        WHERE id = ? AND archived_at IS NULL
      `
    )
    .get(pinId);

  if (!existing) {
    return res.status(404).json({ error: "Pin not found" });
  }

  if (existing.user_id !== req.session.user.id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const hasMapLayer = Object.prototype.hasOwnProperty.call(req.body, "map_layer");
  const hasX = Object.prototype.hasOwnProperty.call(req.body, "x");
  const hasY = Object.prototype.hasOwnProperty.call(req.body, "y");
  const hasTitle = Object.prototype.hasOwnProperty.call(req.body, "title");
  const hasNote = Object.prototype.hasOwnProperty.call(req.body, "note");
  const hasCategory = Object.prototype.hasOwnProperty.call(req.body, "category");

  const mapLayer = hasMapLayer
    ? sanitizeMapLayer(String(req.body.map_layer || ""))
    : existing.map_layer;
  const x = hasX ? clampNormalizedCoordinate(Number(req.body.x)) : Number(existing.x);
  const y = hasY ? clampNormalizedCoordinate(Number(req.body.y)) : Number(existing.y);
  const title = hasTitle ? limitString(req.body.title, 120).trim() : existing.title;
  const note = hasNote ? limitString(req.body.note, 2000).trim() : existing.note;
  const category = hasCategory
    ? sanitizeMapPinCategory(String(req.body.category || "clue"))
    : existing.category;

  if (!title) {
    return res.status(400).json({ error: "title is required" });
  }

  const now = new Date().toISOString();
  db.prepare(
    `
      UPDATE map_pins
      SET map_layer = ?,
          x = ?,
          y = ?,
          title = ?,
          note = ?,
          category = ?,
          updated_at = ?
      WHERE id = ?
    `
  ).run(mapLayer, x, y, title, note, category, now, pinId);

  const updated = db
    .prepare(
      `
        SELECT *
        FROM map_pins
        WHERE id = ?
      `
    )
    .get(pinId);

  res.json(mapMapPinForClient(updated));
});

app.post("/api/maps/pins/:id/archive", requireRole("player", "dm"), (req, res) => {
  const pinId = Number(req.params.id);
  const existing = db
    .prepare(
      `
        SELECT *
        FROM map_pins
        WHERE id = ? AND archived_at IS NULL
      `
    )
    .get(pinId);

  if (!existing) {
    return res.status(404).json({ error: "Pin not found" });
  }

  if (existing.user_id !== req.session.user.id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const now = new Date().toISOString();
  db.prepare(
    `
      UPDATE map_pins
      SET archived_at = ?,
          archived_by_user_id = ?,
          updated_at = ?
      WHERE id = ?
    `
  ).run(now, req.session.user.id, now, pinId);

  archiveRecordAndLog({
    objectType: "map_pin",
    objectId: pinId,
    ownerUserId: existing.user_id,
    archivedByUserId: req.session.user.id,
    payload: { row: existing },
    objectLabel: existing.title,
    sourceTable: "map_pins",
    archiveReason: req.session.user.role === "dm" ? "dm-remove" : "player-remove",
    auditMessage: `Archived map pin ${pinId}`,
  });

  res.json({ ok: true, archived_id: pinId });
});

app.post("/api/exports/audit", requireRole("player", "dm"), (req, res) => {
  const exportType = limitString(req.body.export_type, 64).trim();
  const objectType = limitString(req.body.object_type || "export", 64).trim() || "export";
  const objectId = req.body.object_id ? limitString(req.body.object_id, 64).trim() : null;
  const message =
    limitString(req.body.message, 300).trim() ||
    `User exported ${exportType || "data"} (${objectType})`;
  const allowedExportTypes = new Set(["board_png", "board_json", "map_pins_json"]);

  if (!allowedExportTypes.has(exportType)) {
    return res.status(400).json({ error: "Unsupported export type" });
  }

  createAuditLog(db, {
    actorUserId: req.session.user.id,
    actionType: "export",
    objectType,
    objectId: objectId || exportType,
    message,
    createdAt: new Date().toISOString(),
  });

  res.status(201).json({ ok: true });
});

app.post("/api/dm/backups", requireRole("dm"), (req, res) => {
  const now = new Date();
  const nowIso = now.toISOString();
  const timestamp = formatTimestampForFilename(now);
  const backupName = `faebook-backup-${timestamp}`;
  const backupsRootDir = path.join(__dirname, "../../backups");
  const backupDir = path.join(backupsRootDir, backupName);
  const backupDataDir = path.join(backupDir, "data");
  const backupUploadsDir = path.join(backupDir, "uploads");
  const backupMapsDir = path.join(backupDir, "config", "maps");
  const sourceDbPath = path.join(__dirname, "../../data/faebook.db");
  const sourceUploadsDir = path.join(__dirname, "../../uploads/npc-portraits");
  const sourceMapsDir = path.join(__dirname, "../../config/maps");

  try {
    if (fs.existsSync(backupDir)) {
      return res.status(409).json({ error: "A backup already exists for this timestamp" });
    }

    safeMkdir(backupDataDir);
    safeMkdir(backupUploadsDir);
    safeMkdir(backupMapsDir);

    if (fs.existsSync(sourceDbPath)) {
      fs.copyFileSync(sourceDbPath, path.join(backupDataDir, "faebook.db"));
    }

    for (const suffix of ["-wal", "-shm"]) {
      const sourcePath = `${sourceDbPath}${suffix}`;
      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, path.join(backupDataDir, `faebook.db${suffix}`));
      }
    }

    if (fs.existsSync(sourceUploadsDir)) {
      fs.cpSync(sourceUploadsDir, backupUploadsDir, { recursive: true, force: true });
    }

    const mapConfigFiles = fs
      .readdirSync(sourceMapsDir)
      .filter((filename) => filename.toLowerCase().endsWith(".yml"))
      .sort();

    for (const filename of mapConfigFiles) {
      fs.copyFileSync(
        path.join(sourceMapsDir, filename),
        path.join(backupMapsDir, filename)
      );
    }

    const manifest = {
      backup_name: backupName,
      schema_version: "1.0",
      created_at: nowIso,
      created_by_user_id: req.session.user.id,
      created_by_username: req.session.user.username,
      app_name: "FaeBook",
      includes: {
        database: fs.existsSync(sourceDbPath),
        database_wal: fs.existsSync(`${sourceDbPath}-wal`),
        database_shm: fs.existsSync(`${sourceDbPath}-shm`),
        uploaded_portraits: fs.existsSync(sourceUploadsDir),
        map_config_files: mapConfigFiles,
      },
    };

    fs.writeFileSync(
      path.join(backupDir, "manifest.json"),
      JSON.stringify(manifest, null, 2),
      "utf8"
    );

    createAuditLog(db, {
      actorUserId: req.session.user.id,
      actionType: "backup_create",
      objectType: "system_backup",
      objectId: backupName,
      message: `DM created local backup ${backupName}`,
      createdAt: nowIso,
    });

    res.status(201).json({
      ok: true,
      backup: {
        name: backupName,
        created_at: nowIso,
        path: path.relative(path.join(__dirname, "../.."), backupDir),
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to create backup",
    });
  }
});

app.get("/api/archive", requireRole("dm"), (req, res) => {
  const filters = [];
  const params = [];

  if (req.query.object_type) {
    filters.push("archive_records.object_type = ?");
    params.push(String(req.query.object_type));
  }

  const ownerUserId = Number(req.query.owner_user_id);
  if (Number.isInteger(ownerUserId) && ownerUserId > 0) {
    filters.push("archive_records.owner_user_id = ?");
    params.push(ownerUserId);
  }

  if (req.query.date_from) {
    filters.push("archive_records.archived_at >= ?");
    params.push(String(req.query.date_from));
  }

  if (req.query.date_to) {
    filters.push("archive_records.archived_at <= ?");
    params.push(String(req.query.date_to));
  }

  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const rows = db
    .prepare(
      `
        SELECT
          archive_records.id,
          archive_records.object_type,
          archive_records.object_id,
          archive_records.owner_user_id,
          archive_records.archived_by_user_id,
          archive_records.archived_at,
          archive_records.object_label,
          archive_records.source_table,
          archive_records.archive_reason,
          owner.username AS owner_username,
          owner.display_name AS owner_display_name,
          archived_by.username AS archived_by_username,
          archived_by.display_name AS archived_by_display_name
        FROM archive_records
        LEFT JOIN users AS owner
          ON owner.id = archive_records.owner_user_id
        LEFT JOIN users AS archived_by
          ON archived_by.id = archive_records.archived_by_user_id
        ${whereClause}
        ORDER BY archive_records.archived_at DESC, archive_records.id DESC
        LIMIT 300
      `
    )
    .all(...params);

  res.json(rows);
});

app.post("/api/archive/:id/restore", requireRole("dm"), (req, res) => {
  const archiveId = Number(req.params.id);
  const archiveRecord = db
    .prepare(
      `
        SELECT *
        FROM archive_records
        WHERE id = ?
      `
    )
    .get(archiveId);

  if (!archiveRecord) {
    return res.status(404).json({ error: "Archive record not found" });
  }

  const restoreStrategy = getRestoreStrategy(archiveRecord.object_type);
  if (!restoreStrategy) {
    return res.status(400).json({ error: "This object type is not restorable in v1" });
  }

  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    const restoredObjectId = restoreStrategy.restoreRow(db, archiveRecord, now);

    db.prepare(
      `
        DELETE FROM archive_records
        WHERE id = ?
      `
    ).run(archiveId);

    createAuditLog(db, {
      actorUserId: req.session.user.id,
      actionType: "restore",
      objectType: archiveRecord.object_type,
      objectId: restoredObjectId,
      message: `Restored ${archiveRecord.object_type} ${restoredObjectId} from archive ${archiveId}`,
      createdAt: now,
    });

    return restoredObjectId;
  });

  const restoredObjectId = tx();
  res.json({ ok: true, restored_id: restoredObjectId, archive_id: archiveId });
});

app.delete("/api/archive/:id", requireRole("dm"), (req, res) => {
  const archiveId = Number(req.params.id);
  const archiveRecord = db
    .prepare(
      `
        SELECT *
        FROM archive_records
        WHERE id = ?
      `
    )
    .get(archiveId);

  if (!archiveRecord) {
    return res.status(404).json({ error: "Archive record not found" });
  }

  const restoreStrategy = getRestoreStrategy(archiveRecord.object_type);
  if (!restoreStrategy) {
    return res.status(400).json({ error: "This object type is not hard-deletable in v1" });
  }

  const objectId = Number(archiveRecord.object_id);
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare(
      `
        DELETE FROM ${restoreStrategy.tableName}
        WHERE id = ?
      `
    ).run(objectId);

    db.prepare(
      `
        DELETE FROM archive_records
        WHERE id = ?
      `
    ).run(archiveId);

    createAuditLog(db, {
      actorUserId: req.session.user.id,
      actionType: "hard_delete",
      objectType: archiveRecord.object_type,
      objectId,
      message: `Hard deleted ${archiveRecord.object_type} ${objectId} from archive ${archiveId}`,
      createdAt: now,
    });
  });

  tx();
  res.json({ ok: true, id: archiveId, hard_deleted_object_id: objectId });
});

app.get("/api/boards", requireRole("player", "dm"), (req, res) => {
  const ownerUser = getBoardOwnerForRequest(req);

  if (!ownerUser) {
    return res.status(404).json({ error: "Board owner not found" });
  }

  ensureBoardForOwner(ownerUser.id);
  const rows = db
    .prepare(
      `
        SELECT *
        FROM boards
        WHERE owner_user_id = ?
          AND archived_at IS NULL
        ORDER BY is_default DESC, updated_at DESC, id DESC
      `
    )
    .all(ownerUser.id);

  res.json({
    owner: getSessionUser(ownerUser),
    boards: rows.map(mapBoardSummary),
  });
});

app.post("/api/boards", requireRole("player", "dm"), (req, res) => {
  const ownerUser = getBoardOwnerForRequest(req);

  if (!ownerUser) {
    return res.status(404).json({ error: "Board owner not found" });
  }

  const name = limitString(req.body.name || "Untitled Board", 120).trim() || "Untitled Board";
  const now = new Date().toISOString();
  const board = sanitizeBoardPayload(req.body.board || getDefaultBoard());

  const result = db
    .prepare(
      `
        INSERT INTO boards (
          owner_user_id,
          name,
          is_default,
          json_data,
          created_at,
          updated_at,
          archived_at,
          archived_by_user_id
        )
        VALUES (?, ?, 0, ?, ?, ?, NULL, NULL)
      `
    )
    .run(ownerUser.id, name, JSON.stringify(board), now, now);

  const created = db
    .prepare(
      `
        SELECT *
        FROM boards
        WHERE id = ?
      `
    )
    .get(Number(result.lastInsertRowid));

  res.status(201).json({
    board: mapBoardSummary(created),
    owner: getSessionUser(ownerUser),
  });
});

app.patch("/api/boards/:id", requireRole("player", "dm"), (req, res) => {
  const ownerUser = getBoardOwnerForRequest(req);
  const boardId = Number(req.params.id);

  if (!ownerUser) {
    return res.status(404).json({ error: "Board owner not found" });
  }

  if (!Number.isInteger(boardId) || boardId <= 0) {
    return res.status(400).json({ error: "Invalid board id" });
  }

  const existing = getBoardByIdForOwner(boardId, ownerUser.id);
  if (!existing) {
    return res.status(404).json({ error: "Board not found" });
  }

  const maybeName = req.body.name;
  const setDefault = req.body.set_default === true;
  const now = new Date().toISOString();
  const nextName =
    maybeName === undefined ? existing.name : limitString(maybeName, 120).trim() || existing.name;

  const tx = db.transaction(() => {
    db.prepare(
      `
        UPDATE boards
        SET name = ?,
            updated_at = ?
        WHERE id = ?
      `
    ).run(nextName, now, boardId);

    if (setDefault) {
      setSingleDefaultBoardForOwnerInTransaction(ownerUser.id, boardId, now);
    }
  });

  tx();

  res.json({
    board: mapBoardSummary(getBoardByIdForOwner(boardId, ownerUser.id)),
    owner: getSessionUser(ownerUser),
  });
});

app.post("/api/boards/:id/duplicate", requireRole("player", "dm"), (req, res) => {
  const ownerUser = getBoardOwnerForRequest(req);
  const boardId = Number(req.params.id);

  if (!ownerUser) {
    return res.status(404).json({ error: "Board owner not found" });
  }

  if (!Number.isInteger(boardId) || boardId <= 0) {
    return res.status(400).json({ error: "Invalid board id" });
  }

  const sourceBoard = getBoardByIdForOwner(boardId, ownerUser.id);
  if (!sourceBoard) {
    return res.status(404).json({ error: "Board not found" });
  }

  const now = new Date().toISOString();
  const result = db
    .prepare(
      `
        INSERT INTO boards (
          owner_user_id,
          name,
          is_default,
          json_data,
          created_at,
          updated_at,
          archived_at,
          archived_by_user_id
        )
        VALUES (?, ?, 0, ?, ?, ?, NULL, NULL)
      `
    )
    .run(ownerUser.id, `${sourceBoard.name} (Copy)`, sourceBoard.json_data, now, now);

  const created = db
    .prepare(
      `
        SELECT *
        FROM boards
        WHERE id = ?
      `
    )
    .get(Number(result.lastInsertRowid));

  res.status(201).json({
    board: mapBoardSummary(created),
    owner: getSessionUser(ownerUser),
  });
});

app.post("/api/boards/:id/archive", requireRole("player", "dm"), (req, res) => {
  const ownerUser = getBoardOwnerForRequest(req);
  const boardId = Number(req.params.id);

  if (!ownerUser) {
    return res.status(404).json({ error: "Board owner not found" });
  }

  if (!Number.isInteger(boardId) || boardId <= 0) {
    return res.status(400).json({ error: "Invalid board id" });
  }

  const sourceBoard = getBoardByIdForOwner(boardId, ownerUser.id);
  if (!sourceBoard) {
    return res.status(404).json({ error: "Board not found" });
  }

  const activeCountRow = db
    .prepare(
      `
        SELECT COUNT(*) AS count
        FROM boards
        WHERE owner_user_id = ?
          AND archived_at IS NULL
      `
    )
    .get(ownerUser.id);

  if (Number(activeCountRow?.count || 0) < 2) {
    return res.status(400).json({ error: "At least one active board must remain" });
  }

  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare(
      `
        UPDATE boards
        SET archived_at = ?,
            archived_by_user_id = ?,
            is_default = 0,
            updated_at = ?
        WHERE id = ?
      `
    ).run(now, req.session.user.id, now, boardId);

    if (Number(sourceBoard.is_default) === 1) {
      const fallback = getLatestActiveBoardRow(ownerUser.id);
      if (fallback) {
        setSingleDefaultBoardForOwnerInTransaction(ownerUser.id, fallback.id, now);
      }
    } else {
      clearActiveBoardDefaults(ownerUser.id, now, boardId);
    }
  });

  tx();

  archiveRecordAndLog({
    objectType: "board",
    objectId: boardId,
    ownerUserId: sourceBoard.owner_user_id,
    archivedByUserId: req.session.user.id,
    payload: { row: sourceBoard },
    objectLabel: `Board: ${sourceBoard.name}`,
    sourceTable: "boards",
    archiveReason: "player-remove",
    auditMessage: `Archived board ${boardId}`,
  });
  const fallbackBoard = ensureBoardForOwner(ownerUser.id);
  res.json({
    ok: true,
    archived_id: boardId,
    next_board_id: fallbackBoard.id,
    owner: getSessionUser(ownerUser),
  });
});

app.get("/api/board", requireRole("player", "dm"), (req, res) => {
  const { ownerUser, boardRow } = getBoardForRequest(req);

  if (!ownerUser) {
    return res.status(404).json({ error: "Board owner not found" });
  }

  if (!boardRow) {
    return res.status(404).json({ error: "Board not found" });
  }

  res.json({
    board_id: boardRow.id,
    board_name: boardRow.name,
    is_default: Number(boardRow.is_default) === 1,
    board: safeParseBoard(boardRow.json_data),
    updated_at: boardRow.updated_at,
    owner: getSessionUser(ownerUser),
  });
});

app.put("/api/board", requireRole("player", "dm"), (req, res) => {
  const { ownerUser, boardRow } = getBoardForRequest(req);

  if (!ownerUser) {
    return res.status(404).json({ error: "Board owner not found" });
  }

  if (!boardRow) {
    return res.status(404).json({ error: "Board not found" });
  }

  const board = sanitizeBoardPayload(req.body);
  const now = new Date().toISOString();

  db.prepare(
    `
      UPDATE boards
      SET json_data = ?,
          updated_at = ?
      WHERE id = ?
    `
  ).run(JSON.stringify(board), now, boardRow.id);

  res.json({
    ok: true,
    board_id: boardRow.id,
    updated_at: now,
    owner: getSessionUser(ownerUser),
  });
});

app.use("/uploads", express.static(path.join(__dirname, "../../uploads")));

if (fs.existsSync(CLIENT_INDEX_PATH)) {
  app.use(express.static(CLIENT_DIST_DIR));

  app.get(/^\/(?!api|uploads).*/, (_req, res) => {
    res.sendFile(CLIENT_INDEX_PATH);
  });
}

app.listen(PORT, () => {
  console.log(`FaeBook server running at http://localhost:${PORT}`);
});
