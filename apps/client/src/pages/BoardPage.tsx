import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addEdge,
  Background,
  Controls,
  MiniMap,
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
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import "@xyflow/react/dist/style.css";

import { useAuth } from "../auth/AuthContext";
import { apiFetch, apiUrl } from "../lib/api";
import type {
  BoardCardData,
  BoardEdge,
  BoardEdgeData,
  BoardResponse,
  BoardNode,
  BoardSnapshot,
  BoardUserSummary,
  Npc,
  AuthUser,
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

function BoardCanvas() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, logout } = useAuth();

  const isPlayerView = location.pathname.startsWith("/player");
  const isDm = user?.role === "dm";

  const [visibleNpcs, setVisibleNpcs] = useState<Npc[]>([]);
  const [nodes, setNodes, onNodesChange] = useNodesState<BoardNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<BoardEdge>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
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

  const viewportRef = useRef(DEFAULT_VIEWPORT);
  const hasHydratedRef = useRef(false);
  const nextXRef = useRef(40);
  const nextYRef = useRef(40);
  const autosaveTimeoutRef = useRef<number | null>(null);
  const dirtyRef = useRef(false);

  const selectedBoardUserId = useMemo(() => {
    if (!user) return null;

    if (!isDm) {
      return user.id;
    }

    const raw = searchParams.get("userId");
    const parsed = raw ? Number(raw) : Number.NaN;

    return Number.isInteger(parsed) && parsed > 0 ? parsed : user.id;
  }, [isDm, searchParams, user]);

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
      title: data.title,
      body: data.body,
      imageUrl: data.imageUrl,
    }),
    [],
  );

  const stripTransientEdgeData = useCallback(
    (data?: BoardEdgeData): BoardEdgeData => ({
      label: data?.label ?? "",
    }),
    [],
  );

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

      const query = isDm ? `?userId=${selectedBoardUserId}` : "";
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
    }

    autosaveTimeoutRef.current = window.setTimeout(() => {
      void persistBoard();
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (autosaveTimeoutRef.current) {
        window.clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [edges, markDirty, nodes, persistBoard, viewportVersion]);

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

        const query = isDm ? `?userId=${selectedBoardUserId}` : "";
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
  }, [decorateEdges, decorateNodes, isDm, rfInstance, selectedBoardUserId, setEdges, setNodes]);

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
  }, [persistBoard]);

  const addNpcNode = useCallback(
    (npc: Npc) => {
      const imageUrl = npc.portrait_path ? apiUrl(npc.portrait_path) : undefined;

      const newNode: BoardNode = decorateNode({
        id: `npc-${npc.slug}-${Date.now()}`,
        type: "boardCard",
        position: { x: nextXRef.current, y: nextYRef.current },
        data: {
          kind: "npc",
          title: npc.name,
          body: npc.house || npc.rank_title || "",
          imageUrl,
        },
      });

      setNodes((current) => [...current, newNode]);
      nextXRef.current += 40;
      nextYRef.current += 40;
    },
    [decorateNode, setNodes],
  );

  const addNoteNode = useCallback(() => {
    const newNode: BoardNode = decorateNode({
      id: `note-${Date.now()}`,
      type: "boardCard",
      position: { x: nextXRef.current, y: nextYRef.current },
      data: {
        kind: "note",
        title: "New note",
        body: "",
      },
    });

    setNodes((current) => [...current, newNode]);
    nextXRef.current += 40;
    nextYRef.current += 40;
  }, [decorateNode, setNodes]);

  const clearBoard = useCallback(() => {
    if (!window.confirm("Clear the entire board?")) return;
    setNodes([]);
    setEdges([]);
  }, [setEdges, setNodes]);

  const handleBoardOwnerChange = useCallback(
    async (nextUserId: number) => {
      if (!user || !isDm || nextUserId === selectedBoardUserId) return;

      if (dirtyRef.current) {
        const saved = await persistBoard();
        if (!saved) return;
      }

      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("userId", String(nextUserId));
      setSearchParams(nextParams, { replace: true });
    },
    [isDm, persistBoard, searchParams, selectedBoardUserId, setSearchParams, user],
  );

  async function handleLogout() {
    try {
      if (dirtyRef.current) {
        await persistBoard();
      }

      setLoggingOut(true);
      setError("");
      await logout();
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logout failed");
    } finally {
      setLoggingOut(false);
    }
  }

  const sidebarNpcs = useMemo(() => visibleNpcs, [visibleNpcs]);
  const boardOwnerLabel =
    boardOwner?.display_name || boardOwner?.username || user?.display_name || "User";

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">FaeBook</p>
          <h1>Investigation Board</h1>
        </div>

        <div className="topbar-meta topbar-meta-stack">
          <span>{nodes.length} nodes</span>
          <span>Viewing {boardOwnerLabel}&apos;s board</span>
          <button
            className="action-button secondary-link topbar-action"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </header>

      <div className="page-back-link board-nav">
        {isPlayerView ? (
          <Link to="/player">← Player Directory</Link>
        ) : (
          <Link to="/">← DM Panel</Link>
        )}
      </div>

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

      <section className="board-layout">
        <aside className="board-sidebar">
          <div className="board-sidebar-card">
            <h2>Board Tools</h2>

            {isDm ? (
              <label className="toolbar-field">
                <span>Open board</span>
                <select
                  className="text-input"
                  value={selectedBoardUserId ?? ""}
                  onChange={(event) => {
                    void handleBoardOwnerChange(Number(event.target.value));
                  }}
                >
                  {boardUsers.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.display_name} ({entry.role})
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <div className="board-tools-actions">
              <button className="action-button" onClick={addNoteNode}>
                Add note
              </button>
              <button
                className="action-button secondary-link"
                onClick={() => {
                  void saveBoard();
                }}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save now"}
              </button>
              <button className="action-button secondary-link" onClick={clearBoard}>
                Clear board
              </button>
            </div>
            <p className="board-meta-line">
              Autosave:{" "}
              {autosaveStatus === "dirty"
                ? "Waiting..."
                : autosaveStatus === "saving"
                  ? "Saving..."
                  : autosaveStatus === "saved"
                    ? "Saved"
                    : "Idle"}
            </p>
            <p className="board-meta-line">
              Last saved:{" "}
              {lastSavedAt ? new Date(lastSavedAt).toLocaleString() : "Never"}
            </p>
            <p className="board-meta-line">
              Tip: click a node or edge, then press Delete or Backspace.
            </p>
          </div>

          <div className="board-sidebar-card">
            <h2>{boardOwner?.role === "dm" ? "All NPCs" : "Unlocked NPCs"}</h2>
            <div className="board-npc-list">
              {sidebarNpcs.map((npc) => (
                <button
                  key={npc.id}
                  className="board-npc-button"
                  onClick={() => {
                    addNpcNode(npc);
                  }}
                >
                  {npc.name}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="board-canvas-wrap">
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
          >
            <Background />
            <MiniMap />
            <Controls />
          </ReactFlow>
        </div>
      </section>
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
