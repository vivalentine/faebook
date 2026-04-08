import { useEffect, useState } from "react";
import type { SubmitEventHandler } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch, apiUrl } from "../lib/api";
import type { Npc, NpcNote } from "../types";

export default function PlayerNpcPage() {
  const { slug = "" } = useParams();
  const { user } = useAuth();

  const [npc, setNpc] = useState<Npc | null>(null);
  const [notes, setNotes] = useState<NpcNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [updatingNoteId, setUpdatingNoteId] = useState<number | null>(null);
  const [deletingNoteId, setDeletingNoteId] = useState<number | null>(null);

  useEffect(() => {
    async function loadPage() {
      try {
        setLoading(true);
        setError("");

        const npcResponse = await apiFetch(`/api/npcs/${slug}`);
        if (!npcResponse.ok) {
          throw new Error(`Failed to load NPC: ${npcResponse.status}`);
        }

        const notesResponse = await apiFetch(`/api/npcs/${slug}/notes`);
        if (!notesResponse.ok) {
          throw new Error(`Failed to load notes: ${notesResponse.status}`);
        }

        const npcData = await npcResponse.json();
        const notesData = await notesResponse.json();

        setNpc(npcData);
        setNotes(notesData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    loadPage();
  }, [slug]);

  const handleSubmit: SubmitEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();

    if (!content.trim()) {
      setError("Please enter a note.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await apiFetch(`/api/npcs/${slug}/notes`, {
        method: "POST",
        body: JSON.stringify({
          content: content.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to save note: ${response.status}`);
      }

      setNotes((current) => [...current, data]);
      setContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  async function handleSaveEdit(noteId: number) {
    if (!editingContent.trim()) {
      setError("Please enter a note.");
      return;
    }

    try {
      setUpdatingNoteId(noteId);
      setError("");

      const response = await apiFetch(`/api/npc-notes/${noteId}`, {
        method: "PATCH",
        body: JSON.stringify({
          content: editingContent.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to update note: ${response.status}`);
      }

      setNotes((current) =>
        current.map((note) => (note.id === noteId ? data : note))
      );
      setEditingNoteId(null);
      setEditingContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setUpdatingNoteId(null);
    }
  }

  async function handleDelete(noteId: number) {
    if (!window.confirm("Delete this note?")) return;

    try {
      setDeletingNoteId(noteId);
      setError("");

      const response = await apiFetch(`/api/npc-notes/${noteId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to delete note: ${response.status}`);
      }

      setNotes((current) => current.filter((note) => note.id !== noteId));

      if (editingNoteId === noteId) {
        setEditingNoteId(null);
        setEditingContent("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setDeletingNoteId(null);
    }
  }

  if (loading) {
    return (
      <div className="app-shell">
        <div className="state-card">
          <p>Loading NPC page...</p>
        </div>
      </div>
    );
  }

  if (error && !npc) {
    return (
      <div className="app-shell">
        <div className="state-card error-card">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!npc) return null;

  const imageUrl = npc.portrait_path ? apiUrl(npc.portrait_path) : "";

  return (
    <div className="app-shell">
      <div className="page-back-link">
        <Link to="/directory">← Back to directory</Link>
      </div>

      <section className="detail-shell">
        <div className="detail-hero">
          <div className="detail-image-wrap">
            {imageUrl ? (
              <img className="detail-image" src={imageUrl} alt={npc.name} />
            ) : (
              <div className="detail-image placeholder">No image</div>
            )}
          </div>

          <div className="detail-meta">
            <p className="eyebrow">FaeBook Entry</p>
            <h1>{npc.name}</h1>
            <p className="rank-line large">
              {npc.rank_title || npc.role || "Unranked"}
            </p>

            <div className="meta-row">
              {npc.house ? <span>House: {npc.house}</span> : null}
              {npc.court ? <span>Court: {npc.court}</span> : null}
              {npc.ring ? <span>Ring: {npc.ring}</span> : null}
            </div>

            {npc.short_blurb ? <p className="blurb">{npc.short_blurb}</p> : null}

            {npc.met_summary ? (
              <div className="summary-box">
                <p className="summary-label">Met when</p>
                <p>{npc.met_summary}</p>
              </div>
            ) : null}
          </div>
        </div>

        <section className="notes-section">
          <div className="notes-header">
            <h2>Party Notes</h2>
            <p>Shared notes everyone can read during the session.</p>
            <p className="summary-label">
              Posting as {user?.display_name || user?.username || "Unknown User"}
            </p>
          </div>

          {error ? (
            <div className="state-card error-card small-card">
              <p>{error}</p>
            </div>
          ) : null}

          <form className="note-form" onSubmit={handleSubmit}>
            <textarea
              className="text-area"
              placeholder="Write a note about this NPC..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
            />
            <button className="action-button" type="submit" disabled={saving}>
              {saving ? "Saving..." : "Add note"}
            </button>
          </form>

          <div className="notes-list">
            {notes.length === 0 ? (
              <div className="state-card small-card">
                <p>No notes yet.</p>
              </div>
            ) : (
              notes.map((note) => {
                const isEditing = editingNoteId === note.id;
                const wasEdited = note.updated_at !== note.created_at;

                return (
                  <article className="note-card" key={note.id}>
                    <div className="note-card-header">
                      <strong>{note.author_name}</strong>
                      <span>
                        {new Date(note.created_at).toLocaleString()}
                        {wasEdited ? " • edited" : ""}
                      </span>
                    </div>

                    {isEditing ? (
                      <>
                        <textarea
                          className="text-area"
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          rows={4}
                        />

                        <div className="note-actions">
                          <button
                            className="action-button"
                            type="button"
                            onClick={() => handleSaveEdit(note.id)}
                            disabled={updatingNoteId === note.id}
                          >
                            {updatingNoteId === note.id ? "Saving..." : "Save"}
                          </button>

                          <button
                            className="action-button secondary-link"
                            type="button"
                            onClick={() => {
                              setEditingNoteId(null);
                              setEditingContent("");
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p>{note.content}</p>

                        {note.can_edit || note.can_delete ? (
                          <div className="note-actions">
                            {note.can_edit ? (
                              <button
                                className="action-button secondary-link"
                                type="button"
                                onClick={() => {
                                  setEditingNoteId(note.id);
                                  setEditingContent(note.content);
                                }}
                              >
                                Edit
                              </button>
                            ) : null}

                            {note.can_delete ? (
                              <button
                                className="action-button secondary-link"
                                type="button"
                                onClick={() => handleDelete(note.id)}
                                disabled={deletingNoteId === note.id}
                              >
                                {deletingNoteId === note.id
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </section>
      </section>
    </div>
  );
}
