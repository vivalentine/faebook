const { buildSnippetPayload, getQueryTerms } = require("./search-snippets");

const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 100;
const MIN_QUERY_LENGTH = 2;
const SOURCE_FETCH_MULTIPLIER = 4;
const MAX_SOURCE_FETCH_LIMIT = 300;

function toSearchPattern(value) {
  return `%${String(value || "")
    .trim()
    .toLowerCase()}%`;
}

function parsePagination(rawLimit, rawOffset) {
  const limit = Math.min(Math.max(Number.parseInt(String(rawLimit || DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(Number.parseInt(String(rawOffset || 0), 10) || 0, 0);
  return { limit, offset };
}

function getSourceFetchLimit(limit, offset) {
  return Math.min(Math.max((offset + limit) * SOURCE_FETCH_MULTIPLIER, limit), MAX_SOURCE_FETCH_LIMIT);
}

function scoreResult(result, queryLower) {
  const title = String(result.title || "").toLowerCase();
  const snippet = String(result.snippet || "").toLowerCase();
  const startsWith = title.startsWith(queryLower) ? 2 : 0;
  const containsTitle = title.includes(queryLower) ? 2 : 0;
  const containsSnippet = snippet.includes(queryLower) ? 1 : 0;
  return startsWith + containsTitle + containsSnippet;
}

function rankResults(results, query) {
  const queryLower = query.toLowerCase();
  return results
    .map((result) => ({ ...result, score: scoreResult(result, queryLower) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        String(a.label).localeCompare(String(b.label)) ||
        String(a.title).localeCompare(String(b.title)) ||
        String(a.type).localeCompare(String(b.type)) ||
        Number(a.id) - Number(b.id)
    )
    .map(({ score, ...rest }) => rest);
}

function paginateResults(results, limit, offset) {
  const total = results.length;
  const paginated = results.slice(offset, offset + limit);
  return {
    results: paginated,
    total,
    has_more: offset + limit < total,
  };
}

function withSnippet(result, query, snippetSource) {
  const snippetPayload = buildSnippetPayload({
    query,
    sourceText: snippetSource,
  });

  return {
    ...result,
    snippet: snippetPayload.excerpt,
    snippet_payload: snippetPayload,
  };
}

function searchForDm({ db, query, searchPattern, sourceLimit }) {
  const results = [];

  const npcRows = db
    .prepare(
      `
        SELECT id, slug, name, rank_title, house, faction, court, ring, is_visible
        FROM npcs
        WHERE
          LOWER(name) LIKE ?
          OR LOWER(COALESCE(rank_title, '')) LIKE ?
          OR LOWER(COALESCE(house, '')) LIKE ?
          OR LOWER(COALESCE(faction, '')) LIKE ?
          OR LOWER(COALESCE(court, '')) LIKE ?
          OR LOWER(COALESCE(ring, '')) LIKE ?
        ORDER BY name COLLATE NOCASE ASC
        LIMIT ?
      `
    )
    .all(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, sourceLimit);

  for (const row of npcRows) {
    results.push(
      withSnippet(
        {
          type: "npc",
          label: "NPC",
          id: row.id,
          title: row.name,
          url: `/directory/${row.slug}`,
          metadata: {
            slug: row.slug,
            visibility: Number(row.is_visible) === 1 ? "visible" : "hidden",
          },
        },
        query,
        [row.rank_title, row.house, row.faction, row.court, row.ring].filter(Boolean).join(" • ")
      )
    );
  }

  const canonicalAliasRows = db
    .prepare(
      `
        SELECT npc_aliases.id, npc_aliases.alias, npcs.slug, npcs.name
        FROM npc_aliases
        INNER JOIN npcs ON npcs.id = npc_aliases.npc_id
        WHERE npc_aliases.alias_type = 'canonical'
          AND npc_aliases.archived_at IS NULL
          AND LOWER(npc_aliases.alias) LIKE ?
        ORDER BY npc_aliases.updated_at DESC, npc_aliases.id DESC
        LIMIT ?
      `
    )
    .all(searchPattern, sourceLimit);

  for (const row of canonicalAliasRows) {
    results.push(
      withSnippet(
        {
          type: "canonical_alias",
          label: "Canonical Alias",
          id: row.id,
          title: row.alias,
          url: `/directory/${row.slug}`,
          metadata: { npc_name: row.name, npc_slug: row.slug },
        },
        query,
        `NPC: ${row.name}`
      )
    );
  }

  const personalAliasRows = db
    .prepare(
      `
        SELECT npc_aliases.id, npc_aliases.alias, npcs.slug, npcs.name AS npc_name,
          users.display_name AS owner_display_name, users.username AS owner_username
        FROM npc_aliases
        INNER JOIN npcs ON npcs.id = npc_aliases.npc_id
        INNER JOIN users ON users.id = npc_aliases.user_id
        WHERE npc_aliases.alias_type = 'personal'
          AND npc_aliases.archived_at IS NULL
          AND LOWER(npc_aliases.alias) LIKE ?
        ORDER BY npc_aliases.updated_at DESC, npc_aliases.id DESC
        LIMIT ?
      `
    )
    .all(searchPattern, sourceLimit);

  for (const row of personalAliasRows) {
    const ownerName = row.owner_display_name || row.owner_username;
    results.push(
      withSnippet(
        {
          type: "personal_alias",
          label: "Personal Alias",
          id: row.id,
          title: row.alias,
          url: `/directory/${row.slug}`,
          metadata: {
            npc_name: row.npc_name,
            npc_slug: row.slug,
            owner_display_name: row.owner_display_name || null,
            owner_username: row.owner_username || null,
          },
        },
        query,
        `${ownerName} • NPC: ${row.npc_name}`
      )
    );
  }

  const npcNoteRows = db
    .prepare(
      `
        SELECT npc_notes.id, npc_notes.content, npcs.slug, npcs.name AS npc_name,
          users.display_name AS author_display_name, users.username AS author_username
        FROM npc_notes
        INNER JOIN npcs ON npcs.id = npc_notes.npc_id
        INNER JOIN users ON users.id = npc_notes.author_user_id
        WHERE LOWER(npc_notes.content) LIKE ?
        ORDER BY npc_notes.updated_at DESC, npc_notes.id DESC
        LIMIT ?
      `
    )
    .all(searchPattern, sourceLimit);

  for (const row of npcNoteRows) {
    const authorName = row.author_display_name || row.author_username;
    results.push(
      withSnippet(
        {
          type: "npc_note",
          label: "Private NPC Note",
          id: row.id,
          title: `Note on ${row.npc_name}`,
          url: `/directory/${row.slug}`,
          metadata: {
            npc_name: row.npc_name,
            npc_slug: row.slug,
            author_display_name: row.author_display_name || null,
            author_username: row.author_username || null,
          },
        },
        query,
        `${authorName}: ${row.content}`
      )
    );
  }

  const suspectRows = db
    .prepare(
      `
        SELECT dashboard_suspects.id, dashboard_suspects.name, dashboard_suspects.status, dashboard_suspects.note,
          users.display_name AS owner_display_name, users.username AS owner_username
        FROM dashboard_suspects
        INNER JOIN users ON users.id = dashboard_suspects.user_id
        WHERE dashboard_suspects.archived_at IS NULL
          AND (
            LOWER(dashboard_suspects.name) LIKE ?
            OR LOWER(COALESCE(dashboard_suspects.status, '')) LIKE ?
            OR LOWER(COALESCE(dashboard_suspects.note, '')) LIKE ?
          )
        ORDER BY dashboard_suspects.updated_at DESC, dashboard_suspects.id DESC
        LIMIT ?
      `
    )
    .all(searchPattern, searchPattern, searchPattern, sourceLimit);

  for (const row of suspectRows) {
    const ownerName = row.owner_display_name || row.owner_username;
    results.push(
      withSnippet(
        {
          type: "dashboard_suspect",
          label: "Dashboard Suspect",
          id: row.id,
          title: row.name,
          url: "/",
          metadata: {
            status: row.status,
            owner_display_name: row.owner_display_name || null,
            owner_username: row.owner_username || null,
          },
        },
        query,
        `${ownerName} • ${row.status}${row.note ? ` • ${row.note}` : ""}`
      )
    );
  }

  const dashboardNoteRows = db
    .prepare(
      `
        SELECT dashboard_notes.id, dashboard_notes.content,
          users.display_name AS owner_display_name, users.username AS owner_username
        FROM dashboard_notes
        INNER JOIN users ON users.id = dashboard_notes.user_id
        WHERE dashboard_notes.archived_at IS NULL
          AND LOWER(dashboard_notes.content) LIKE ?
        ORDER BY dashboard_notes.updated_at DESC, dashboard_notes.id DESC
        LIMIT ?
      `
    )
    .all(searchPattern, sourceLimit);

  for (const row of dashboardNoteRows) {
    const ownerName = row.owner_display_name || row.owner_username;
    results.push(
      withSnippet(
        {
          type: "dashboard_note",
          label: "Dashboard Note",
          id: row.id,
          title: `Personal note • ${ownerName}`,
          url: "/",
          metadata: {
            owner_display_name: row.owner_display_name || null,
            owner_username: row.owner_username || null,
          },
        },
        query,
        row.content
      )
    );
  }

  const mapPinRows = db
    .prepare(
      `
        SELECT map_pins.id, map_pins.title, map_pins.note, map_pins.category, map_pins.map_layer,
          users.display_name AS owner_display_name, users.username AS owner_username
        FROM map_pins
        INNER JOIN users ON users.id = map_pins.user_id
        WHERE map_pins.archived_at IS NULL
          AND (
            LOWER(map_pins.title) LIKE ?
            OR LOWER(COALESCE(map_pins.note, '')) LIKE ?
            OR LOWER(COALESCE(map_pins.category, '')) LIKE ?
            OR LOWER(COALESCE(map_pins.map_layer, '')) LIKE ?
          )
        ORDER BY map_pins.updated_at DESC, map_pins.id DESC
        LIMIT ?
      `
    )
    .all(searchPattern, searchPattern, searchPattern, searchPattern, sourceLimit);

  for (const row of mapPinRows) {
    const ownerName = row.owner_display_name || row.owner_username;
    results.push(
      withSnippet(
        {
          type: "map_pin",
          label: "Map Pin",
          id: row.id,
          title: row.title,
          url: "/maps",
          metadata: {
            map_layer: row.map_layer,
            category: row.category,
            owner_display_name: row.owner_display_name || null,
            owner_username: row.owner_username || null,
          },
        },
        query,
        `${ownerName} • ${row.map_layer} • ${row.category}${row.note ? ` • ${row.note}` : ""}`
      )
    );
  }

  const recapRows = db
    .prepare(
      `
        SELECT id, session_number, title, content, published_at
        FROM session_recaps
        WHERE LOWER(title) LIKE ? OR LOWER(content) LIKE ?
        ORDER BY published_at DESC, session_number DESC
        LIMIT ?
      `
    )
    .all(searchPattern, searchPattern, sourceLimit);

  for (const row of recapRows) {
    results.push(
      withSnippet(
        {
          type: "session_recap",
          label: "Session Recap",
          id: row.id,
          title: row.title,
          url: "/",
          metadata: { session_number: row.session_number, published_at: row.published_at },
        },
        query,
        `Session ${row.session_number} • ${row.content}`
      )
    );
  }

  const importLogRows = db
    .prepare(
      `
        SELECT id, filename, result, message, created_at
        FROM import_logs
        WHERE LOWER(filename) LIKE ? OR LOWER(message) LIKE ? OR LOWER(result) LIKE ?
        ORDER BY created_at DESC, id DESC
        LIMIT ?
      `
    )
    .all(searchPattern, searchPattern, searchPattern, sourceLimit);

  for (const row of importLogRows) {
    results.push(
      withSnippet(
        {
          type: "import_log",
          label: "Import Log",
          id: row.id,
          title: row.filename,
          url: "/dm-tools",
          metadata: { result: row.result, created_at: row.created_at },
        },
        query,
        `${row.result} • ${row.message}`
      )
    );
  }

  const archiveRows = db
    .prepare(
      `
        SELECT archive_records.id, archive_records.object_type, archive_records.object_id,
          archive_records.object_label, archive_records.archive_reason, archive_records.archived_at,
          owner.display_name AS owner_display_name, owner.username AS owner_username
        FROM archive_records
        LEFT JOIN users AS owner ON owner.id = archive_records.owner_user_id
        WHERE LOWER(COALESCE(archive_records.object_type, '')) LIKE ?
          OR LOWER(COALESCE(archive_records.object_id, '')) LIKE ?
          OR LOWER(COALESCE(archive_records.object_label, '')) LIKE ?
          OR LOWER(COALESCE(archive_records.archive_reason, '')) LIKE ?
        ORDER BY archive_records.archived_at DESC, archive_records.id DESC
        LIMIT ?
      `
    )
    .all(searchPattern, searchPattern, searchPattern, searchPattern, sourceLimit);

  for (const row of archiveRows) {
    const ownerName = row.owner_display_name || row.owner_username || "no owner";
    results.push(
      withSnippet(
        {
          type: "archive_record",
          label: "Archive Record",
          id: row.id,
          title: row.object_label || `${row.object_type} #${row.object_id}`,
          url: "/archive",
          metadata: {
            object_type: row.object_type,
            object_id: row.object_id,
            archived_at: row.archived_at,
            owner_display_name: row.owner_display_name || null,
            owner_username: row.owner_username || null,
          },
        },
        query,
        `${row.object_type} • ${ownerName}${row.archive_reason ? ` • ${row.archive_reason}` : ""}`
      )
    );
  }

  return results;
}

function searchForPlayer({ db, sessionUserId, query, searchPattern, sourceLimit }) {
  const results = [];

  const npcRows = db
    .prepare(
      `
        SELECT id, slug, name, rank_title, house, faction, court, ring
        FROM npcs
        WHERE is_visible = 1
          AND (
            LOWER(name) LIKE ? OR LOWER(COALESCE(rank_title, '')) LIKE ? OR LOWER(COALESCE(house, '')) LIKE ?
            OR LOWER(COALESCE(faction, '')) LIKE ? OR LOWER(COALESCE(court, '')) LIKE ? OR LOWER(COALESCE(ring, '')) LIKE ?
          )
        ORDER BY name COLLATE NOCASE ASC
        LIMIT ?
      `
    )
    .all(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, sourceLimit);

  for (const row of npcRows) {
    results.push(
      withSnippet(
        {
          type: "npc",
          label: "NPC",
          id: row.id,
          title: row.name,
          url: `/directory/${row.slug}`,
          metadata: { slug: row.slug, visibility: "visible" },
        },
        query,
        [row.rank_title, row.house, row.faction, row.court, row.ring].filter(Boolean).join(" • ")
      )
    );
  }

  const canonicalAliasRows = db
    .prepare(
      `
        SELECT npc_aliases.id, npc_aliases.alias, npcs.slug, npcs.name
        FROM npc_aliases
        INNER JOIN npcs ON npcs.id = npc_aliases.npc_id
        WHERE npc_aliases.alias_type = 'canonical'
          AND npc_aliases.archived_at IS NULL
          AND npcs.is_visible = 1
          AND LOWER(npc_aliases.alias) LIKE ?
        ORDER BY npc_aliases.updated_at DESC, npc_aliases.id DESC
        LIMIT ?
      `
    )
    .all(searchPattern, sourceLimit);

  for (const row of canonicalAliasRows) {
    results.push(
      withSnippet(
        {
          type: "canonical_alias",
          label: "Canonical Alias",
          id: row.id,
          title: row.alias,
          url: `/directory/${row.slug}`,
          metadata: { npc_name: row.name, npc_slug: row.slug },
        },
        query,
        `NPC: ${row.name}`
      )
    );
  }

  const personalAliasRows = db
    .prepare(
      `
        SELECT npc_aliases.id, npc_aliases.alias, npcs.slug, npcs.name
        FROM npc_aliases
        INNER JOIN npcs ON npcs.id = npc_aliases.npc_id
        WHERE npc_aliases.alias_type = 'personal'
          AND npc_aliases.archived_at IS NULL
          AND npcs.is_visible = 1
          AND npc_aliases.user_id = ?
          AND LOWER(npc_aliases.alias) LIKE ?
        ORDER BY npc_aliases.updated_at DESC, npc_aliases.id DESC
        LIMIT ?
      `
    )
    .all(sessionUserId, searchPattern, sourceLimit);

  for (const row of personalAliasRows) {
    results.push(
      withSnippet(
        {
          type: "personal_alias",
          label: "My Personal Alias",
          id: row.id,
          title: row.alias,
          url: `/directory/${row.slug}`,
          metadata: { npc_name: row.name, npc_slug: row.slug },
        },
        query,
        `NPC: ${row.name}`
      )
    );
  }

  const npcNoteRows = db
    .prepare(
      `
        SELECT npc_notes.id, npc_notes.content, npcs.slug, npcs.name AS npc_name
        FROM npc_notes
        INNER JOIN npcs ON npcs.id = npc_notes.npc_id
        WHERE npc_notes.author_user_id = ?
          AND npcs.is_visible = 1
          AND LOWER(npc_notes.content) LIKE ?
        ORDER BY npc_notes.updated_at DESC, npc_notes.id DESC
        LIMIT ?
      `
    )
    .all(sessionUserId, searchPattern, sourceLimit);

  for (const row of npcNoteRows) {
    results.push(
      withSnippet(
        {
          type: "npc_note",
          label: "My Private NPC Note",
          id: row.id,
          title: `Note on ${row.npc_name}`,
          url: `/directory/${row.slug}`,
          metadata: { npc_name: row.npc_name, npc_slug: row.slug },
        },
        query,
        row.content
      )
    );
  }

  const suspectRows = db
    .prepare(
      `
        SELECT id, name, status, note
        FROM dashboard_suspects
        WHERE user_id = ?
          AND archived_at IS NULL
          AND (LOWER(name) LIKE ? OR LOWER(COALESCE(status, '')) LIKE ? OR LOWER(COALESCE(note, '')) LIKE ?)
        ORDER BY updated_at DESC, id DESC
        LIMIT ?
      `
    )
    .all(sessionUserId, searchPattern, searchPattern, searchPattern, sourceLimit);

  for (const row of suspectRows) {
    results.push(
      withSnippet(
        {
          type: "dashboard_suspect",
          label: "My Dashboard Suspect",
          id: row.id,
          title: row.name,
          url: "/",
          metadata: { status: row.status },
        },
        query,
        `${row.status}${row.note ? ` • ${row.note}` : ""}`
      )
    );
  }

  const dashboardNoteRows = db
    .prepare(
      `
        SELECT id, content
        FROM dashboard_notes
        WHERE user_id = ? AND archived_at IS NULL AND LOWER(content) LIKE ?
        ORDER BY updated_at DESC, id DESC
        LIMIT ?
      `
    )
    .all(sessionUserId, searchPattern, sourceLimit);

  for (const row of dashboardNoteRows) {
    results.push(
      withSnippet(
        {
          type: "dashboard_note",
          label: "My Dashboard Note",
          id: row.id,
          title: "Personal note",
          url: "/",
        },
        query,
        row.content
      )
    );
  }

  const mapPinRows = db
    .prepare(
      `
        SELECT id, title, note, category, map_layer
        FROM map_pins
        WHERE user_id = ?
          AND archived_at IS NULL
          AND (
            LOWER(title) LIKE ? OR LOWER(COALESCE(note, '')) LIKE ?
            OR LOWER(COALESCE(category, '')) LIKE ? OR LOWER(COALESCE(map_layer, '')) LIKE ?
          )
        ORDER BY updated_at DESC, id DESC
        LIMIT ?
      `
    )
    .all(sessionUserId, searchPattern, searchPattern, searchPattern, searchPattern, sourceLimit);

  for (const row of mapPinRows) {
    results.push(
      withSnippet(
        {
          type: "map_pin",
          label: "My Map Pin",
          id: row.id,
          title: row.title,
          url: "/maps",
          metadata: { map_layer: row.map_layer, category: row.category },
        },
        query,
        `${row.map_layer} • ${row.category}${row.note ? ` • ${row.note}` : ""}`
      )
    );
  }

  const recapRows = db
    .prepare(
      `
        SELECT id, session_number, title, content, published_at
        FROM session_recaps
        WHERE LOWER(title) LIKE ? OR LOWER(content) LIKE ?
        ORDER BY published_at DESC, session_number DESC
        LIMIT ?
      `
    )
    .all(searchPattern, searchPattern, sourceLimit);

  for (const row of recapRows) {
    results.push(
      withSnippet(
        {
          type: "session_recap",
          label: "Session Recap",
          id: row.id,
          title: row.title,
          url: "/",
          metadata: { session_number: row.session_number, published_at: row.published_at },
        },
        query,
        `Session ${row.session_number} • ${row.content}`
      )
    );
  }

  return results;
}

function runGlobalSearch({ db, sessionUser, rawQuery, rawLimit, rawOffset }) {
  const query = String(rawQuery || "").trim();
  const { limit, offset } = parsePagination(rawLimit, rawOffset);

  if (query.length < MIN_QUERY_LENGTH) {
    return {
      query,
      limit,
      offset,
      total: 0,
      has_more: false,
      results: [],
    };
  }

  const searchPattern = toSearchPattern(query);
  const sourceLimit = getSourceFetchLimit(limit, offset);

  const baseResults =
    sessionUser.role === "dm"
      ? searchForDm({ db, query, searchPattern, sourceLimit })
      : searchForPlayer({ db, sessionUserId: sessionUser.id, query, searchPattern, sourceLimit });

  const rankedResults = rankResults(baseResults, query);
  const paged = paginateResults(rankedResults, limit, offset);

  return {
    query,
    limit,
    offset,
    total: paged.total,
    has_more: paged.has_more,
    query_terms: getQueryTerms(query),
    results: paged.results,
  };
}

module.exports = {
  runGlobalSearch,
  parsePagination,
  MAX_LIMIT,
  DEFAULT_LIMIT,
};
