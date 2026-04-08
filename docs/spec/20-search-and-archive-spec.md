# Search and Archive Spec v1

## Purpose

Defines the search model and archive model for v1.

## Locked Decisions

- search is permission-aware
- players search only what they are allowed to see
- DM can search admin-visible content
- player remove actions archive content
- archive management is DM-only

## Search Model

## Player Search Scope

Player search can include:

- visible NPC names
- canonical aliases for visible NPCs
- personal aliases created by that player
- visible NPC metadata fields where appropriate
- personal suspect entries
- personal notes
- personal map pins

Player search excludes:

- hidden NPCs
- DM-only data
- archive records
- other players’ private content

## DM Search Scope

DM search can include:

- all NPCs
- canonical aliases
- personal aliases
- import logs
- archive records
- recap content
- admin-visible content

## Search Fields

### NPC fields

- `name`
- canonical aliases
- personal aliases where allowed
- `rank_title`
- `house`
- `faction`
- `court`
- `ring`

### Player-owned fields

- suspect `name`
- suspect `note`
- personal notes `content`
- map pin `title`
- map pin `note`

### Admin fields

- import log `filename`
- import log `message`
- archive record metadata
- audit log message later if desired

## Search UX Rules

- search should feel fast
- search results must respect permissions
- alias hits should remain easy to understand
- player personal alias hits should never leak to other players

## Archive Model

## Core Rule

When a player removes content, the item is archived instead of permanently deleted.

## Supported v1 archive targets

- boards
- dashboard suspects
- dashboard notes
- npc aliases
- map pins
- NPC records
- portrait assets

## Archive Ownership Rules

### Player

Can trigger archive by removing own content.

Cannot:

- browse archive
- restore
- hard delete

### DM

Can:

- browse archive
- filter archive
- restore archived items
- hard delete archived items

## Archive Browser Requirements

DM archive UI should support:

- filter by content type
- filter by user
- filter by date
- restore action
- hard delete action

## Restore Rules

- DM-only
- restoring an item returns it to active state
- restore should preserve core metadata and ownership

## Hard Delete Rules

- DM-only
- hard delete permanently removes archive record and recoverable payload
- hard delete should be explicit and auditable

## Audit Expectations

Archive-related actions should produce admin-visible records for:

- archive event
- restore event
- hard delete event

## Acceptance Targets

- player remove action archives data
- archived item disappears from normal active views
- DM archive browser shows archived item
- DM restore works
- DM hard delete works
- no archive management leaks to player users
