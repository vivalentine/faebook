require("dotenv").config();

const express = require("express");
const cors = require("cors");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const db = require("./db");

const app = express();
const PORT = Number(process.env.PORT || 3001);
const SESSION_COOKIE_NAME = "faebook.sid";
const CLIENT_DIST_DIR = path.join(__dirname, "../client/dist");
const CLIENT_INDEX_PATH = path.join(CLIENT_DIST_DIR, "index.html");

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
    created_at: npc.created_at,
    updated_at: npc.updated_at,
  };
}

function noteCanEdit(sessionUser, noteRow) {
  if (!sessionUser) return false;
  if (sessionUser.role === "dm") return true;
  return noteRow.author_user_id === sessionUser.id;
}

function mapNoteForClient(sessionUser, noteRow) {
  return {
    id: noteRow.id,
    author_name: noteRow.author_name,
    author_user_id: noteRow.author_user_id,
    content: noteRow.content,
    created_at: noteRow.created_at,
    updated_at: noteRow.updated_at,
    can_edit: noteCanEdit(sessionUser, noteRow),
    can_delete: noteCanEdit(sessionUser, noteRow),
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

function getOrCreateBoardState(ownerUserId) {
  const row = db
    .prepare(
      `
        SELECT json_data, updated_at
        FROM board_states
        WHERE owner_user_id = ?
      `
    )
    .get(ownerUserId);

  if (!row) {
    const defaultBoard = getDefaultBoard();
    const now = new Date().toISOString();

    db.prepare(
      `
        INSERT INTO board_states (
          owner_user_id,
          json_data,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?)
      `
    ).run(ownerUserId, JSON.stringify(defaultBoard), now, now);

    return {
      board: defaultBoard,
      updated_at: now,
    };
  }

  return {
    board: safeParseBoard(row.json_data),
    updated_at: row.updated_at,
  };
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function limitString(value, maxLength) {
  return String(value || "").slice(0, maxLength);
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
      imageUrl: kind === "npc" ? limitString(node.data?.imageUrl || "", 500) : undefined,
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

  res.json(rows);
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

app.get("/api/dm/npcs/:slug/notes", requireRole("dm"), (req, res) => {
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

  const notes = db
    .prepare(
      `
        SELECT id, author_name, author_user_id, content, created_at, updated_at
        FROM npc_notes
        WHERE npc_id = ?
        ORDER BY created_at ASC
      `
    )
    .all(npc.id);

  res.json(notes.map((note) => mapNoteForClient(req.session.user, note)));
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

app.get("/api/dm/board-users", requireRole("dm"), (_req, res) => {
  const rows = db
    .prepare(
      `
        SELECT
          users.id,
          users.username,
          users.display_name,
          users.role,
          board_states.updated_at AS board_updated_at
        FROM users
        LEFT JOIN board_states
          ON board_states.owner_user_id = users.id
        ORDER BY
          CASE WHEN users.role = 'dm' THEN 0 ELSE 1 END,
          users.display_name ASC
      `
    )
    .all();

  res.json(rows);
});

app.get("/api/npcs", requireRole("player", "dm"), (_req, res) => {
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

  res.json(rows.map(mapNpcForPlayer));
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

app.get("/api/npcs/:slug/notes", requireRole("player", "dm"), (req, res) => {
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

  const notes = db
    .prepare(
      `
        SELECT id, author_name, author_user_id, content, created_at, updated_at
        FROM npc_notes
        WHERE npc_id = ?
        ORDER BY created_at ASC
      `
    )
    .all(npc.id);

  res.json(notes.map((note) => mapNoteForClient(req.session.user, note)));
});

app.post("/api/npcs/:slug/notes", requireRole("player", "dm"), (req, res) => {
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

  const content = String(req.body.content || "").trim();

  if (!content) {
    return res.status(400).json({ error: "content is required" });
  }

  const authorUser = req.session.user;
  const authorName =
    authorUser?.display_name || authorUser?.username || "Unknown User";

  const now = new Date().toISOString();

  const result = db
    .prepare(
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
      `
    )
    .run(npc.id, authorUser.id, authorName, content, now, now);

  const note = db
    .prepare(
      `
        SELECT id, author_name, author_user_id, content, created_at, updated_at
        FROM npc_notes
        WHERE id = ?
      `
    )
    .get(result.lastInsertRowid);

  res.status(201).json(mapNoteForClient(req.session.user, note));
});

app.patch("/api/npc-notes/:id", requireRole("player", "dm"), (req, res) => {
  const noteId = Number(req.params.id);
  const content = String(req.body.content || "").trim();

  if (!content) {
    return res.status(400).json({ error: "content is required" });
  }

  const note = db
    .prepare(
      `
        SELECT
          npc_notes.id,
          npc_notes.npc_id,
          npc_notes.author_name,
          npc_notes.author_user_id,
          npc_notes.content,
          npc_notes.created_at,
          npc_notes.updated_at,
          npcs.is_visible
        FROM npc_notes
        JOIN npcs ON npcs.id = npc_notes.npc_id
        WHERE npc_notes.id = ?
      `
    )
    .get(noteId);

  if (!note) {
    return res.status(404).json({ error: "Note not found" });
  }

  if (req.session.user.role !== "dm" && !note.is_visible) {
    return res.status(404).json({ error: "Note not found" });
  }

  if (!noteCanEdit(req.session.user, note)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const now = new Date().toISOString();

  db.prepare(
    `
      UPDATE npc_notes
      SET content = ?, updated_at = ?
      WHERE id = ?
    `
  ).run(content, now, noteId);

  const updatedNote = db
    .prepare(
      `
        SELECT id, author_name, author_user_id, content, created_at, updated_at
        FROM npc_notes
        WHERE id = ?
      `
    )
    .get(noteId);

  res.json(mapNoteForClient(req.session.user, updatedNote));
});

app.delete("/api/npc-notes/:id", requireRole("player", "dm"), (req, res) => {
  const noteId = Number(req.params.id);

  const note = db
    .prepare(
      `
        SELECT
          npc_notes.id,
          npc_notes.npc_id,
          npc_notes.author_name,
          npc_notes.author_user_id,
          npc_notes.content,
          npc_notes.created_at,
          npc_notes.updated_at,
          npcs.is_visible
        FROM npc_notes
        JOIN npcs ON npcs.id = npc_notes.npc_id
        WHERE npc_notes.id = ?
      `
    )
    .get(noteId);

  if (!note) {
    return res.status(404).json({ error: "Note not found" });
  }

  if (req.session.user.role !== "dm" && !note.is_visible) {
    return res.status(404).json({ error: "Note not found" });
  }

  if (!noteCanEdit(req.session.user, note)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  db.prepare(
    `
      DELETE FROM npc_notes
      WHERE id = ?
    `
  ).run(noteId);

  res.json({ ok: true, id: noteId });
});

app.get("/api/board", requireRole("player", "dm"), (req, res) => {
  const ownerUser = getBoardOwnerForRequest(req);

  if (!ownerUser) {
    return res.status(404).json({ error: "Board owner not found" });
  }

  const data = getOrCreateBoardState(ownerUser.id);

  res.json({
    board: data.board,
    updated_at: data.updated_at,
    owner: getSessionUser(ownerUser),
  });
});

app.put("/api/board", requireRole("player", "dm"), (req, res) => {
  const ownerUser = getBoardOwnerForRequest(req);

  if (!ownerUser) {
    return res.status(404).json({ error: "Board owner not found" });
  }

  const board = sanitizeBoardPayload(req.body);
  const now = new Date().toISOString();

  db.prepare(
    `
      INSERT INTO board_states (
        owner_user_id,
        json_data,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?)
      ON CONFLICT(owner_user_id) DO UPDATE SET
        json_data = excluded.json_data,
        updated_at = excluded.updated_at
    `
  ).run(ownerUser.id, JSON.stringify(board), now, now);

  res.json({
    ok: true,
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
