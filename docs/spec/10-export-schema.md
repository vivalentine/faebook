# Export Schema v1

## Purpose

This document defines how FaeBook exports user and DM data out of the app in portable formats.

This schema governs:

* board image export
* board JSON export
* map pin export
* suspect list export
* personal notes export
* future archive-compatible restore inputs where relevant

This schema does not govern:

* full app backup bundles
* raw database dumps
* NPC markdown import files
* portrait asset import behavior
* map asset config files

Those belong to backup, import, and asset schemas.

---

## Scope

This schema applies to export actions initiated from:

* Investigation Board
* Maps
* Home dashboard widgets where relevant
* DM/admin views if broader export tools are added

This schema covers exportable content in v1:

* boards as PNG
* boards as JSON
* map pins as JSON
* suspect list as JSON
* personal notes as JSON or plain text
* optional DM exports of NPC metadata later

---

## Core Export Policy

### Ownership rule

Users can export their own user-owned content.

### DM rule

DM can export:

* DM-owned content
* global admin-facing content
* player-owned content only where DM view access already exists or admin tooling explicitly supports it

### Archive rule

Standard user exports do not include archived items unless the export action explicitly says so.

### Scope rule

Exports should reflect the current user’s visible and owned data unless the export action is explicitly DM/admin scoped.

---

## Export Types in v1

### Board PNG export

A visual export of the current board state.

### Board JSON export

A structured export of the current board state for backup, restore, and portability.

### Map pin export

A structured export of the current user’s map pins.

### Suspect list export

A structured export of the current user’s suspect entries.

### Personal notes export

A structured export of the current user’s dashboard personal notes.
Optional plain text export is also allowed.

---

## General Export Metadata

All structured exports should include a standard metadata envelope where practical.

### Recommended metadata fields

* `export_type`
* `schema_version`
* `exported_at`
* `exported_by_user_id`
* `exported_by_username`
* `app_name`
* `app_version` if available

### Example metadata block

```json id="omiyhz"
{
  "export_type": "board_json",
  "schema_version": "1.0",
  "exported_at": "2026-04-08T21:30:00Z",
  "exported_by_user_id": 4,
  "exported_by_username": "usaq",
  "app_name": "FaeBook"
}
```

---

## Board PNG Export

## Purpose

Creates a downloadable image snapshot of the current board as the user sees it.

### Export source

* current visible board state
* includes unsaved visual state if export is triggered from the live board view

This is the recommended v1 behavior.

### Included content

* all visible board nodes on that board
* node styling
* edge lines
* edge labels
* note colors
* viewport framing based on export implementation

### Export behavior options

Two acceptable implementations:

#### Option A

Export the current visible viewport only.

#### Option B

Export the full logical board area with all nodes included.

Recommended v1 choice:

* export the full current board composition rather than just the viewport

That produces a more useful artifact for players.

### File format

* `.png`

### File naming rule

Recommended pattern:

```text id="dlghyn"
board-{board-name}-{yyyy-mm-dd-hhmm}.png
```

### Example

```text id="n3gf8r"
board-session-2-theories-2026-04-08-2130.png
```

### Rendering requirements

* preserve readable text
* preserve note colors
* preserve crime-board styling
* preserve enough resolution to be useful on mobile and desktop

### Resolution guidance

Export should support a reasonable scale factor.
This may be configurable later in settings.

Suggested default:

* 2x render scale for clarity

---

## Board JSON Export

## Purpose

Creates a structured portable representation of a board.

This export is intended for:

* backup
* restore
* migration
* later import
* debugging
* user-controlled data retention

### Required top-level fields

```json id="856jop"
{
  "metadata": {},
  "board": {}
}
```

### `board` payload fields

* `id`
* `name`
* `owner_user_id`
* `is_default`
* `nodes`
* `edges`
* `viewport`
* `created_at`
* `updated_at`

### Node fields

Each node export should preserve:

* `id`
* `type`
* `position`
* `data`

### Edge fields

Each edge export should preserve:

* `id`
* `source`
* `target`
* `type`
* `data`

### Viewport fields

* `x`
* `y`
* `zoom`

### Example

```json id="2n0qfr"
{
  "metadata": {
    "export_type": "board_json",
    "schema_version": "1.0",
    "exported_at": "2026-04-08T21:30:00Z",
    "exported_by_user_id": 4,
    "exported_by_username": "usaq",
    "app_name": "FaeBook"
  },
  "board": {
    "id": 14,
    "name": "Session 2 Theories",
    "owner_user_id": 4,
    "is_default": false,
    "nodes": [
      {
        "id": "note-1712581000000",
        "type": "boardCard",
        "position": { "x": 420, "y": 180 },
        "data": {
          "kind": "note",
          "title": "Check the pendant",
          "body": "Aloria left it behind?",
          "color": "yellow"
        }
      }
    ],
    "edges": [],
    "viewport": { "x": 0, "y": 0, "zoom": 1 },
    "created_at": "2026-04-08T18:00:00Z",
    "updated_at": "2026-04-08T21:28:00Z"
  }
}
```

### File format

* `.json`

### File naming rule

```text id="asoq2z"
board-{board-name}-{yyyy-mm-dd-hhmm}.json
```

---

## Map Pin Export

## Purpose

Exports a user’s pins for one map or all maps.

### Export scope options

Allowed v1 scopes:

* current map only
* all user pins across all maps

### File format

* `.json`

### Top-level fields

* `metadata`
* `pins`

### Pin fields

Each pin export should preserve:

* `id`
* `user_id`
* `map_layer`
* `x`
* `y`
* `title`
* `note`
* `category`
* `created_at`
* `updated_at`

### Example

```json id="gez0ab"
{
  "metadata": {
    "export_type": "map_pins_json",
    "schema_version": "1.0",
    "exported_at": "2026-04-08T21:30:00Z",
    "exported_by_user_id": 4,
    "exported_by_username": "usaq",
    "app_name": "FaeBook"
  },
  "pins": [
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
  ]
}
```

### File naming rule

```text id="69d1qb"
map-pins-{scope}-{yyyy-mm-dd-hhmm}.json
```

Example:

```text id="schzul"
map-pins-inner-ring-2026-04-08-2130.json
```

---

## Suspect List Export

## Purpose

Exports a player’s suspect tracker entries.

### File format

* `.json`

### Top-level fields

* `metadata`
* `suspects`

### Suspect fields

Each suspect export should preserve:

* `id`
* `user_id`
* `name`
* `status`
* `note`
* `sort_order`
* `created_at`
* `updated_at`

### Example

```json id="dckur7"
{
  "metadata": {
    "export_type": "suspect_list_json",
    "schema_version": "1.0",
    "exported_at": "2026-04-08T21:30:00Z",
    "exported_by_user_id": 4,
    "exported_by_username": "usaq",
    "app_name": "FaeBook"
  },
  "suspects": [
    {
      "id": 6,
      "user_id": 4,
      "name": "Seralyth Moonthorn",
      "status": "active",
      "note": "Still feels too involved to ignore.",
      "sort_order": 1,
      "created_at": "2026-04-08T18:05:00Z",
      "updated_at": "2026-04-08T18:10:00Z"
    }
  ]
}
```

### File naming rule

```text id="n2fvgz"
suspects-{yyyy-mm-dd-hhmm}.json
```

---

## Personal Notes Export

## Purpose

Exports the player’s longform personal dashboard notes.

### Supported formats in v1

* `.json`
* optional `.txt`

### JSON export fields

* `metadata`
* `note`

### `note` fields

* `user_id`
* `content`
* `updated_at`

### Example JSON

```json id="wimq0z"
{
  "metadata": {
    "export_type": "personal_note_json",
    "schema_version": "1.0",
    "exported_at": "2026-04-08T21:30:00Z",
    "exported_by_user_id": 4,
    "exported_by_username": "usaq",
    "app_name": "FaeBook"
  },
  "note": {
    "user_id": 4,
    "content": "Need to compare the pendant clue with the oath-space timing.",
    "updated_at": "2026-04-08T21:10:00Z"
  }
}
```

### Example plain text export

```text id="cy190c"
FaeBook Personal Notes
Exported: 2026-04-08T21:30:00Z
User: usaq

Need to compare the pendant clue with the oath-space timing.
```

### File naming rules

JSON:

```text id="gxxyux"
personal-notes-{yyyy-mm-dd-hhmm}.json
```

Text:

```text id="d9abj7"
personal-notes-{yyyy-mm-dd-hhmm}.txt
```

---

## Export Permissions

### Player export permissions

Players may export:

* their own boards
* their own pins
* their own suspect list
* their own personal notes

Players may not export:

* other players’ content
* DM-only data
* archives
* canonical NPC admin metadata unless later explicitly supported

### DM export permissions

DM may export:

* DM-owned boards
* DM-admin-visible content where tooling supports it
* later admin datasets if implemented

For v1, DM export scope should stay intentional and explicit.
Do not silently give one-click export of every player’s private dataset unless you build that as an admin tool on purpose.

---

## Archived Content in Exports

### Default rule

Standard exports do not include archived items.

### Optional future rule

Admin or advanced export tools may later offer:

* include archived items
* export archive separately

This is out of scope for v1 standard user exports.

---

## Restore Compatibility

Structured exports should be future-friendly for restore and re-import.

### Board JSON

Should be designed so it can become a restore input later.

### Map pin JSON

Should be structurally suitable for future import or restore.

### Suspect and note JSON

Should also be structurally clean enough for later import if desired.

v1 does not require import-from-export flows, but the schema should support them later.

---

## Validation Rules

An export is invalid if:

* required metadata block missing for structured export
* payload content missing
* payload shape does not match export type
* malformed JSON
* empty output generated due to serialization error

### Empty-data behavior

Empty exports are allowed if the exportable dataset is empty.

Example:

* no map pins yet
* no suspects yet

In these cases:

* export may still succeed
* payload array is empty
* metadata remains present

---

## File Naming Rules

All export filenames should be:

* lowercase
* timestamped
* filesystem-safe
* descriptive

### Sanitization rules

* spaces become `-`
* slashes removed
* punctuation normalized where needed
* board names sanitized before filename generation

### Timestamp format

Recommended:

```text id="cfjlwm"
yyyy-mm-dd-hhmm
```

Example:

```text id="da6a9l"
2026-04-08-2130
```

---

## Export UX Rules

### Board page

User should be able to:

* export PNG
* export JSON

### Maps page

User should be able to:

* export current map pins
* export all map pins

### Dashboard

User should be able to:

* export suspect list
* export personal notes

### DM/admin views

Future admin exports should live in DM/admin tools, not mixed into regular player export controls.

---

## Audit Expectations

Export events may be logged.

### Recommended v1 audit events

* board PNG export
* board JSON export
* map pin export
* suspect export
* personal notes export

These may be useful in DM/admin diagnostics later, though full export audit logging is optional in v1.

---

## Security and Privacy Rules

### Player content isolation

Exports must respect ownership boundaries.

A player export must never include:

* another player’s private aliases
* another player’s boards
* another player’s notes
* another player’s pins

### DM visibility rule

DM can see more data in admin contexts, but export tools must still be deliberate and scoped.
Do not produce accidental wide exports.

---

## Future Expansion

This schema is intentionally ready for later export additions such as:

* recap export
* archive export
* NPC directory export
* admin audit export
* full user data bundle

These are not required in v1.

---

## Locked Decisions

These decisions are final for v1:

* board export supports PNG and JSON
* map pin export supports JSON
* suspect list export supports JSON
* personal notes export supports JSON and may support plain text
* structured exports carry metadata envelope
* user exports are scoped to owned content
* standard exports exclude archived content
* export filenames are timestamped and filesystem-safe

---

## Non-Goals for v1

This schema does not include:

* full database dump export
* live sync export
* collaborative team export bundles
* archive-inclusive standard exports
* encrypted export bundles
* automatic cloud backup

These belong to later backup and admin tooling.

---

## Implementation Notes

A clean export flow should look like this:

### Board PNG

1. capture current board composition
2. render export-safe image
3. download PNG

### Board JSON

1. gather board record
2. serialize nodes, edges, viewport, metadata
3. download JSON

### Map pins

1. gather scoped pin set
2. serialize with metadata
3. download JSON

### Suspects and notes

1. gather user-owned records
2. serialize with metadata
3. download JSON or text
