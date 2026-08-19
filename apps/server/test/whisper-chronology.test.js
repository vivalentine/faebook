const test = require("node:test");
const assert = require("node:assert/strict");
const Database = require("better-sqlite3");
const { buildSummerCourtVisibilitySql } = require("../summer-court-calendar");

function createCommentDatabase() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE whisper_comments (
      id INTEGER PRIMARY KEY,
      post_id INTEGER NOT NULL,
      crown_year INTEGER,
      bloom_index INTEGER,
      petal INTEGER,
      bell INTEGER,
      chime INTEGER,
      created_at TEXT NOT NULL
    );
  `);
  return db;
}

const chronologicalOrderSql = `
  comments.crown_year ASC,
  comments.bloom_index ASC,
  comments.petal ASC,
  comments.bell ASC,
  comments.chime ASC,
  comments.created_at ASC,
  comments.id ASC
`;

test("post-detail comment ordering returns Summer Court comments earliest-first", () => {
  const db = createCommentDatabase();
  const insert = db.prepare(`
    INSERT INTO whisper_comments
      (id, post_id, crown_year, bloom_index, petal, bell, chime, created_at)
    VALUES (?, 1, 412, 4, 18, ?, ?, ?)
  `);
  insert.run(5, 15, 2, "2026-01-05T00:00:00.000Z");
  insert.run(1, 12, 18, "2026-01-01T00:00:00.000Z");
  insert.run(3, 13, 12, "2026-01-03T00:00:00.000Z");
  insert.run(2, 12, 46, "2026-01-02T00:00:00.000Z");

  const rows = db.prepare(`
    SELECT comments.id FROM whisper_comments AS comments
    WHERE comments.post_id = 1
    ORDER BY ${chronologicalOrderSql}
  `).all();

  assert.deepEqual(rows.map(({ id }) => id), [1, 2, 3, 5]);
  db.close();
});

test("post-detail ordering breaks identical campaign timestamps by created_at and ID", () => {
  const db = createCommentDatabase();
  const insert = db.prepare(`
    INSERT INTO whisper_comments
      (id, post_id, crown_year, bloom_index, petal, bell, chime, created_at)
    VALUES (?, 1, 412, 4, 18, 12, 18, ?)
  `);
  insert.run(2, "2026-01-02T00:00:00.000Z");
  insert.run(9, "2026-01-01T00:00:00.000Z");
  insert.run(3, "2026-01-01T00:00:00.000Z");

  const rows = db.prepare(`
    SELECT comments.id FROM whisper_comments AS comments
    ORDER BY ${chronologicalOrderSql}
  `).all();

  assert.deepEqual(rows.map(({ id }) => id), [3, 9, 2]);
  db.close();
});

test("campaign-time visibility still excludes future comments for players", () => {
  const db = createCommentDatabase();
  const insert = db.prepare(`
    INSERT INTO whisper_comments
      (id, post_id, crown_year, bloom_index, petal, bell, chime, created_at)
    VALUES (?, 1, 412, 4, 18, ?, 0, '2026-01-01T00:00:00.000Z')
  `);
  insert.run(1, 12);
  insert.run(2, 14);
  const campaignTime = { crown_year: 412, bloom_index: 4, petal: 18, bell: 13, chime: 0 };
  const visibilitySql = buildSummerCourtVisibilitySql("comments", campaignTime);

  const visible = db.prepare(`
    SELECT comments.id FROM whisper_comments AS comments
    WHERE ${visibilitySql}
    ORDER BY ${chronologicalOrderSql}
  `).all();

  assert.deepEqual(visible.map(({ id }) => id), [1]);
  assert.deepEqual(db.prepare("SELECT id FROM whisper_comments ORDER BY id").all().map(({ id }) => id), [1, 2], "DM query remains unfiltered");
  db.close();
});
