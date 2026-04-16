import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";
import {
  BLOOMS,
  formatSummerCourtDateTimeFull,
  toSummerCourtDateTimeOrNull,
} from "../lib/summerCourtCalendar";

type CampaignDateState = {
  crown_year: number;
  bloom_index: number;
  petal: number;
  bell: number;
  chime: number;
  updated_at: string;
};

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

type LocationImportPreviewFile = {
  filename: string;
  parsed_name: string | null;
  slug: string | null;
  status: "create" | "update" | null;
  state: string;
  validation_issues: string[];
  warnings: string[];
  preview_snippet?: string;
};

type LocationImportPreview = {
  staged_markdown_count: number;
  files: LocationImportPreviewFile[];
};

type WhisperImportPreviewComment = {
  comment_key: string | null;
  status: "create" | "update" | null;
  validation_issues: string[];
  warnings: string[];
};

type WhisperImportPreviewPost = {
  title: string | null;
  post_key: string | null;
  status: "create" | "update" | null;
  timestamp: {
    crown_year: number | null;
    bloom_index: number | null;
    petal: number | null;
    bell: number | null;
    chime: number | null;
  };
  comment_count: number;
  invalid_comment_count: number;
  validation_issues: string[];
  warnings: string[];
  comments: WhisperImportPreviewComment[];
};

type WhisperImportPreviewFile = {
  filename: string;
  size: number;
  uploaded_at: string;
  source_label: string;
  mode: string | null;
  schema_version: number | null;
  validation_issues: string[];
  warnings: string[];
  summary: {
    create: number;
    update: number;
    invalid: number;
    posts: number;
  };
  posts: WhisperImportPreviewPost[];
};

type WhisperImportPreview = {
  staged_file_count: number;
  totals: {
    create: number;
    update: number;
    invalid: number;
    warnings: number;
  };
  files: WhisperImportPreviewFile[];
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
  const [locationPreview, setLocationPreview] = useState<LocationImportPreview | null>(null);
  const [whisperPreview, setWhisperPreview] = useState<WhisperImportPreview | null>(null);
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [finalizeResult, setFinalizeResult] = useState("");
  const [backupResult, setBackupResult] = useState<BackupResult | null>(null);
  const [cleanupItems, setCleanupItems] = useState<NpcCleanupItem[]>([]);
  const [campaignDate, setCampaignDate] = useState<CampaignDateState | null>(null);
  const [campaignYearDraft, setCampaignYearDraft] = useState("");
  const [campaignBloomDraft, setCampaignBloomDraft] = useState("6");
  const [campaignPetalDraft, setCampaignPetalDraft] = useState("18");
  const [campaignBellDraft, setCampaignBellDraft] = useState("");
  const [campaignChimeDraft, setCampaignChimeDraft] = useState("");

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    try {
      setLoading(true);
      setError("");

      const [
        previewResponse,
        locationPreviewResponse,
        whisperPreviewResponse,
        logsResponse,
        cleanupResponse,
        campaignDateResponse,
      ] = await Promise.all([
        apiFetch("/api/dm/import/staging"),
        apiFetch("/api/dm/location-import/staging"),
        apiFetch("/api/dm/whisper-import/staging"),
        apiFetch("/api/dm/import/logs"),
        apiFetch("/api/dm/npcs?include_archived=1"),
        apiFetch("/api/dm/campaign-date"),
      ]);

      if (!previewResponse.ok) {
        throw new Error(`Failed loading staging preview: ${previewResponse.status}`);
      }
      if (!locationPreviewResponse.ok) {
        throw new Error(`Failed loading location staging preview: ${locationPreviewResponse.status}`);
      }
      if (!whisperPreviewResponse.ok) {
        throw new Error(`Failed loading whisper staging preview: ${whisperPreviewResponse.status}`);
      }

      if (!logsResponse.ok) {
        throw new Error(`Failed loading import logs: ${logsResponse.status}`);
      }
      if (!cleanupResponse.ok) {
        throw new Error(`Failed loading NPC cleanup list: ${cleanupResponse.status}`);
      }
      if (!campaignDateResponse.ok) {
        throw new Error(`Failed loading campaign date: ${campaignDateResponse.status}`);
      }

      setPreview(await previewResponse.json());
      setLocationPreview(await locationPreviewResponse.json());
      setWhisperPreview(await whisperPreviewResponse.json());
      setLogs(await logsResponse.json());
      setCleanupItems(await cleanupResponse.json());
      const loadedCampaignDate = (await campaignDateResponse.json()) as CampaignDateState;
      setCampaignDate(loadedCampaignDate);
      setCampaignYearDraft(String(loadedCampaignDate.crown_year));
      setCampaignBloomDraft(String(loadedCampaignDate.bloom_index));
      setCampaignPetalDraft(String(loadedCampaignDate.petal));
      setCampaignBellDraft(String(loadedCampaignDate.bell));
      setCampaignChimeDraft(String(loadedCampaignDate.chime));
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

  async function uploadLocationFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    try {
      setBusy(true);
      setError("");
      setFinalizeResult("");

      const formData = new FormData();
      Array.from(fileList).forEach((file) => formData.append("files", file));

      const response = await apiFetch("/api/dm/location-import/staging/markdown", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Upload failed: ${response.status}`);
      }

      setLocationPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  async function loadLocationFixtures() {
    try {
      setBusy(true);
      setError("");
      setFinalizeResult("");
      const response = await apiFetch("/api/dm/location-import/staging/fixtures", { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Failed to load location fixtures: ${response.status}`);
      }
      setLocationPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  async function uploadWhisperFile(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];

    try {
      setBusy(true);
      setError("");
      setFinalizeResult("");

      const formData = new FormData();
      formData.append("file", file);

      const response = await apiFetch("/api/dm/whisper-import/staging/file", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Upload failed: ${response.status}`);
      }

      setWhisperPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  async function clearWhisperStaging() {
    try {
      setBusy(true);
      setError("");
      setFinalizeResult("");
      const response = await apiFetch("/api/dm/whisper-import/staging/clear", { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Failed to clear whisper staging: ${response.status}`);
      }
      setWhisperPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  async function finalizeWhisperImport() {
    if (!window.confirm("Finalize staged whisper import now?")) return;

    try {
      setBusy(true);
      setError("");
      setFinalizeResult("");

      const response = await apiFetch("/api/dm/whisper-import/finalize", { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Finalize failed: ${response.status}`);
      }

      const created = (data.results || []).reduce(
        (sum: number, item: { created?: number }) => sum + Number(item.created || 0),
        0
      );
      const updated = (data.results || []).reduce(
        (sum: number, item: { updated?: number }) => sum + Number(item.updated || 0),
        0
      );
      const invalid = (data.results || []).reduce(
        (sum: number, item: { invalid?: number }) => sum + Number(item.invalid || 0),
        0
      );
      setFinalizeResult(`Whisper import complete. Created: ${created}, Updated: ${updated}, Invalid: ${invalid}.`);

      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  async function clearLocationStaging() {
    try {
      setBusy(true);
      setError("");
      setFinalizeResult("");
      const response = await apiFetch("/api/dm/location-import/staging/clear", { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Failed to clear location staging: ${response.status}`);
      }
      setLocationPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  async function finalizeLocationImport() {
    if (!window.confirm("Finalize staged location import now?")) return;

    try {
      setBusy(true);
      setError("");
      setFinalizeResult("");

      const response = await apiFetch("/api/dm/location-import/finalize", { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Finalize failed: ${response.status}`);
      }

      const created = (data.results || []).filter((item: { result: string }) => item.result === "created").length;
      const updated = (data.results || []).filter((item: { result: string }) => item.result === "updated").length;
      const invalid = (data.results || []).filter((item: { result: string }) => item.result === "invalid").length;
      setFinalizeResult(`Location import complete. Created: ${created}, Updated: ${updated}, Invalid: ${invalid}.`);

      await refresh();
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

  async function saveCampaignDate() {
    const payload = {
      crown_year: Number.parseInt(campaignYearDraft, 10),
      bloom_index: Number.parseInt(campaignBloomDraft, 10),
      petal: Number.parseInt(campaignPetalDraft, 10),
      bell: campaignBellDraft.trim() ? Number.parseInt(campaignBellDraft, 10) : undefined,
      chime: campaignChimeDraft.trim() ? Number.parseInt(campaignChimeDraft, 10) : undefined,
    };

    try {
      setBusy(true);
      setError("");
      const response = await apiFetch("/api/dm/campaign-date", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as CampaignDateState | { error?: string };

      if (!response.ok) {
        throw new Error((data as { error?: string }).error || `Save failed: ${response.status}`);
      }

      const next = data as CampaignDateState;
      setCampaignDate(next);
      setCampaignYearDraft(String(next.crown_year));
      setCampaignBloomDraft(String(next.bloom_index));
      setCampaignPetalDraft(String(next.petal));
      setCampaignBellDraft(String(next.bell));
      setCampaignChimeDraft(String(next.chime));
      setFinalizeResult("Campaign date updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  const campaignPreview = toSummerCourtDateTimeOrNull({
    crown_year: Number.parseInt(campaignYearDraft, 10),
    bloom_index: Number.parseInt(campaignBloomDraft, 10),
    petal: Number.parseInt(campaignPetalDraft, 10),
    bell: campaignBellDraft.trim()
      ? Number.parseInt(campaignBellDraft, 10)
      : Number(campaignDate?.bell ?? 0),
    chime: campaignChimeDraft.trim()
      ? Number.parseInt(campaignChimeDraft, 10)
      : Number(campaignDate?.chime ?? 0),
  });

  const summary = useMemo(() => {
    if (!preview) return { create: 0, update: 0, invalid: 0 };
    return {
      create: preview.files.filter((file) => file.status === "create").length,
      update: preview.files.filter((file) => file.status === "update").length,
      invalid: preview.files.filter((file) => file.validation_issues.length > 0).length,
    };
  }, [preview]);

  const locationSummary = useMemo(() => {
    if (!locationPreview) return { create: 0, update: 0, invalid: 0 };
    return {
      create: locationPreview.files.filter((file) => file.status === "create").length,
      update: locationPreview.files.filter((file) => file.status === "update").length,
      invalid: locationPreview.files.filter((file) => file.validation_issues.length > 0).length,
    };
  }, [locationPreview]);

  const whisperSummary = useMemo(() => {
    if (!whisperPreview) return { create: 0, update: 0, invalid: 0 };
    return {
      create: whisperPreview.totals.create,
      update: whisperPreview.totals.update,
      invalid: whisperPreview.totals.invalid,
    };
  }, [whisperPreview]);

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
          <span>Location markdown staged: {locationPreview?.staged_markdown_count || 0}</span>
          <span>Whisper JSON staged: {whisperPreview?.staged_file_count || 0}</span>
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
          <h2>Campaign Date</h2>
          <p>Set the current in-world Summer Court date for dashboard and timeline context.</p>
          <div className="toolbar-grid dm-tools-campaign-date-grid">
            <label className="toolbar-field">
              <span>Crown Year</span>
              <input
                className="text-input"
                type="number"
                min={1}
                value={campaignYearDraft}
                onChange={(event) => setCampaignYearDraft(event.target.value)}
              />
            </label>
            <label className="toolbar-field">
              <span>Bloom</span>
              <select
                className="text-input"
                value={campaignBloomDraft}
                onChange={(event) => setCampaignBloomDraft(event.target.value)}
              >
                {BLOOMS.map((bloom) => (
                  <option key={bloom.index} value={bloom.index}>
                    {bloom.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="toolbar-field">
              <span>Petal</span>
              <input
                className="text-input"
                type="number"
                min={1}
                max={28}
                value={campaignPetalDraft}
                onChange={(event) => setCampaignPetalDraft(event.target.value)}
              />
            </label>
            <label className="toolbar-field">
              <span>Bell (optional)</span>
              <input
                className="text-input"
                type="number"
                min={0}
                max={23}
                placeholder={campaignDate ? String(campaignDate.bell) : "0"}
                value={campaignBellDraft}
                onChange={(event) => setCampaignBellDraft(event.target.value)}
              />
            </label>
            <label className="toolbar-field">
              <span>Chime (optional)</span>
              <input
                className="text-input"
                type="number"
                min={0}
                max={59}
                placeholder={campaignDate ? String(campaignDate.chime) : "0"}
                value={campaignChimeDraft}
                onChange={(event) => setCampaignChimeDraft(event.target.value)}
              />
            </label>
          </div>
          <p className="topbar-meta">
            Preview: {campaignPreview ? formatSummerCourtDateTimeFull(campaignPreview) : "Enter a valid date"}
          </p>
          {campaignDate ? (
            <p className="topbar-meta">Last updated: {new Date(campaignDate.updated_at).toLocaleString()}</p>
          ) : null}
          <div className="note-actions">
            <button className="action-button" type="button" onClick={() => void saveCampaignDate()} disabled={busy || !campaignPreview}>
              Save Campaign Date
            </button>
          </div>
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
          <h2>Whisper Importer</h2>
          <p>Stage Whisper Network JSON files, review upsert status, then finalize imported posts and comments.</p>

          <div className="toolbar-grid">
            <label className="toolbar-field">
              <span>Upload whisper JSON (.json)</span>
              <input
                className="text-input"
                type="file"
                accept=".json,application/json,text/json"
                onChange={(event) => {
                  void uploadWhisperFile(event.target.files);
                  event.currentTarget.value = "";
                }}
                disabled={busy}
              />
            </label>
          </div>

          <div className="note-actions">
            <button className="action-button secondary-link" type="button" onClick={() => void clearWhisperStaging()} disabled={busy}>
              Clear whisper staging
            </button>
            <button
              className="action-button"
              type="button"
              onClick={() => void finalizeWhisperImport()}
              disabled={busy || (whisperPreview?.files.length || 0) === 0}
            >
              Finalize whisper import
            </button>
          </div>

          <p>
            Create: {whisperSummary.create} • Update: {whisperSummary.update} • Invalid: {whisperSummary.invalid}
          </p>

          {(whisperPreview?.files || []).length === 0 ? (
            <p>No staged whisper JSON files yet.</p>
          ) : (
            <div className="notes-list">
              {(whisperPreview?.files || []).map((file) => (
                <article className="note-card" key={`${file.filename}-${file.uploaded_at}`}>
                  <div className="note-card-header">
                    <strong>{file.filename}</strong>
                    <span>
                      create {file.summary.create} • update {file.summary.update} • invalid {file.summary.invalid}
                    </span>
                  </div>
                  <p>Source label: {file.source_label}</p>
                  <p>Schema: {file.schema_version ?? "—"} • Mode: {file.mode || "—"}</p>
                  <p>Staged at: {new Date(file.uploaded_at).toLocaleString()}</p>
                  {file.validation_issues.length ? <p>Validation issues: {file.validation_issues.join("; ")}</p> : null}
                  {file.warnings.length ? <p>Warnings: {file.warnings.join("; ")}</p> : null}
                  {(file.posts || []).map((post, postIndex) => (
                    <div className="state-card small-card" key={`${file.filename}-${post.post_key || post.title || postIndex}`}>
                      <div className="note-card-header">
                        <strong>{post.title || "Untitled post"}</strong>
                        <span>{post.status || "invalid"}</span>
                      </div>
                      <p>Post key: {post.post_key || "—"}</p>
                      <p>
                        Timestamp:{" "}
                        {post.timestamp.crown_year !== null
                          ? `Year ${post.timestamp.crown_year}, Bloom ${post.timestamp.bloom_index}, Petal ${post.timestamp.petal}, Bell ${post.timestamp.bell}, Chime ${post.timestamp.chime}`
                          : "Unrecorded"}
                      </p>
                      <p>
                        Comments: {post.comment_count} (invalid: {post.invalid_comment_count})
                      </p>
                      {post.validation_issues.length ? <p>Validation issues: {post.validation_issues.join("; ")}</p> : null}
                      {post.warnings.length ? <p>Warnings: {post.warnings.join("; ")}</p> : null}
                    </div>
                  ))}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="state-card">
          <h2>Location Importer</h2>
          <p>
            Stage location markdown files, review create/update status, then finalize into the locations atlas table.
          </p>

          <div className="toolbar-grid">
            <label className="toolbar-field">
              <span>Upload location markdown (.md)</span>
              <input
                className="text-input"
                type="file"
                accept=".md,text/markdown"
                multiple
                onChange={(event) => {
                  void uploadLocationFiles(event.target.files);
                  event.currentTarget.value = "";
                }}
                disabled={busy}
              />
            </label>
          </div>

          <div className="note-actions">
            <button className="action-button" type="button" onClick={() => void loadLocationFixtures()} disabled={busy}>
              Use location fixtures
            </button>
            <button className="action-button secondary-link" type="button" onClick={() => void clearLocationStaging()} disabled={busy}>
              Clear location staging
            </button>
            <button
              className="action-button"
              type="button"
              onClick={() => void finalizeLocationImport()}
              disabled={busy || (locationPreview?.files.length || 0) === 0}
            >
              Finalize location import
            </button>
          </div>

          <p>
            Create: {locationSummary.create} • Update: {locationSummary.update} • Invalid: {locationSummary.invalid}
          </p>

          {(locationPreview?.files || []).length === 0 ? (
            <p>No staged location markdown files yet.</p>
          ) : (
            <div className="notes-list">
              {(locationPreview?.files || []).map((item) => (
                <article className="note-card" key={item.filename}>
                  <div className="note-card-header">
                    <strong>{item.filename}</strong>
                    <span>{item.status || item.state}</span>
                  </div>
                  <p>Name: {item.parsed_name || "—"}</p>
                  <p>Slug: {item.slug || "—"}</p>
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
