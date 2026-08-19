const fs = require("fs");
const path = require("path");

async function createDatabaseRecoveryPoint(db, options = {}) {
  const now = options.now || new Date();
  const rootDir = options.rootDir || path.join(__dirname, "../../backups");
  const prefix = options.prefix || "faebook-recovery";
  const backupName = `${prefix}-${now.toISOString().replace(/[:.]/g, "-")}`;
  const backupDir = path.join(rootDir, backupName);
  const backupDataDir = path.join(backupDir, "data");
  const destination = path.join(backupDataDir, "faebook.db");

  if (fs.existsSync(backupDir)) {
    throw new Error(`Recovery point ${backupName} already exists`);
  }
  fs.mkdirSync(backupDataDir, { recursive: true });
  try {
    await db.backup(destination);
    fs.writeFileSync(
      path.join(backupDir, "manifest.json"),
      JSON.stringify({
        backup_name: backupName,
        schema_version: "1.0",
        created_at: now.toISOString(),
        reason: options.reason || "database recovery point",
        created_by_user_id: options.actorUserId || null,
        includes: { database: true },
      }, null, 2),
      "utf8"
    );
  } catch (error) {
    fs.rmSync(backupDir, { recursive: true, force: true });
    throw error;
  }

  return { name: backupName, path: backupDir, createdAt: now.toISOString() };
}

module.exports = { createDatabaseRecoveryPoint };
