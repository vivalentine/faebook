import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import FaeIcon from "../components/FaeIcon";
import FaeSelect, { type FaeSelectOption } from "../components/FaeSelect";
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
import type { DashboardData, WhisperComment, WhisperPost, WhisperSortMode } from "../types";

const WHISPER_SORT_OPTIONS: Array<FaeSelectOption & { value: WhisperSortMode }> = [
  { value: "trending", label: "Trending", icon: "flame" },
  { value: "recent", label: "Recent", icon: "clock" },
  { value: "views", label: "View count", icon: "eye" },
  { value: "likes", label: "Likes", icon: "heart" },
  { value: "comments", label: "Most commented", icon: "chat-bubble" },
];

const DEFAULT_WHISPER_SORT: WhisperSortMode = "trending";
const WHISPER_FEEDBACK_MS = 820;
const WHISPER_HEART_ANIMATION_MS = 520;

type WhisperFeedResponse = {
  posts: WhisperPost[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    sort?: WhisperSortMode;
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


function getWhisperRecentSortTimestamp(post: WhisperPost): number {
  const dt = getSummerCourtFromWhisperRecord(post);
  if (dt) {
    return dt.crown_year * 10_000_000 + dt.bloom_index * 100_000 + dt.petal * 1_000 + dt.bell * 60 + dt.chime;
  }
  const createdTime = Date.parse(post.created_at);
  return Number.isFinite(createdTime) ? createdTime : 0;
}

function getWhisperTrendingScore(post: WhisperPost): number {
  return post.view_count + post.like_count * 3 + post.comment_count * 5;
}

function sortWhisperPosts(posts: WhisperPost[], sortMode: WhisperSortMode): WhisperPost[] {
  const sorted = [...posts];
  sorted.sort((a, b) => {
    if (sortMode === "recent") {
      const diff = getWhisperRecentSortTimestamp(b) - getWhisperRecentSortTimestamp(a);
      if (diff !== 0) return diff;
    } else if (sortMode === "views") {
      const diff = b.view_count - a.view_count;
      if (diff !== 0) return diff;
    } else if (sortMode === "likes") {
      const diff = b.like_count - a.like_count;
      if (diff !== 0) return diff;
    } else if (sortMode === "comments") {
      const diff = b.comment_count - a.comment_count;
      if (diff !== 0) return diff;
    } else {
      const diff = getWhisperTrendingScore(b) - getWhisperTrendingScore(a);
      if (diff !== 0) return diff;
    }

    const recentDiff = getWhisperRecentSortTimestamp(b) - getWhisperRecentSortTimestamp(a);
    if (recentDiff !== 0) return recentDiff;
    return b.id - a.id;
  });
  return sorted;
}

export default function WhisperNetworkPage() {
  const { user } = useAuth();
  const isDm = user?.role === "dm";

  const [posts, setPosts] = useState<WhisperPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortMode, setSortMode] = useState<WhisperSortMode>(DEFAULT_WHISPER_SORT);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [isReaderOpen, setIsReaderOpen] = useState(false);
  const [commentsByPostId, setCommentsByPostId] = useState<Record<number, WhisperComment[]>>({});
  const [commentDraftByPostId, setCommentDraftByPostId] = useState<Record<number, string>>({});
  const [isSubmittingCommentByPostId, setIsSubmittingCommentByPostId] = useState<Record<number, boolean>>({});
  const [feedbackPostIds, setFeedbackPostIds] = useState<Record<number, true>>({});

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
  const [heartAnimationByPostId, setHeartAnimationByPostId] = useState<Record<number, "like" | "unlike" | null>>({});
  const heartAnimationTimersRef = useRef<Record<number, number>>({});
  const [campaignDateTime, setCampaignDateTime] = useState<SummerCourtDateTime | null>(null);

  const sortedPosts = useMemo(() => sortWhisperPosts(posts, sortMode), [posts, sortMode]);

  const activePost = useMemo(
    () => sortedPosts.find((post) => post.id === selectedPostId) || null,
    [sortedPosts, selectedPostId],
  );

  function triggerPostFeedback(postId: number) {
    setFeedbackPostIds((current) => ({ ...current, [postId]: true }));
    window.setTimeout(() => {
      setFeedbackPostIds((current) => {
        if (!current[postId]) return current;
        const next = { ...current };
        delete next[postId];
        return next;
      });
    }, WHISPER_FEEDBACK_MS);
  }

  async function loadFeed(options?: { preferredSelectedPostId?: number | null }) {
    try {
      setLoading(true);
      setError("");
      const [feedResponse, dashboardResponse] = await Promise.all([
        apiFetch(`/api/whisper/posts?limit=40&offset=0&sort=${sortMode}`),
        apiFetch("/api/dashboard"),
      ]);
      const data = (await feedResponse.json()) as WhisperFeedResponse | { error?: string };
      const dashboardData = (await dashboardResponse.json()) as DashboardData | { error?: string };
      if (!feedResponse.ok) {
        throw new Error((data as { error?: string }).error || "Failed to load whisper feed");
      }
      if (!dashboardResponse.ok) {
        throw new Error((dashboardData as { error?: string }).error || "Failed to load campaign date");
      }

      setCampaignDateTime(toSummerCourtDateTimeOrNull((dashboardData as DashboardData).campaign_date || undefined));

      const loadedPosts = (data as WhisperFeedResponse).posts || [];
      setPosts(loadedPosts);
      const preferredSelectedPostId = options?.preferredSelectedPostId ?? null;
      const loadedPostIdSet = new Set(loadedPosts.map((post) => post.id));
      setSelectedPostId((current) => {
        if (preferredSelectedPostId && loadedPostIdSet.has(preferredSelectedPostId)) {
          return preferredSelectedPostId;
        }
        if (current && loadedPostIdSet.has(current)) {
          return current;
        }
        return loadedPosts[0]?.id ?? null;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load whisper feed");
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFeed();
  }, [sortMode]);

  useEffect(() => {
    if (!isReaderOpen) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsReaderOpen(false);
      }
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isReaderOpen]);

  useEffect(
    () => () => {
      Object.values(heartAnimationTimersRef.current).forEach((timerId) => {
        window.clearTimeout(timerId);
      });
    },
    [],
  );

  function triggerHeartAnimation(postId: number, state: "like" | "unlike") {
    const currentTimer = heartAnimationTimersRef.current[postId];
    if (currentTimer) {
      window.clearTimeout(currentTimer);
    }
    setHeartAnimationByPostId((current) => ({ ...current, [postId]: state }));
    heartAnimationTimersRef.current[postId] = window.setTimeout(() => {
      setHeartAnimationByPostId((current) => ({ ...current, [postId]: null }));
      delete heartAnimationTimersRef.current[postId];
    }, WHISPER_HEART_ANIMATION_MS);
  }

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

  async function openPostReader(postId: number) {
    setIsReaderOpen(true);
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
      triggerHeartAnimation(postId, liked ? "like" : "unlike");
      setPosts((current) =>
        current.map((post) =>
          post.id === postId ? { ...post, liked_by_me: liked, like_count: likeCount } : post,
        ),
      );
      triggerPostFeedback(postId);
      await loadFeed({ preferredSelectedPostId: postId });
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
      triggerPostFeedback(postId);
      await loadFeed({ preferredSelectedPostId: postId });
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
    setPostCrownYearDraft(campaignDateTime ? String(campaignDateTime.crown_year) : "");
    setPostBloomIndexDraft(campaignDateTime ? String(campaignDateTime.bloom_index) : "");
    setPostPetalDraft(campaignDateTime ? String(campaignDateTime.petal) : "");
    setPostBellDraft(campaignDateTime ? String(campaignDateTime.bell) : "");
    setPostChimeDraft(campaignDateTime ? String(campaignDateTime.chime) : "");
  }

  useEffect(() => {
    if (!campaignDateTime || editingPostId) return;
    if (postCrownYearDraft || postBloomIndexDraft || postPetalDraft || postBellDraft || postChimeDraft) return;
    setPostCrownYearDraft(String(campaignDateTime.crown_year));
    setPostBloomIndexDraft(String(campaignDateTime.bloom_index));
    setPostPetalDraft(String(campaignDateTime.petal));
    setPostBellDraft(String(campaignDateTime.bell));
    setPostChimeDraft(String(campaignDateTime.chime));
  }, [
    campaignDateTime,
    editingPostId,
    postBellDraft,
    postBloomIndexDraft,
    postChimeDraft,
    postCrownYearDraft,
    postPetalDraft,
  ]);

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
    if (editingPostId && !summerCourtDateTime) {
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
          ...(summerCourtDateTime || {}),
        }),
      });
      const data = (await response.json()) as WhisperPost | { error?: string };
      if (!response.ok) {
        throw new Error((data as { error?: string }).error || "Failed to save post");
      }

      const savedPost = data as WhisperPost;
      setPosts((current) => {
        const others = current.filter((post) => post.id !== savedPost.id);
        return [savedPost, ...others];
      });
      setSelectedPostId(savedPost.id);
      resetPostForm();
      await loadPostDetails(savedPost.id);
      await loadFeed({ preferredSelectedPostId: savedPost.id });
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
        setIsReaderOpen(false);
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
      await loadFeed({ preferredSelectedPostId: comment.post_id });
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
  }) || (!editingPostId ? campaignDateTime : null);

  return (
    <section className="whisper-page chapters-page">
      <div className="page-heading">
        <h1>Rumor Feed</h1>
        <p className="topbar-meta">Anonymous rumors from the city’s shadowed alleys and moonlit taverns.</p>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}

      <div className="chapters-layout whisper-layout">
        <article className="state-card chapters-index-card whisper-feed-card">
          <div className="documents-index-header whisper-feed-header">
            <h2>Rumor Feed</h2>
            <div className="whisper-feed-tools">
              <label className="whisper-sort-label">
                <span className="topbar-meta">Sort</span>
                <FaeSelect
                  ariaLabel="Sort whispers"
                  className="text-input whisper-sort-select"
                  value={sortMode}
                  onChange={(value) => setSortMode(value as WhisperSortMode)}
                  options={WHISPER_SORT_OPTIONS}
                />
              </label>
              <p className="topbar-meta">{sortedPosts.length} whispers</p>
            </div>
          </div>
          {loading ? <p className="topbar-meta">Gathering whispers…</p> : null}
          {!loading && sortedPosts.length === 0 ? <p className="topbar-meta">No whispers yet.</p> : null}
          <ul className="chapter-list whisper-list">
            {sortedPosts.map((post) => {
              const isActive = post.id === selectedPostId;
              const hasFeedback = Boolean(feedbackPostIds[post.id]);
              return (
                <li
                  key={post.id}
                  className={`chapter-list-item whisper-list-item ${isActive ? "active" : ""} ${
                    hasFeedback ? "is-updated" : ""
                  }`.trim()}
                >
                  <button
                    type="button"
                    className="whisper-post-button"
                    onClick={() => {
                      void openPostReader(post.id);
                    }}
                  >
                    <span className="chapter-list-meta">Anonymous rumor · {getPostFeedTimestamp(post)}</span>
                    <strong>{post.title}</strong>
                    <p className="whisper-list-excerpt">{post.body}</p>
                  </button>
                  <div className={`whisper-post-stats whisper-post-inline-actions ${hasFeedback ? "is-updated" : ""}`.trim()}>
                    <button
                      type="button"
                      className={`whisper-icon-button ${post.liked_by_me ? "is-liked" : ""} ${
                        heartAnimationByPostId[post.id] === "like"
                          ? "heart-animate-like"
                          : heartAnimationByPostId[post.id] === "unlike"
                            ? "heart-animate-unlike"
                            : ""
                      }`.trim()}
                      onClick={() => void toggleLike(post.id)}
                      aria-label={post.liked_by_me ? "Unlike whisper" : "Like whisper"}
                    >
                      <FaeIcon icon="heart" filled={post.liked_by_me} />
                      <span>{post.like_count}</span>
                    </button>
                    <span className="whisper-stat-pill" aria-label={`${post.comment_count} comments`}>
                      <FaeIcon icon="message-circle" />
                      <span>{post.comment_count}</span>
                    </span>
                    <span className="whisper-stat-pill" aria-label={`${post.view_count} views`}>
                      <FaeIcon icon="eye" />
                      <span>{post.view_count}</span>
                    </span>
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
                </li>
              );
            })}
          </ul>
        </article>
      </div>

      {isReaderOpen && activePost ? (
        <div className="board-modal-overlay" role="presentation" onClick={() => setIsReaderOpen(false)}>
          <div className="board-modal whisper-detail-modal" role="dialog" aria-modal="true" aria-label="Whisper details" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="whisper-modal-close" onClick={() => setIsReaderOpen(false)} aria-label="Close whisper details">
              <FaeIcon icon="x" />
            </button>
            <header className="chapter-reader-header whisper-detail-header whisper-detail-fixed">
              <p className="topbar-meta">Anonymous rumor · {getPostDetailTimestamp(activePost)}</p>
              <h2>{activePost.title}</h2>
              <p className="whisper-reader-body">{activePost.body}</p>
              <div
                className={`whisper-post-stats whisper-detail-actions ${
                  feedbackPostIds[activePost.id] ? "is-updated" : ""
                }`.trim()}
              >
                <button
                  type="button"
                  className={`whisper-icon-button ${activePost.liked_by_me ? "is-liked" : ""} ${
                    heartAnimationByPostId[activePost.id] === "like"
                      ? "heart-animate-like"
                      : heartAnimationByPostId[activePost.id] === "unlike"
                        ? "heart-animate-unlike"
                        : ""
                  }`.trim()}
                  onClick={() => void toggleLike(activePost.id)}
                  aria-label={activePost.liked_by_me ? "Unlike whisper" : "Like whisper"}
                >
                  <FaeIcon icon="heart" filled={activePost.liked_by_me} />
                  <span>{activePost.like_count}</span>
                </button>
                <span className="whisper-stat-pill" aria-label={`${activePost.comment_count} comments`}>
                  <FaeIcon icon="message-circle" />
                  <span>{activePost.comment_count}</span>
                </span>
                <span className="whisper-stat-pill" aria-label={`${activePost.view_count} views`}>
                  <FaeIcon icon="eye" />
                  <span>{activePost.view_count}</span>
                </span>
              </div>
              <div className="whisper-detail-actions">
                {isDm ? (
                  <button type="button" className="secondary-link" onClick={() => startEditPost(activePost)}>
                    Edit whisper
                  </button>
                ) : null}
                {isDm ? (
                  <button type="button" className="board-node-delete-button" onClick={() => void deletePost(activePost)}>
                    Delete whisper
                  </button>
                ) : null}
              </div>
            </header>
            <div className="whisper-inline-comments whisper-detail-comments">
              <h3>Anonymous comments</h3>
              <ul className="whisper-comment-list">
                {(commentsByPostId[activePost.id] || []).map((comment) => (
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
                  value={commentDraftByPostId[activePost.id] || ""}
                  onChange={(event) =>
                    setCommentDraftByPostId((current) => ({ ...current, [activePost.id]: event.target.value }))
                  }
                />
                <button
                  type="button"
                  className="action-button"
                  disabled={Boolean(isSubmittingCommentByPostId[activePost.id])}
                  onClick={() => {
                    void submitComment(activePost.id);
                  }}
                >
                  {isSubmittingCommentByPostId[activePost.id] ? "Posting…" : "Post anonymous comment"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

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
          {!editingPostId && postPreviewDate ? (
            <p className="topbar-meta">Using current campaign time for new whispers.</p>
          ) : null}
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
