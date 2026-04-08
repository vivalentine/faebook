import type { Edge, Node, Viewport } from "@xyflow/react";

export type Npc = {
  id: number;
  slug: string;
  name: string;
  house: string | null;
  faction: string | null;
  court: string | null;
  ring: string | null;
  rank_title: string | null;
  role: string | null;
  introduced_in: string | null;
  portrait_path: string | null;
  met_summary: string | null;
  short_blurb: string | null;
  is_visible: number;
  source_file?: string | null;
  created_at: string;
  updated_at: string;
};

export type NpcNote = {
  id: number;
  author_name: string;
  author_user_id: number | null;
  content: string;
  created_at: string;
  updated_at: string;
  can_edit: boolean;
  can_delete: boolean;
};

export type BoardCardData = {
  kind: "npc" | "note";
  title: string;
  body?: string;
  imageUrl?: string;
  onTitleChange?: (nodeId: string, value: string) => void;
  onBodyChange?: (nodeId: string, value: string) => void;
  onDelete?: (nodeId: string) => void;
};

export type BoardEdgeData = {
  label?: string;
  onDelete?: (edgeId: string) => void;
  onLabelChange?: (edgeId: string, value: string) => void;
};

export type BoardNode = Node<BoardCardData>;
export type BoardEdge = Edge<BoardEdgeData>;

export type BoardSnapshot = {
  nodes: BoardNode[];
  edges: BoardEdge[];
  viewport: Viewport;
};

export type AuthRole = "dm" | "player";

export type AuthUser = {
  id: number;
  username: string;
  display_name: string;
  role: AuthRole;
};

export type BoardUserSummary = {
  id: number;
  username: string;
  display_name: string;
  role: AuthRole;
  board_updated_at: string | null;
};

export type BoardResponse = {
  board: BoardSnapshot;
  updated_at: string;
  owner: AuthUser;
};
