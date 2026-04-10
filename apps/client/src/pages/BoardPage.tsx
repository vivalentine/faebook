import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  addEdge,
  Background,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Connection,
  type EdgeTypes,
  type NodeTypes,
  type ReactFlowInstance,
  type Viewport,
} from "@xyflow/react";
import { useSearchParams } from "react-router-dom";
import "@xyflow/react/dist/style.css";

import { useAuth } from "../auth/AuthContext";
import FaeSelect from "../components/FaeSelect";
import { apiFetch, apiUrl } from "../lib/api";
import { DM_LAST_VIEWED_BOARD_OWNER_KEY, getUserSettings } from "../lib/userSettings";
import type {
  AuthUser,
  BoardCardData,
  BoardEdge,
  BoardEdgeData,
  BoardListItem,
  BoardNode,
  BoardResponse,
  BoardSnapshot,
  BoardUserSummary,
  Npc,
} from "../types";
import BoardCardNode from "../components/BoardCardNode";
import BoardDeleteEdge from "../components/BoardDeleteEdge";

const nodeTypes: NodeTypes = {
  boardCard: BoardCardNode,
};

const edgeTypes: EdgeTypes = {
  boardEdge: BoardDeleteEdge,
};

const AUTOSAVE_DELAY_MS = 1200;
const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };
const NOTE_COLORS: Array<"yellow" | "pink" | "mint" | "blue"> = ["yellow", "pink", "mint", "blue"];

function formatTimestampForFilename(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}-${hour}${minute}`;
}

function sanitizeFilenamePart(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_\s]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "board";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function renderElementToPngBlob(element: HTMLElement, pixelRatio = 2) {
  const rect = element.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));
  const cloned = element.cloneNode(true) as HTMLElement;
  cloned.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");

  const svgMarkup = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <foreignObject width="100%" height="100%">
        ${new XMLSerializer().serializeToString(cloned)}
      </foreignObject>
    </svg>
  `;

  const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  const image = new Image();
  image.decoding = "sync";

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Failed to render board image"));
    image.src = svgUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = width * pixelRatio;
  canvas.height = height * pixelRatio;
  const context = canvas.getContext("2d");
  if (!context) {
    URL.revokeObjectURL(svgUrl);
    throw new Error("Canvas context not available");
  }

  context.scale(pixelRatio, pixelRatio);
  context.fillStyle = "#071014";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  URL.revokeObjectURL(svgUrl);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to generate board PNG"));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

function BoardCanvas() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const isDm = user?.role === "dm";

  const [visibleNpcs, setVisibleNpcs] = useState<Npc[]>([]);
  const [nodes, setNodes, onNodesChange] = useNodesState<BoardNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<BoardEdge>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState("");
  const [rfInstance, setRfInstance] = useState<
    ReactFlowInstance<BoardNode, BoardEdge> | null
  >(null);
  const [viewportVersion, setViewportVersion] = useState(0);
  const [autosaveStatus, setAutosaveStatus] = useState<
    "idle" | "dirty" | "saving" | "saved"
  >("idle");
  const [boardUsers, setBoardUsers] = useState<BoardUserSummary[]>([]);
  const [boardOwner, setBoardOwner] = useState<AuthUser | null>(null);
  const [boards, setBoards] = useState<BoardListItem[]>([]);
  const [currentBoardId, setCurrentBoardId] = useState<number | null>(null);
  const [currentBoardName, setCurrentBoardName] = useState("Investigation Board");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const [showNpcPicker, setShowNpcPicker] = useState(false);
  const [npcSearch, setNpcSearch] = useState("");

  const viewportRef = useRef(DEFAULT_VIEWPORT);
  const hasHydratedRef = useRef(false);
  const nextXRef = useRef(40);
  const nextYRef = useRef(40);
  const autosaveTimeoutRef = useRef<number | null>(null);
  const dirtyRef = useRef(false);
  const boardSurfaceRef = useRef<HTMLDivElement | null>(null);

  const selectedBoardUserId = useMemo(() => {
    if (!user) return null;

    if (!isDm) {
      return user.id;
    }

    const raw = searchParams.get("userId");
    const parsed = raw ? Number(raw) : Number.NaN;

    return Number.isInteger(parsed) && parsed > 0 ? parsed : user.id;
  }, [isDm, searchParams, user]);

  const selectedBoardId = useMemo(() => {
    const raw = searchParams.get("boardId");
    const parsed = raw ? Number(raw) : Number.NaN;
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }, [searchParams]);

  useEffect(() => {
    if (!user || user.role !== "dm") {
      return;
    }

    if (!selectedBoardUserId || selectedBoardUserId === user.id) {
      return;
    }

    window.localStorage.setItem(DM_LAST_VIEWED_BOARD_OWNER_KEY, String(selectedBoardUserId));
  }, [selectedBoardUserId, user]);

  const canMutateDefault = Boolean(user && selectedBoardUserId === user.id);

  useEffect(() => {
    if (!user || user.role !== "dm") {
      return;
    }

    if (searchParams.get("userId")) {
      return;
    }

    const settings = getUserSettings(user.id);
    if (settings.dmBoardDefaultView !== "last-viewed-player") {
      return;
    }

    const storedOwnerId = Number(window.localStorage.getItem(DM_LAST_VIEWED_BOARD_OWNER_KEY));
    if (!Number.isInteger(storedOwnerId) || storedOwnerId <= 0 || storedOwnerId === user.id) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("userId", String(storedOwnerId));
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams, user]);

  const boardAutosaveEnabled = useMemo(() => {
    if (!user) {
      return true;
    }

    return getUserSettings(user.id).boardAutosave;
  }, [user]);

  const markDirty = useCallback(() => {
    if (!hasHydratedRef.current) return;

    dirtyRef.current = true;
    setAutosaveStatus("dirty");
  }, []);

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((current) => current.filter((node) => node.id !== nodeId));
      setEdges((current) =>
        current.filter(
          (edge) => edge.source !== nodeId && edge.target !== nodeId,
        ),
      );
    },
    [setEdges, setNodes],
  );

  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      setEdges((current) => current.filter((edge) => edge.id !== edgeId));
    },
    [setEdges],
  );

  const handleEdgeLabelChange = useCallback(
    (edgeId: string, value: string) => {
      setEdges((current) =>
        current.map((edge) =>
          edge.id === edgeId
            ? {
                ...edge,
                data: {
                  ...edge.data,
                  label: value,
                },
              }
            : edge,
        ),
      );
    },
    [setEdges],
  );

  const handleNoteTitleChange = useCallback(
    (nodeId: string, value: string) => {
      setNodes((current) =>
        current.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  title: value,
                },
              }
            : node,
        ),
      );
    },
    [setNodes],
  );

  const handleNoteBodyChange = useCallback(
    (nodeId: string, value: string) => {
      setNodes((current) =>
        current.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  body: value,
                },
              }
            : node,
        ),
      );
    },
    [setNodes],
  );

  const decorateNode = useCallback(
    (node: BoardNode): BoardNode => ({
      ...node,
      data: {
        ...node.data,
        onTitleChange: handleNoteTitleChange,
        onBodyChange: handleNoteBodyChange,
        onDelete: handleDeleteNode,
      },
    }),
    [handleDeleteNode, handleNoteBodyChange, handleNoteTitleChange],
  );

  const decorateEdge = useCallback(
    (edge: BoardEdge): BoardEdge => ({
      ...edge,
      type: "boardEdge",
      data: {
        ...edge.data,
        label: edge.data?.label ?? "",
        onDelete: handleDeleteEdge,
        onLabelChange: handleEdgeLabelChange,
      },
      style: edge.style || { stroke: "#c63b44", strokeWidth: 3 },
    }),
    [handleDeleteEdge, handleEdgeLabelChange],
  );

  const decorateNodes = useCallback(
    (inputNodes: BoardNode[]) => inputNodes.map(decorateNode),
    [decorateNode],
  );

  const decorateEdges = useCallback(
    (inputEdges: BoardEdge[]) => inputEdges.map(decorateEdge),
    [decorateEdge],
  );

  const stripTransientNodeData = useCallback(
    (data: BoardCardData): BoardCardData => ({
      kind: data.kind,
      npcId: data.npcId,
      title: data.title,
      body: data.body,
      imageUrl: data.imageUrl,
      noteColor: data.noteColor,
      noteRotation: data.noteRotation,
    }),
    [],
  );

  const stripTransientEdgeData = useCallback(
    (data?: BoardEdgeData): BoardEdgeData => ({
      label: data?.label ?? "",
    }),
    [],
  );

  const loadBoards = useCallback(async () => {
    if (!selectedBoardUserId) return;
    const query = isDm ? `?userId=${selectedBoardUserId}` : "";
    const response = await apiFetch(`/api/boards${query}`);
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || `Failed to load boards: ${response.status}`);
    }

    setBoards(payload.boards || []);
  }, [isDm, selectedBoardUserId]);

  const persistBoard = useCallback(async () => {
    if (!selectedBoardUserId) return true;

    try {
      setSaving(true);
      setAutosaveStatus("saving");
      setError("");

      const snapshot: BoardSnapshot = {
        nodes: nodes.map((node) => ({
          ...node,
          data: stripTransientNodeData(node.data),
        })),
        edges: edges.map((edge) => ({
          ...edge,
          data: stripTransientEdgeData(edge.data),
        })),
        viewport: viewportRef.current,
      };

      const params = new URLSearchParams();
      if (isDm) params.set("userId", String(selectedBoardUserId));
      if (currentBoardId) params.set("boardId", String(currentBoardId));
      const query = params.toString() ? `?${params.toString()}` : "";

      const response = await apiFetch(`/api/board${query}`, {
        method: "PUT",
        body: JSON.stringify(snapshot),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Failed to save board: ${response.status}`);
      }

      setLastSavedAt(result.updated_at);
      dirtyRef.current = false;
      setAutosaveStatus("saved");

      setBoardUsers((current) =>
        current.map((entry) =>
          entry.id === selectedBoardUserId
            ? {
                ...entry,
                board_updated_at: result.updated_at,
              }
            : entry,
        ),
      );

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setAutosaveStatus("idle");
      return false;
    } finally {
      setSaving(false);
    }
  }, [
    currentBoardId,
    edges,
    isDm,
    nodes,
    selectedBoardUserId,
    stripTransientEdgeData,
    stripTransientNodeData,
  ]);

  useEffect(() => {
    if (!hasHydratedRef.current) return;

    markDirty();

    if (autosaveTimeoutRef.current) {
      window.clearTimeout(autosaveTimeoutRef.current);
      autosaveTimeoutRef.current = null;
    }

    if (!boardAutosaveEnabled) {
      return;
    }

    autosaveTimeoutRef.current = window.setTimeout(() => {
      void persistBoard();
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (autosaveTimeoutRef.current) {
        window.clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [boardAutosaveEnabled, edges, markDirty, nodes, persistBoard, viewportVersion]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current || saving) return;

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [saving]);

  useEffect(() => {
    if (!isDm) return;

    async function loadBoardUsers() {
      try {
        const response = await apiFetch("/api/dm/board-users");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || `Failed to load board users: ${response.status}`);
        }

        setBoardUsers(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    }

    void loadBoardUsers();
  }, [isDm]);

  useEffect(() => {
    if (!rfInstance || !selectedBoardUserId) return;
    const instance: ReactFlowInstance<BoardNode, BoardEdge> = rfInstance;

    let isActive = true;

    async function loadBoard() {
      try {
        if (autosaveTimeoutRef.current) {
          window.clearTimeout(autosaveTimeoutRef.current);
          autosaveTimeoutRef.current = null;
        }

        hasHydratedRef.current = false;
        dirtyRef.current = false;
        setLoading(true);
        setError("");
        setAutosaveStatus("idle");

        await loadBoards();

        const params = new URLSearchParams();
        if (isDm) params.set("userId", String(selectedBoardUserId));
        if (selectedBoardId) params.set("boardId", String(selectedBoardId));
        const query = params.toString() ? `?${params.toString()}` : "";

        const boardResponse = await apiFetch(`/api/board${query}`);
        const boardData: BoardResponse = await boardResponse.json();

        if (!boardResponse.ok) {
          throw new Error(boardData?.owner ? "Failed to load board" : "Board not found");
        }

        const npcPath =
          isDm && boardData.owner.role === "dm" ? "/api/dm/npcs" : "/api/npcs";
        const npcResponse = await apiFetch(npcPath);
        const npcData = await npcResponse.json();

        if (!npcResponse.ok) {
          throw new Error(npcData.error || `Failed to load NPCs: ${npcResponse.status}`);
        }

        if (!isActive) return;

        const restoredNodes = decorateNodes((boardData.board.nodes || []) as BoardNode[]);
        const restoredEdges = decorateEdges((boardData.board.edges || []) as BoardEdge[]);
        const restoredViewport = boardData.board.viewport || DEFAULT_VIEWPORT;

        setNodes(restoredNodes);
        setEdges(restoredEdges);
        setVisibleNpcs(npcData);
        setLastSavedAt(boardData.updated_at);
        setBoardOwner(boardData.owner);
        setCurrentBoardId(boardData.board_id);
        setCurrentBoardName(boardData.board_name);
        viewportRef.current = restoredViewport;
        nextXRef.current = 40 + restoredNodes.length * 20;
        nextYRef.current = 40 + restoredNodes.length * 20;

        requestAnimationFrame(() => {
          if (!isActive) return;
          instance.setViewport(restoredViewport);
          hasHydratedRef.current = true;
        });
      } catch (err) {
        if (!isActive) return;
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    void loadBoard();

    return () => {
      isActive = false;
    };
  }, [
    decorateEdges,
    decorateNodes,
    isDm,
    loadBoards,
    rfInstance,
    selectedBoardId,
    selectedBoardUserId,
    setEdges,
    setNodes,
  ]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!rfInstance) return;

    requestAnimationFrame(() => {
      rfInstance.setViewport(viewportRef.current);
    });
  }, [isFullscreen, rfInstance, selectedBoardId, selectedBoardUserId]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((current) =>
        addEdge(
          {
            ...params,
            type: "boardEdge",
            data: {
              label: "",
              onDelete: handleDeleteEdge,
              onLabelChange: handleEdgeLabelChange,
            },
            style: { stroke: "#c63b44", strokeWidth: 3 },
          },
          current,
        ),
      );
    },
    [handleDeleteEdge, handleEdgeLabelChange, setEdges],
  );

  const saveBoard = useCallback(async () => {
    if (autosaveTimeoutRef.current) {
      window.clearTimeout(autosaveTimeoutRef.current);
      autosaveTimeoutRef.current = null;
    }

    await persistBoard();
    await loadBoards();
  }, [loadBoards, persistBoard]);

  const addNpcNode = useCallback(
    (npc: Npc) => {
      const imageUrl = npc.portrait_path ? apiUrl(npc.portrait_path) : undefined;

      const newNode: BoardNode = decorateNode({
        id: `npc-${npc.slug}-${Date.now()}`,
        type: "boardCard",
        position: { x: nextXRef.current, y: nextYRef.current },
        data: {
          kind: "npc",
          npcId: npc.id,
          title: npc.name,
          body: npc.house || npc.rank_title || "",
          imageUrl,
        },
      });

      setNodes((current) => [...current, newNode]);
      nextXRef.current += 40;
      nextYRef.current += 40;
      setShowNpcPicker(false);
      setShowAddMenu(false);
    },
    [decorateNode, setNodes],
  );

  const addNoteNode = useCallback(() => {
    const noteColor = NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)];
    const noteRotation = Math.floor(Math.random() * 9) - 4;

    const newNode: BoardNode = decorateNode({
      id: `note-${Date.now()}`,
      type: "boardCard",
      position: { x: nextXRef.current, y: nextYRef.current },
      data: {
        kind: "note",
        title: "New note",
        body: "",
        noteColor,
        noteRotation,
      },
    });

    setNodes((current) => [...current, newNode]);
    nextXRef.current += 40;
    nextYRef.current += 40;
    setShowAddMenu(false);
  }, [decorateNode, setNodes]);

  const clearBoard = useCallback(() => {
    if (!window.confirm("Clear the entire board?")) return;
    setNodes([]);
    setEdges([]);
    setShowOverflowMenu(false);
  }, [setEdges, setNodes]);

  const updateSearchParams = useCallback(
    (update: (params: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams);
      update(next);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const handleBoardOwnerChange = useCallback(
    async (nextUserId: number) => {
      if (!user || !isDm || nextUserId === selectedBoardUserId) return;

      if (dirtyRef.current) {
        const saved = await persistBoard();
        if (!saved) return;
      }

      updateSearchParams((params) => {
        params.set("userId", String(nextUserId));
        params.delete("boardId");
      });
    },
    [isDm, persistBoard, selectedBoardUserId, updateSearchParams, user],
  );

  const handleBoardSwitch = useCallback(
    async (nextBoardId: number) => {
      if (!currentBoardId || nextBoardId === currentBoardId) return;

      if (dirtyRef.current) {
        const saved = await persistBoard();
        if (!saved) return;
      }

      if (canMutateDefault) {
        const params = new URLSearchParams();
        if (isDm) params.set("userId", String(selectedBoardUserId));
        await apiFetch(`/api/boards/${nextBoardId}${params.toString() ? `?${params.toString()}` : ""}`, {
          method: "PATCH",
          body: JSON.stringify({ set_default: true }),
        });
      }

      updateSearchParams((params) => {
        params.set("boardId", String(nextBoardId));
      });
    },
    [canMutateDefault, currentBoardId, isDm, persistBoard, selectedBoardUserId, updateSearchParams],
  );

  const createBoard = useCallback(async () => {
    try {
      const nextName = window.prompt("New board name", "Investigation Board");
      if (!nextName) return;

      const params = new URLSearchParams();
      if (isDm) params.set("userId", String(selectedBoardUserId));

      const response = await apiFetch(`/api/boards${params.toString() ? `?${params.toString()}` : ""}`, {
        method: "POST",
        body: JSON.stringify({ name: nextName, board: { nodes: [], edges: [], viewport: DEFAULT_VIEWPORT } }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to create board");
      }

      await loadBoards();
      updateSearchParams((next) => next.set("boardId", String(payload.board.id)));
      setShowOverflowMenu(false);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Failed to create board");
    }
  }, [isDm, loadBoards, selectedBoardUserId, updateSearchParams]);

  const renameBoard = useCallback(async () => {
    try {
      if (!currentBoardId) return;
      const nextName = window.prompt("Rename board", currentBoardName);
      if (!nextName) return;

      const params = new URLSearchParams();
      if (isDm) params.set("userId", String(selectedBoardUserId));

      const response = await apiFetch(
        `/api/boards/${currentBoardId}${params.toString() ? `?${params.toString()}` : ""}`,
        {
          method: "PATCH",
          body: JSON.stringify({ name: nextName }),
        },
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to rename board");
      }

      setCurrentBoardName(payload.board.name);
      await loadBoards();
      setShowOverflowMenu(false);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Failed to rename board");
    }
  }, [currentBoardId, currentBoardName, isDm, loadBoards, selectedBoardUserId]);

  const duplicateBoard = useCallback(async () => {
    try {
      if (!currentBoardId) return;

      const params = new URLSearchParams();
      if (isDm) params.set("userId", String(selectedBoardUserId));

      const response = await apiFetch(
        `/api/boards/${currentBoardId}/duplicate${params.toString() ? `?${params.toString()}` : ""}`,
        { method: "POST" },
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to duplicate board");
      }

      await loadBoards();
      updateSearchParams((next) => next.set("boardId", String(payload.board.id)));
      setShowOverflowMenu(false);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Failed to duplicate board");
    }
  }, [currentBoardId, isDm, loadBoards, selectedBoardUserId, updateSearchParams]);

  const archiveBoard = useCallback(async () => {
    try {
      if (!currentBoardId) return;
      if (!window.confirm("Archive this board? You can restore it from DM Archive.")) return;

      const params = new URLSearchParams();
      if (isDm) params.set("userId", String(selectedBoardUserId));

      const response = await apiFetch(
        `/api/boards/${currentBoardId}/archive${params.toString() ? `?${params.toString()}` : ""}`,
        { method: "POST" },
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to archive board");
      }

      await loadBoards();
      updateSearchParams((next) => next.set("boardId", String(payload.next_board_id)));
      setShowOverflowMenu(false);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Failed to archive board");
    }
  }, [currentBoardId, isDm, loadBoards, selectedBoardUserId, updateSearchParams]);

  const toggleFullscreen = useCallback(async () => {
    if (!boardSurfaceRef.current) return;

    if (!document.fullscreenElement) {
      await boardSurfaceRef.current.requestFullscreen();
      return;
    }

    await document.exitFullscreen();
  }, []);

  const filteredNpcs = useMemo(() => {
    const query = npcSearch.trim().toLowerCase();
    if (!query) return visibleNpcs;
    return visibleNpcs.filter((npc) => {
      const aliases = [...npc.canonical_aliases, ...npc.personal_aliases].join(" ").toLowerCase();
      return npc.name.toLowerCase().includes(query) || aliases.includes(query);
    });
  }, [npcSearch, visibleNpcs]);

  const boardOwnerLabel =
    boardOwner?.display_name || boardOwner?.username || user?.display_name || "User";
  const currentBoardDetails =
    boards.find((entry) => entry.id === currentBoardId) || null;

  const exportBoardJson = useCallback(async () => {
    if (!user || !currentBoardId || !boardOwner) return;

    const timestamp = formatTimestampForFilename();
    const boardSlug = sanitizeFilenamePart(currentBoardName);
    const payload = {
      metadata: {
        export_type: "board_json",
        schema_version: "1.0",
        exported_at: new Date().toISOString(),
        exported_by_user_id: user.id,
        exported_by_username: user.username,
        app_name: "FaeBook",
      },
      board: {
        id: currentBoardId,
        name: currentBoardName,
        owner_user_id: boardOwner.id,
        is_default: currentBoardDetails?.is_default ?? false,
        nodes: nodes.map((node) => ({
          ...node,
          data: stripTransientNodeData(node.data),
        })),
        edges: edges.map((edge) => ({
          ...edge,
          data: stripTransientEdgeData(edge.data),
        })),
        viewport: viewportRef.current,
        created_at: currentBoardDetails?.created_at || null,
        updated_at: lastSavedAt || currentBoardDetails?.updated_at || null,
      },
    };

    downloadBlob(
      new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
      `board-${boardSlug}-${timestamp}.json`,
    );

    try {
      await apiFetch("/api/exports/audit", {
        method: "POST",
        body: JSON.stringify({
          export_type: "board_json",
          object_type: "board",
          object_id: String(currentBoardId),
          message: `Exported board JSON for board ${currentBoardId}`,
        }),
      });
    } catch (_error) {
      // non-blocking
    }
  }, [
    boardOwner,
    boards,
    currentBoardId,
    currentBoardName,
    edges,
    lastSavedAt,
    nodes,
    stripTransientEdgeData,
    stripTransientNodeData,
    user,
  ]);

  const exportBoardPng = useCallback(async () => {
    if (!currentBoardId || !boardSurfaceRef.current) return;

    const viewportElement = boardSurfaceRef.current.querySelector(
      ".react-flow__viewport",
    ) as HTMLElement | null;

    if (!viewportElement) {
      setError("Unable to export board image.");
      return;
    }

    try {
      const blob = await renderElementToPngBlob(viewportElement, 2);
      const timestamp = formatTimestampForFilename();
      const boardSlug = sanitizeFilenamePart(currentBoardName);
      downloadBlob(blob, `board-${boardSlug}-${timestamp}.png`);

      await apiFetch("/api/exports/audit", {
        method: "POST",
        body: JSON.stringify({
          export_type: "board_png",
          object_type: "board",
          object_id: String(currentBoardId),
          message: `Exported board PNG for board ${currentBoardId}`,
        }),
      });
    } catch (_error) {
      setError("Failed to export board image.");
    }
  }, [currentBoardId, currentBoardName]);

  const npcPickerModal = showNpcPicker ? (
    <div className={`board-modal-overlay ${isFullscreen ? "board-modal-overlay-surface" : ""}`.trim()} role="presentation" onClick={() => setShowNpcPicker(false)}>
      <div className="board-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <h2>Add NPC</h2>
        <input
          className="text-input"
          type="search"
          placeholder="Search by name or alias..."
          value={npcSearch}
          onChange={(event) => setNpcSearch(event.target.value)}
        />
        <div className="board-modal-list">
          {filteredNpcs.map((npc) => (
            <button key={npc.id} type="button" className="board-npc-button" onClick={() => addNpcNode(npc)}>
              {npc.name}
            </button>
          ))}
          {!filteredNpcs.length ? <p className="topbar-meta">No NPC matches.</p> : null}
        </div>
        <div className="board-modal-actions">
          <button type="button" className="secondary-link" onClick={() => setShowNpcPicker(false)}>Close</button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>Investigation Board</h1>
        </div>

        <div className="topbar-meta topbar-meta-stack">
          <span>{nodes.length} nodes</span>
          <span>Viewing {boardOwnerLabel}&apos;s board</span>
        </div>
      </header>

      {error ? (
        <div className="state-card error-card small-card board-error">
          <p>{error}</p>
        </div>
      ) : null}

      {loading ? (
        <div className="state-card small-card board-error">
          <p>Loading board...</p>
        </div>
      ) : null}

      <section className="board-v2-shell" ref={boardSurfaceRef}>
        <div className="board-floating-controls">
          {isDm ? (
            <label className="toolbar-field board-inline-field">
              <span>User</span>
              <FaeSelect
                className="text-input"
                value={selectedBoardUserId != null ? String(selectedBoardUserId) : ""}
                onChange={(nextValue) => {
                  void handleBoardOwnerChange(Number(nextValue));
                }}
                options={boardUsers.map((entry) => ({
                  value: String(entry.id),
                  label: `${entry.display_name} (${entry.role})`,
                }))}
              />
            </label>
          ) : null}

          <label className="toolbar-field board-inline-field">
            <span>Board</span>
            <FaeSelect
              className="text-input"
              value={currentBoardId != null ? String(currentBoardId) : ""}
              onChange={(nextValue) => {
                void handleBoardSwitch(Number(nextValue));
              }}
              options={boards.map((board) => ({
                value: String(board.id),
                label: `${board.name}${board.is_default ? " • default" : ""}`,
              }))}
            />
          </label>

          <div className="board-icon-group">
            <button className="action-button board-icon-button" onClick={() => setShowAddMenu((v) => !v)} type="button">+</button>
            <button className="action-button board-icon-button" onClick={() => void saveBoard()} type="button" disabled={saving}>{saving ? "…" : "💾"}</button>
            <button className="action-button board-icon-button" onClick={() => void toggleFullscreen()} type="button">{isFullscreen ? "⤢" : "⤢"}</button>
            <button className="action-button board-icon-button" onClick={() => setShowOverflowMenu((v) => !v)} type="button">⋯</button>
          </div>

          {showAddMenu ? (
            <div className="board-popover">
              <button type="button" className="secondary-link" onClick={addNoteNode}>Add Note</button>
              <button type="button" className="secondary-link" onClick={() => {
                setShowNpcPicker(true);
                setShowAddMenu(false);
              }}>Add NPC</button>
            </div>
          ) : null}

          {showOverflowMenu ? (
            <div className="board-popover">
              <button type="button" className="secondary-link" onClick={() => void createBoard()}>Create Board</button>
              <button type="button" className="secondary-link" onClick={() => void renameBoard()}>Rename Board</button>
              <button type="button" className="secondary-link" onClick={() => void duplicateBoard()}>Duplicate Board</button>
              <button type="button" className="secondary-link" onClick={() => void exportBoardJson()}>Export Board JSON</button>
              <button type="button" className="secondary-link" onClick={() => void exportBoardPng()}>Export Board PNG</button>
              <button type="button" className="secondary-link" onClick={clearBoard}>Clear Board</button>
              <button type="button" className="board-node-delete-button" onClick={() => void archiveBoard()}>Archive Board</button>
            </div>
          ) : null}
        </div>

        <div className="board-canvas-wrap board-v2-canvas">
          <ReactFlow<BoardNode, BoardEdge>
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onInit={setRfInstance}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onMoveEnd={(_, viewport) => {
              viewportRef.current = viewport;
              setViewportVersion((value) => value + 1);
            }}
            deleteKeyCode={["Delete", "Backspace"]}
            defaultEdgeOptions={{
              type: "boardEdge",
              style: { stroke: "#c63b44", strokeWidth: 3 },
            }}
            fitViewOptions={{ maxZoom: 1.3 }}
            nodeDragThreshold={8}
          >
            <Background />
          </ReactFlow>
        </div>

        <footer className="board-footer-status">
          <span>{currentBoardName}</span>
          <span>
            Autosave:{" "}
            {!boardAutosaveEnabled
              ? "Off"
              : autosaveStatus === "dirty"
                ? "Waiting..."
                : autosaveStatus === "saving"
                  ? "Saving..."
                  : autosaveStatus === "saved"
                    ? "Saved"
                    : "Idle"}
          </span>
          <span>Last saved: {lastSavedAt ? new Date(lastSavedAt).toLocaleString() : "Never"}</span>
        </footer>
      </section>

      {npcPickerModal && boardSurfaceRef.current
        ? createPortal(npcPickerModal, isFullscreen ? boardSurfaceRef.current : document.body)
        : null}
    </div>
  );
}

export default function BoardPage() {
  return (
    <ReactFlowProvider>
      <BoardCanvas />
    </ReactFlowProvider>
  );
}
