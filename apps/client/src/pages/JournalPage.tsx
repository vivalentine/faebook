import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api";
import type { DashboardNote } from "../types";

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

export default function JournalPage() {
  const { user } = useAuth();
  const [note, setNote] = useState<DashboardNote | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  async function loadJournal() {
    try {
      setLoading(true);
      setError("");
      setStatus("");
      const response = await apiFetch("/api/dashboard/notes");
      const data = (await response.json()) as DashboardNote | null | { error?: string };

      if (!response.ok) {
        throw new Error((data as { error?: string }).error || "Failed to load journal");
      }

      const nextNote = (data as DashboardNote | null) || null;
      setNote(nextNote);
      setDraft(nextNote?.content || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load journal");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadJournal();
  }, []);

  async function handleSave() {
    try {
      setSaving(true);
      setError("");
      setStatus("");
      const response = await apiFetch("/api/dashboard/notes", {
        method: "PUT",
        body: JSON.stringify({
          content: draft,
        }),
      });
      const data = (await response.json()) as DashboardNote | { error?: string };

      if (!response.ok) {
        throw new Error((data as { error?: string }).error || "Failed to save journal");
      }

      setNote(data as DashboardNote);
      setStatus("Saved");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save journal");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!note) {
      return;
    }
    if (!window.confirm("Archive your current journal entry?")) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setStatus("");
      const response = await apiFetch(`/api/dashboard/notes/${note.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Failed to archive journal");
      }
      setNote(null);
      setDraft("");
      setStatus("Archived");
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Failed to archive journal");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="main-content journal-page-shell">
      <section className="state-card journal-card">
        <div className="journal-header">
          <h1>Player Journal</h1>
          <p>Private campaign notes for your theories, loose threads, and reminders.</p>
          <p className="topbar-meta">Visible to you and the DM in admin context.</p>
        </div>

        {loading ? <p>Loading journal...</p> : null}
        {!loading && error ? <p className="settings-inline-note settings-inline-note-error">{error}</p> : null}

        {!loading ? (
          <>
            <textarea
              className="text-area journal-textarea"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setStatus("");
              }}
              placeholder="Write your private campaign journal..."
              aria-label="Player journal content"
            />
            <div className="journal-actions">
              <button className="action-button" type="button" disabled={saving} onClick={() => void handleSave()}>
                {saving ? "Saving..." : "Save Journal"}
              </button>
              <button
                className="board-node-delete-button"
                type="button"
                disabled={saving || !note}
                onClick={() => void handleArchive()}
              >
                Archive Entry
              </button>
              <span className="topbar-meta">
                {status || (note?.updated_at ? `Last saved ${formatDateTime(note.updated_at)}` : "Not saved yet")}
              </span>
            </div>
          </>
        ) : null}
      </section>

      {user?.role === "dm" ? (
        <section className="state-card small-card">
          <p className="topbar-meta">
            DM note: This page edits your own journal record. Use DM profile inspect view to read player journals.
          </p>
        </section>
      ) : null}
    </main>
  );
}
