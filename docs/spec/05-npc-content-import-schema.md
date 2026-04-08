# NPC Content Import Schema v1

## Purpose

This document defines how a DM-supplied NPC markdown file is parsed, validated, matched, and imported into FaeBook.

This schema governs:

* NPC creation
* NPC updates
* canonical alias import
* portrait file matching
* visibility defaults
* audit expectations
* archive behavior for replaced portrait assets

This schema does not govern player-created content such as:

* personal aliases
* personal notes
* suspects
* boards
* map pins

Those systems are separate and must remain intact during NPC imports.

---

## Scope

This schema applies to:

* DM Tools upload flow
* batch import
* single-file import
* dry-run preview
* create/update commit flow

Supported source file type:

* `.md`

---

## File Format

Each NPC source file must contain:

1. YAML frontmatter
2. markdown body

### Required layout

```md id="et92lt"
---
name: Example NPC
slug: example-npc
role_type: npc
visibility: hidden
---

## Description

Raw markdown content here.
```

---

## Parsing Model

### Frontmatter

Frontmatter is the structured source of truth for importable NPC metadata.

### Markdown body

Markdown body is stored raw in v1.

The importer does not need to parse body sections into structured app fields in v1. Raw body content must be preserved for future DM/admin use.

---

## Required Frontmatter Fields

```yaml id="6r23iz"
name:
slug:
role_type:
visibility:
```

### `name`

Human-readable display name for the NPC.

Rules:

* required
* string
* trimmed
* length: 1 to 120 characters

### `slug`

Canonical stable identifier for the NPC.

Rules:

* required
* string
* trimmed
* lowercase kebab-case
* unique across all NPCs
* length: 1 to 120 characters
* used for routing, import matching, updates, and stable identity

Allowed example:

```yaml id="4i4ol0"
slug: empress-titania
```

Disallowed examples:

```yaml id="h0jclu"
slug: Empress Titania
slug: empress_titania
slug: empress titania
```

### `role_type`

Declares the file’s content type.

Rules:

* required
* must equal `npc`

Allowed example:

```yaml id="xqklhk"
role_type: npc
```

### `visibility`

Initial player visibility state.

Rules:

* required
* allowed values:

  * `hidden`
  * `visible`

Allowed example:

```yaml id="7z3m1d"
visibility: hidden
```

---

## Optional Frontmatter Fields

```yaml id="hcrwq3"
rank_title:
house:
faction:
court:
ring:
introduced_in:
met_summary:
short_blurb:
canonical_aliases:
portrait_filename:
source_file_label:
sort_name:
tags:
```

### `rank_title`

Short formal title.

Examples:

* `Empress of Summer`
* `Heir Apparent`
* `Head Lady-in-Waiting`

Rules:

* string
* trimmed
* max 120 characters

### `house`

House affiliation.

Rules:

* string
* trimmed
* max 80 characters

### `faction`

Faction affiliation.

Rules:

* string
* trimmed
* max 80 characters

### `court`

Court affiliation.

Rules:

* string
* trimmed
* max 40 characters

### `ring`

Ring or district classification.

Rules:

* string
* trimmed
* max 40 characters

### `introduced_in`

Reference for first appearance.

Examples:

* `Session 1`
* `Chapter 3`
* `Wild Bloom Academy`

Rules:

* string
* trimmed
* max 120 characters

### `met_summary`

Short player-facing memory cue.

Example:

* `The ruler who summoned the party to Ever Summer.`

Rules:

* string
* trimmed
* max 240 characters

### `short_blurb`

Directory-card summary text.

Rules:

* string
* trimmed
* max 500 characters

### `canonical_aliases`

DM-defined alternate names.

Rules:

* array of strings
* each alias trimmed
* each alias max 80 characters
* empty strings removed
* duplicates collapsed case-insensitively

Example:

```yaml id="e86ldp"
canonical_aliases:
  - Titania
  - The Empress
  - Her Radiance
```

### `portrait_filename`

Explicit portrait file match target.

Rules:

* string
* trimmed
* filename only
* max 255 characters

Example:

```yaml id="8x9k18"
portrait_filename: empress-titania.png
```

### `source_file_label`

Human-readable source reference.

Examples:

* `04_NPC Folio/Empress Titania.md`
* `Imported Batch 2026-04-08`

Rules:

* string
* trimmed
* max 255 characters

### `sort_name`

Optional alternate sort key for UI/admin ordering.

Rules:

* string
* trimmed
* max 120 characters

### `tags`

Optional tag array for future filtering and admin tools.

Rules:

* array of strings
* trimmed
* each tag max 40 characters
* duplicate tags collapsed case-insensitively

Example:

```yaml id="osncjd"
tags:
  - imperial
  - summer-court
  - sovereign
```

---

## Normalization Rules

Before validation and persistence, imported values must be normalized.

### String normalization

* trim leading/trailing whitespace
* collapse empty string to null for optional scalar fields
* preserve internal punctuation and casing except where slug rules apply

### Slug normalization

Importer may validate a slug. It must not silently invent or rewrite a slug during commit.

If a slug is invalid:

* dry run marks file as invalid
* commit rejects the file

### Alias normalization

* trim whitespace
* remove blank entries
* dedupe case-insensitively
* preserve original casing for display

### Tag normalization

* trim whitespace
* remove blank entries
* dedupe case-insensitively

---

## Markdown Body Handling

Markdown body is stored raw in v1.

### Stored field

Importer stores the full markdown body as raw text in a DM/admin-facing storage field or source-content field.

### Parsing behavior

The importer does not need to parse structured body sections in v1.

### Allowed section headings

Writers may still use structured headings such as:

```md id="2ua4co"
## Public Notes
## DM Notes
## Description
## Secrets
## Relationships
```

These headings are allowed and preserved. They are not required for v1 import success.

---

## Identity and Matching Rules

## Canonical identity

The `slug` is the only canonical identity key for import matching.

### Matching order

1. `slug`
2. reject if `slug` missing
3. reject if `slug` invalid

Filename alone must not determine identity during commit.

### Create behavior

If `slug` does not exist:

* create new NPC record

### Update behavior

If `slug` exists:

* update the existing NPC record

### Rename behavior

Changing `name` does not change identity.
Changing `slug` is a separate future admin flow and is out of scope for v1 import.

---

## Validation Rules

A file is invalid if any of these are true:

* missing frontmatter
* missing `name`
* missing `slug`
* missing `role_type`
* missing `visibility`
* `role_type != npc`
* invalid slug format
* invalid visibility value
* duplicate slug inside the same import batch

### Valid slug pattern

Recommended validation pattern:

```text id="15ja1r"
^[a-z0-9]+(?:-[a-z0-9]+)*$
```

---

## Import Preview Behavior

DM Tools must support dry-run preview before commit.

For each file, preview should report:

* parsed name
* parsed slug
* create or update result
* matched portrait filename, if any
* validation status
* warnings
* blocking errors

### Preview states

* `create`
* `update`
* `invalid`
* `unmatched-portrait`
* `warning`

### Warning examples

* portrait not found
* tags empty
* no canonical aliases present
* source file label missing

Warnings do not block commit unless the system later chooses to enforce them.

---

## Commit Behavior

## On create

Importer must:

* create NPC record
* write metadata fields
* store raw markdown body
* create canonical alias records if present
* attach matched portrait if present
* write audit log entry

## On update

Importer must:

* update scalar metadata fields from the new file
* preserve player-created content
* merge canonical aliases from the file
* replace portrait if a new portrait is matched
* store latest raw markdown body
* write audit log entry

### Player-created content that must persist across updates

* personal aliases
* personal notes
* suspects
* boards
* map pins
* any future player-private content linked to the NPC

---

## Canonical Alias Import Rules

Canonical aliases are DM-defined aliases imported from the markdown file.

### Create/update rules

* merge into canonical alias set for the NPC
* dedupe case-insensitively
* preserve display casing from import source
* do not overwrite player-created aliases
* do not collapse personal aliases into canonical aliases

### Removal behavior

If a previously imported canonical alias is absent from the new import file, the implementation may either:

* archive the removed canonical alias, or
* mark it removed in an audit-aware way

For v1, removed canonical aliases should be treated as a tracked change and remain recoverable if archive infrastructure is already available.

---

## Portrait Matching Rules

Portrait import is controlled by metadata from the markdown file plus staged image uploads.

### Matching order

1. exact `portrait_filename`
2. exact basename equals slug
3. exact basename equals normalized name
4. unmatched if no reliable match found

### Portrait replacement rule

If an existing NPC portrait is replaced during import:

* previous portrait is always archived
* new portrait becomes active portrait
* audit log entry records the replacement

### Missing portrait behavior

Portrait is optional for NPC creation and update.

If no portrait matches:

* NPC import can still succeed
* preview should show warning

---

## Field Persistence Map

### Imported scalar fields

These fields are directly updated from frontmatter:

* `name`
* `slug`
* `visibility`
* `rank_title`
* `house`
* `faction`
* `court`
* `ring`
* `introduced_in`
* `met_summary`
* `short_blurb`
* `source_file_label`
* `sort_name`

### Imported collection fields

* `canonical_aliases`
* `tags`

### Raw stored source fields

* raw markdown body
* original source filename, if available
* last imported at timestamp
* last import log reference, if available

---

## Visibility Rules

Allowed values:

* `hidden`
* `visible`

### Create behavior

Set from imported file.

### Update behavior

Update from imported file.

This means import is allowed to change player visibility state intentionally.

---

## Audit Expectations

Every committed import must create an audit trail entry.

### Minimum audit fields

* actor user id
* action type
* object type
* object id
* timestamp
* result
* message summary

### Example messages

* `Created NPC from import: empress-titania`
* `Updated NPC from import: empress-titania`
* `Replaced portrait during import: empress-titania`

---

## Failure Handling

## File-level reject

Reject a file when:

* required fields missing
* field types invalid
* invalid slug
* invalid visibility
* invalid role_type

## Batch-level behavior

Batch import should support partial success.

That means:

* valid files may commit
* invalid files remain rejected
* results report must separate created, updated, skipped, invalid, and warned files

### Suggested result categories

* `created`
* `updated`
* `skipped`
* `invalid`
* `warning`

---

## Example File

```md id="jf5fd2"
---
name: Empress Titania
slug: empress-titania
role_type: npc
visibility: visible
rank_title: Empress of Summer
house: Imperial Solar Throne
court: Summer
ring: Inner Ring
introduced_in: Session 1
met_summary: The ruler who summoned the party to Ever Summer.
short_blurb: An immortal sovereign radiant with warmth, ceremony, and control.
canonical_aliases:
  - Titania
  - The Empress
  - Her Radiance
portrait_filename: empress-titania.png
source_file_label: 04_NPC Folio/Empress Titania.md
sort_name: Titania, Empress
tags:
  - imperial
  - summer-court
  - sovereign
---

## Description

Titania appears in a blaze of warmth, ceremony, and impossible composure.

## Public Notes

This content is preserved raw for future DM/admin use.

## Secrets

Raw markdown body is stored as-is in v1.
```

---

## Non-Goals for v1

This schema does not do these things in v1:

* parse markdown body sections into structured UI fields
* import player-created aliases
* import player notes
* infer slug automatically during commit
* let filename override slug identity
* expose shared player-created notes

---

## Locked Decisions

These decisions are part of this schema and are final for v1:

* markdown body is stored raw
* slug is the canonical identity key
* portrait replacement always archives the previous image
* session recaps are authored in-app, not imported here
* map metadata is handled in file/config, outside this schema
* DM can see player-added content in DM/admin views, though that content is not imported by this schema

---

## Implementation Notes

A clean importer flow should look like this:

1. upload markdown files
2. upload image files
3. parse frontmatter
4. validate required fields
5. match portraits
6. show dry-run preview
7. commit selected files
8. write audit logs
9. show results report
