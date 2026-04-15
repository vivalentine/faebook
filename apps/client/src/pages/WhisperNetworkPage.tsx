import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api";
import {
  formatSummerCourtCommentDateTime,
  formatSummerCourtDateTimeFull,
  formatSummerCourtDateTimeStandard,
  getBellPeriodName,
  getPhaseIndexFromPetal,
  toSummerCourtDateTimeOrNull,
  type SummerCourtDateTime,
} from "../lib/summerCourtCalendar";
import type { WhisperComment, WhisperPost } from "../types";

type WhisperFeedResponse = {
  posts: WhisperPost[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
};

type WhisperPostDetailResponse = {
  post: WhisperPost;
  comments: WhisperComment[];
};

function getSummerCourtFromWhisperRecord(record: {
  crown_year: number | null;
  bloom_index: number | null;
  petal: number | null;
  bell: number | null;
  chime: number | null;
  created_at: string;
}): SummerCourtDateTime | null {
  return (
    toSummerCourtDateTimeOrNull({
      crown_year: record.crown_year ?? undefined,
      bloom_index: record.bloom_index ?? undefined,
      petal: record.petal ?? undefined,
      bell: record.bell ?? undefined,
      chime: record.chime ?? undefined,
    }) || null
  );
}

function getPostFeedTimestamp(post: WhisperPost): string {
  const dt = getSummerCourtFromWhisperRecord(post);
  if (!dt) return "Unrecorded court time";
  return formatSummerCourtDateTimeStandard(dt);
}

function getPostDetailTimestamp(post: WhisperPost): string {
  const dt = getSummerCourtFromWhisperRecord(post);
  if (!dt) return "Unrecorded court time";
  return formatSummerCourtDateTimeFull(dt);
}

function getCommentTimestamp(comment: WhisperComment): string {
  const dt = getSummerCourtFromWhisperRecord(comment);
  if (!dt) return "Unrecorded court time";
  return formatSummerCourtCommentDateTime(dt);
}

export default function WhisperNetworkPage() {
  const { user } = useAuth();
  const isDm = user?.role === "dm";

  const [posts, setPosts] = useState<WhisperPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [commentsByPostId, setCommentsByPostId] = useState<Record<number, WhisperComment[]>>({});
  const [expandedPostIds, setExpandedPostIds] = useState<Record<number, boolean>>({});
  const [commentDraftByPostId, setCommentDraftByPostId] = useState<Record<number, string>>({});
  const [isSubmittingCommentByPostId, setIsSubmittingCommentByPostId] = useState<Record<number, boolean>>({});

  const [postTitleDraft, setPostTitleDraft] = useState("");
  const [postBodyDraft, setPostBodyDraft] = useState("");
  const [postLikeCountDraft, setPostLikeCountDraft] = useState("0");
  const [postViewCountDraft, setPostViewCountDraft] = useState("0");
  const [postCrownYearDraft, setPostCrownYearDraft] = useState("");
  const [postBloomIndexDraft, setPostBloomIndexDraft] = useState("");
  const [postPetalDraft, setPostPetalDraft] = useState("");
  const [postBellDraft, setPostBellDraft] = useState("");
  const [postChimeDraft, setPostChimeDraft] = useState("");
  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [isSavingPost, setIsSavingPost] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [commentCrownYearDraft, setCommentCrownYearDraft] = useState("");
  const [commentBloomIndexDraft, setCommentBloomIndexDraft] = useState("");
  const [commentPetalDraft, setCommentPetalDraft] = useState("");
  const [commentBellDraft, setCommentBellDraft] = useState("");
  const [commentChimeDraft, setCommentChimeDraft] = useState("");
  const [isSavingCommentTime, setIsSavingCommentTime] = useState(false);

  const activePost = useMemo(
    () => posts.find((post) => post.id === selectedPostId) || null,
    [posts, selectedPostId],
  );

  async function loadFeed() {
    try {
      setLoading(true);
      setError("");
      const response = await apiFetch("/api/whisper/posts?limit=40&offset=0");
      const data = (await response.json()) as WhisperFeedResponse | { error?: string };
      if (!response.ok) {
        throw new Error((data as { error?: string }).error || "Failed to load whisper feed");
      }
      const loadedPosts = (data as WhisperFeedResponse).posts || [];
      setPosts(loadedPosts);
      if (loadedPosts.length > 0) {
        setSelectedPostId((current) => current ?? loadedPosts[0].id);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load whisper feed");
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFeed();
  }, []);

  async function loadPostDetails(postId: number) {
    try {
      const response = await apiFetch(`/api/whisper/posts/${postId}`);
      const data = (await response.json()) as WhisperPostDetailResponse | { error?: string };
      if (!response.ok) {
        throw new Error((data as { error?: string }).error || "Failed to load post details");
      }
      const detail = data as WhisperPostDetailResponse;
      setCommentsByPostId((current) => ({ ...current, [postId]: detail.comments || [] }));
      setPosts((current) => current.map((post) => (post.id === postId ? detail.post : post)));
    } catch (detailsError) {
      setError(detailsError instanceof Error ? detailsError.message : "Failed to load post details");
    }
  }

  async function openPost(postId: number) {
    setSelectedPostId(postId);
    if (!commentsByPostId[postId]) {
      await loadPostDetails(postId);
    }
  }

  async function togglePostExpansion(postId: number) {
    setExpandedPostIds((current) => ({ ...current, [postId]: !current[postId] }));
    await openPost(postId);
  }

  async function toggleLike(postId: number) {
    try {
      const response = await apiFetch(`/api/whisper/posts/${postId}/likes`, { method: "POST" });
      const data = (await response.json()) as { liked?: boolean; like_count?: number; error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Failed to toggle like");
      }

      const liked = Boolean(data.liked);
      const likeCount = Number(data.like_count || 0);
      setPosts((current) =>
        current.map((post) =>
          post.id === postId ? { ...post, liked_by_me: liked, like_count: likeCount } : post,
        ),
      );
    } catch (likeError) {
      setError(likeError instanceof Error ? likeError.message : "Failed to toggle like");
    }
  }

  async function submitComment(postId: number) {
    const body = String(commentDraftByPostId[postId] || "").trim();
    if (!body) {
      return;
    }

    try {
      setIsSubmittingCommentByPostId((current) => ({ ...current, [postId]: true }));
      const response = await apiFetch(`/api/whisper/posts/${postId}/comments`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      const data = (await response.json()) as WhisperComment | { error?: string };
      if (!response.ok) {
        throw new Error((data as { error?: string }).error || "Failed to post comment");
      }

      const createdComment = data as WhisperComment;
      setCommentsByPostId((current) => ({
        ...current,
        [postId]: [...(current[postId] || []), createdComment],
      }));
      setCommentDraftByPostId((current) => ({ ...current, [postId]: "" }));
      setPosts((current) =>
        current.map((post) =>
          post.id === postId ? { ...post, comment_count: post.comment_count + 1 } : post,
        ),
      );
    } catch (commentError) {
      setError(commentError instanceof Error ? commentError.message : "Failed to post comment");
    } finally {
      setIsSubmittingCommentByPostId((current) => ({ ...current, [postId]: false }));
    }
  }

  function startEditPost(post: WhisperPost) {
    setEditingPostId(post.id);
    setPostTitleDraft(post.title);
    setPostBodyDraft(post.body);
    setPostLikeCountDraft(String(post.like_count));
    setPostViewCountDraft(String(post.view_count));
    setPostCrownYearDraft(post.crown_year == null ? "" : String(post.crown_year));
    setPostBloomIndexDraft(post.bloom_index == null ? "" : String(post.bloom_index));
    setPostPetalDraft(post.petal == null ? "" : String(post.petal));
    setPostBellDraft(post.bell == null ? "" : String(post.bell));
    setPostChimeDraft(post.chime == null ? "" : String(post.chime));
  }

  function resetPostForm() {
    setEditingPostId(null);
    setPostTitleDraft("");
    setPostBodyDraft("");
    setPostLikeCountDraft("0");
    setPostViewCountDraft("0");
    setPostCrownYearDraft("");
    setPostBloomIndexDraft("");
    setPostPetalDraft("");
    setPostBellDraft("");
    setPostChimeDraft("");
  }

  async function savePost() {
    const title = postTitleDraft.trim();
    const body = postBodyDraft.trim();
    const parsedLikeCount = Number.parseInt(postLikeCountDraft, 10);
    const parsedViewCount = Number.parseInt(postViewCountDraft, 10);
    const summerCourtDateTime = toSummerCourtDateTimeOrNull({
      crown_year: Number.parseInt(postCrownYearDraft, 10),
      bloom_index: Number.parseInt(postBloomIndexDraft, 10),
      petal: Number.parseInt(postPetalDraft, 10),
      bell: Number.parseInt(postBellDraft, 10),
      chime: Number.parseInt(postChimeDraft, 10),
    });
    if (!title || !body) {
      setError("Post title and rumor text are required.");
      return;
    }
    if (!Number.isInteger(parsedLikeCount) || parsedLikeCount < 0) {
      setError("Like count must be a non-negative integer.");
      return;
    }
    if (!Number.isInteger(parsedViewCount) || parsedViewCount < 0) {
      setError("View count must be a non-negative integer.");
      return;
    }
    if (!summerCourtDateTime) {
      setError("Summer Court date/time is required and must be valid.");
      return;
    }

    try {
      setIsSavingPost(true);
      setError("");
      const response = await apiFetch(editingPostId ? `/api/whisper/posts/${editingPostId}` : "/api/whisper/posts", {
        method: editingPostId ? "PATCH" : "POST",
        body: JSON.stringify({
          title,
          body,
          like_count: parsedLikeCount,
          view_count: parsedViewCount,
          ...summerCourtDateTime,
        }),
      });
      const data = (await response.json()) as WhisperPost | { error?: string };
      if (!response.ok) {
        throw new Error((data as { error?: string }).error || "Failed to save post");
      }

      const savedPost = data as WhisperPost;
      setPosts((current) => {
        const others = current.filter((post) => post.id !== savedPost.id);
        return [savedPost, ...others].sort((a, b) => {
          const aTime = new Date(a.updated_at).getTime();
          const bTime = new Date(b.updated_at).getTime();
          return bTime - aTime;
        });
      });
      setSelectedPostId(savedPost.id);
      resetPostForm();
      await loadPostDetails(savedPost.id);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save post");
    } finally {
      setIsSavingPost(false);
    }
  }

  async function deletePost(post: WhisperPost) {
    if (!window.confirm(`Delete this rumor post: "${post.title}"?`)) {
      return;
    }

    try {
      const response = await apiFetch(`/api/whisper/posts/${post.id}`, { method: "DELETE" });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete post");
      }

      setPosts((current) => current.filter((entry) => entry.id !== post.id));
      setCommentsByPostId((current) => {
        const next = { ...current };
        delete next[post.id];
        return next;
      });
      if (selectedPostId === post.id) {
        setSelectedPostId(null);
      }
      if (editingPostId === post.id) {
        resetPostForm();
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete post");
    }
  }

  async function deleteComment(comment: WhisperComment) {
    if (!window.confirm("Delete this anonymous comment?")) {
      return;
    }

    try {
      const response = await apiFetch(`/api/whisper/comments/${comment.id}`, { method: "DELETE" });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete comment");
      }

      setCommentsByPostId((current) => ({
        ...current,
        [comment.post_id]: (current[comment.post_id] || []).filter((entry) => entry.id !== comment.id),
      }));
      setPosts((current) =>
        current.map((post) =>
          post.id === comment.post_id
            ? { ...post, comment_count: Math.max(0, post.comment_count - 1) }
            : post,
        ),
      );
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete comment");
    }
  }

  function startEditCommentTime(comment: WhisperComment) {
    setEditingCommentId(comment.id);
    setCommentCrownYearDraft(comment.crown_year == null ? "" : String(comment.crown_year));
    setCommentBloomIndexDraft(comment.bloom_index == null ? "" : String(comment.bloom_index));
    setCommentPetalDraft(comment.petal == null ? "" : String(comment.petal));
    setCommentBellDraft(comment.bell == null ? "" : String(comment.bell));
    setCommentChimeDraft(comment.chime == null ? "" : String(comment.chime));
  }

  function resetCommentTimeForm() {
    setEditingCommentId(null);
    setCommentCrownYearDraft("");
    setCommentBloomIndexDraft("");
    setCommentPetalDraft("");
    setCommentBellDraft("");
    setCommentChimeDraft("");
  }

  async function saveCommentTime(comment: WhisperComment) {
    const summerCourtDateTime = toSummerCourtDateTimeOrNull({
      crown_year: Number.parseInt(commentCrownYearDraft, 10),
      bloom_index: Number.parseInt(commentBloomIndexDraft, 10),
      petal: Number.parseInt(commentPetalDraft, 10),
      bell: Number.parseInt(commentBellDraft, 10),
      chime: Number.parseInt(commentChimeDraft, 10),
    });

    if (!summerCourtDateTime) {
      setError("Comment Summer Court date/time is required and must be valid.");
      return;
    }

    try {
      setIsSavingCommentTime(true);
      const response = await apiFetch(`/api/whisper/comments/${comment.id}`, {
        method: "PATCH",
        body: JSON.stringify(summerCourtDateTime),
      });
      const data = (await response.json()) as WhisperComment | { error?: string };
      if (!response.ok) {
        throw new Error((data as { error?: string }).error || "Failed to update comment date/time");
      }

      const updatedComment = data as WhisperComment;
      setCommentsByPostId((current) => ({
        ...current,
        [comment.post_id]: (current[comment.post_id] || []).map((entry) =>
          entry.id === comment.id ? updatedComment : entry,
        ),
      }));
      resetCommentTimeForm();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update comment date/time");
    } finally {
      setIsSavingCommentTime(false);
    }
  }

  const postPreviewDate = toSummerCourtDateTimeOrNull({
    crown_year: Number.parseInt(postCrownYearDraft, 10),
    bloom_index: Number.parseInt(postBloomIndexDraft, 10),
    petal: Number.parseInt(postPetalDraft, 10),
    bell: Number.parseInt(postBellDraft, 10),
    chime: Number.parseInt(postChimeDraft, 10),
  });

  return (
    <section className="whisper-page chapters-page">
      <div className="page-heading">
        <h1>Whisper Network</h1>
        <p className="topbar-meta">Anonymous rumors from the city’s shadowed alleys and moonlit taverns.</p>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}

      <div className="chapters-layout whisper-layout">
        <article className="state-card chapters-index-card whisper-feed-card">
          <div className="documents-index-header whisper-feed-header">
            <h2>Rumor Feed</h2>
            <p className="topbar-meta">{posts.length} whispers</p>
          </div>
          {loading ? <p className="topbar-meta">Gathering whispers…</p> : null}
          {!loading && posts.length === 0 ? <p className="topbar-meta">No whispers yet.</p> : null}
          <ul className="chapter-list whisper-list">
            {posts.map((post) => {
              const isActive = post.id === selectedPostId;
              const isExpanded = Boolean(expandedPostIds[post.id]);
              return (
                <li key={post.id} className={`chapter-list-item whisper-list-item ${isActive ? "active" : ""}`.trim()}>
                  <button
                    type="button"
                    className="whisper-post-button"
                    onClick={() => {
                      void openPost(post.id);
                    }}
                  >
                    <span className="chapter-list-meta">Anonymous rumor · {getPostFeedTimestamp(post)}</span>
                    <strong>{post.title}</strong>
                    <p className="whisper-list-excerpt">{post.body}</p>
                    <span className="whisper-post-stats">❤️ {post.like_count} · 💬 {post.comment_count} · 👁 {post.view_count}</span>
                  </button>
                  <div className="whisper-post-inline-actions">
                    <button type="button" className="secondary-link" onClick={() => void toggleLike(post.id)}>
                      {post.liked_by_me ? "Unlike" : "Like"}
                    </button>
                    <button type="button" className="secondary-link" onClick={() => void togglePostExpansion(post.id)}>
                      {isExpanded ? "Hide comments" : "Show comments"}
                    </button>
                  </div>
                  {isDm ? (
                    <div className="chapter-list-admin-actions whisper-admin-actions">
                      <button type="button" className="secondary-link" onClick={() => startEditPost(post)}>
                        Edit
                      </button>
                      <button type="button" className="board-node-delete-button" onClick={() => void deletePost(post)}>
                        Delete
                      </button>
                    </div>
                  ) : null}

                  {isExpanded ? (
                    <div className="whisper-inline-comments">
                      <h3>Anonymous Comments</h3>
                      <ul className="whisper-comment-list">
                        {(commentsByPostId[post.id] || []).map((comment) => (
                          <li key={comment.id} className="whisper-comment-card">
                            <div>
                              <p className="whisper-comment-meta">Anonymous witness · {getCommentTimestamp(comment)}</p>
                              <p>{comment.body}</p>
                            </div>
                            {isDm ? (
                              <div className="whisper-post-inline-actions">
                                <button
                                  type="button"
                                  className="secondary-link"
                                  onClick={() => startEditCommentTime(comment)}
                                >
                                  Edit court time
                                </button>
                                <button
                                  type="button"
                                  className="board-node-delete-button"
                                  onClick={() => void deleteComment(comment)}
                                >
                                  Moderate
                                </button>
                              </div>
                            ) : null}
                            {isDm && editingCommentId === comment.id ? (
                              <div className="note-form whisper-comment-form">
                                <input
                                  className="text-input"
                                  type="number"
                                  min={1}
                                  placeholder="Crown Year"
                                  value={commentCrownYearDraft}
                                  onChange={(event) => setCommentCrownYearDraft(event.target.value)}
                                />
                                <input
                                  className="text-input"
                                  type="number"
                                  min={1}
                                  max={12}
                                  placeholder="Bloom"
                                  value={commentBloomIndexDraft}
                                  onChange={(event) => setCommentBloomIndexDraft(event.target.value)}
                                />
                                <input
                                  className="text-input"
                                  type="number"
                                  min={1}
                                  max={28}
                                  placeholder="Petal"
                                  value={commentPetalDraft}
                                  onChange={(event) => setCommentPetalDraft(event.target.value)}
                                />
                                <input
                                  className="text-input"
                                  type="number"
                                  min={0}
                                  max={23}
                                  placeholder="Bell"
                                  value={commentBellDraft}
                                  onChange={(event) => setCommentBellDraft(event.target.value)}
                                />
                                <input
                                  className="text-input"
                                  type="number"
                                  min={0}
                                  max={59}
                                  placeholder="Chime"
                                  value={commentChimeDraft}
                                  onChange={(event) => setCommentChimeDraft(event.target.value)}
                                />
                                <div className="whisper-post-inline-actions">
                                  <button
                                    type="button"
                                    className="action-button"
                                    disabled={isSavingCommentTime}
                                    onClick={() => void saveCommentTime(comment)}
                                  >
                                    {isSavingCommentTime ? "Saving…" : "Save"}
                                  </button>
                                  <button type="button" className="secondary-link" onClick={resetCommentTimeForm}>
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                      <div className="note-form whisper-comment-form">
                        <textarea
                          className="text-area"
                          rows={3}
                          placeholder="Share a rumor anonymously…"
                          value={commentDraftByPostId[post.id] || ""}
                          onChange={(event) =>
                            setCommentDraftByPostId((current) => ({ ...current, [post.id]: event.target.value }))
                          }
                        />
                        <button
                          type="button"
                          className="action-button"
                          disabled={Boolean(isSubmittingCommentByPostId[post.id])}
                          onClick={() => {
                            void submitComment(post.id);
                          }}
                        >
                          {isSubmittingCommentByPostId[post.id] ? "Posting…" : "Post anonymous comment"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </article>

        <article className="state-card chapter-reader-card whisper-reader-card">
          {activePost ? (
            <>
              <header className="chapter-reader-header">
                <p className="topbar-meta">Anonymous rumor · {getPostDetailTimestamp(activePost)}</p>
                <h2>{activePost.title}</h2>
                <p className="whisper-reader-body">{activePost.body}</p>
                <p className="whisper-post-stats">❤️ {activePost.like_count} · 💬 {activePost.comment_count} · 👁 {activePost.view_count}</p>
              </header>
              <div className="whisper-reader-actions">
                <button type="button" className="action-button" onClick={() => void toggleLike(activePost.id)}>
                  {activePost.liked_by_me ? "Unlike this whisper" : "Like this whisper"}
                </button>
                <button type="button" className="secondary-link" onClick={() => void togglePostExpansion(activePost.id)}>
                  {expandedPostIds[activePost.id] ? "Hide thread" : "Open thread"}
                </button>
              </div>
            </>
          ) : (
            <p className="topbar-meta">Pick a rumor to inspect the thread.</p>
          )}
        </article>
      </div>

      {isDm ? (
        <article className="state-card chapter-editor-card whisper-editor-card">
          <div className="dashboard-recap-editor-header">
            <h2>{editingPostId ? "Edit whisper" : "Create whisper"}</h2>
            {editingPostId ? (
              <button type="button" className="secondary-link" onClick={resetPostForm}>
                Cancel
              </button>
            ) : null}
          </div>
          <input
            className="text-input"
            placeholder="Rumor title"
            value={postTitleDraft}
            onChange={(event) => setPostTitleDraft(event.target.value)}
          />
          <textarea
            className="text-area"
            rows={6}
            placeholder="Rumor body text"
            value={postBodyDraft}
            onChange={(event) => setPostBodyDraft(event.target.value)}
          />
          <input
            className="text-input"
            type="number"
            min={0}
            step={1}
            placeholder="Like count"
            value={postLikeCountDraft}
            onChange={(event) => setPostLikeCountDraft(event.target.value)}
          />
          <input
            className="text-input"
            type="number"
            min={0}
            step={1}
            placeholder="View count"
            value={postViewCountDraft}
            onChange={(event) => setPostViewCountDraft(event.target.value)}
          />
          <div className="note-form">
            <input
              className="text-input"
              type="number"
              min={1}
              placeholder="Crown Year"
              value={postCrownYearDraft}
              onChange={(event) => setPostCrownYearDraft(event.target.value)}
            />
            <input
              className="text-input"
              type="number"
              min={1}
              max={12}
              placeholder="Bloom"
              value={postBloomIndexDraft}
              onChange={(event) => setPostBloomIndexDraft(event.target.value)}
            />
            <input
              className="text-input"
              type="number"
              min={1}
              max={28}
              placeholder="Petal"
              value={postPetalDraft}
              onChange={(event) => setPostPetalDraft(event.target.value)}
            />
            <input
              className="text-input"
              type="number"
              min={0}
              max={23}
              placeholder="Bell"
              value={postBellDraft}
              onChange={(event) => setPostBellDraft(event.target.value)}
            />
            <input
              className="text-input"
              type="number"
              min={0}
              max={59}
              placeholder="Chime"
              value={postChimeDraft}
              onChange={(event) => setPostChimeDraft(event.target.value)}
            />
          </div>
          <p className="topbar-meta">
            {postPreviewDate
              ? formatSummerCourtDateTimeFull(postPreviewDate)
              : "Summer Court preview unavailable until all fields are valid."}
          </p>
          {postPreviewDate ? (
            <p className="topbar-meta">
              Phase {getPhaseIndexFromPetal(postPreviewDate.petal)} · {getBellPeriodName(postPreviewDate.bell)}
            </p>
          ) : null}
          <div className="dashboard-row-actions">
            <button className="action-button" type="button" disabled={isSavingPost} onClick={() => void savePost()}>
              {isSavingPost ? "Saving…" : editingPostId ? "Update whisper" : "Publish whisper"}
            </button>
          </div>
        </article>
      ) : null}
    </section>
  );
}
