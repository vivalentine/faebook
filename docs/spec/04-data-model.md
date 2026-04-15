# Data Model Spec v1

## Overview

FaeBook v1 uses a mixed data model with:

- existing auth and NPC tables
- new user-owned records
- archive records
- admin logs
- config/file-backed map metadata

## Existing Core Entities

### users

Core auth and role table.

Required fields:

- `id`
- `username`
- `display_name`
- `role`
- `password_hash`
- `created_at`
- `updated_at`

Allowed roles:

- `dm`
- `player`

### npcs

Core NPC table.

Required fields:

- `id`
- `slug`
- `name`
- `is_visible`
- `created_at`
- `updated_at`

Suggested scalar fields:

- `rank_title`
- `house`
- `faction`
- `court`
- `ring`
- `introduced_in`
- `met_summary`
- `short_blurb`
- `portrait_path`
- `source_file`
- `raw_markdown_body`

## New v1 Entities

### boards

Stores full board documents.

Fields:

- `id`
- `owner_user_id`
- `name`
- `is_default`
- `json_data`
- `created_at`
- `updated_at`
- `archived_at`
- `archived_by_user_id`

Rules:

- one user can own many boards
- one default board per user
- archived boards are excluded from normal views

### dashboard_suspects

Stores per-user suspect tracking.

Fields:

- `id`
- `user_id`
- `name`
- `status`
- `note`
- `sort_order`
- `created_at`
- `updated_at`
- `archived_at`
- `archived_by_user_id`

Suggested status values:

- `active`
- `cleared`
- `unknown`

### dashboard_notes

Stores longform personal notes.

Fields:

- `id`
- `user_id`
- `content`
- `updated_at`
- `archived_at`
- `archived_by_user_id`

Assumption:

- one active longform note document per user in v1
- this can expand later

### npc_aliases

Stores canonical and personal aliases.

Fields:

- `id`
- `npc_id`
- `user_id`
- `alias`
- `alias_type`
- `created_at`
- `updated_at`
- `archived_at`
- `archived_by_user_id`

Rules:

- `user_id` is null for canonical aliases
- `user_id` is required for personal aliases

Allowed `alias_type`:

- `canonical`
- `personal`

### session_recaps

Stores DM-authored recap content.

Fields:

- `id`
- `session_number`
- `title`
- `content`
- `published_at`
- `published_by_user_id`
- `updated_at`

Rules:

- editable in app
- latest recap surfaced on dashboard

### map_pins

Stores per-user pins across maps.

Fields:

- `id`
- `user_id`
- `map_layer`
- `x`
- `y`
- `title`
- `note`
- `category`
- `created_at`
- `updated_at`
- `archived_at`
- `archived_by_user_id`

Allowed `map_layer` values:

- `overworld`
- `inner-ring`
- `outer-ring`

Suggested `category` values:

- `clue`
- `lead`
- `suspect`
- `danger`
- `meeting`
- `theory`

Coordinate rule:

- `x` and `y` are normalized decimal positions from 0 to 1

### archive_records

Generic archive container for restore and hard delete workflows.

Fields:

- `id`
- `object_type`
- `object_id`
- `owner_user_id`
- `archived_by_user_id`
- `archived_at`
- `payload_json`

Supported v1 object types:

- `board`
- `dashboard_suspect`
- `dashboard_note`
- `npc_alias`
- `map_pin`
- `npc`
- `portrait_asset`

### import_logs

Stores DM import job output.

Fields:

- `id`
- `dm_user_id`
- `filename`
- `result`
- `message`
- `created_at`

Suggested `result` values:

- `created`
- `updated`
- `skipped`
- `errored`

### audit_logs

Stores security and admin-relevant actions.

Fields:

- `id`
- `actor_user_id`
- `action_type`
- `object_type`
- `object_id`
- `message`
- `created_at`

## Relationships

### users to boards

- one-to-many

### users to dashboard_suspects

- one-to-many

### users to dashboard_notes

- one-to-many or one-to-one active doc pattern in v1

### users to map_pins

- one-to-many

### npcs to npc_aliases

- one-to-many

### users to npc_aliases

- one-to-many for personal aliases

### users to import_logs

- one-to-many for DM only

### users to audit_logs

- one-to-many

## Visibility and Archive Rules

- active app surfaces query non-archived records only
- remove actions archive records instead of destroying them
- restore pulls from archive record payload
- hard delete is DM-only

## Search-Relevant Fields

Search indexing should cover:

- `npcs.name`
- canonical aliases
- personal aliases within allowed scope
- `rank_title`
- `house`
- `faction`
- `court`
- `ring`
- suspect names
- dashboard note content
- map pin title and note
- recap title and content for allowed contexts

## Config-Backed Data

### maps config

Map metadata lives in file/config, not database, in v1.

Expected config data per map:

- `map_id`
- `label`
- `image_filename`
- `tile_source`
- `width`
- `height`
- `default_zoom`
- `min_zoom`
- `max_zoom`

## Data Safety Rules

- preserve stable NPC slugs
- preserve user-owned content on NPC updates
- preserve archive history
- prefer migrations over destructive resets
- preserve old portrait assets through archive when replaced
