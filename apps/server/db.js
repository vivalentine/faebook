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

module.exports = db;
