# Session Recap Authoring Rules v1

## Purpose

This document defines how session recaps are created, edited, published, displayed, searched, and managed inside FaeBook.

Session recaps exist to give players a stable DM-authored summary of what happened in each session, framed in the voice and presentation style of Lumi.

This schema governs:

* recap creation
* recap editing
* recap publishing
* recap visibility
* recap display on the Home dashboard
* recap searchability
* recap ownership and permissions

This schema does not govern:

* player-created summaries
* clue tracking
* timeline systems
* NPC import content
* board exports

---

## Core Product Rule

Session recaps are:

* authored by the DM
* edited in-app
* read-only for players
* displayed as `Lumi’s Session Recap`

Players cannot edit recap content.

---

## Scope

This schema applies to:

* Home dashboard recap widget
* recap authoring UI in DM/admin views
* recap storage
* recap search indexing
* future recap archive or history views

---

## Recap Model

Each recap represents one published session summary.

A recap is a standalone content object with:

* session identity
* title
* body content
* publish metadata
* author metadata
* optional supporting metadata for later filtering

---

## Required Fields

Recommended recap fields:

* `id`
* `session_number`
* `title`
* `content`
* `published_at`
* `published_by_user_id`

### Field definitions

#### `id`

Primary key.

Rules:

* required
* unique

#### `session_number`

Canonical numeric session reference.

Rules:

* required
* positive integer
* unique per recap

Example:

```text id="q0k4rv"
session_number: 3
```

#### `title`

Display title of the recap.

Rules:

* required
* string
* trimmed
* max 120 characters

### Title rule

Default title should be:

```text id="sukef2"
Lumi’s Session Recap
```

You may optionally append session context in admin views or history lists later, but the player-facing widget should still read as Lumi’s recap.

Examples:

* `Lumi’s Session Recap`
* `Lumi’s Session Recap — Session 3`

Recommended v1 player-facing default:

* `Lumi’s Session Recap`

#### `content`

Main recap body.

Rules:

* required
* string
* trimmed
* stored as rich text or markdown-compatible text, implementation choice
* max length can be generous in v1

Recommended practical max:

* 20,000 characters

#### `published_at`

Timestamp of latest publish state.

Rules:

* required once published
* UTC timestamp

#### `published_by_user_id`

DM user who published the recap.

Rules:

* required
* must reference DM user

---

## Optional Fields

Recommended optional fields:

* `summary`
* `featured_npcs`
* `featured_locations`
* `updated_at`
* `last_edited_by_user_id`
* `is_published`
* `session_label`

### Optional field definitions

#### `summary`

Short one-line dashboard summary if you want a compact card preview later.

Rules:

* optional
* string
* max 240 characters

#### `featured_npcs`

Optional list of referenced NPC IDs or names for later enhancements.

Rules:

* optional
* array

#### `featured_locations`

Optional list of referenced locations or map IDs for later enhancements.

Rules:

* optional
* array

#### `updated_at`

Timestamp of last edit.

Rules:

* optional but strongly recommended

#### `last_edited_by_user_id`

Latest DM editor.

Rules:

* optional but strongly recommended

#### `is_published`

Publishing state.

Rules:

* boolean
* recommended if drafts are supported

#### `session_label`

Optional alternate display label.

Examples:

* `Session 3`
* `Masquerade Fallout I`

Rules:

* optional
* max 80 characters

---

## Ownership and Permissions

## DM permissions

DM can:

* create recap
* edit recap
* save draft
* publish recap
* update published recap
* remove recap later if archive is added
* view all recap metadata

## Player permissions

Players can:

* read published recap content
* see latest recap on dashboard
* later read older recaps if a recap history page is added

Players cannot:

* create recap
* edit recap
* delete recap
* publish recap

---

## Authoring Rules

Recaps are authored in-app.

### v1 authoring surface

Recommended DM UI:

* recap editor form
* title field
* body field
* session number field
* save draft button
* publish button

### Draft support

Draft support is recommended.

If drafts are included in v1:

* unpublished recaps are DM-visible only
* players never see draft content

If drafts are deferred:

* recap can still be created directly as published content

Recommended v1 behavior:

* support drafts if easy
* otherwise support direct publish only

---

## Publishing Rules

### Publish behavior

When DM publishes a recap:

* recap becomes visible to players
* recap appears on Home dashboard
* recap becomes searchable where allowed
* publish metadata is stored
* audit log entry is written

### Update behavior

If DM edits an already published recap:

* updated content replaces prior published content
* `updated_at` changes
* latest published version is what players see

### One recap per session

Recommended v1 rule:

* one recap per `session_number`

If a recap for session 3 already exists and DM edits it:

* update the existing recap
* do not create duplicate recap records for the same session number

---

## Display Rules

## Home dashboard widget

Home dashboard shows:

* latest published recap only

### Widget presentation

Recommended widget fields:

* title: `Lumi’s Session Recap`
* optional session label
* publish date or updated date
* recap body or truncated preview
* “Read more” if truncation is used

### Player display

Players see published recap content only.

### DM display

DM sees the same published widget plus admin editing access elsewhere.

---

## Ordering Rules

### Latest recap logic

The dashboard recap widget should show the latest published recap.

Recommended ordering rule:

1. highest `session_number`
2. fallback to latest `published_at` if needed

### Admin ordering

DM/admin recap list should sort by:

* newest session number first

---

## Content Rules

### Voice and style

Recap is framed as Lumi’s recap.

This is a presentation rule, not a schema-enforced text parser rule.

### Allowed content

Recap can include:

* summary of session events
* remembered NPC encounters
* notable discoveries
* open questions
* next-step hooks
* mood and framing in Lumi’s voice

### Disallowed assumptions

Recap should not require a separate clue tracker or timeline system.

It should remain a readable narrative summary, not a rigid evidence log.

---

## Storage Format

### Recommended content storage

Use one of:

* plain rich text string
* markdown-compatible string

Recommended v1:

* plain text or markdown-compatible text stored as raw text

This keeps editing simple and future-proof.

---

## Search Rules

Published recaps are searchable according to Search Indexing Rules v1.

### Player search scope

Players may search:

* published recap title
* published recap content

### DM search scope

DM may search:

* all recap titles
* all recap content
* draft content too, if drafts exist

### Draft visibility rule

Draft recaps are never searchable in player search.

---

## Validation Rules

A recap is invalid if:

* `session_number` missing
* `title` missing
* `content` missing
* `published_by_user_id` missing when publishing
* duplicate `session_number` on create where uniqueness is required

### Field constraints

* `title`: 1 to 120 chars
* `content`: 1 to 20,000 chars recommended
* `session_number`: positive integer

### Empty content rule

Blank recap content is not allowed.

---

## Example Record

```json id="b8m44n"
{
  "id": 3,
  "session_number": 3,
  "title": "Lumi’s Session Recap",
  "content": "The party’s evening continued through a web of invitations, interruptions, and increasingly suspicious coincidences...",
  "published_at": "2026-04-08T21:45:00Z",
  "published_by_user_id": 1,
  "updated_at": "2026-04-08T21:45:00Z",
  "last_edited_by_user_id": 1,
  "is_published": true,
  "session_label": "Session 3"
}
```

---

## Dashboard Behavior

### Required behavior

* show latest published recap
* player sees read-only content
* DM sees same published recap in dashboard context

### Optional enhancements

* truncate long recap with expand action
* show session label
* show “updated” timestamp
* add recap archive page later

---

## Future Recap History

This is not required for v1, but the schema should allow it.

Future recap history page may show:

* all published recaps
* ordered by session number
* searchable by title and content
* optional session label and date

---

## Audit Expectations

Recap actions should write audit log entries.

### Recommended audit events

* recap created
* recap draft saved
* recap published
* recap updated
* recap archived later if that is added

### Example messages

* `Created recap draft for Session 3`
* `Published recap for Session 3`
* `Updated recap for Session 3`

---

## Archive Behavior

Archive is not required for recap v1, but the model should leave room for it.

If recap archive is added later:

* DM-only management
* restore possible
* player never sees archived recap content
* latest published recap widget ignores archived recaps

---

## Locked Decisions

These decisions are final for v1:

* recaps are authored and edited in-app
* recaps are DM-authored only
* players are read-only
* Home dashboard shows the latest published recap
* default player-facing title is `Lumi’s Session Recap`
* published recap content is searchable
* draft recap content is DM-only
* one recap per session number is the recommended model

---

## Non-Goals for v1

This schema does not include:

* player comments on recaps
* shared recap editing
* branching recap versions
* timeline extraction
* clue extraction
* auto-generated recap text
* attachment uploads inside recaps

---

## Implementation Notes

A clean v1 recap flow should look like this:

1. DM opens recap editor
2. enters session number
3. writes or updates title and content
4. saves draft or publishes
5. published recap becomes visible on Home dashboard
6. search index updates
7. audit log writes the action
