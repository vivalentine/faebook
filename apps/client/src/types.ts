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
  canonical_aliases: string[];
  personal_aliases: string[];
  source_file?: string | null;
  created_at: string;
  updated_at: string;
};

export type NpcAlias = {
  id: number;
  npc_id: number;
  user_id: number | null;
  owner_display_name?: string | null;
  owner_username?: string | null;
  alias: string;
  alias_type: "canonical" | "personal";
  created_at: string;
  updated_at: string;
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

export type DashboardSuspect = {
  id: number;
  name: string;
  status: "active" | "cleared" | "unknown";
  note: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type DashboardNote = {
  id: number;
  content: string;
  created_at: string;
  updated_at: string;
};

export type SessionRecap = {
  id: number;
  session_number: number;
  title: string;
  content: string;
  published_at: string;
  updated_at: string;
  published_by_user_id: number;
  published_by_display_name?: string | null;
  published_by_username?: string | null;
};

export type DashboardActivityItem = {
  type: string;
  label: string;
  updated_at: string;
};

export type DashboardNpcUnlock = {
  id: number;
  slug: string;
  name: string;
  updated_at: string;
};

export type DashboardData = {
  role: AuthRole;
  quick_links: {
    board: string;
    maps: string;
  };
  recently_unlocked_npcs: DashboardNpcUnlock[];
  suspects: DashboardSuspect[];
  personal_note: DashboardNote | null;
  latest_recap: SessionRecap | null;
  recent_personal_activity: DashboardActivityItem[];
  player_board_links?: Array<{
    id: number;
    display_name: string;
    username: string;
    board_updated_at: string | null;
  }>;
  recent_imports?: Array<{
    filename: string;
    result: string;
    timestamp: string;
  }>;
  recently_changed_npcs?: DashboardNpcUnlock[];
  archive_activity_summary?: {
    archived_recently: number;
    restored_recently: number;
    note: string;
  };
};

export type ArchiveRecord = {
  id: number;
  object_type: "dashboard_suspect" | "dashboard_note" | "npc_alias" | string;
  object_id: string;
  owner_user_id: number | null;
  archived_by_user_id: number;
  archived_at: string;
  object_label: string | null;
  source_table: string | null;
  archive_reason: string | null;
  owner_username?: string | null;
  owner_display_name?: string | null;
  archived_by_username?: string | null;
  archived_by_display_name?: string | null;
};
