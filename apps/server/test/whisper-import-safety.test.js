const test = require("node:test");
const assert = require("node:assert/strict");
const Database = require("better-sqlite3");
const {
  addStagedFile,
  clearStage,
  finalizeImport,
  getStagingSummary,
} = require("../dm-whisper-import");

function createDb() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE whisper_posts (
      id INTEGER PRIMARY KEY, author_user_id INTEGER NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL,
      like_count INTEGER NOT NULL DEFAULT 0, view_count INTEGER NOT NULL DEFAULT 0,
      crown_year INTEGER, bloom_index INTEGER, petal INTEGER, bell INTEGER, chime INTEGER,
      import_key TEXT, source_label TEXT, last_imported_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE whisper_comments (
      id INTEGER PRIMARY KEY, post_id INTEGER NOT NULL, author_user_id INTEGER NOT NULL, body TEXT NOT NULL,
      crown_year INTEGER, bloom_index INTEGER, petal INTEGER, bell INTEGER, chime INTEGER,
      import_key TEXT, source_label TEXT, last_imported_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE import_logs (id INTEGER PRIMARY KEY, dm_user_id INTEGER, filename TEXT, result TEXT, message TEXT, created_at TEXT);
    CREATE UNIQUE INDEX idx_whisper_posts_import_identity_unique
      ON whisper_posts(source_label, import_key) WHERE source_label IS NOT NULL AND import_key IS NOT NULL;
    CREATE UNIQUE INDEX idx_whisper_comments_import_identity_unique
      ON whisper_comments(source_label, import_key) WHERE source_label IS NOT NULL AND import_key IS NOT NULL;
  `);
  return db;
}

function stage(dmUserId, source, title, commentBody = "A reply") {
  addStagedFile(dmUserId, {
    originalname: `${source}.json`,
    size: 1,
    buffer: Buffer.from(JSON.stringify({
      schema_version: 1,
      source_label: source,
      mode: "upsert",
      posts: [{
        post_key: "post-001",
        title,
        body: `${title} body`,
        comments: [{ comment_key: "comment-001", body: commentBody }],
      }],
    })),
  });
}

test("Whisper imports update only the matching source and key", async () => {
  const db = createDb();
  const dm = 1001;
  stage(dm, "A", "Morning rumor", "Morning reply");
  await finalizeImport(db, dm);

  stage(dm, "A", "Morning rumor revised", "Morning reply revised");
  const updatePreview = getStagingSummary(db, dm);
  assert.equal(updatePreview.files[0].posts[0].status, "update");
  assert.equal(updatePreview.files[0].posts[0].existing_title, "Morning rumor");
  await finalizeImport(db, dm);

  stage(dm, "B", "Afternoon rumor", "Afternoon reply");
  assert.equal(getStagingSummary(db, dm).files[0].posts[0].status, "create");
  await finalizeImport(db, dm);

  assert.deepEqual(
    db.prepare("SELECT source_label, title FROM whisper_posts ORDER BY source_label").all(),
    [
      { source_label: "A", title: "Morning rumor revised" },
      { source_label: "B", title: "Afternoon rumor" },
    ]
  );
  assert.deepEqual(
    db.prepare("SELECT source_label, body FROM whisper_comments ORDER BY source_label").all(),
    [
      { source_label: "A", body: "Morning reply revised" },
      { source_label: "B", body: "Afternoon reply" },
    ]
  );
  db.close();
});

test("ambiguous legacy keys block finalization without changing data", async () => {
  const db = createDb();
  const dm = 1002;
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO whisper_posts
    (author_user_id,title,body,import_key,source_label,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`)
    .run(dm, "Legacy", "Keep me", "post-001", null, now, now);
  stage(dm, "A", "Incoming");
  const preview = getStagingSummary(db, dm);
  assert.match(preview.files[0].posts[0].validation_issues.join(" "), /legacy post key/);
  await assert.rejects(() => finalizeImport(db, dm), /identity collisions/);
  assert.deepEqual(db.prepare("SELECT title, body FROM whisper_posts").all(), [{ title: "Legacy", body: "Keep me" }]);
  clearStage(dm);
  db.close();
});

test("a database error rolls back every change in a finalized import", async () => {
  const db = createDb();
  const dm = 1003;
  stage(dm, "A", "Must roll back");
  db.exec(`CREATE TRIGGER fail_comments BEFORE INSERT ON whisper_comments BEGIN SELECT RAISE(ABORT, 'forced failure'); END`);
  await assert.rejects(() => finalizeImport(db, dm), /forced failure/);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM whisper_posts").get().count, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM whisper_comments").get().count, 0);
  db.close();
});
