require("dotenv").config();

const express = require("express");
const cors = require("cors");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const db = require("./db");
const { createArchiveRecord, createAuditLog, getRestoreStrategy } = require("./archive");

const app = express();
const PORT = Number(process.env.PORT || 3001);
const SESSION_COOKIE_NAME = "faebook.sid";
const CLIENT_DIST_DIR = path.join(__dirname, "../client/dist");
const CLIENT_INDEX_PATH = path.join(CLIENT_DIST_DIR, "index.html");
const MAPS_CONFIG_DIR = path.join(__dirname, "../../config/maps");
const MAP_LAYER_IDS = ["overworld", "inner-ring", "outer-ring"];
const MAP_PIN_CATEGORIES = ["clue", "lead", "suspect", "danger", "meeting", "theory"];

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
    created_at: npc.created_at,
    updated_at: npc.updated_at,
  };
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
          session_recaps.session_number,
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
        ORDER BY session_recaps.published_at DESC, session_recaps.session_number DESC
        LIMIT 1
      `
    )
    .get();
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
  const rows = db
    .prepare(
      `
        SELECT *
        FROM npcs
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
      `
    )
    .get(req.params.slug);

  if (!npc) {
    return res.status(404).json({ error: "NPC not found" });
  }

  res.json(npc);
});

app.get("/api/dm/npcs/:slug/aliases", requireRole("dm"), (req, res) => {
  const npc = db
    .prepare(
      `
        SELECT id
        FROM npcs
        WHERE slug = ?
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

app.post("/api/dm/npcs/:slug/aliases", requireRole("dm"), (req, res) => {
  const npc = db
    .prepare(
      `
        SELECT id
        FROM npcs
        WHERE slug = ?
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
      `
    )
    .get(slug);

  res.json(npc);
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
  const latestRecap = getLatestRecap() || null;

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
    payload.recent_imports = [];
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

  res.json(recap);
});

app.post("/api/session-recaps", requireRole("dm"), (req, res) => {
  const sessionNumber = Number.parseInt(String(req.body.session_number), 10);
  const title = limitString(req.body.title || "Lumi’s Session Recap", 120).trim();
  const content = limitString(req.body.content, 20000).trim();

  if (!Number.isInteger(sessionNumber) || sessionNumber <= 0) {
    return res.status(400).json({ error: "session_number must be a positive integer" });
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
        WHERE session_number = ?
      `
    )
    .get(sessionNumber);

  if (existing) {
    db.prepare(
      `
        UPDATE session_recaps
        SET title = ?, content = ?, published_at = ?, published_by_user_id = ?, updated_at = ?
        WHERE id = ?
      `
    ).run(title, content, now, req.session.user.id, now, existing.id);
  } else {
    db.prepare(
      `
        INSERT INTO session_recaps (
          session_number,
          title,
          content,
          published_at,
          published_by_user_id,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `
    ).run(sessionNumber, title, content, now, req.session.user.id, now);
  }

  const latest = getLatestRecap();
  res.json(latest || null);
});

app.get("/api/npcs", requireRole("player", "dm"), (req, res) => {
  const rows = db
    .prepare(
      `
        SELECT *
        FROM npcs
        WHERE is_visible = 1
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

  const payload = rows.map((row) =>
    mapNpcForPlayer({
      ...row,
      canonical_aliases: canonicalByNpcId.get(row.id) || [],
      personal_aliases: personalByNpcId.get(row.id) || [],
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
        WHERE slug = ? AND is_visible = 1
      `
    )
    .get(req.params.slug);

  if (!npc) {
    return res.status(404).json({ error: "NPC not found" });
  }

  res.json(mapNpcForPlayer(npc));
});

app.get("/api/npcs/:slug/aliases", requireRole("player", "dm"), (req, res) => {
  const npc = db
    .prepare(
      `
        SELECT id
        FROM npcs
        WHERE slug = ? AND is_visible = 1
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

app.post("/api/npcs/:slug/aliases", requireRole("player", "dm"), (req, res) => {
  const npc = db
    .prepare(
      `
        SELECT id
        FROM npcs
        WHERE slug = ? AND is_visible = 1
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
