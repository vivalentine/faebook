import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import type { ArchiveRecord, BoardUserSummary } from "../types";

const CONTENT_TYPE_OPTIONS = [
  { value: "", label: "All content types" },
  { value: "board", label: "Boards" },
  { value: "dashboard_suspect", label: "Dashboard suspects" },
  { value: "dashboard_note", label: "Dashboard notes" },
  { value: "npc_alias", label: "NPC aliases" },
  { value: "map_pin", label: "Map pins" },
];

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

async function readJsonResponseOrThrow(response: Response, fallbackMessage: string) {
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.toLowerCase().includes("application/json");

  if (!isJson) {
    throw new Error(
      `${fallbackMessage}: expected application/json response but received "${contentType || "unknown"}".`,
    );
  }

  const body = await response.json();
  return body;
}

export default function ArchivePage() {
  const [records, setRecords] = useState<ArchiveRecord[]>([]);
  const [users, setUsers] = useState<BoardUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actingId, setActingId] = useState<number | null>(null);

  const [objectTypeFilter, setObjectTypeFilter] = useState("");
  const [ownerUserIdFilter, setOwnerUserIdFilter] = useState("");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");

  async function loadArchive() {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();
      if (objectTypeFilter) params.set("object_type", objectTypeFilter);
      if (ownerUserIdFilter) params.set("owner_user_id", ownerUserIdFilter);
      if (dateFromFilter) params.set("date_from", `${dateFromFilter}T00:00:00.000Z`);
      if (dateToFilter) params.set("date_to", `${dateToFilter}T23:59:59.999Z`);

      const archiveResponse = await apiFetch(`/api/archive?${params.toString()}`);
      const archiveData = await readJsonResponseOrThrow(
        archiveResponse,
        "Failed to load archive records",
      );

      if (!archiveResponse.ok) {
        throw new Error(archiveData.error || "Failed to load archive records");
      }

      setRecords(Array.isArray(archiveData) ? archiveData : []);

      const usersResponse = await apiFetch("/api/users");
      const usersData = await readJsonResponseOrThrow(
        usersResponse,
        "Failed to load archive owner users",
      );
      if (usersResponse.ok && Array.isArray(usersData)) {
        setUsers(usersData);
      } else if (!usersResponse.ok) {
        throw new Error(usersData.error || "Failed to load archive owner users");
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load archive records");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadArchive();
  }, []);

  const playerUsers = useMemo(() => {
    return users
      .filter((user) => user.role === "player")
      .sort((a, b) => (a.display_name || a.username).localeCompare(b.display_name || b.username));
  }, [users]);

  async function handleRestore(record: ArchiveRecord) {
    if (!window.confirm("Restore this archived item back to active records?")) {
      return;
    }

    try {
      setActingId(record.id);
      setError("");
      const response = await apiFetch(`/api/archive/${record.id}/restore`, { method: "POST" });
      const data = await readJsonResponseOrThrow(response, "Failed to restore record");
      if (!response.ok) {
        throw new Error(data.error || "Failed to restore record");
      }

      setRecords((current) => current.filter((entry) => entry.id !== record.id));
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : "Failed to restore record");
    } finally {
      setActingId(null);
    }
  }

  async function handleHardDelete(record: ArchiveRecord) {
    if (
      !window.confirm(
        "Permanently hard delete this archive entry and source record? This cannot be undone.",
      )
    ) {
      return;
    }

    try {
      setActingId(record.id);
      setError("");
      const response = await apiFetch(`/api/archive/${record.id}`, { method: "DELETE" });
      const data = await readJsonResponseOrThrow(response, "Failed to hard delete record");
      if (!response.ok) {
        throw new Error(data.error || "Failed to hard delete record");
      }

      setRecords((current) => current.filter((entry) => entry.id !== record.id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to hard delete record");
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="main-content">
      <div className="topbar">
        <div>
          <p className="eyebrow">FaeBook</p>
          <h1>Archive</h1>
          <p className="topbar-meta">DM-only archive browser and recovery actions.</p>
        </div>
      </div>

      {error ? (
        <div className="state-card error-card small-card dashboard-error">
          <p>{error}</p>
        </div>
      ) : null}

      <section className="state-card archive-filters-card">
        <h2>Filters</h2>
        <div className="archive-filters-grid">
          <label className="toolbar-field">
            <span>Content Type</span>
            <select
              className="text-input"
              value={objectTypeFilter}
              onChange={(event) => setObjectTypeFilter(event.target.value)}
            >
              {CONTENT_TYPE_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="toolbar-field">
            <span>Owner</span>
            <select
              className="text-input"
              value={ownerUserIdFilter}
              onChange={(event) => setOwnerUserIdFilter(event.target.value)}
            >
              <option value="">All users</option>
              {playerUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.display_name || user.username}
                </option>
              ))}
            </select>
          </label>

          <label className="toolbar-field">
            <span>Archived On / After</span>
            <input
              className="text-input"
              type="date"
              value={dateFromFilter}
              onChange={(event) => setDateFromFilter(event.target.value)}
            />
          </label>

          <label className="toolbar-field">
            <span>Archived On / Before</span>
            <input
              className="text-input"
              type="date"
              value={dateToFilter}
              onChange={(event) => setDateToFilter(event.target.value)}
            />
          </label>
        </div>

        <div className="archive-filter-actions">
          <button className="action-button" type="button" disabled={loading} onClick={() => void loadArchive()}>
            {loading ? "Loading..." : "Apply Filters"}
          </button>
          <button
            className="secondary-link"
            type="button"
            disabled={loading}
            onClick={() => {
              setObjectTypeFilter("");
              setOwnerUserIdFilter("");
              setDateFromFilter("");
              setDateToFilter("");
            }}
          >
            Clear
          </button>
        </div>
      </section>

      <section className="notes-section archive-list-section">
        <div className="notes-header">
          <h2>Archived Items</h2>
          <p>Restore returns the item to active state. Hard delete permanently removes the item and archive entry.</p>
        </div>

        {loading ? (
          <div className="state-card small-card">
            <p>Loading archive records...</p>
          </div>
        ) : records.length === 0 ? (
          <div className="state-card small-card">
            <p>No archive records match your filters.</p>
          </div>
        ) : (
          <div className="archive-list">
            {records.map((record) => {
              const ownerName = record.owner_display_name || record.owner_username || "Unknown";
              const archivedBy =
                record.archived_by_display_name || record.archived_by_username || "Unknown";

              return (
                <article className="note-card archive-item" key={record.id}>
                  <div className="note-card-header">
                    <strong>{record.object_label || `${record.object_type} #${record.object_id}`}</strong>
                    <span>{formatDateTime(record.archived_at)}</span>
                  </div>

                  <p className="archive-item-meta">
                    <span>Type: {record.object_type}</span>
                    <span>Owner: {ownerName}</span>
                    <span>Archived by: {archivedBy}</span>
                    <span>Reason: {record.archive_reason || "—"}</span>
                  </p>

                  <div className="note-actions">
                    <button
                      className="action-button"
                      type="button"
                      disabled={actingId === record.id}
                      onClick={() => void handleRestore(record)}
                    >
                      {actingId === record.id ? "Working..." : "Restore"}
                    </button>

                    <button
                      className="board-node-delete-button"
                      type="button"
                      disabled={actingId === record.id}
                      onClick={() => void handleHardDelete(record)}
                    >
                      {actingId === record.id ? "Working..." : "Hard Delete"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
