import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";

type ImportPreviewFile = {
  filename: string;
  parsed_name: string | null;
  slug: string | null;
  tier?: "major" | "minor" | null;
  parser_used?: "fixture" | "obsidian-template";
  status: "create" | "update" | null;
  state: string;
  matched_portrait: string | null;
  unmatched_portrait_state: string;
  validation_issues: string[];
  warnings: string[];
  preview_snippet?: string;
};

type ImportPreview = {
  staged_markdown_count: number;
  staged_portrait_count: number;
  files: ImportPreviewFile[];
  unmatched_files: Array<{
    filename: string;
    size: number;
    validationIssues: string[];
  }>;
};

type ImportLog = {
  id: number;
  filename: string;
  result: string;
  message: string;
  created_at: string;
};

type BackupResult = {
  name: string;
  created_at: string;
  path: string;
};

type NpcCleanupItem = {
  id: number;
  name: string;
  slug: string;
  tier?: "major" | "minor" | null;
  portrait_path: string | null;
  last_imported_at?: string | null;
  updated_at: string;
  archived_at?: string | null;
};

export default function DmToolsPage() {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [finalizeResult, setFinalizeResult] = useState("");
  const [backupResult, setBackupResult] = useState<BackupResult | null>(null);
  const [cleanupItems, setCleanupItems] = useState<NpcCleanupItem[]>([]);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    try {
      setLoading(true);
      setError("");

      const [previewResponse, logsResponse, cleanupResponse] = await Promise.all([
        apiFetch("/api/dm/import/staging"),
        apiFetch("/api/dm/import/logs"),
        apiFetch("/api/dm/npcs?include_archived=1"),
      ]);

      if (!previewResponse.ok) {
        throw new Error(`Failed loading staging preview: ${previewResponse.status}`);
      }

      if (!logsResponse.ok) {
        throw new Error(`Failed loading import logs: ${logsResponse.status}`);
      }
      if (!cleanupResponse.ok) {
        throw new Error(`Failed loading NPC cleanup list: ${cleanupResponse.status}`);
      }

      setPreview(await previewResponse.json());
      setLogs(await logsResponse.json());
      setCleanupItems(await cleanupResponse.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function archiveNpc(slug: string) {
    if (!window.confirm(`Archive NPC ${slug}? This is the safer default cleanup action.`)) return;
    setBusy(true);
    setError("");
    try {
      const response = await apiFetch(`/api/dm/npcs/${slug}/archive`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Archive failed: ${response.status}`);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  async function restoreNpc(slug: string) {
    if (!window.confirm(`Restore archived NPC ${slug}?`)) return;
    setBusy(true);
    setError("");
    try {
      const response = await apiFetch(`/api/dm/npcs/${slug}/restore`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Restore failed: ${response.status}`);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  async function hardDeleteNpc(slug: string) {
    const confirmation = window.prompt(
      `Hard delete is destructive.\nType exactly: DELETE ${slug}\n\nThis removes the NPC and related aliases/notes.`
    );
    if (!confirmation) return;

    setBusy(true);
    setError("");
    try {
      const response = await apiFetch(`/api/dm/npcs/${slug}/hard-delete`, {
        method: "DELETE",
        body: JSON.stringify({ confirmation }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Hard delete failed: ${response.status}`);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  async function uploadFiles(endpoint: string, fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    try {
      setBusy(true);
      setError("");
      setFinalizeResult("");
      setBackupResult(null);

      const formData = new FormData();
      Array.from(fileList).forEach((file) => formData.append("files", file));

      const response = await apiFetch(endpoint, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Upload failed: ${response.status}`);
      }

      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  async function loadFixtures() {
    try {
      setBusy(true);
      setError("");
      setFinalizeResult("");
      const response = await apiFetch("/api/dm/import/staging/fixtures", { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Failed to load fixtures: ${response.status}`);
      }
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  async function clearStaging() {
    try {
      setBusy(true);
      setError("");
      setFinalizeResult("");
      const response = await apiFetch("/api/dm/import/staging/clear", { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Failed to clear staging: ${response.status}`);
      }
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  async function finalizeImport() {
    if (!window.confirm("Finalize staged import now?")) return;

    try {
      setBusy(true);
      setError("");
      setFinalizeResult("");

      const response = await apiFetch("/api/dm/import/finalize", { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Finalize failed: ${response.status}`);
      }

      const created = (data.results || []).filter((item: { result: string }) => item.result === "created").length;
      const updated = (data.results || []).filter((item: { result: string }) => item.result === "updated").length;
      const invalid = (data.results || []).filter((item: { result: string }) => item.result === "invalid").length;
      setFinalizeResult(`Finalize complete. Created: ${created}, Updated: ${updated}, Invalid: ${invalid}.`);

      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  async function createBackup() {
    if (!window.confirm("Create a local DM backup now?")) return;

    try {
      setBusy(true);
      setError("");
      setFinalizeResult("");
      const response = await apiFetch("/api/dm/backups", { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Backup failed: ${response.status}`);
      }

      setBackupResult(data.backup || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  const summary = useMemo(() => {
    if (!preview) return { create: 0, update: 0, invalid: 0 };
    return {
      create: preview.files.filter((file) => file.status === "create").length,
      update: preview.files.filter((file) => file.status === "update").length,
      invalid: preview.files.filter((file) => file.validation_issues.length > 0).length,
    };
  }, [preview]);

  if (loading) {
    return (
      <div className="app-shell">
        <div className="state-card">
          <p>Loading DM tools...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell dm-tools-page">
      <header className="topbar">
        <div>
          <h1>DM Tools</h1>
        </div>
        <div className="topbar-meta topbar-meta-stack">
          <span>Markdown staged: {preview?.staged_markdown_count || 0}</span>
          <span>Portraits staged: {preview?.staged_portrait_count || 0}</span>
        </div>
      </header>

      <main className="main-content">
        <section className="toolbar-card">
          <div className="toolbar-grid">
            <label className="toolbar-field">
              <span>Upload NPC markdown (.md)</span>
              <input
                className="text-input"
                type="file"
                accept=".md,text/markdown"
                multiple
                onChange={(event) => {
                  void uploadFiles("/api/dm/import/staging/markdown", event.target.files);
                  event.currentTarget.value = "";
                }}
                disabled={busy}
              />
            </label>

            <label className="toolbar-field">
              <span>Upload portraits (.png/.webp/.jpg/.jpeg)</span>
              <input
                className="text-input"
                type="file"
                accept=".png,.webp,.jpg,.jpeg,image/png,image/webp,image/jpeg"
                multiple
                onChange={(event) => {
                  void uploadFiles("/api/dm/import/staging/portraits", event.target.files);
                  event.currentTarget.value = "";
                }}
                disabled={busy}
              />
            </label>
          </div>

          <div className="note-actions">
            <button className="action-button" type="button" onClick={() => void loadFixtures()} disabled={busy}>
              Use fixture files
            </button>
            <button className="action-button secondary-link" type="button" onClick={() => void clearStaging()} disabled={busy}>
              Clear staging
            </button>
            <button className="action-button" type="button" onClick={() => void finalizeImport()} disabled={busy || (preview?.files.length || 0) === 0}>
              Finalize import
            </button>
            <Link to="/archive" className="action-button secondary-link">
              Open Archive
            </Link>
          </div>
        </section>

        {error ? (
          <div className="state-card error-card">
            <p>{error}</p>
          </div>
        ) : null}

        {finalizeResult ? (
          <div className="state-card small-card">
            <p>{finalizeResult}</p>
          </div>
        ) : null}

        <section className="state-card">
          <h2>Local Backup</h2>
          <p>
            Creates a DM-only local backup bundle with database files, uploaded portraits, and map config.
          </p>
          <div className="note-actions">
            <button className="action-button" type="button" onClick={() => void createBackup()} disabled={busy}>
              Create Local Backup
            </button>
          </div>
          {backupResult ? (
            <p>
              Created: <strong>{backupResult.name}</strong> ({new Date(backupResult.created_at).toLocaleString()}) at{" "}
              <code>{backupResult.path}</code>
            </p>
          ) : null}
        </section>

        <section className="state-card">
          <h2>Staging Preview</h2>
          <p>
            Create: {summary.create} • Update: {summary.update} • Invalid: {summary.invalid}
          </p>

          {(preview?.files || []).length === 0 ? (
            <p>No staged markdown files yet.</p>
          ) : (
            <div className="notes-list">
              {(preview?.files || []).map((item) => (
                <article className="note-card" key={item.filename}>
                  <div className="note-card-header">
                    <strong>{item.filename}</strong>
                    <span>{item.status || item.state}</span>
                  </div>
                  <p>Parser: {item.parser_used || "fixture"}</p>
                  <p>Name: {item.parsed_name || "—"}</p>
                  <p>Slug: {item.slug || "—"}</p>
                  <p>Tier: {item.tier || "major"}</p>
                  <p>Matched portrait: {item.matched_portrait || "Unmatched"}</p>
                  {item.preview_snippet ? <p>Preview: {item.preview_snippet}</p> : null}
                  {item.validation_issues.length ? (
                    <p>Validation issues: {item.validation_issues.join("; ")}</p>
                  ) : null}
                  {item.warnings.length ? <p>Warnings: {item.warnings.join("; ")}</p> : null}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="state-card">
          <h2>Unmatched Portrait Files</h2>
          {(preview?.unmatched_files || []).length === 0 ? (
            <p>None.</p>
          ) : (
            <ul>
              {(preview?.unmatched_files || []).map((item) => (
                <li key={item.filename}>
                  {item.filename} ({item.size} bytes)
                  {item.validationIssues.length ? ` — ${item.validationIssues.join("; ")}` : ""}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="state-card">
          <h2>NPC Cleanup</h2>
          {cleanupItems.length === 0 ? (
            <p>No NPC records found.</p>
          ) : (
            <div className="notes-list">
              {cleanupItems.map((npc) => {
                const isArchived = Boolean(npc.archived_at);
                return (
                  <article className="note-card" key={npc.id}>
                    <div className="note-card-header">
                      <strong>{npc.name}</strong>
                      <span>{isArchived ? "archived" : "active"}</span>
                    </div>
                    <p>Slug: {npc.slug}</p>
                    <p>Tier: {npc.tier || "major"}</p>
                    <p>Portrait: {npc.portrait_path ? "matched" : "none"}</p>
                    <p>Last import/update: {new Date(npc.last_imported_at || npc.updated_at).toLocaleString()}</p>
                    <div className="note-actions">
                      {isArchived ? (
                        <>
                          <button className="action-button" type="button" onClick={() => void restoreNpc(npc.slug)} disabled={busy}>
                            Restore
                          </button>
                          <button className="action-button secondary-link" type="button" onClick={() => void hardDeleteNpc(npc.slug)} disabled={busy}>
                            Hard delete
                          </button>
                        </>
                      ) : (
                        <button className="action-button secondary-link" type="button" onClick={() => void archiveNpc(npc.slug)} disabled={busy}>
                          Archive
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="state-card">
          <h2>Import Logs</h2>
          {logs.length === 0 ? (
            <p>No import logs yet.</p>
          ) : (
            <div className="notes-list">
              {logs.map((log) => (
                <article className="note-card" key={log.id}>
                  <div className="note-card-header">
                    <strong>{log.filename}</strong>
                    <span>{log.result}</span>
                  </div>
                  <p>{log.message}</p>
                  <p>{new Date(log.created_at).toLocaleString()}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
