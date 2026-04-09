import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api";
import type { DashboardData, DashboardSuspect } from "../types";

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

const SUSPECT_STATUSES: DashboardSuspect["status"][] = ["active", "unknown", "cleared"];

export default function HomePage() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newSuspectName, setNewSuspectName] = useState("");
  const [newSuspectNote, setNewSuspectNote] = useState("");
  const [addingSuspect, setAddingSuspect] = useState(false);

  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteStatus, setNoteStatus] = useState("");

  const [recapSessionNumber, setRecapSessionNumber] = useState("");
  const [recapContent, setRecapContent] = useState("");
  const [savingRecap, setSavingRecap] = useState(false);

  async function loadDashboard() {
    setLoading(true);
    setError("");

    try {
      const response = await apiFetch("/api/dashboard");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load dashboard");
      }

      setDashboard(data);
      setNoteDraft(data.personal_note?.content || "");
      setRecapSessionNumber(String(data.latest_recap?.session_number || ""));
      setRecapContent(data.latest_recap?.content || "");
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load dashboard");
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const sortedSuspects = useMemo(() => {
    return [...(dashboard?.suspects || [])].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  }, [dashboard?.suspects]);

  async function addSuspect() {
    if (!newSuspectName.trim()) {
      return;
    }

    try {
      setAddingSuspect(true);
      const response = await apiFetch("/api/dashboard/suspects", {
        method: "POST",
        body: JSON.stringify({
          name: newSuspectName,
          note: newSuspectNote,
          status: "unknown",
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to add suspect");
      }

      setDashboard((current) =>
        current
          ? {
              ...current,
              suspects: [...current.suspects, data],
            }
          : current,
      );
      setNewSuspectName("");
      setNewSuspectNote("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to add suspect");
    } finally {
      setAddingSuspect(false);
    }
  }

  async function updateSuspect(suspectId: number, patch: Partial<DashboardSuspect>) {
    try {
      const response = await apiFetch(`/api/dashboard/suspects/${suspectId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save suspect");
      }

      setDashboard((current) =>
        current
          ? {
              ...current,
              suspects: current.suspects.map((suspect) =>
                suspect.id === suspectId ? data : suspect,
              ),
            }
          : current,
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save suspect");
    }
  }

  async function archiveSuspect(suspectId: number) {
    try {
      const response = await apiFetch(`/api/dashboard/suspects/${suspectId}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to archive suspect");
      }

      setDashboard((current) =>
        current
          ? {
              ...current,
              suspects: current.suspects.filter((suspect) => suspect.id !== suspectId),
            }
          : current,
      );
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Failed to archive suspect");
    }
  }

  async function moveSuspect(suspect: DashboardSuspect, direction: "up" | "down") {
    const list = sortedSuspects;
    const index = list.findIndex((item) => item.id === suspect.id);
    if (index === -1) {
      return;
    }

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) {
      return;
    }

    const target = list[targetIndex];
    await Promise.all([
      updateSuspect(suspect.id, { sort_order: target.sort_order }),
      updateSuspect(target.id, { sort_order: suspect.sort_order }),
    ]);
  }

  async function saveNotes() {
    try {
      setNoteSaving(true);
      setNoteStatus("");
      const response = await apiFetch("/api/dashboard/notes", {
        method: "PUT",
        body: JSON.stringify({
          content: noteDraft,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save personal notes");
      }

      setDashboard((current) =>
        current
          ? {
              ...current,
              personal_note: data,
            }
          : current,
      );
      setNoteStatus("Saved");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save personal notes");
    } finally {
      setNoteSaving(false);
    }
  }

  async function archivePersonalNote() {
    if (!dashboard?.personal_note) {
      return;
    }

    if (!window.confirm("Archive your active personal note?")) {
      return;
    }

    try {
      setNoteSaving(true);
      setNoteStatus("");

      const response = await apiFetch(`/api/dashboard/notes/${dashboard.personal_note.id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to archive personal note");
      }

      setDashboard((current) =>
        current
          ? {
              ...current,
              personal_note: null,
            }
          : current,
      );
      setNoteDraft("");
      setNoteStatus("Archived");
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Failed to archive personal note");
    } finally {
      setNoteSaving(false);
    }
  }

  async function saveRecap() {
    if (!user || user.role !== "dm") {
      return;
    }

    try {
      setSavingRecap(true);
      const response = await apiFetch("/api/session-recaps", {
        method: "POST",
        body: JSON.stringify({
          session_number: Number.parseInt(recapSessionNumber, 10),
          title: "Lumi’s Session Recap",
          content: recapContent,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to publish recap");
      }

      setDashboard((current) =>
        current
          ? {
              ...current,
              latest_recap: data,
            }
          : current,
      );
    } catch (recapError) {
      setError(recapError instanceof Error ? recapError.message : "Failed to publish recap");
    } finally {
      setSavingRecap(false);
    }
  }

  if (loading) {
    return (
      <div className="main-content">
        <div className="state-card">
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="main-content">
        <div className="state-card error-card">
          <p>{error || "Dashboard unavailable."}</p>
          <button className="action-button" type="button" onClick={() => void loadDashboard()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content dashboard-shell">
      <div className="topbar">
        <div>
          <h1>Home</h1>
          <p className="topbar-meta">Welcome back, {user?.display_name || user?.username}.</p>
        </div>
      </div>

      {error ? (
        <div className="state-card error-card small-card dashboard-error">
          <p>{error}</p>
        </div>
      ) : null}

      <section className="dashboard-grid">
        <article className="state-card dashboard-card dashboard-quick-actions">
          <h2>Continue</h2>
          <div className="dashboard-pill-links">
            <Link className="secondary-link" to={dashboard.quick_links.board}>
              Continue to Board
            </Link>
            <Link className="secondary-link" to={dashboard.quick_links.maps}>
              Continue to Maps
            </Link>
          </div>
        </article>

        <article className="state-card dashboard-card">
          <h2>Recently Unlocked NPCs</h2>
          {dashboard.recently_unlocked_npcs.length ? (
            <ul className="dashboard-list">
              {dashboard.recently_unlocked_npcs.map((npc) => (
                <li key={npc.id}>
                  <Link to={`/directory/${npc.slug}`}>{npc.name}</Link>
                  <span>{formatDateTime(npc.updated_at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="topbar-meta">No unlocked NPCs yet.</p>
          )}
        </article>

        <article className="state-card dashboard-card dashboard-suspects">
          <h2>Suspect List</h2>
          <div className="dashboard-inline-form">
            <input
              className="text-input"
              placeholder="Suspect name"
              value={newSuspectName}
              onChange={(event) => setNewSuspectName(event.target.value)}
            />
            <input
              className="text-input"
              placeholder="Short note"
              value={newSuspectNote}
              onChange={(event) => setNewSuspectNote(event.target.value)}
            />
            <button
              className="action-button"
              type="button"
              disabled={addingSuspect || !newSuspectName.trim()}
              onClick={() => void addSuspect()}
            >
              {addingSuspect ? "Adding..." : "Add"}
            </button>
          </div>

          <div className="dashboard-suspect-list">
            {sortedSuspects.map((suspect, index) => (
              <div key={suspect.id} className="dashboard-suspect-item">
                <input
                  className="text-input"
                  value={suspect.name}
                  onChange={(event) => {
                    void updateSuspect(suspect.id, { name: event.target.value });
                  }}
                />
                <select
                  className="text-input"
                  value={suspect.status}
                  onChange={(event) => {
                    void updateSuspect(suspect.id, {
                      status: event.target.value as DashboardSuspect["status"],
                    });
                  }}
                >
                  {SUSPECT_STATUSES.map((statusValue) => (
                    <option key={statusValue} value={statusValue}>
                      {statusValue}
                    </option>
                  ))}
                </select>
                <textarea
                  className="text-area"
                  rows={2}
                  value={suspect.note}
                  onChange={(event) => {
                    void updateSuspect(suspect.id, { note: event.target.value });
                  }}
                />
                <div className="dashboard-row-actions">
                  <button
                    type="button"
                    className="secondary-link"
                    disabled={index === 0}
                    onClick={() => void moveSuspect(suspect, "up")}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="secondary-link"
                    disabled={index === sortedSuspects.length - 1}
                    onClick={() => void moveSuspect(suspect, "down")}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="board-node-delete-button"
                    onClick={() => void archiveSuspect(suspect.id)}
                  >
                    Archive
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="state-card dashboard-card">
          <h2>Personal Notes</h2>
          <textarea
            className="text-area dashboard-notes-text"
            value={noteDraft}
            onChange={(event) => {
              setNoteDraft(event.target.value);
              setNoteStatus("");
            }}
            placeholder="Track theories, questions, and reminders..."
          />
          <div className="dashboard-row-actions">
            <button className="action-button" type="button" disabled={noteSaving} onClick={() => void saveNotes()}>
              {noteSaving ? "Saving..." : "Save Notes"}
            </button>
            <button
              className="board-node-delete-button"
              type="button"
              disabled={noteSaving || !dashboard.personal_note}
              onClick={() => void archivePersonalNote()}
            >
              Archive Note
            </button>
            <span className="topbar-meta">{noteStatus}</span>
          </div>
        </article>

        <article className="state-card dashboard-card">
          <h2>Lumi’s Session Recap</h2>
          {dashboard.latest_recap ? (
            <>
              <p className="topbar-meta">
                Session {dashboard.latest_recap.session_number} · Published {formatDateTime(dashboard.latest_recap.published_at)}
              </p>
              <p className="dashboard-prewrap">{dashboard.latest_recap.content}</p>
            </>
          ) : (
            <p className="topbar-meta">No published recap yet.</p>
          )}

          {user?.role === "dm" ? (
            <div className="dashboard-recap-editor">
              <h3>Publish Recap</h3>
              <input
                className="text-input"
                type="number"
                min={1}
                placeholder="Session number"
                value={recapSessionNumber}
                onChange={(event) => setRecapSessionNumber(event.target.value)}
              />
              <textarea
                className="text-area"
                rows={6}
                value={recapContent}
                onChange={(event) => setRecapContent(event.target.value)}
                placeholder="Write recap content for players..."
              />
              <button
                className="action-button"
                type="button"
                disabled={savingRecap || !recapSessionNumber || !recapContent.trim()}
                onClick={() => void saveRecap()}
              >
                {savingRecap ? "Publishing..." : "Publish Recap"}
              </button>
            </div>
          ) : null}
        </article>

        <article className="state-card dashboard-card">
          <h2>Recent Personal Activity</h2>
          {dashboard.recent_personal_activity.length ? (
            <ul className="dashboard-list">
              {dashboard.recent_personal_activity.map((item, index) => (
                <li key={`${item.type}-${index}`}>
                  <span>{item.label}</span>
                  <span>{formatDateTime(item.updated_at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="topbar-meta">No recent activity tracked yet.</p>
          )}
        </article>

        {user?.role === "dm" ? (
          <>
            <article className="state-card dashboard-card">
              <h2>Quick Links to Player Boards</h2>
              {dashboard.player_board_links?.length ? (
                <ul className="dashboard-list">
                  {dashboard.player_board_links.map((player) => (
                    <li key={player.id}>
                      <Link to={`/board?userId=${player.id}`}>{player.display_name || player.username}</Link>
                      <span>{formatDateTime(player.board_updated_at)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="topbar-meta">No players found.</p>
              )}
            </article>

            <article className="state-card dashboard-card">
              <h2>Recent NPC Imports</h2>
              <p className="topbar-meta">Import audit cards will appear once import tracking is connected.</p>
            </article>

            <article className="state-card dashboard-card">
              <h2>Recently Changed NPCs</h2>
              {dashboard.recently_changed_npcs?.length ? (
                <ul className="dashboard-list">
                  {dashboard.recently_changed_npcs.map((npc) => (
                    <li key={npc.id}>
                      <Link to={`/directory/${npc.slug}`}>{npc.name}</Link>
                      <span>{formatDateTime(npc.updated_at)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="topbar-meta">No recent NPC edits.</p>
              )}
            </article>

            <article className="state-card dashboard-card">
              <h2>Archive Activity Summary</h2>
              <p className="topbar-meta">
                Archived: {dashboard.archive_activity_summary?.archived_recently ?? 0} · Restored: {dashboard.archive_activity_summary?.restored_recently ?? 0}
              </p>
              <p className="topbar-meta">{dashboard.archive_activity_summary?.note || "Archive summary pending."}</p>
              <div className="placeholder-inline-link">
                <Link to="/archive">Open Archive</Link>
              </div>
            </article>
          </>
        ) : null}
      </section>
    </div>
  );
}
