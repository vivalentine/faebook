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
import type { WhisperComment, WhisperPost, WhisperSortMode } from "../types";
import { useLiveCampaignState } from "../context/LiveCampaignStateContext";
import { hasMoreWhispers, mergeWhisperPage } from "../lib/whisperPagination";

const WHISPER_SORT_OPTIONS: Array<FaeSelectOption & { value: WhisperSortMode }> = [
  { value: "trending", label: "Trending", icon: "flame" },
  { value: "recent", label: "Recent", icon: "clock" },
  { value: "views", label: "View count", icon: "eye" },
  { value: "likes", label: "Likes", icon: "heart" },
  { value: "comments", label: "Most commented", icon: "chat-bubble" },
];

const DEFAULT_WHISPER_SORT: WhisperSortMode = "recent";
const WHISPER_PAGE_SIZE = 40;
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


function getWhisperRecentSortValue(record: {
  crown_year: number | null;
  bloom_index: number | null;
  petal: number | null;
  bell: number | null;
  chime: number | null;
  created_at: string;
}): number {
  const dt = getSummerCourtFromWhisperRecord(record);
  if (dt) {
    return (((dt.crown_year * 12 + dt.bloom_index) * 28 + dt.petal) * 24 + dt.bell) * 60 + dt.chime;
  }

  const createdTime = Date.parse(record.created_at);
  return Number.isFinite(createdTime) ? createdTime : 0;
}

function sortWhisperCommentsByRecent(comments: WhisperComment[]): WhisperComment[] {
  return [...comments].sort((a, b) => {
    const diff = getWhisperRecentSortValue(b) - getWhisperRecentSortValue(a);
    if (diff !== 0) return diff;
    return b.id - a.id;
  });
}

export default function WhisperNetworkPage() {
  const { user } = useAuth();
  const { campaignDate, campaignUpdatedAt } = useLiveCampaignState();
  const isDm = user?.role === "dm";

  const [posts, setPosts] = useState<WhisperPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalPosts, setTotalPosts] = useState(0);
  const [error, setError] = useState("");
  const [sortMode, setSortMode] = useState<WhisperSortMode>(DEFAULT_WHISPER_SORT);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [selectedPostDetail, setSelectedPostDetail] = useState<WhisperPost | null>(null);
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
  const campaignUpdatedAtRef = useRef<string | null>(null);
  const selectedPostIdRef = useRef<number | null>(null);
  const isReaderOpenRef = useRef(false);
  const postsRef = useRef<WhisperPost[]>([]);
  const feedRequestInFlightRef = useRef(false);
  const feedAbortControllerRef = useRef<AbortController | null>(null);
  const feedGenerationRef = useRef(0);
  const feedSentinelRef = useRef<HTMLDivElement | null>(null);
  const [campaignDateTime, setCampaignDateTime] = useState<SummerCourtDateTime | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createPostTitleDraft, setCreatePostTitleDraft] = useState("");
  const [createPostBodyDraft, setCreatePostBodyDraft] = useState("");
  const [createPostError, setCreatePostError] = useState("");
  const [isCreatingPost, setIsCreatingPost] = useState(false);

  const activePost = useMemo(
    () => posts.find((post) => post.id === selectedPostId) ||
      (selectedPostDetail?.id === selectedPostId ? selectedPostDetail : null),
    [posts, selectedPostDetail, selectedPostId],
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

  async function loadFeed(options?: {
    preferredSelectedPostId?: number | null;
    silent?: boolean;
    append?: boolean;
    requestedSort?: WhisperSortMode;
  }) {
    const silent = Boolean(options?.silent);
    const append = Boolean(options?.append);
    if (feedRequestInFlightRef.current) return;
    const generation = feedGenerationRef.current;
    const offset = append ? postsRef.current.length : 0;
    const requestedSort = options?.requestedSort || sortMode;
    const controller = new AbortController();
    try {
      feedRequestInFlightRef.current = true;
      feedAbortControllerRef.current = controller;
      if (append) {
        setLoadingMore(true);
      } else if (!silent) {
        setLoading(true);
        setError("");
      }
      const feedResponse = await apiFetch(
        `/api/whisper/posts?limit=${WHISPER_PAGE_SIZE}&offset=${offset}&sort=${requestedSort}`,
        { signal: controller.signal },
      );
      const data = (await feedResponse.json()) as WhisperFeedResponse | { error?: string };
      if (!feedResponse.ok) {
        throw new Error((data as { error?: string }).error || "Failed to load whisper feed");
      }

      if (generation !== feedGenerationRef.current) return;
      const feed = data as WhisperFeedResponse;
      const loadedPosts = feed.posts || [];
      setTotalPosts(feed.pagination.total);
      setPosts((current) => append ? mergeWhisperPage(current, loadedPosts) : loadedPosts);
      const preferredSelectedPostId = options?.preferredSelectedPostId ?? null;
      const loadedPostIdSet = new Set(loadedPosts.map((post) => post.id));
      if (!append) setSelectedPostId((current) => {
        if (preferredSelectedPostId && loadedPostIdSet.has(preferredSelectedPostId)) {
          return preferredSelectedPostId;
        }
        if (current && loadedPostIdSet.has(current)) {
          return current;
        }
        if (current && isReaderOpenRef.current) return current;
        return loadedPosts[0]?.id ?? null;
      });
      return loadedPostIdSet;
    } catch (loadError) {
      if (controller.signal.aborted) return;
      if (!silent) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load whisper feed");
        if (!append) setPosts([]);
      }
    } finally {
      if (feedAbortControllerRef.current === controller) {
        feedRequestInFlightRef.current = false;
        feedAbortControllerRef.current = null;
        setLoadingMore(false);
        if (!silent) setLoading(false);
      }
    }
  }

  useEffect(() => {
    feedGenerationRef.current += 1;
    feedAbortControllerRef.current?.abort();
    feedRequestInFlightRef.current = false;
    setPosts([]);
    setTotalPosts(0);
    void loadFeed({ requestedSort: sortMode });
  }, [sortMode]);

  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  const hasMorePosts = hasMoreWhispers(posts.length, totalPosts);
  useEffect(() => {
    const sentinel = feedSentinelRef.current;
    if (!sentinel || !hasMorePosts) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadFeed({ append: true, silent: true });
        }
      },
      { rootMargin: "240px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMorePosts, posts.length, sortMode]);

  useEffect(() => {
    selectedPostIdRef.current = selectedPostId;
  }, [selectedPostId]);

  useEffect(() => {
    isReaderOpenRef.current = isReaderOpen;
  }, [isReaderOpen]);

  useEffect(() => {
    setCampaignDateTime(campaignDate ? toSummerCourtDateTimeOrNull(campaignDate) : null);
    if (!campaignUpdatedAt) return;
    const previousUpdatedAt = campaignUpdatedAtRef.current;
    campaignUpdatedAtRef.current = campaignUpdatedAt;
    if (!previousUpdatedAt || previousUpdatedAt === campaignUpdatedAt) return;

    let disposed = false;
    async function refreshRevealedWhispers() {
      const openPostId = isReaderOpenRef.current ? selectedPostIdRef.current : null;
      await loadFeed({ preferredSelectedPostId: openPostId, silent: true });
      if (disposed || !openPostId) return;
      await loadPostDetails(openPostId, { silent: true });
    }
    void refreshRevealedWhispers();
    return () => { disposed = true; };
  }, [campaignDate, campaignUpdatedAt]);

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

  useEffect(() => {
    if (!isCreateModalOpen) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsCreateModalOpen(false);
      }
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isCreateModalOpen]);

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

  async function loadPostDetails(postId: number, options?: { silent?: boolean }) {
    try {
      const response = await apiFetch(`/api/whisper/posts/${postId}`);
      const data = (await response.json()) as WhisperPostDetailResponse | { error?: string };
      if (!response.ok) {
        if (response.status === 404 && options?.silent) {
          setSelectedPostId(null);
          setSelectedPostDetail(null);
          setIsReaderOpen(false);
          return false;
        }
        throw new Error((data as { error?: string }).error || "Failed to load post details");
      }
      const detail = data as WhisperPostDetailResponse;
      setSelectedPostDetail(detail.post);
      setCommentsByPostId((current) => ({
        ...current,
        [postId]: sortWhisperCommentsByRecent(detail.comments || []),
      }));
      setPosts((current) => current.map((post) => (post.id === postId ? detail.post : post)));
      return true;
    } catch (detailsError) {
      if (!options?.silent) {
        setError(detailsError instanceof Error ? detailsError.message : "Failed to load post details");
      }
      return false;
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
      void loadFeed({ preferredSelectedPostId: postId, silent: true });
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
        [postId]: sortWhisperCommentsByRecent([...(current[postId] || []), createdComment]),
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

  async function createPostFromFeed() {
    const title = createPostTitleDraft.trim();
    const body = createPostBodyDraft.trim();
    if (!title || !body) {
      setCreatePostError("Title and rumor text are required.");
      return;
    }

    try {
      setIsCreatingPost(true);
      setCreatePostError("");
      setError("");
      const response = await apiFetch("/api/whisper/posts", {
        method: "POST",
        body: JSON.stringify({ title, body }),
      });
      const data = (await response.json()) as WhisperPost | { error?: string };
      if (!response.ok) {
        throw new Error((data as { error?: string }).error || "Failed to publish rumor");
      }
      const createdPost = data as WhisperPost;
      setIsCreateModalOpen(false);
      setCreatePostTitleDraft("");
      setCreatePostBodyDraft("");
      setSelectedPostId(createdPost.id);
      setIsReaderOpen(true);
      setPosts((current) => [createdPost, ...current.filter((post) => post.id !== createdPost.id)]);
      await loadPostDetails(createdPost.id);
      await loadFeed({ preferredSelectedPostId: createdPost.id });
    } catch (createError) {
      setCreatePostError(createError instanceof Error ? createError.message : "Failed to publish rumor");
    } finally {
      setIsCreatingPost(false);
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
      setTotalPosts((current) => Math.max(0, current - 1));
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
        [comment.post_id]: sortWhisperCommentsByRecent(
          (current[comment.post_id] || []).map((entry) =>
            entry.id === comment.id ? updatedComment : entry,
          ),
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
      {error ? <p className="error-banner">{error}</p> : null}

      <div className="chapters-layout whisper-layout">
        <article className="state-card chapters-index-card whisper-feed-card">
          <div className="documents-index-header whisper-feed-header">
            <h2>Rumor Feed</h2>
            <div className="whisper-feed-tools">
              <button type="button" className="action-button whisper-new-post-button" onClick={() => setIsCreateModalOpen(true)}>
                New Post
              </button>
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
              <p className="topbar-meta">{totalPosts} whispers</p>
            </div>
          </div>
          {loading ? <p className="topbar-meta">Gathering whispers…</p> : null}
          {!loading && posts.length === 0 ? <p className="topbar-meta">No whispers yet.</p> : null}
          <ul className="chapter-list whisper-list">
            {posts.map((post) => {
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
                  <div className="whisper-feed-card-footer">
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
            <li aria-hidden="true">
              <div ref={feedSentinelRef} className="whisper-feed-sentinel" />
              {loadingMore ? <p className="topbar-meta">Gathering older whispers…</p> : null}
            </li>
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

      {isCreateModalOpen ? (
        <div className="board-modal-overlay" role="presentation" onClick={() => setIsCreateModalOpen(false)}>
          <div
            className="board-modal whisper-create-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Create new whisper post"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dashboard-recap-editor-header">
              <h2>New anonymous rumor</h2>
            </div>
            {createPostError ? <p className="error-banner">{createPostError}</p> : null}
            <input
              className="text-input"
              placeholder="Rumor title"
              maxLength={160}
              value={createPostTitleDraft}
              onChange={(event) => setCreatePostTitleDraft(event.target.value)}
            />
            <textarea
              className="text-area"
              rows={6}
              placeholder="Share what you heard…"
              maxLength={5000}
              value={createPostBodyDraft}
              onChange={(event) => setCreatePostBodyDraft(event.target.value)}
            />
            <div className="dashboard-row-actions whisper-create-modal-actions whisper-new-post-actions">
              <button type="button" className="secondary-link" onClick={() => setIsCreateModalOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="action-button"
                disabled={isCreatingPost}
                onClick={() => void createPostFromFeed()}
              >
                {isCreatingPost ? "Posting…" : "Post anonymous rumor"}
              </button>
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
