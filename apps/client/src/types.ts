import type { Edge, Node, Viewport } from "@xyflow/react";

export type Npc = {
  id: number;
  slug: string;
  name: string;
  tier?: "major" | "minor";
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
  reputation?: NpcReputationDisplay | null;
  source_file?: string | null;
  source_file_label?: string | null;
  sort_name?: string | null;
  raw_markdown_body?: string | null;
  last_imported_at?: string | null;
  archived_at?: string | null;
  archived_by_user_id?: number | null;
  created_at: string;
  updated_at: string;
};

export type NpcReputationDisplay = {
  bucket: string;
  card_indicator: "heart" | "green" | "yellow" | "neutral" | "red" | "black" | "knife";
  card_label: string;
  detail_text: string;
  dm_hint: string;
  score?: number;
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

export type NpcNote = {
  id: number;
  npc_id: number;
  author_user_id: number | null;
  author_name: string;
  author_display_name?: string | null;
  author_username?: string | null;
  content: string;
  created_at: string;
  updated_at: string;
};

export type BoardCardData = {
  kind: "npc" | "note";
  npcId?: number;
  title: string;
  body?: string;
  imageUrl?: string;
  noteColor?: "yellow" | "pink" | "mint" | "blue";
  noteRotation?: number;
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

export type UserProfile = {
  user_id: number;
  username: string;
  display_name: string;
  role: AuthRole;
  bio: string;
  status_line: string;
  pronouns: string;
  profile_image_path: string | null;
  updated_at: string;
};

export type BoardUserSummary = {
  id: number;
  username: string;
  display_name: string;
  role: AuthRole;
  board_updated_at: string | null;
};

export type BoardResponse = {
  board_id: number;
  board_name: string;
  is_default: boolean;
  board: BoardSnapshot;
  updated_at: string;
  owner: AuthUser;
};

export type BoardListItem = {
  id: number;
  owner_user_id: number;
  name: string;
  is_default: boolean;
  updated_at: string;
  created_at: string;
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
  chapter_number: number;
  chapter_title: string;
  title: string;
  content: string;
  is_published: boolean;
  published_at: string;
  updated_at: string;
  published_by_user_id: number;
  published_by_display_name?: string | null;
  published_by_username?: string | null;
};

export type CampaignDocument = {
  id: number;
  slug: string;
  title: string;
  document_type: string;
  body_markdown: string;
  published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type LocationRecord = {
  id: number;
  slug: string;
  name: string;
  ring: string | null;
  court: string | null;
  faction: string | null;
  district: string | null;
  summary: string | null;
  body_markdown: string;
  tags: string[];
  map_id: MapLayerConfig["map_id"] | null;
  landmark_slug: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
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
  object_type: "board" | "dashboard_suspect" | "dashboard_note" | "npc_alias" | string;
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

export type MapLayerConfig = {
  map_id: "overworld" | "inner-ring" | "outer-ring";
  label: string;
  image_filename: string;
  image_path: string;
  width: number;
  height: number;
  default_zoom: number;
  min_zoom: number;
  max_zoom: number;
  pin_scale: number;
};

export type MapPinCategory = "clue" | "lead" | "suspect" | "danger" | "meeting" | "theory";

export type MapPin = {
  id: number;
  user_id: number;
  map_layer: MapLayerConfig["map_id"];
  x: number;
  y: number;
  title: string;
  note: string;
  category: MapPinCategory;
  created_at: string;
  updated_at: string;
};

export type WhisperPost = {
  id: number;
  title: string;
  body: string;
  like_count: number;
  comment_count: number;
  view_count: number;
  liked_by_me: boolean;
  can_moderate: boolean;
  created_at: string;
  updated_at: string;
};

export type WhisperComment = {
  id: number;
  post_id: number;
  body: string;
  can_moderate: boolean;
  created_at: string;
  updated_at: string;
};

export type MapLandmarkVisibilityScope = "public" | "dm_only";

export type MapLandmarkMarkerStyle = "district" | "landmark" | "estate" | "civic" | "market";

export type MapLandmark = {
  id: number;
  map_id: MapLayerConfig["map_id"];
  slug: string;
  label: string;
  x: number;
  y: number;
  marker_style: MapLandmarkMarkerStyle;
  visibility_scope: MapLandmarkVisibilityScope;
  description: string;
  linked_page_slug: string | null;
  linked_entity_slug: string | null;
  sort_order: number;
  unlock_chapter: number | null;
  linked_location: Pick<LocationRecord, "slug" | "name" | "ring" | "summary"> | null;
  created_at: string;
  updated_at: string;
};

export type SearchSnippetPayload = {
  source: string;
  excerpt: string;
  highlighted_excerpt: string;
  truncated: boolean;
  matched_terms: string[];
};

export type SearchResult = {
  type: string;
  label: string;
  id: number;
  title: string;
  snippet?: string;
  snippet_payload?: SearchSnippetPayload;
  url?: string;
  metadata?: Record<string, string | number | null>;
};

export type SearchResponse = {
  query: string;
  limit: number;
  offset: number;
  total: number;
  has_more: boolean;
  entity_filter?: string;
  query_terms?: string[];
  results: SearchResult[];
};

export type SearchSuggestion = {
  type: string;
  id: number;
  title: string;
  label: string;
  url?: string;
  metadata?: Record<string, string | number | null>;
};

export type SearchSuggestionsResponse = {
  query: string;
  limit: number;
  suggestions: SearchSuggestion[];
};
