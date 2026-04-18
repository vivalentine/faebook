import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import FaeSelect from "../components/FaeSelect";
import { renderRecapMarkdown } from "../components/RecapMarkdown";
import { apiFetch } from "../lib/api";
import { formatMarkdownPreview } from "../lib/markdownPreview";
import { useWikiEntityIndex } from "../lib/wikiLinks";
import type { CampaignDocument } from "../types";

type DocumentFormState = {
  slug: string;
  title: string;
  document_type: string;
  body_markdown: string;
  published: boolean;
  sort_order: string;
};

const EMPTY_FORM: DocumentFormState = {
  slug: "",
  title: "",
  document_type: "lore",
  body_markdown: "",
  published: false,
  sort_order: "0",
};

function toSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function DocumentsPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isDm = user?.role === "dm";
  const entityWikiIndex = useWikiEntityIndex();

  const [documents, setDocuments] = useState<CampaignDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [form, setForm] = useState<DocumentFormState>(EMPTY_FORM);

  const activeDocument = useMemo(() => {
    if (!documents.length) return null;
    if (!slug) return documents[0] || null;
    return documents.find((doc) => doc.slug === slug) || null;
  }, [documents, slug]);

  const documentTypes = useMemo(() => {
    const values = Array.from(new Set(documents.map((doc) => doc.document_type).filter(Boolean)));
    return values.sort((a, b) => a.localeCompare(b));
  }, [documents]);
  const documentTypeOptions = useMemo(
    () => [
      { value: "all", label: "All categories" },
      ...documentTypes.map((type) => ({ value: type, label: type })),
    ],
    [documentTypes],
  );

  const filteredDocuments = useMemo(() => {
    if (filterType === "all") return documents;
    return documents.filter((doc) => doc.document_type === filterType);
  }, [documents, filterType]);

  async function loadDocuments() {
    try {
      setLoading(true);
      setError("");
      const response = await apiFetch("/api/documents");
      const data = (await response.json()) as CampaignDocument[] | { error?: string };
      if (!response.ok) {
        throw new Error((data as { error?: string }).error || "Failed to load documents");
      }
      setDocuments(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load documents");
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDocuments();
  }, []);

  useEffect(() => {
    if (!slug && documents.length > 0) {
      navigate(`/documents/${documents[0].slug}`, { replace: true });
    }
  }, [documents, navigate, slug]);

  function startEdit(doc: CampaignDocument) {
    setEditingId(doc.id);
    setForm({
      slug: doc.slug,
      title: doc.title,
      document_type: doc.document_type,
      body_markdown: doc.body_markdown,
      published: doc.published,
      sort_order: String(doc.sort_order ?? 0),
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function saveDocument() {
    const payload = {
      slug: toSlug(form.slug || form.title),
      title: form.title.trim(),
      document_type: form.document_type.trim() || "lore",
      body_markdown: form.body_markdown,
      published: form.published,
      sort_order: Number.parseInt(form.sort_order, 10) || 0,
    };

    if (!payload.title || !payload.body_markdown.trim() || !payload.slug) {
      setError("Title, slug, and markdown body are required.");
      return;
    }

    try {
      setIsSaving(true);
      setError("");
      const response = await apiFetch(editingId ? `/api/documents/${editingId}` : "/api/documents", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as CampaignDocument | { error?: string };
      if (!response.ok) {
        throw new Error((data as { error?: string }).error || "Failed to save document");
      }

      const saved = data as CampaignDocument;
      setDocuments((current) => {
        const others = current.filter((doc) => doc.id !== saved.id);
        return [...others, saved].sort((a, b) => {
          if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
          return a.title.localeCompare(b.title);
        });
      });
      resetForm();
      navigate(`/documents/${saved.slug}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save document");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteDocument(doc: CampaignDocument) {
    if (!window.confirm(`Delete ${doc.title}? This cannot be undone.`)) {
      return;
    }
    try {
      const response = await apiFetch(`/api/documents/${doc.id}`, { method: "DELETE" });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete document");
      }
      setDocuments((current) => current.filter((item) => item.id !== doc.id));
      if (activeDocument?.id === doc.id) {
        navigate("/documents");
      }
      if (editingId === doc.id) {
        resetForm();
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete document");
    }
  }

  async function uploadDocument(file: File) {
    const body = new FormData();
    body.set("file", file);
    body.set("published", "false");

    try {
      setUploading(true);
      setError("");
      const response = await apiFetch("/api/documents/import", {
        method: "POST",
        body,
      });
      const data = (await response.json()) as { document?: CampaignDocument; error?: string };
      if (!response.ok || !data.document) {
        throw new Error(data.error || "Failed to import document");
      }
      setDocuments((current) => {
        const others = current.filter((doc) => doc.id !== data.document?.id);
        return [...others, data.document as CampaignDocument].sort((a, b) => {
          if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
          return a.title.localeCompare(b.title);
        });
      });
      navigate(`/documents/${data.document.slug}`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Failed to import document");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="chapters-page documents-page">
      <div className="page-heading">
        <h1>Library & Archive</h1>
        <p className="topbar-meta">In-world dossiers, diaries, and lore texts.</p>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}

      <div className="chapters-layout documents-layout">
        <article className="state-card chapters-index-card documents-index-card">
          <div className="documents-index-header">
            <h2>Documents</h2>
            <FaeSelect
              className="text-input"
              value={filterType}
              onChange={setFilterType}
              options={documentTypeOptions}
              ariaLabel="Filter documents by category"
            />
          </div>
          {loading ? <p className="topbar-meta">Loading library…</p> : null}
          {!loading && filteredDocuments.length === 0 ? (
            <p className="topbar-meta">No documents found.</p>
          ) : (
            <ul className="chapter-list">
              {filteredDocuments.map((doc) => (
                <li key={doc.id} className={`chapter-list-item ${activeDocument?.id === doc.id ? "active" : ""}`.trim()}>
                  <Link to={`/documents/${doc.slug}`} className="chapter-list-link">
                    <span className="chapter-list-meta">{doc.document_type || "lore"}</span>
                    <strong>{doc.title}</strong>
                    {isDm ? (
                      <span className={`chapter-status ${doc.published ? "published" : "draft"}`.trim()}>
                        {doc.published ? "Published" : "Draft"}
                      </span>
                    ) : null}
                    <span className="topbar-meta documents-card-excerpt">{formatMarkdownPreview(doc.body_markdown)}</span>
                  </Link>
                  {isDm ? (
                    <div className="chapter-list-admin-actions">
                      <button type="button" className="secondary-link" onClick={() => startEdit(doc)}>
                        Edit
                      </button>
                      <button type="button" className="board-node-delete-button" onClick={() => void deleteDocument(doc)}>
                        Delete
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="state-card chapter-reader-card documents-reader-card">
          {activeDocument ? (
            <>
              <header className="chapter-reader-header">
                <p className="topbar-meta">
                  {activeDocument.document_type}
                  {isDm ? ` · ${activeDocument.published ? "Published" : "Draft"}` : ""}
                </p>
                <h2>{activeDocument.title}</h2>
              </header>
              <div className="dashboard-markdown chapter-reader-markdown documents-reader-markdown reader-prose">
                {renderRecapMarkdown(activeDocument.body_markdown, { entityIndex: entityWikiIndex })}
              </div>
            </>
          ) : (
            <p className="topbar-meta">Choose a document to begin reading.</p>
          )}
        </article>
      </div>

      {isDm ? (
        <article className="state-card chapter-editor-card documents-editor-card">
          <div className="dashboard-recap-editor-header">
            <h2>{editingId ? "Edit document" : "New document"}</h2>
            {editingId ? (
              <button type="button" className="secondary-link" onClick={resetForm}>
                Cancel
              </button>
            ) : null}
          </div>

          <div className="chapter-editor-grid documents-editor-grid">
            <input
              className="text-input"
              placeholder="Slug"
              value={form.slug}
              onChange={(event) => setForm((current) => ({ ...current, slug: toSlug(event.target.value) }))}
            />
            <input
              className="text-input"
              placeholder="Title"
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  title: event.target.value,
                  slug: current.slug || toSlug(event.target.value),
                }))
              }
            />
            <input
              className="text-input"
              placeholder="Category"
              value={form.document_type}
              onChange={(event) => setForm((current) => ({ ...current, document_type: event.target.value }))}
            />
            <input
              className="text-input"
              type="number"
              min={0}
              placeholder="Sort order"
              value={form.sort_order}
              onChange={(event) => setForm((current) => ({ ...current, sort_order: event.target.value }))}
            />
          </div>

          <label className="chapter-publish-toggle">
            <input
              type="checkbox"
              checked={form.published}
              onChange={(event) => setForm((current) => ({ ...current, published: event.target.checked }))}
            />
            Published (players only see published documents)
          </label>

          <textarea
            className="text-area"
            rows={14}
            placeholder="Write markdown content..."
            value={form.body_markdown}
            onChange={(event) => setForm((current) => ({ ...current, body_markdown: event.target.value }))}
          />

          <div className="dashboard-row-actions documents-editor-actions">
            <button className="action-button" type="button" disabled={isSaving} onClick={() => void saveDocument()}>
              {isSaving ? "Saving..." : editingId ? "Update document" : "Create document"}
            </button>
            <label className="secondary-link documents-upload-button">
              {uploading ? "Uploading..." : "Import .md"}
              <input
                type="file"
                accept=".md,text/markdown"
                disabled={uploading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void uploadDocument(file);
                  }
                  event.currentTarget.value = "";
                }}
              />
            </label>
          </div>
        </article>
      ) : null}
    </section>
  );
}
