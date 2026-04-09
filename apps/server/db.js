const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "../../data");
const dbPath = path.join(dataDir, "faebook.db");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('dm', 'player')),
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS npcs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    house TEXT,
    faction TEXT,
    court TEXT,
    ring TEXT,
    rank_title TEXT,
    role TEXT,
    introduced_in TEXT,
    portrait_path TEXT,
    met_summary TEXT,
    short_blurb TEXT,
    is_visible INTEGER NOT NULL DEFAULT 0,
    source_file TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS npc_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    npc_id INTEGER NOT NULL,
    author_name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (npc_id) REFERENCES npcs(id)
  );

  CREATE TABLE IF NOT EXISTS board_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    json_data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS board_states (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_user_id INTEGER NOT NULL UNIQUE,
    json_data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (owner_user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_board_states_owner_user_id
  ON board_states(owner_user_id);

  CREATE TABLE IF NOT EXISTS boards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
    json_data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    archived_at TEXT,
    archived_by_user_id INTEGER,
    FOREIGN KEY (owner_user_id) REFERENCES users(id),
    FOREIGN KEY (archived_by_user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_boards_owner_active
  ON boards(owner_user_id, archived_at, updated_at DESC, id DESC);

  CREATE UNIQUE INDEX IF NOT EXISTS idx_boards_owner_default_active
  ON boards(owner_user_id)
  WHERE is_default = 1 AND archived_at IS NULL;

  CREATE TABLE IF NOT EXISTS dashboard_suspects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'unknown' CHECK (status IN ('active', 'cleared', 'unknown')),
    note TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    archived_at TEXT,
    archived_by_user_id INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (archived_by_user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_dashboard_suspects_user_sort
  ON dashboard_suspects(user_id, archived_at, sort_order, id);

  CREATE TABLE IF NOT EXISTS dashboard_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    archived_at TEXT,
    archived_by_user_id INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (archived_by_user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_dashboard_notes_user_active
  ON dashboard_notes(user_id, archived_at, updated_at);

  CREATE TABLE IF NOT EXISTS session_recaps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_number INTEGER NOT NULL UNIQUE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    published_at TEXT NOT NULL,
    published_by_user_id INTEGER NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (published_by_user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_session_recaps_published_at
  ON session_recaps(published_at DESC, session_number DESC);

  CREATE TABLE IF NOT EXISTS npc_aliases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    npc_id INTEGER NOT NULL,
    user_id INTEGER,
    alias TEXT NOT NULL,
    alias_normalized TEXT NOT NULL,
    alias_type TEXT NOT NULL CHECK (alias_type IN ('canonical', 'personal')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    archived_at TEXT,
    archived_by_user_id INTEGER,
    FOREIGN KEY (npc_id) REFERENCES npcs(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (archived_by_user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_npc_aliases_npc_active
  ON npc_aliases(npc_id, archived_at, alias_type);

  CREATE INDEX IF NOT EXISTS idx_npc_aliases_user_active
  ON npc_aliases(user_id, archived_at, alias_type);

  CREATE UNIQUE INDEX IF NOT EXISTS idx_npc_aliases_canonical_unique
  ON npc_aliases(npc_id, alias_type, alias_normalized)
  WHERE alias_type = 'canonical' AND archived_at IS NULL;

  CREATE UNIQUE INDEX IF NOT EXISTS idx_npc_aliases_personal_unique
  ON npc_aliases(npc_id, user_id, alias_type, alias_normalized)
  WHERE alias_type = 'personal' AND archived_at IS NULL;

  CREATE TABLE IF NOT EXISTS map_pins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    map_layer TEXT NOT NULL CHECK (map_layer IN ('overworld', 'inner-ring', 'outer-ring')),
    x REAL NOT NULL,
    y REAL NOT NULL,
    title TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'clue' CHECK (category IN ('clue', 'lead', 'suspect', 'danger', 'meeting', 'theory')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    archived_at TEXT,
    archived_by_user_id INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (archived_by_user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_map_pins_user_map_active
  ON map_pins(user_id, map_layer, archived_at, updated_at DESC);

  CREATE INDEX IF NOT EXISTS idx_map_pins_archived
  ON map_pins(archived_at DESC, id DESC);

  CREATE TABLE IF NOT EXISTS archive_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    object_type TEXT NOT NULL,
    object_id TEXT NOT NULL,
    owner_user_id INTEGER,
    archived_by_user_id INTEGER NOT NULL,
    archived_at TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    object_label TEXT,
    source_table TEXT,
    archive_reason TEXT,
    FOREIGN KEY (owner_user_id) REFERENCES users(id),
    FOREIGN KEY (archived_by_user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_archive_records_object_type
  ON archive_records(object_type, archived_at DESC);

  CREATE INDEX IF NOT EXISTS idx_archive_records_owner_user
  ON archive_records(owner_user_id, archived_at DESC);

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_user_id INTEGER NOT NULL,
    action_type TEXT NOT NULL,
    object_type TEXT NOT NULL,
    object_id TEXT,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (actor_user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON audit_logs(created_at DESC);

  CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type
  ON audit_logs(action_type, created_at DESC);

  CREATE TABLE IF NOT EXISTS import_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dm_user_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    result TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (dm_user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_import_logs_created_at
  ON import_logs(created_at DESC);
`);

function tableExists(tableName) {
  const row = db
    .prepare(
      `
        SELECT name
        FROM sqlite_master
        WHERE type = 'table' AND name = ?
      `
    )
    .get(tableName);

  return Boolean(row);
}

function columnExists(tableName, columnName) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  return columns.some((column) => column.name === columnName);
}

if (!columnExists("npc_notes", "author_user_id")) {
  db.exec(`
    ALTER TABLE npc_notes
    ADD COLUMN author_user_id INTEGER REFERENCES users(id)
  `);

  db.exec(`
    UPDATE npc_notes
    SET author_user_id = (
      SELECT users.id
      FROM users
      WHERE users.display_name = npc_notes.author_name
         OR users.username = LOWER(npc_notes.author_name)
      LIMIT 1
    )
    WHERE author_user_id IS NULL
  `);
}

const npcNoteDuplicateGroups = db
  .prepare(
    `
      SELECT npc_id, author_user_id
      FROM npc_notes
      WHERE author_user_id IS NOT NULL
      GROUP BY npc_id, author_user_id
      HAVING COUNT(*) > 1
    `
  )
  .all();

if (npcNoteDuplicateGroups.length > 0) {
  const selectDuplicates = db.prepare(
    `
      SELECT id
      FROM npc_notes
      WHERE npc_id = ?
        AND author_user_id = ?
      ORDER BY updated_at DESC, created_at DESC, id DESC
    `
  );

  const markLegacyDuplicate = db.prepare(
    `
      UPDATE npc_notes
      SET author_user_id = NULL,
          author_name = TRIM(author_name || ' (legacy duplicate)')
      WHERE id = ?
    `
  );

  for (const group of npcNoteDuplicateGroups) {
    const duplicates = selectDuplicates.all(group.npc_id, group.author_user_id);
    for (const duplicate of duplicates.slice(1)) {
      markLegacyDuplicate.run(duplicate.id);
    }
  }
}

db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_npc_notes_npc_author_unique
  ON npc_notes(npc_id, author_user_id)
  WHERE author_user_id IS NOT NULL
`);

if (!columnExists("session_recaps", "updated_at")) {
  db.exec(`
    ALTER TABLE session_recaps
    ADD COLUMN updated_at TEXT
  `);

  db.exec(`
    UPDATE session_recaps
    SET updated_at = COALESCE(updated_at, published_at)
  `);
}

if (tableExists("board_state")) {
  const hasNewBoards = db
    .prepare(
      `
        SELECT COUNT(*) AS count
        FROM board_states
      `
    )
    .get();

  if (Number(hasNewBoards?.count || 0) === 0) {
    const legacyBoard = db
      .prepare(
        `
          SELECT json_data, updated_at
          FROM board_state
          WHERE id = 1
        `
      )
      .get();

    const dmUser = db
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

    if (legacyBoard && dmUser) {
      db.prepare(
        `
          INSERT INTO board_states (
            owner_user_id,
            json_data,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?)
          ON CONFLICT(owner_user_id) DO NOTHING
        `
      ).run(
        dmUser.id,
        legacyBoard.json_data,
        legacyBoard.updated_at,
        legacyBoard.updated_at
      );
    }
  }
}

if (tableExists("board_states")) {
  const boardCount = db
    .prepare(
      `
        SELECT COUNT(*) AS count
        FROM boards
      `
    )
    .get();

  if (Number(boardCount?.count || 0) === 0) {
    const now = new Date().toISOString();
    const legacyRows = db
      .prepare(
        `
          SELECT owner_user_id, json_data, created_at, updated_at
          FROM board_states
          ORDER BY owner_user_id ASC
        `
      )
      .all();

    const insertBoard = db.prepare(
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
        VALUES (?, ?, 1, ?, ?, ?, NULL, NULL)
      `
    );

    const migrateTx = db.transaction(() => {
      for (const row of legacyRows) {
        insertBoard.run(
          row.owner_user_id,
          "Investigation Board",
          row.json_data,
          row.created_at || row.updated_at || now,
          row.updated_at || now
        );
      }
    });

    migrateTx();
  }
}

if (!columnExists("npcs", "raw_markdown_body")) {
  db.exec(`
    ALTER TABLE npcs
    ADD COLUMN raw_markdown_body TEXT
  `);
}

if (!columnExists("npcs", "source_file_label")) {
  db.exec(`
    ALTER TABLE npcs
    ADD COLUMN source_file_label TEXT
  `);
}

if (!columnExists("npcs", "sort_name")) {
  db.exec(`
    ALTER TABLE npcs
    ADD COLUMN sort_name TEXT
  `);
}

if (!columnExists("npcs", "last_imported_at")) {
  db.exec(`
    ALTER TABLE npcs
    ADD COLUMN last_imported_at TEXT
  `);
}

module.exports = db;
