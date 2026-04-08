import { useEffect, useState } from "react";
import type { SubmitEventHandler } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch, apiUrl } from "../lib/api";
import type { Npc, NpcAlias } from "../types";

type PersonalAliasGroup = {
  user_id: number;
  display_name: string;
  username: string;
  aliases: NpcAlias[];
};

export default function DmNpcPage() {
  const { slug = "" } = useParams();

  const [npc, setNpc] = useState<Npc | null>(null);
  const [canonicalAliases, setCanonicalAliases] = useState<NpcAlias[]>([]);
  const [personalAliasGroups, setPersonalAliasGroups] = useState<PersonalAliasGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [aliasInput, setAliasInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingAliasId, setEditingAliasId] = useState<number | null>(null);
  const [editingAliasValue, setEditingAliasValue] = useState("");
  const [updatingAliasId, setUpdatingAliasId] = useState<number | null>(null);
  const [deletingAliasId, setDeletingAliasId] = useState<number | null>(null);

  useEffect(() => {
    async function loadNpcPage() {
      try {
        setLoading(true);
        setError("");

        const npcResponse = await apiFetch(`/api/dm/npcs/${slug}`);
        if (!npcResponse.ok) {
          throw new Error(`Failed to load NPC: ${npcResponse.status}`);
        }

        const aliasesResponse = await apiFetch(`/api/dm/npcs/${slug}/aliases`);
        if (!aliasesResponse.ok) {
          throw new Error(`Failed to load aliases: ${aliasesResponse.status}`);
        }

        const npcData = await npcResponse.json();
        const aliasesData = await aliasesResponse.json();

        setNpc(npcData);
        setCanonicalAliases(aliasesData.canonical || []);
        setPersonalAliasGroups(aliasesData.personal_by_user || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    loadNpcPage();
  }, [slug]);

  const handleCreateCanonicalAlias: SubmitEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();

    if (!aliasInput.trim()) {
      setError("Please enter an alias.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await apiFetch(`/api/dm/npcs/${slug}/aliases`, {
        method: "POST",
        body: JSON.stringify({ alias: aliasInput.trim() }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to create alias: ${response.status}`);
      }

      setCanonicalAliases((current) =>
        [...current, data].sort((a, b) => a.alias.localeCompare(b.alias))
      );
      setAliasInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  async function handleSaveCanonicalAlias(aliasId: number) {
    if (!editingAliasValue.trim()) {
      setError("Please enter an alias.");
      return;
    }

    try {
      setUpdatingAliasId(aliasId);
      setError("");

      const response = await apiFetch(`/api/dm/npc-aliases/${aliasId}`, {
        method: "PATCH",
        body: JSON.stringify({ alias: editingAliasValue.trim() }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to update alias: ${response.status}`);
      }

      setCanonicalAliases((current) =>
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

  async function handleDeleteCanonicalAlias(aliasId: number) {
    if (!window.confirm("Archive this canonical alias?")) return;

    try {
      setDeletingAliasId(aliasId);
      setError("");

      const response = await apiFetch(`/api/dm/npc-aliases/${aliasId}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to archive alias: ${response.status}`);
      }

      setCanonicalAliases((current) => current.filter((alias) => alias.id !== aliasId));

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
            <h2>Canonical Aliases</h2>
            <p>DM-managed known names shown to players when this NPC is visible.</p>
          </div>

          {error ? (
            <div className="state-card error-card small-card">
              <p>{error}</p>
            </div>
          ) : null}

          <form className="note-form" onSubmit={handleCreateCanonicalAlias}>
            <input
              className="text-input"
              type="text"
              placeholder="Add canonical alias..."
              value={aliasInput}
              onChange={(e) => setAliasInput(e.target.value)}
              maxLength={80}
            />
            <button className="action-button" type="submit" disabled={saving}>
              {saving ? "Saving..." : "Add alias"}
            </button>
          </form>

          {canonicalAliases.length === 0 ? (
            <div className="state-card small-card">
              <p>No canonical aliases yet.</p>
            </div>
          ) : (
            <div className="notes-list">
              {canonicalAliases.map((alias) => {
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
                            onClick={() => handleSaveCanonicalAlias(alias.id)}
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
                          onClick={() => handleDeleteCanonicalAlias(alias.id)}
                          disabled={deletingAliasId === alias.id}
                        >
                          {deletingAliasId === alias.id ? "Archiving..." : "Archive"}
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="notes-section">
          <div className="notes-header">
            <h2>Player Personal Aliases</h2>
            <p>Private player aliases visible in DM admin context only.</p>
          </div>

          {personalAliasGroups.length === 0 ? (
            <div className="state-card small-card">
              <p>No personal aliases added by players yet.</p>
            </div>
          ) : (
            personalAliasGroups.map((group) => (
              <div className="state-card small-card" key={group.user_id}>
                <p className="summary-label">
                  {group.display_name}
                  {group.username ? ` (@${group.username})` : ""}
                </p>
                <ul>
                  {group.aliases.map((alias) => (
                    <li key={alias.id}>{alias.alias}</li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>
      </section>
    </div>
  );
}
