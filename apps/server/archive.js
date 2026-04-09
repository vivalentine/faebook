function limitString(value, maxLength) {
  return String(value || "").slice(0, maxLength);
}

function serializePayload(payload) {
  return JSON.stringify(payload || {});
}

function parsePayload(value) {
  if (!value) return {};

  try {
    return JSON.parse(value);
  } catch (_error) {
    return {};
  }
}

function clearActiveBoardDefaults(db, ownerUserId, now, exceptBoardId = null) {
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

function setSingleDefaultBoardForOwner(db, ownerUserId, boardId, now) {
  clearActiveBoardDefaults(db, ownerUserId, now, boardId);
  db.prepare(
    `
      UPDATE boards
      SET is_default = 1,
          updated_at = ?
      WHERE owner_user_id = ?
        AND id = ?
        AND archived_at IS NULL
    `
  ).run(now, ownerUserId, boardId);
}

function createAuditLog(db, { actorUserId, actionType, objectType, objectId, message, createdAt }) {
  const now = createdAt || new Date().toISOString();
  db.prepare(
    `
      INSERT INTO audit_logs (
        actor_user_id,
        action_type,
        object_type,
        object_id,
        message,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `
  ).run(actorUserId, actionType, objectType, objectId ? String(objectId) : null, message, now);
}

function createArchiveRecord(db, {
  objectType,
  objectId,
  ownerUserId,
  archivedByUserId,
  archivedAt,
  payload,
  objectLabel,
  sourceTable,
  archiveReason,
}) {
  const now = archivedAt || new Date().toISOString();

  const result = db.prepare(
    `
      INSERT INTO archive_records (
        object_type,
        object_id,
        owner_user_id,
        archived_by_user_id,
        archived_at,
        payload_json,
        object_label,
        source_table,
        archive_reason
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    objectType,
    String(objectId),
    ownerUserId || null,
    archivedByUserId,
    now,
    serializePayload(payload),
    objectLabel ? limitString(objectLabel, 160) : null,
    sourceTable || null,
    archiveReason || null
  );

  return {
    id: Number(result.lastInsertRowid),
    archived_at: now,
  };
}

const RESTORE_STRATEGIES = {
  board: {
    tableName: "boards",
    objectType: "board",
    restoreRow(db, archiveRecord, now) {
      const objectId = Number(archiveRecord.object_id);
      const existing = db
        .prepare(
          `
            SELECT *
            FROM boards
            WHERE id = ?
          `
        )
        .get(objectId);

      if (existing) {
        db.prepare(
          `
            UPDATE boards
            SET archived_at = NULL,
                archived_by_user_id = NULL,
                updated_at = ?
            WHERE id = ?
          `
        ).run(now, objectId);
      } else {
        const payload = parsePayload(archiveRecord.payload_json);
        const row = payload.row || {};

        db.prepare(
          `
            INSERT INTO boards (
              id,
              owner_user_id,
              name,
              is_default,
              json_data,
              created_at,
              updated_at,
              archived_at,
              archived_by_user_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)
          `
        ).run(
          objectId,
          row.owner_user_id,
          row.name || "Restored Board",
          row.is_default ? 1 : 0,
          row.json_data || "{\"nodes\":[],\"edges\":[],\"viewport\":{\"x\":0,\"y\":0,\"zoom\":1}}",
          row.created_at || now,
          now
        );
      }

      const rowAfter = db
        .prepare(
          `
            SELECT id, owner_user_id
            FROM boards
            WHERE id = ?
          `
        )
        .get(objectId);

      setSingleDefaultBoardForOwner(db, rowAfter.owner_user_id, objectId, now);

      return objectId;
    },
  },
  dashboard_suspect: {
    tableName: "dashboard_suspects",
    objectType: "dashboard_suspect",
    restoreRow(db, archiveRecord, now) {
      const objectId = Number(archiveRecord.object_id);
      const existing = db
        .prepare(
          `
            SELECT *
            FROM dashboard_suspects
            WHERE id = ?
          `
        )
        .get(objectId);

      if (existing) {
        db.prepare(
          `
            UPDATE dashboard_suspects
            SET archived_at = NULL,
                archived_by_user_id = NULL,
                updated_at = ?
            WHERE id = ?
          `
        ).run(now, objectId);
        return objectId;
      }

      const payload = parsePayload(archiveRecord.payload_json);
      const row = payload.row || {};
      db.prepare(
        `
          INSERT INTO dashboard_suspects (
            id,
            user_id,
            name,
            status,
            note,
            sort_order,
            created_at,
            updated_at,
            archived_at,
            archived_by_user_id
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)
        `
      ).run(
        objectId,
        row.user_id,
        row.name,
        row.status,
        row.note,
        row.sort_order,
        row.created_at || now,
        now
      );

      return objectId;
    },
  },
  dashboard_note: {
    tableName: "dashboard_notes",
    objectType: "dashboard_note",
    restoreRow(db, archiveRecord, now) {
      const objectId = Number(archiveRecord.object_id);
      const existing = db
        .prepare(
          `
            SELECT *
            FROM dashboard_notes
            WHERE id = ?
          `
        )
        .get(objectId);

      if (existing) {
        db.prepare(
          `
            UPDATE dashboard_notes
            SET archived_at = NULL,
                archived_by_user_id = NULL,
                updated_at = ?
            WHERE id = ?
          `
        ).run(now, objectId);
        return objectId;
      }

      const payload = parsePayload(archiveRecord.payload_json);
      const row = payload.row || {};
      db.prepare(
        `
          INSERT INTO dashboard_notes (
            id,
            user_id,
            content,
            created_at,
            updated_at,
            archived_at,
            archived_by_user_id
          )
          VALUES (?, ?, ?, ?, ?, NULL, NULL)
        `
      ).run(objectId, row.user_id, row.content || "", row.created_at || now, now);

      return objectId;
    },
  },
  npc_alias: {
    tableName: "npc_aliases",
    objectType: "npc_alias",
    restoreRow(db, archiveRecord, now) {
      const objectId = Number(archiveRecord.object_id);
      const existing = db
        .prepare(
          `
            SELECT *
            FROM npc_aliases
            WHERE id = ?
          `
        )
        .get(objectId);

      if (existing) {
        db.prepare(
          `
            UPDATE npc_aliases
            SET archived_at = NULL,
                archived_by_user_id = NULL,
                updated_at = ?
            WHERE id = ?
          `
        ).run(now, objectId);
        return objectId;
      }

      const payload = parsePayload(archiveRecord.payload_json);
      const row = payload.row || {};
      db.prepare(
        `
          INSERT INTO npc_aliases (
            id,
            npc_id,
            user_id,
            alias,
            alias_normalized,
            alias_type,
            created_at,
            updated_at,
            archived_at,
            archived_by_user_id
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)
        `
      ).run(
        objectId,
        row.npc_id,
        row.user_id || null,
        row.alias,
        row.alias_normalized,
        row.alias_type,
        row.created_at || now,
        now
      );

      return objectId;
    },
  },
};

function getRestoreStrategy(objectType) {
  return RESTORE_STRATEGIES[objectType] || null;
}

module.exports = {
  createArchiveRecord,
  createAuditLog,
  getRestoreStrategy,
};
