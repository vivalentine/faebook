import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { renderRecapMarkdown } from "../components/RecapMarkdown";
import { apiFetch } from "../lib/api";
import { useWikiNpcIndex } from "../lib/wikiLinks";
import type { SessionRecap } from "../types";

type ChapterFormState = {
  chapter_number: string;
  chapter_title: string;
  content: string;
  is_published: boolean;
};

const EMPTY_FORM: ChapterFormState = {
  chapter_number: "",
  chapter_title: "",
  content: "",
  is_published: true,
};

function getExcerpt(content: string) {
  const compact = content.replace(/\s+/g, " ").trim();
  return compact.length > 180 ? `${compact.slice(0, 180)}…` : compact;
}

export default function ChaptersPage() {
  const { chapterNumber } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isDm = user?.role === "dm";
  const [chapters, setChapters] = useState<SessionRecap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ChapterFormState>(EMPTY_FORM);
  const npcWikiIndex = useWikiNpcIndex();

  const activeChapterNumber = Number.parseInt(chapterNumber || "", 10);

  const activeChapter = useMemo(() => {
    if (Number.isInteger(activeChapterNumber)) {
      return chapters.find((chapter) => chapter.chapter_number === activeChapterNumber) || null;
    }
    return chapters[0] || null;
  }, [activeChapterNumber, chapters]);

  const chapterIndexes = useMemo(
    () => chapters.map((chapter) => chapter.chapter_number).sort((a, b) => a - b),
    [chapters],
  );

  const previousChapterNumber = useMemo(() => {
    if (!activeChapter) return null;
    const index = chapterIndexes.findIndex((number) => number === activeChapter.chapter_number);
    if (index <= 0) return null;
    return chapterIndexes[index - 1];
  }, [activeChapter, chapterIndexes]);

  const nextChapterNumber = useMemo(() => {
    if (!activeChapter) return null;
    const index = chapterIndexes.findIndex((number) => number === activeChapter.chapter_number);
    if (index < 0 || index + 1 >= chapterIndexes.length) return null;
    return chapterIndexes[index + 1];
  }, [activeChapter, chapterIndexes]);

  async function loadChapters() {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch("/api/session-recaps");
      const data = (await response.json()) as SessionRecap[] | { error?: string };
      if (!response.ok) {
        throw new Error((data as { error?: string }).error || "Failed to load chapter library");
      }
      setChapters(data as SessionRecap[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load chapter library");
      setChapters([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadChapters();
  }, []);

  useEffect(() => {
    if (!activeChapter && chapters.length > 0 && !chapterNumber) {
      navigate(`/chapters/${chapters[0].chapter_number}`, { replace: true });
    }
  }, [activeChapter, chapterNumber, chapters, navigate]);

  function startEdit(chapter: SessionRecap) {
    setEditingId(chapter.id);
    setForm({
      chapter_number: String(chapter.chapter_number),
      chapter_title: chapter.chapter_title,
      content: chapter.content,
      is_published: chapter.is_published,
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function saveChapter() {
    const chapter_number = Number.parseInt(form.chapter_number, 10);
    if (!Number.isInteger(chapter_number) || chapter_number <= 0 || !form.chapter_title.trim() || !form.content.trim()) {
      setError("Chapter number, title, and content are required.");
      return;
    }

    try {
      setIsSaving(true);
      setError("");
      const response = await apiFetch(editingId ? `/api/session-recaps/${editingId}` : "/api/session-recaps", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify({
          chapter_number,
          chapter_title: form.chapter_title,
          title: "Lumi’s Session Recap",
          content: form.content,
          is_published: form.is_published,
        }),
      });
      const data = (await response.json()) as SessionRecap | { error?: string };
      if (!response.ok) {
        throw new Error((data as { error?: string }).error || "Failed to save chapter");
      }
      const saved = data as SessionRecap;
      setChapters((current) => {
        const filtered = current.filter((chapter) => chapter.id !== saved.id);
        return [...filtered, saved].sort((a, b) => a.chapter_number - b.chapter_number);
      });
      resetForm();
      navigate(`/chapters/${saved.chapter_number}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save chapter");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteChapter(chapter: SessionRecap) {
    if (!window.confirm(`Delete Chapter ${chapter.chapter_number}? This cannot be undone.`)) {
      return;
    }
    try {
      const response = await apiFetch(`/api/session-recaps/${chapter.id}`, { method: "DELETE" });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete chapter");
      }
      setChapters((current) => current.filter((item) => item.id !== chapter.id));
      if (activeChapter?.id === chapter.id) {
        navigate("/chapters");
      }
      if (editingId === chapter.id) {
        resetForm();
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete chapter");
    }
  }

  return (
    <section className="chapters-page">
      <div className="page-heading">
        <h1>Lumi’s Chapter Library</h1>
        <p className="topbar-meta">A story archive of published campaign chapters.</p>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}

      <div className="chapters-layout">
        <article className="state-card chapters-index-card">
          <h2>Chapters</h2>
          {loading ? <p className="topbar-meta">Loading chapter archive…</p> : null}
          {!loading && chapters.length === 0 ? (
            <p className="topbar-meta">No published recaps yet.</p>
          ) : (
            <ul className="chapter-list">
              {chapters.map((chapter) => (
                <li key={chapter.id} className={`chapter-list-item ${activeChapter?.id === chapter.id ? "active" : ""}`.trim()}>
                  <Link to={`/chapters/${chapter.chapter_number}`} className="chapter-list-link">
                    <span className="chapter-list-meta">Chapter {chapter.chapter_number}</span>
                    <strong>{chapter.chapter_title}</strong>
                    {isDm ? (
                      <span className={`chapter-status ${chapter.is_published ? "published" : "draft"}`.trim()}>
                        {chapter.is_published ? "Published" : "Draft"}
                      </span>
                    ) : null}
                    <span className="topbar-meta">{getExcerpt(chapter.content)}</span>
                  </Link>
                  {isDm ? (
                    <div className="chapter-list-admin-actions">
                      <button type="button" className="secondary-link" onClick={() => startEdit(chapter)}>
                        Edit
                      </button>
                      <button type="button" className="board-node-delete-button" onClick={() => void deleteChapter(chapter)}>
                        Delete
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="state-card chapter-reader-card">
          {activeChapter ? (
            <>
              <header className="chapter-reader-header">
                <p className="topbar-meta">
                  Chapter {activeChapter.chapter_number}
                  {isDm ? ` · ${activeChapter.is_published ? "Published" : "Draft"}` : ""}
                </p>
                <h2>{activeChapter.chapter_title}</h2>
              </header>
              <div className="dashboard-markdown chapter-reader-markdown">
                {renderRecapMarkdown(activeChapter.content, { npcIndex: npcWikiIndex })}
              </div>
              <div className="chapter-reader-nav">
                {previousChapterNumber ? (
                  <Link to={`/chapters/${previousChapterNumber}`} className="secondary-link">
                    ← Previous chapter
                  </Link>
                ) : (
                  <span className="topbar-meta">No previous chapter.</span>
                )}
                {nextChapterNumber ? (
                  <Link to={`/chapters/${nextChapterNumber}`} className="secondary-link">
                    Next chapter →
                  </Link>
                ) : (
                  <span className="topbar-meta">No next chapter.</span>
                )}
              </div>
            </>
          ) : (
            <p className="topbar-meta">Choose a chapter to begin reading.</p>
          )}
        </article>
      </div>

      {isDm ? (
        <article className="state-card chapter-editor-card">
          <div className="dashboard-recap-editor-header">
            <h2>{editingId ? "Edit chapter" : "New chapter"}</h2>
            {editingId ? (
              <button type="button" className="secondary-link" onClick={resetForm}>
                Cancel
              </button>
            ) : null}
          </div>
          <div className="chapter-editor-grid">
            <input
              className="text-input"
              type="number"
              min={1}
              placeholder="Chapter number"
              value={form.chapter_number}
              onChange={(event) => setForm((current) => ({ ...current, chapter_number: event.target.value }))}
            />
            <input
              className="text-input"
              placeholder="Chapter title"
              value={form.chapter_title}
              onChange={(event) => setForm((current) => ({ ...current, chapter_title: event.target.value }))}
            />
          </div>
          <label className="chapter-publish-toggle">
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={(event) => setForm((current) => ({ ...current, is_published: event.target.checked }))}
            />
            Published (uncheck to keep as DM-only draft)
          </label>
          <textarea
            className="text-area"
            rows={10}
            placeholder="Write chapter recap in markdown..."
            value={form.content}
            onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
          />
          <div className="dashboard-row-actions">
            <button className="action-button" type="button" disabled={isSaving} onClick={() => void saveChapter()}>
              {isSaving ? "Saving..." : editingId ? "Update chapter" : "Create chapter"}
            </button>
          </div>
        </article>
      ) : null}
    </section>
  );
}
