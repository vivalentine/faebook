import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch, apiUrl } from "../lib/api";
import type { Npc, NpcNote } from "../types";

export default function DmNpcPage() {
  const { slug = "" } = useParams();

  const [npc, setNpc] = useState<Npc | null>(null);
  const [notes, setNotes] = useState<NpcNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [updatingNoteId, setUpdatingNoteId] = useState<number | null>(null);
  const [deletingNoteId, setDeletingNoteId] = useState<number | null>(null);

  useEffect(() => {
    async function loadNpcPage() {
      try {
        setLoading(true);
        setError("");

        const npcResponse = await apiFetch(`/api/dm/npcs/${slug}`);
        if (!npcResponse.ok) {
          throw new Error(`Failed to load NPC: ${npcResponse.status}`);
        }

        const notesResponse = await apiFetch(`/api/dm/npcs/${slug}/notes`);
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

    loadNpcPage();
  }, [slug]);

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

  if (error || !npc) {
    return (
      <div className="app-shell">
        <div className="state-card error-card">
          <p>{error || "NPC not found"}</p>
        </div>
      </div>
    );
  }

  const imageUrl = npc.portrait_path ? apiUrl(npc.portrait_path) : "";

  return (
    <div className="app-shell">
      <div className="page-back-link">
        <Link to="/">← Back to DM panel</Link>
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
            <p className="eyebrow">DM Entry</p>
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

            <div className="detail-info-list">
              <p>
                <strong>Introduced in:</strong> {npc.introduced_in || "—"}
              </p>
              <p>
                <strong>Visibility:</strong> {npc.is_visible ? "Visible" : "Hidden"}
              </p>
              <p>
                <strong>Source file:</strong> {npc.source_file || "—"}
              </p>
            </div>
          </div>
        </div>

        <section className="notes-section">
          <div className="notes-header">
            <h2>Player Notes</h2>
            <p>Shared notes currently attached to this NPC.</p>
          </div>

          {error ? (
            <div className="state-card error-card small-card">
              <p>{error}</p>
            </div>
          ) : null}

          {notes.length === 0 ? (
            <div className="state-card small-card">
              <p>No notes yet.</p>
            </div>
          ) : (
            <div className="notes-list">
              {notes.map((note) => {
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

                        <div className="note-actions">
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

                          <button
                            className="action-button secondary-link"
                            type="button"
                            onClick={() => handleDelete(note.id)}
                            disabled={deletingNoteId === note.id}
                          >
                            {deletingNoteId === note.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
