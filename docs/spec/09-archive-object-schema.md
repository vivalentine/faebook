# Archive Object Schema v1

## Purpose

This document defines how FaeBook stores removed content in a DM-managed archive.

The archive exists to support:

* safe player removal flows
* DM-only restore
* DM-only hard delete
* auditability
* recovery from accidental deletion
* future cleanup workflows

In player-facing views, removal feels like deletion. In system behavior, removal creates an archive record.

---

## Core Archive Policy

### Player-facing rule

When a player removes supported content, the item disappears from their view.

### System rule

The removed item is archived instead of permanently deleted.

### DM rule

Only the DM can:

* browse archived items
* restore archived items
* hard delete archived items
* clear archive entries

---

## Scope

This schema applies to archived records for:

* boards
* board nodes
* map pins
* dashboard suspects
* dashboard personal notes
* personal NPC aliases
* canonical NPC aliases
* NPC records
* portrait assets
* future supported content types

This schema does not require every content type to share the exact same live table. It does require every archived item to enter a consistent archive model.

---

## Archive Model

Each archived item is stored as a snapshot record.

The archive record must contain:

* identity of the archived object
* content type
* ownership information
* actor who archived it
* timestamp
* serialized payload needed for restore
* metadata used for filtering and display

---

## Required Archive Fields

Recommended archive record fields:

* `archive_id`
* `object_type`
* `object_id`
* `owner_user_id`
* `archived_by_user_id`
* `archived_at`
* `payload_json`

### Field definitions

#### `archive_id`

Stable archive record identifier.

Rules:

* required
* unique
* primary key

#### `object_type`

Content type of the archived object.

Rules:

* required
* short string enum
* validated against supported object types

#### `object_id`

Identifier of the original object in its live system.

Rules:

* required
* string or integer, implementation choice
* preserved for audit and restore mapping

#### `owner_user_id`

User who owned the archived content before removal.

Rules:

* required for player-owned content
* nullable only for global system objects if needed later
* for NPCs or canonical objects, may point to DM ownership or remain nullable depending on implementation
* recommended to keep non-null wherever practical for easier filtering

#### `archived_by_user_id`

User who triggered the archive event.

Rules:

* required
* for player removals, this is the player user id
* for DM removals, this is the DM user id

#### `archived_at`

Timestamp of archive creation.

Rules:

* required
* UTC timestamp

#### `payload_json`

Serialized snapshot of the archived object.

Rules:

* required
* JSON object
* must contain enough data to restore the item cleanly

---

## Optional Archive Fields

Recommended optional fields:

* `object_label`
* `parent_object_type`
* `parent_object_id`
* `archive_reason`
* `source_table`
* `source_route`
* `created_at_original`
* `updated_at_original`
* `hard_deleted_at`
* `hard_deleted_by_user_id`

### Optional field definitions

#### `object_label`

Human-readable display label for archive UI.

Examples:

* `Board: Session 2 Theories`
* `Map Pin: Secret Garden`
* `Alias: Solar Tyrant`

Rules:

* optional
* max 160 characters

#### `parent_object_type`

Type of parent record if relevant.

Examples:

* `board`
* `npc`

#### `parent_object_id`

ID of parent record if relevant.

Examples:

* node belongs to board
* alias belongs to npc
* portrait belongs to npc

#### `archive_reason`

Short reason code or message.

Suggested values:

* `player-remove`
* `dm-remove`
* `replacement`
* `clear-board`
* `bulk-cleanup`
* `npc-archive`

#### `source_table`

Original storage table or source area.

#### `source_route`

Optional UI or API origin reference for debugging.

#### `created_at_original`

Original creation timestamp of the live object.

#### `updated_at_original`

Original last-updated timestamp of the live object.

#### `hard_deleted_at`

Timestamp of permanent deletion from archive.

#### `hard_deleted_by_user_id`

Actor who permanently deleted the archive record.

---

## Supported Object Types in v1

Recommended supported `object_type` values:

* `board`
* `board_node`
* `map_pin`
* `dashboard_suspect`
* `dashboard_note`
* `npc_alias_personal`
* `npc_alias_canonical`
* `npc`
* `portrait_asset`

If you want a simpler v1, you can also collapse alias variants into:

* `npc_alias`

Either route is acceptable as long as restore logic stays clear.

---

## Ownership Rules

### Player-owned archive records

These include:

* boards
* board nodes
* map pins
* suspects
* personal notes
* personal aliases

For these:

* `owner_user_id` is the player
* `archived_by_user_id` may be player or DM

### DM-managed content

These include:

* canonical aliases
* NPCs
* portrait assets
* future recap records if archived later

For these:

* `owner_user_id` may be the DM user id or a system-owned DM reference
* choose one consistent rule and keep it everywhere

Recommended v1 rule:

* DM-managed archived content uses the DM user id as `owner_user_id`

---

## Payload Rules

`payload_json` is the restore source of truth.

### Payload requirements

The payload must contain enough information to reconstruct the object in a restore action without guessing.

### General payload principles

* store the full archived object snapshot
* keep field names close to live model names
* preserve IDs if restore logic supports ID reuse
* preserve parent links
* preserve timestamps where useful
* preserve display labels where useful

### Example payload for board node

```json id="sx4jie"
{
  "id": "note-1712581000000",
  "board_id": 14,
  "type": "note",
  "position": { "x": 420, "y": 180 },
  "data": {
    "title": "Check the pendant",
    "body": "Aloria left it behind?",
    "color": "yellow"
  },
  "created_at": "2026-04-08T18:05:00Z",
  "updated_at": "2026-04-08T18:10:00Z"
}
```

### Example payload for map pin

```json id="kagyy0"
{
  "id": 52,
  "user_id": 4,
  "map_layer": "inner-ring",
  "x": 0.614,
  "y": 0.282,
  "title": "Moonthorn Estate",
  "note": "Possible trap route",
  "category": "danger",
  "created_at": "2026-04-08T18:05:00Z",
  "updated_at": "2026-04-08T18:10:00Z"
}
```

### Example payload for personal alias

```json id="8v6z6x"
{
  "id": 103,
  "npc_id": 12,
  "user_id": 4,
  "alias": "Solar Tyrant",
  "alias_normalized": "solar tyrant",
  "alias_type": "personal",
  "created_at": "2026-04-08T18:05:00Z",
  "updated_at": "2026-04-08T18:10:00Z"
}
```

---

## Archive Creation Rules

An archive record is created when a supported live object is removed or replaced.

### Archive creation triggers

#### Player-triggered archive events

* removing a saved board
* removing a board node
* removing a pin
* removing a suspect
* removing a dashboard note
* removing a personal alias

#### DM-triggered archive events

* archiving an NPC
* removing a canonical alias
* replacing a portrait
* clearing archived content permanently from archive UI
* future bulk cleanup operations

#### System-triggered archive events

* portrait replacement during import
* canonical alias removal during import merge if supported

---

## Removal Behavior by Object Type

### Boards

Player remove action archives the board.
DM can restore or hard delete.

### Board nodes

Player remove action archives the node.
If nodes live inside board JSON rather than a table, the archive payload must still contain full node snapshot and board linkage.

### Map pins

Player remove action archives the pin.

### Dashboard suspects

Player remove action archives the suspect entry.

### Dashboard personal notes

If note deletion exists, it archives the note.
If notes stay single-record and editable in place, archive behavior may only apply if the entire note record is removed.

### Personal aliases

Player remove action archives the alias.

### Canonical aliases

DM remove action archives the alias.

### NPCs

DM archive action archives the NPC and should preserve enough data for restore, including portrait linkage and core metadata.

### Portrait assets

Replacing a portrait archives the previous asset automatically.

---

## Restore Rules

Restore is DM-only.

### Restore behavior

When the DM restores an archived item:

* the item returns to its live system
* the archive record is marked restored or removed from active archive list, implementation choice
* an audit log entry is written

### Restore safety rules

Restore must check:

* parent object still exists where required
* slug or unique conflicts are handled
* user ownership remains valid
* active record conflict is resolved safely

### Conflict handling

If restore would collide with an existing active record:

* UI should show conflict state
* DM chooses action if needed
* auto-overwrite should be avoided in v1 unless very safe

### Example conflict cases

* restoring alias that already exists
* restoring board into a name collision
* restoring portrait when an active portrait already exists
* restoring NPC whose slug is already occupied

---

## Hard Delete Rules

Hard delete is DM-only.

### Hard delete behavior

Hard delete permanently removes the archive record and, where relevant, the underlying stored asset.

### Hard delete requirements

* confirmation required
* audit log required
* no player-facing direct access
* asset files removed only when safe and intended

### Asset-safe delete

For file-backed archive objects such as portrait assets:

* ensure no active record still points to the asset
* then delete file
* then delete archive record or mark hard-deleted

---

## Archive UI Requirements

DM archive UI should support:

* filter by object type
* filter by user
* filter by date
* search by object label
* view payload summary
* restore
* hard delete

### Suggested archive list fields

* object label
* object type
* owner
* archived by
* archived at
* reason
* restore action
* hard delete action

---

## Search and Filter Rules

Archive search is DM-only.

### Filterable fields

* `object_type`
* `owner_user_id`
* `archived_by_user_id`
* `archived_at`
* `archive_reason`
* `object_label`

### Searchable fields

* `object_label`
* selected payload text fields if later indexed
* original filename for portrait assets
* alias text for aliases
* NPC name for NPC records

---

## Audit Expectations

Every archive lifecycle event must write to audit log.

### Required audit events

* archived
* restored
* hard deleted

### Recommended audit fields

* actor user id
* action type
* object type
* object id
* archive id
* timestamp
* short message

### Example messages

* `Archived map pin: Moonthorn Estate`
* `Restored board: Session 2 Theories`
* `Hard deleted personal alias archive: Solar Tyrant`

---

## Validation Rules

An archive record is invalid if:

* `object_type` missing
* `object_id` missing
* `archived_by_user_id` missing
* `archived_at` missing
* `payload_json` missing
* `payload_json` not parseable
* payload is structurally incompatible with declared `object_type`

### Recommended validation approach

* validate common archive envelope
* validate payload shape based on `object_type`

---

## Envelope Example

```json id="h6i12g"
{
  "archive_id": 204,
  "object_type": "map_pin",
  "object_id": 52,
  "owner_user_id": 4,
  "archived_by_user_id": 4,
  "archived_at": "2026-04-08T18:22:00Z",
  "object_label": "Map Pin: Moonthorn Estate",
  "parent_object_type": "map",
  "parent_object_id": "inner-ring",
  "archive_reason": "player-remove",
  "payload_json": {
    "id": 52,
    "user_id": 4,
    "map_layer": "inner-ring",
    "x": 0.614,
    "y": 0.282,
    "title": "Moonthorn Estate",
    "note": "Possible trap route",
    "category": "danger",
    "created_at": "2026-04-08T18:05:00Z",
    "updated_at": "2026-04-08T18:10:00Z"
  }
}
```

---

## Lifecycle Rules

### Active to archive

Live object is removed from active store and written to archive.

### Archive to restored

Archived object is restored to live store and removed from active archive list or marked restored.

### Archive to hard deleted

Archive record and linked asset data are permanently deleted by DM.

---

## Recommended Implementation Strategy

### Option A: single shared archive table

One archive table with:

* common envelope fields
* `payload_json`

This is the preferred v1 approach because it is simple and flexible.

### Option B: per-object archive tables

Separate archive tables per object type.

This is acceptable later if needed for performance or tooling, though it adds complexity early.

Recommended v1 choice:

* single shared archive table

---

## Locked Decisions

These decisions are final for v1:

* archive management is DM-only
* player remove actions archive content instead of hard deleting it
* restore is DM-only
* hard delete is DM-only
* archive records store a serialized payload snapshot
* archive UI is DM/admin-facing
* archive must support boards, pins, aliases, suspects, notes, NPCs, and portraits
* portrait replacement always creates archive entries for previous active portraits

---

## Non-Goals for v1

This schema does not include:

* player self-service restore
* automatic archive expiration
* versioned restore trees
* collaborative archive review
* public recycle-bin views
* time-based auto purge

These can be added later if needed.

---

## Implementation Notes

A clean archive flow should look like this:

1. user triggers remove
2. system builds archive payload snapshot
3. system writes archive record
4. system removes active object
5. system writes audit log
6. DM can later browse archive
7. DM can restore or hard delete

### Recommended DM archive tools

* archive page
* object type filters
* owner filters
* restore button
* hard delete button
* payload summary drawer or modal
