# Alias Schema v1

## Purpose

This document defines how NPC aliases are stored, validated, indexed, displayed, imported, archived, searched, and managed inside FaeBook.

This schema governs two distinct alias systems:

* canonical aliases, created and managed by the DM
* personal aliases, created by individual players for their own use

This schema exists to support:

* faster search
* player memory support
* nickname tracking
* title variation handling
* house-name and rumor-name lookup
* DM visibility into player-added naming patterns

---

## Scope

This schema applies to:

* NPC Directory
* NPC detail pages
* global search
* DM/admin views
* import behavior for canonical aliases
* archive behavior for removed aliases

This schema does not apply to:

* board node labels
* suspect names
* map pin titles
* recap text
* shared note systems

---

## Alias Types

There are exactly two alias types in v1:

* `canonical`
* `personal`

### Canonical alias

A DM-defined alias attached to an NPC and shared across all users who can see that NPC.

Examples:

* `The Empress`
* `Her Radiance`
* `Titania`

### Personal alias

A player-defined alias attached to an NPC for that player’s own search and memory support.

Examples:

* `Rot Lady`
* `Hot Auntie Nuala Gealach`
* `That creepy plant teacher`

---

## Core Rules

* canonical aliases are visible to all users who can see the NPC
* personal aliases are visible only to the player who created them in player-facing views
* DM can see all personal aliases in DM/admin views
* personal aliases never become canonical automatically
* canonical aliases and personal aliases are stored separately
* alias search is case-insensitive
* alias display preserves original casing
* player deletion of personal aliases archives the alias instead of hard deleting it
* archive management is DM-only

---

## Data Model

Recommended alias record fields:

* `id`
* `npc_id`
* `user_id`
* `alias`
* `alias_normalized`
* `alias_type`
* `created_at`
* `updated_at`
* `archived_at`
* `archived_by_user_id`

### Field definitions

#### `id`

Primary key.

Rules:

* integer or UUID
* unique

#### `npc_id`

The NPC this alias belongs to.

Rules:

* required
* foreign key to NPC record

#### `user_id`

Owner of the alias.

Rules:

* nullable for canonical aliases
* required for personal aliases

Meaning:

* `null` means canonical alias
* non-null means player-owned alias

#### `alias`

Display form of the alias.

Rules:

* required
* trimmed string
* length: 1 to 80 characters

#### `alias_normalized`

Search/index form of the alias.

Rules:

* required
* derived from `alias`
* lowercase
* trimmed
* internal whitespace normalized
* punctuation handling defined below

#### `alias_type`

Type of alias.

Allowed values:

* `canonical`
* `personal`

#### `created_at`

Timestamp of creation.

#### `updated_at`

Timestamp of most recent edit.

#### `archived_at`

Timestamp of archive action.
Nullable.

#### `archived_by_user_id`

Actor who archived the alias.
Nullable until archived.

---

## Ownership Rules

## Canonical alias ownership

Canonical aliases belong to the NPC, not to an individual player.

Rules:

* `alias_type = canonical`
* `user_id = null`
* DM-managed only
* importable from NPC content schema
* editable only by DM

## Personal alias ownership

Personal aliases belong to one player and one NPC.

Rules:

* `alias_type = personal`
* `user_id = owning player user id`
* editable by owning player
* visible to that player in player-facing views
* visible to DM in DM/admin views
* not visible to other players

---

## Validation Rules

An alias is invalid if:

* `alias` missing
* alias is blank after trimming
* alias exceeds max length
* `npc_id` missing
* `alias_type` invalid
* canonical alias has non-null `user_id`
* personal alias has null `user_id`

### Length rule

* minimum: 1 character
* maximum: 80 characters

### Allowed characters

Aliases may contain:

* letters
* numbers
* spaces
* punctuation
* apostrophes
* hyphens
* titles
* joke names
* nicknames

This is intentional. Player aliases should be flexible and expressive.

### Disallowed content

No extra schema-level profanity or tone filter is required in v1.
This is a private campaign app.

---

## Normalization Rules

`alias_normalized` exists for search and dedupe.

### Normalization steps

1. trim leading and trailing whitespace
2. lowercase
3. collapse repeated internal whitespace to single spaces
4. preserve alphanumeric meaning
5. punctuation may either:

   * be preserved for indexing, or
   * be lightly normalized if search engine supports it

### Recommended normalization behavior

For v1:

* lowercase
* trim
* whitespace collapse

Example:

```text id="v0f8vw"
"The Empress" -> "the empress"
"  Hot   Auntie Nuala  " -> "hot auntie nuala"
```

### Display rule

Original `alias` must be preserved for display.
Only `alias_normalized` is used for matching and dedupe.

---

## Deduplication Rules

Deduplication is case-insensitive and scope-aware.

### Canonical alias dedupe scope

Deduped within:

* same NPC
* canonical alias set only

That means two canonical aliases for the same NPC cannot normalize to the same value.

### Personal alias dedupe scope

Deduped within:

* same NPC
* same owning user
* personal alias set only

That means one player cannot add the same normalized alias twice to the same NPC.

### Cross-type duplicates

Allowed.

Example:

* canonical alias: `The Empress`
* player personal alias: `The Empress`

This is allowed, though the UI may choose to collapse display duplicates if useful.

---

## Search Rules

Aliases must be indexable.

### Player search surface

A player may search across:

* NPC display name
* canonical aliases for visible NPCs
* that player’s personal aliases
* titles
* house
* faction
* court
* ring

### DM search surface

DM may search across:

* all NPC names
* all canonical aliases
* all personal aliases
* all NPC metadata

### Search visibility rules

* players never see other players’ personal aliases in player-facing search results
* DM can see personal aliases in DM/admin views

### Search matching behavior

Recommended v1 behavior:

* case-insensitive substring search on normalized alias text

---

## Visibility Rules

### Canonical alias visibility

Visible to:

* DM
* any player who can see the NPC

### Personal alias visibility

Visible to:

* owning player in player-facing views
* DM in DM/admin views

Not visible to:

* other players

---

## Creation Rules

## Canonical alias creation

Canonical aliases may be created by:

* import from NPC markdown frontmatter
* direct DM editing in the app

Players cannot create canonical aliases.

## Personal alias creation

Personal aliases may be created by:

* the owning player from NPC detail page
* optional future quick-add from search UI
* optional future quick-add from dashboard or board context

DM may also create or edit personal aliases in DM/admin views if you want that control later, but it is not required for v1.

---

## Editing Rules

## Canonical alias editing

Editable only by DM.

Edit actions:

* rename alias
* archive alias
* restore alias from archive
* hard delete from archive

## Personal alias editing

Editable by:

* owning player
* DM in DM/admin views if editing support is added there

Player-facing edit behavior:

* player may rename their own alias
* player may remove their own alias, which archives it

---

## Archive Rules

Archive management is DM-only.

### Player-facing removal behavior

When a player removes a personal alias:

* alias disappears from player view
* alias is archived
* player does not hard delete it

### Canonical alias archive behavior

When DM removes a canonical alias:

* alias is archived
* restore remains possible
* hard delete remains DM-only

### Restore behavior

DM may restore:

* canonical aliases
* personal aliases

### Hard delete behavior

Only DM may hard delete aliases from archive.

### Archive metadata

Each archived alias should preserve:

* alias text
* normalized alias
* alias type
* npc id
* user id if personal
* created_at
* updated_at
* archived_at
* archived_by_user_id

---

## Import Behavior

This schema integrates with the NPC Content Import Schema.

## Canonical alias import source

Canonical aliases come from:

```yaml id="6ztldi"
canonical_aliases:
  - Titania
  - The Empress
  - Her Radiance
```

### Import rules for canonical aliases

* create missing canonical aliases
* dedupe case-insensitively
* preserve display casing from import file
* do not touch player personal aliases
* do not collapse personal aliases into canonical aliases

### Update behavior

On re-import:

* merge incoming canonical aliases into existing canonical alias set
* removed aliases may be archived if import is treated as authoritative
* any removals should create audit history

### Personal aliases and import

Imports must never:

* create personal aliases
* update personal aliases
* remove personal aliases

---

## UI Expectations

## Player NPC detail page

Player should be able to:

* see canonical aliases
* add personal alias
* edit personal alias
* remove personal alias

### Suggested player UI sections

* Known names
* My nicknames

## DM NPC detail/admin page

DM should be able to see:

* canonical aliases
* all player-added personal aliases grouped by player
* archive state if relevant

### Suggested DM grouping

* Canonical aliases
* Player aliases by user

Example:

```text id="fjuwq6"
Canonical aliases
- Titania
- The Empress

Player aliases
USAQ
- Her Radiance
- Solar Tyrant

Hilton
- Sun Queen
```

---

## Audit Expectations

Alias changes should generate audit activity when meaningful.

### Canonical alias audit events

* created
* updated
* archived
* restored
* hard deleted
* imported
* removed during import merge

### Personal alias audit events

At minimum:

* created
* archived
* restored
* hard deleted

Optional later:

* rename event
* DM edit event

---

## Failure Handling

## Creation failure

Reject alias create when:

* alias invalid
* duplicate within same scope
* NPC not found
* user not allowed

## Edit failure

Reject alias edit when:

* alias not found
* actor lacks permission
* resulting alias duplicates existing alias in same scope

## Import failure

Canonical alias import should not fail the whole NPC import unless:

* alias field type is malformed in a way that breaks parsing

Preferred behavior:

* invalid alias values produce warning or file-level validation error in preview
* valid scalar NPC fields still preview correctly

---

## Example Records

## Canonical alias example

```json id="mf40ow"
{
  "npc_id": 12,
  "user_id": null,
  "alias": "The Empress",
  "alias_normalized": "the empress",
  "alias_type": "canonical"
}
```

## Personal alias example

```json id="nhv4z0"
{
  "npc_id": 12,
  "user_id": 4,
  "alias": "Solar Tyrant",
  "alias_normalized": "solar tyrant",
  "alias_type": "personal"
}
```

---

## Locked Decisions

These decisions are final for v1:

* alias types are `canonical` and `personal`
* canonical aliases are DM-managed
* personal aliases are player-managed
* personal aliases are private to the owning player in player views
* DM can see all player-added aliases in DM/admin views
* personal alias removal archives the alias instead of hard deleting it
* archive management is DM-only
* search indexes canonical aliases and player personal aliases within the correct visibility scope
* import affects only canonical aliases

---

## Non-Goals for v1

This schema does not include:

* shared player alias pools
* voting or consensus aliasing
* automatic alias suggestion
* NLP nickname extraction
* fuzzy merge between personal and canonical aliases
* alias reputation or popularity scoring

---

## Implementation Notes

A clean alias flow should look like this:

### Canonical path

1. import canonical aliases from NPC markdown
2. validate and normalize
3. merge into canonical alias set
4. write audit log

### Personal path

1. player opens NPC page
2. player adds nickname
3. validate and normalize
4. save as personal alias
5. include in that player’s search index
6. removal archives the alias

### DM/admin path

1. DM opens NPC admin view
2. sees canonical aliases
3. sees player aliases grouped by owner
4. can restore or hard delete archived aliases from archive tools
