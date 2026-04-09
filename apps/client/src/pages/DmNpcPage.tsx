import { useEffect, useState } from "react";
import type { ChangeEvent, SubmitEventHandler } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch, apiUrl } from "../lib/api";
import type { Npc, NpcAlias, NpcNote } from "../types";

type PersonalAliasGroup = {
  user_id: number;
  display_name: string;
  username: string;
  aliases: NpcAlias[];
};

type PersonalNoteGroup = {
  user_id: number;
  display_name: string;
  username: string;
  note: NpcNote | null;
};

type NpcEditForm = {
  name: string;
  rank_title: string;
  house: string;
  faction: string;
  court: string;
  ring: string;
  introduced_in: string;
  met_summary: string;
  short_blurb: string;
  source_file_label: string;
  sort_name: string;
  visibility: "hidden" | "visible";
};

function toForm(npc: Npc): NpcEditForm {
  return {
    name: npc.name || "",
    rank_title: npc.rank_title || "",
    house: npc.house || "",
    faction: npc.faction || "",
    court: npc.court || "",
    ring: npc.ring || "",
    introduced_in: npc.introduced_in || "",
    met_summary: npc.met_summary || "",
    short_blurb: npc.short_blurb || "",
    source_file_label: npc.source_file_label || "",
    sort_name: npc.sort_name || "",
    visibility: npc.is_visible ? "visible" : "hidden",
  };
}

export default function DmNpcPage() {
  const { slug = "" } = useParams();

  const [npc, setNpc] = useState<Npc | null>(null);
  const [canonicalAliases, setCanonicalAliases] = useState<NpcAlias[]>([]);
  const [personalAliasGroups, setPersonalAliasGroups] = useState<PersonalAliasGroup[]>([]);
  const [personalNoteGroups, setPersonalNoteGroups] = useState<PersonalNoteGroup[]>([]);
  const [form, setForm] = useState<NpcEditForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [aliasInput, setAliasInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingAliasId, setEditingAliasId] = useState<number | null>(null);
  const [editingAliasValue, setEditingAliasValue] = useState("");
  const [updatingAliasId, setUpdatingAliasId] = useState<number | null>(null);
  const [deletingAliasId, setDeletingAliasId] = useState<number | null>(null);

  useEffect(() => {
    void loadNpcPage();
  }, [slug]);

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

      const notesResponse = await apiFetch(`/api/dm/npcs/${slug}/notes`);
      if (!notesResponse.ok) {
        throw new Error(`Failed to load notes: ${notesResponse.status}`);
      }

      const npcData = await npcResponse.json();
      const aliasesData = await aliasesResponse.json();
      const notesData = await notesResponse.json();

      setNpc(npcData);
      setForm(toForm(npcData));
      setCanonicalAliases(aliasesData.canonical || []);
      setPersonalAliasGroups(aliasesData.personal_by_user || []);
      setPersonalNoteGroups(notesData.personal_by_user || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function setFormValue<K extends keyof NpcEditForm>(key: K, value: NpcEditForm[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

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
        [...current, data].sort((a, b) => a.alias.localeCompare(b.alias)),
      );
      setAliasInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  async function handleSaveNpcEdits() {
    if (!form) return;

    try {
      setSaving(true);
      setInfo("");
      setError("");

      const response = await apiFetch(`/api/dm/npcs/${slug}`, {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to save NPC: ${response.status}`);
      }

      setNpc(data);
      setForm(toForm(data));
      setInfo("NPC fields updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  async function handlePortraitUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setSaving(true);
      setError("");
      setInfo("");

      const formData = new FormData();
      formData.append("portrait", file);

      const response = await apiFetch(`/api/dm/npcs/${slug}/portrait`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to upload portrait: ${response.status}`);
      }

      setNpc(data);
      setForm((current) => (current ? { ...current } : current));
      setInfo("Portrait replaced. Previous portrait archived.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
      event.target.value = "";
    }
  }

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
          .sort((a, b) => a.alias.localeCompare(b.alias)),
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

  if (error || !npc || !form) {
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
            <label className="toolbar-field">
              <span>Replace portrait</span>
              <input
                className="text-input"
                type="file"
                accept=".png,.webp,.jpg,.jpeg,image/png,image/webp,image/jpeg"
                onChange={(event) => void handlePortraitUpload(event)}
                disabled={saving}
              />
            </label>
          </div>

          <div className="detail-meta">
            <h1>{npc.name}</h1>
            <p className="rank-line large">{npc.rank_title || npc.role || "Unranked"}</p>

            {info ? (
              <div className="state-card small-card">
                <p>{info}</p>
              </div>
            ) : null}
          </div>
        </div>

        <section className="notes-section">
          <div className="notes-header">
            <h2>NPC Admin Fields</h2>
            <p>Direct DM editing for canonical scalar metadata.</p>
          </div>

          {error ? (
            <div className="state-card error-card small-card">
              <p>{error}</p>
            </div>
          ) : null}

          <div className="toolbar-grid">
            <label className="toolbar-field"><span>Name</span><input className="text-input" value={form.name} onChange={(e) => setFormValue("name", e.target.value)} /></label>
            <label className="toolbar-field"><span>Rank title</span><input className="text-input" value={form.rank_title} onChange={(e) => setFormValue("rank_title", e.target.value)} /></label>
            <label className="toolbar-field"><span>House</span><input className="text-input" value={form.house} onChange={(e) => setFormValue("house", e.target.value)} /></label>
            <label className="toolbar-field"><span>Faction</span><input className="text-input" value={form.faction} onChange={(e) => setFormValue("faction", e.target.value)} /></label>
            <label className="toolbar-field"><span>Court</span><input className="text-input" value={form.court} onChange={(e) => setFormValue("court", e.target.value)} /></label>
            <label className="toolbar-field"><span>Ring</span><input className="text-input" value={form.ring} onChange={(e) => setFormValue("ring", e.target.value)} /></label>
            <label className="toolbar-field"><span>Introduced in</span><input className="text-input" value={form.introduced_in} onChange={(e) => setFormValue("introduced_in", e.target.value)} /></label>
            <label className="toolbar-field"><span>Met summary</span><input className="text-input" value={form.met_summary} onChange={(e) => setFormValue("met_summary", e.target.value)} /></label>
            <label className="toolbar-field"><span>Short blurb</span><input className="text-input" value={form.short_blurb} onChange={(e) => setFormValue("short_blurb", e.target.value)} /></label>
            <label className="toolbar-field"><span>Source label</span><input className="text-input" value={form.source_file_label} onChange={(e) => setFormValue("source_file_label", e.target.value)} /></label>
            <label className="toolbar-field"><span>Sort name</span><input className="text-input" value={form.sort_name} onChange={(e) => setFormValue("sort_name", e.target.value)} /></label>
            <label className="toolbar-field">
              <span>Visibility</span>
              <select className="text-input" value={form.visibility} onChange={(e) => setFormValue("visibility", e.target.value as "hidden" | "visible") }>
                <option value="hidden">hidden</option>
                <option value="visible">visible</option>
              </select>
            </label>
          </div>

          <div className="note-actions">
            <button className="action-button" type="button" onClick={() => void handleSaveNpcEdits()} disabled={saving}>
              {saving ? "Saving..." : "Save NPC fields"}
            </button>
          </div>
        </section>

        <section className="notes-section">
          <div className="notes-header">
            <h2>Canonical Aliases</h2>
            <p>DM-managed known names shown to players when this NPC is visible.</p>
          </div>

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
                            onClick={() => void handleSaveCanonicalAlias(alias.id)}
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
                          onClick={() => void handleDeleteCanonicalAlias(alias.id)}
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

        <section className="notes-section">
          <div className="notes-header">
            <h2>Player Private Notes</h2>
            <p>Private per-player NPC notes visible in DM admin context only.</p>
          </div>

          {personalNoteGroups.length === 0 ? (
            <div className="state-card small-card">
              <p>No private player notes added for this NPC yet.</p>
            </div>
          ) : (
            personalNoteGroups.map((group) => (
              <article className="note-card" key={group.user_id}>
                <div className="note-card-header">
                  <strong>
                    {group.display_name}
                    {group.username ? ` (@${group.username})` : ""}
                  </strong>
                  {group.note ? (
                    <span>Updated {new Date(group.note.updated_at).toLocaleString()}</span>
                  ) : null}
                </div>
                <p>{group.note?.content || "No note content."}</p>
              </article>
            ))
          )}
        </section>
      </section>
    </div>
  );
}
