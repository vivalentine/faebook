import { useEffect, useState } from "react";
import type { SubmitEventHandler } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch, apiUrl } from "../lib/api";
import type { Npc, NpcAlias, NpcNote } from "../types";

export default function PlayerNpcPage() {
  const { slug = "" } = useParams();

  const [npc, setNpc] = useState<Npc | null>(null);
  const [canonicalAliases, setCanonicalAliases] = useState<NpcAlias[]>([]);
  const [personalAliases, setPersonalAliases] = useState<NpcAlias[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [aliasInput, setAliasInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingAliasId, setEditingAliasId] = useState<number | null>(null);
  const [editingAliasValue, setEditingAliasValue] = useState("");
  const [updatingAliasId, setUpdatingAliasId] = useState<number | null>(null);
  const [deletingAliasId, setDeletingAliasId] = useState<number | null>(null);
  const [myNote, setMyNote] = useState<NpcNote | null>(null);
  const [noteInput, setNoteInput] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    async function loadPage() {
      try {
        setLoading(true);
        setError("");

        const npcResponse = await apiFetch(`/api/npcs/${slug}`);
        if (!npcResponse.ok) {
          throw new Error(`Failed to load NPC: ${npcResponse.status}`);
        }

        const aliasesResponse = await apiFetch(`/api/npcs/${slug}/aliases`);
        if (!aliasesResponse.ok) {
          throw new Error(`Failed to load aliases: ${aliasesResponse.status}`);
        }

        const noteResponse = await apiFetch(`/api/npcs/${slug}/note`);
        if (!noteResponse.ok) {
          throw new Error(`Failed to load note: ${noteResponse.status}`);
        }

        const npcData = await npcResponse.json();
        const aliasesData = await aliasesResponse.json();
        const noteData = await noteResponse.json();

        setNpc(npcData);
        setCanonicalAliases(aliasesData.canonical || []);
        setPersonalAliases(aliasesData.personal || []);
        setMyNote(noteData.note || null);
        setNoteInput(noteData.note?.content || "");
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

    if (!aliasInput.trim()) {
      setError("Please enter an alias.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await apiFetch(`/api/npcs/${slug}/aliases`, {
        method: "POST",
        body: JSON.stringify({ alias: aliasInput.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to save alias: ${response.status}`);
      }

      setPersonalAliases((current) =>
        [...current, data].sort((a, b) => a.alias.localeCompare(b.alias))
      );
      setAliasInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  async function handleSaveEdit(aliasId: number) {
    if (!editingAliasValue.trim()) {
      setError("Please enter an alias.");
      return;
    }

    try {
      setUpdatingAliasId(aliasId);
      setError("");

      const response = await apiFetch(`/api/npc-aliases/${aliasId}`, {
        method: "PATCH",
        body: JSON.stringify({ alias: editingAliasValue.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to update alias: ${response.status}`);
      }

      setPersonalAliases((current) =>
        current
          .map((alias) => (alias.id === aliasId ? data : alias))
          .sort((a, b) => a.alias.localeCompare(b.alias))
      );
      setEditingAliasId(null);
      setEditingAliasValue("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setUpdatingAliasId(null);
    }
  }

  async function handleSaveNote() {
    try {
      setSavingNote(true);
      setError("");

      const response = await apiFetch(`/api/npcs/${slug}/note`, {
        method: "PUT",
        body: JSON.stringify({ content: noteInput }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to save note: ${response.status}`);
      }

      setMyNote(data.note || null);
      setNoteInput(data.note?.content || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSavingNote(false);
    }
  }

  async function handleDelete(aliasId: number) {
    if (!window.confirm("Remove this alias from your active list?")) return;

    try {
      setDeletingAliasId(aliasId);
      setError("");

      const response = await apiFetch(`/api/npc-aliases/${aliasId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to remove alias: ${response.status}`);
      }

      setPersonalAliases((current) => current.filter((alias) => alias.id !== aliasId));

      if (editingAliasId === aliasId) {
        setEditingAliasId(null);
        setEditingAliasValue("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setDeletingAliasId(null);
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
            <h2>Known Names</h2>
            <p>Canonical aliases managed by your DM for visible NPC records.</p>
          </div>

          {canonicalAliases.length === 0 ? (
            <div className="state-card small-card">
              <p>No canonical aliases yet.</p>
            </div>
          ) : (
            <div className="notes-list">
              {canonicalAliases.map((alias) => (
                <article className="note-card" key={alias.id}>
                  <p>{alias.alias}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="notes-section">
          <div className="notes-header">
            <h2>My Nicknames</h2>
            <p>Private aliases only visible to you and the DM.</p>
          </div>

          {error ? (
            <div className="state-card error-card small-card">
              <p>{error}</p>
            </div>
          ) : null}

          <form className="note-form" onSubmit={handleSubmit}>
            <input
              className="text-input"
              type="text"
              placeholder="Add your personal alias..."
              value={aliasInput}
              onChange={(e) => setAliasInput(e.target.value)}
              maxLength={80}
            />
            <button className="action-button" type="submit" disabled={saving}>
              {saving ? "Saving..." : "Add alias"}
            </button>
          </form>

          <div className="notes-list">
            {personalAliases.length === 0 ? (
              <div className="state-card small-card">
                <p>No personal aliases yet.</p>
              </div>
            ) : (
              personalAliases.map((alias) => {
                const isEditing = editingAliasId === alias.id;
                const wasEdited = alias.updated_at !== alias.created_at;

                return (
                  <article className="note-card" key={alias.id}>
                    <div className="note-card-header">
                      <strong>{alias.alias}</strong>
                      <span>
                        {new Date(alias.created_at).toLocaleString()}
                        {wasEdited ? " • edited" : ""}
                      </span>
                    </div>

                    {isEditing ? (
                      <>
                        <input
                          className="text-input"
                          type="text"
                          value={editingAliasValue}
                          onChange={(e) => setEditingAliasValue(e.target.value)}
                          maxLength={80}
                        />

                        <div className="note-actions">
                          <button
                            className="action-button"
                            type="button"
                            onClick={() => handleSaveEdit(alias.id)}
                            disabled={updatingAliasId === alias.id}
                          >
                            {updatingAliasId === alias.id ? "Saving..." : "Save"}
                          </button>

                          <button
                            className="action-button secondary-link"
                            type="button"
                            onClick={() => {
                              setEditingAliasId(null);
                              setEditingAliasValue("");
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="note-actions">
                        <button
                          className="action-button secondary-link"
                          type="button"
                          onClick={() => {
                            setEditingAliasId(alias.id);
                            setEditingAliasValue(alias.alias);
                          }}
                        >
                          Edit
                        </button>

                        <button
                          className="action-button secondary-link"
                          type="button"
                          onClick={() => handleDelete(alias.id)}
                          disabled={deletingAliasId === alias.id}
                        >
                          {deletingAliasId === alias.id ? "Removing..." : "Remove"}
                        </button>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </section>

        <section className="notes-section">
          <div className="notes-header">
            <h2>My Notes</h2>
            <p>Private notes only visible to you and the DM.</p>
          </div>

          {!myNote && !noteInput.trim() ? (
            <div className="state-card small-card">
              <p>No private note yet. Start one below.</p>
            </div>
          ) : null}

          <div className="note-form">
            <textarea
              className="text-area"
              placeholder="Track your private clues, theories, and suspicions here..."
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              rows={6}
              maxLength={20000}
            />
            <div className="note-actions">
              <button
                className="action-button"
                type="button"
                onClick={() => void handleSaveNote()}
                disabled={savingNote}
              >
                {savingNote ? "Saving..." : myNote ? "Save note" : "Create note"}
              </button>
              {myNote ? (
                <span>
                  Last updated {new Date(myNote.updated_at).toLocaleString()}
                </span>
              ) : null}
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}
