# Search Indexing Rules v1

## Purpose

This document defines what content FaeBook indexes for search, who can search it, how visibility is enforced, and how searchable text is normalized.

This schema governs:

* global search
* NPC Directory search
* alias search
* player-private search surfaces
* DM/admin search surfaces
* search visibility and permissions
* normalization rules for indexed text

This schema does not govern:

* ranking by advanced ML relevance
* semantic embeddings
* typo correction
* fuzzy NLP matching
* archive search UI design beyond basic indexability
* import parsing rules

v1 search is practical, deterministic, permission-aware text search.

---

## Search Model

FaeBook supports two search scopes in v1:

* player search
* DM/admin search

### Player search

Player search returns only content the player is allowed to see.

### DM/admin search

DM search returns all content the DM is allowed to see in admin views.

Search results must always respect visibility and ownership rules.

---

## Search Surfaces in v1

### Player-searchable content

Players can search across:

* visible NPC names
* visible NPC canonical aliases
* their own personal NPC aliases
* visible NPC rank titles
* visible NPC houses
* visible NPC factions
* visible NPC courts
* visible NPC rings
* their own suspect entries
* their own longform personal notes
* their own map pin titles
* their own map pin notes
* latest visible session recap content, if recap text is included in dashboard search

### DM-searchable content

DM can search across:

* all NPC names
* all canonical aliases
* all player personal aliases
* all NPC metadata fields included in index
* import log records
* archive records
* session recap titles and content
* player suspects if DM/admin view includes them
* player notes if DM/admin view includes them
* player pins if DM/admin view includes them

---

## Core Visibility Rules

### Rule 1

Search does not bypass permissions.

### Rule 2

Player search never returns another player’s private content.

### Rule 3

DM search may return player-created content in DM/admin views.

### Rule 4

Hidden NPCs do not appear in player search.

### Rule 5

Canonical aliases follow NPC visibility.
If the NPC is hidden from a player, its canonical aliases are hidden too.

### Rule 6

Personal aliases are visible only:

* to the owning player in player-facing search
* to the DM in DM/admin search

---

## Indexed Entities

## 1. NPC entity

### Indexed fields

* `name`
* `slug`, optional admin-only or internal use
* `rank_title`
* `house`
* `faction`
* `court`
* `ring`
* `introduced_in`, optional
* `met_summary`
* `short_blurb`
* `canonical_aliases`

### Player indexing rule

Index only if NPC is visible to players.

### DM indexing rule

Index all NPCs.

---

## 2. Personal alias entity

### Indexed fields

* `alias`

### Player indexing rule

Index only aliases owned by that player.

### DM indexing rule

Index all personal aliases.

---

## 3. Canonical alias entity

### Indexed fields

* `alias`

### Player indexing rule

Index only aliases attached to visible NPCs.

### DM indexing rule

Index all canonical aliases.

---

## 4. Suspect entity

### Indexed fields

* `name`
* `status`
* `note`

### Player indexing rule

Index only the current player’s suspects.

### DM indexing rule

Index suspect entries only if DM/admin tooling includes them in searchable admin surfaces.

Recommended v1:

* yes, index them for DM/admin visibility

---

## 5. Personal notes entity

### Indexed fields

* `content`

### Player indexing rule

Index only the current player’s personal notes.

### DM indexing rule

Index personal notes only in DM/admin search surfaces if DM visibility into player-added content is enabled.

Locked policy:

* yes, DM can see player-added content in DM/admin views

---

## 6. Map pin entity

### Indexed fields

* `title`
* `note`
* `category`
* `map_layer`

### Player indexing rule

Index only the current player’s pins.

### DM indexing rule

Index player pins only in DM/admin search surfaces where DM has visibility.

---

## 7. Session recap entity

### Indexed fields

* `title`
* `content`
* optional future tags or featured NPC names

### Player indexing rule

Index published visible recap content.

### DM indexing rule

Index all recaps.

---

## 8. Archive entity

### Indexed fields

* `object_label`
* `object_type`
* `archive_reason`
* selected payload text depending on object type
* original filename for portrait assets
* alias text for alias records
* board name for board records
* pin title for pin records

### Player indexing rule

No archive search for players.

### DM indexing rule

Archive is searchable in DM/admin views only.

---

## 9. Import log entity

### Indexed fields

* `filename`
* `result`
* `message`

### Player indexing rule

None.

### DM indexing rule

Searchable in DM/admin tools only.

---

## Normalization Rules

All indexed text must be normalized before search matching.

### Base normalization steps

1. trim leading and trailing whitespace
2. lowercase
3. collapse repeated internal whitespace to a single space
4. store normalized form separately from display form where useful

### Example

```text id="0m4n3n"
"  The   Empress " -> "the empress"
"Moonthorn Estate" -> "moonthorn estate"
```

### Display rule

Original text is preserved for UI display.
Normalized text is used for matching.

---

## Punctuation Handling

v1 should keep punctuation handling simple.

### Recommended rule

* do not aggressively strip punctuation at storage time
* allow basic substring matching on normalized text
* trim and lowercase only
* optional later improvement: lightweight punctuation folding for search keys

### Example

These should still match through normal substring search:

* `Her Radiance`
* `Moonthorn Estate`
* `Hot Auntie Nuala Gealach`

---

## Matching Rules

### v1 matching model

Case-insensitive substring match on normalized text.

This is enough for:

* names
* aliases
* houses
* titles
* suspect names
* note text
* pin labels

### Example queries

Query: `titania`
Matches:

* `Empress Titania`
* canonical alias `Titania`

Query: `solar`
Matches:

* personal alias `Solar Tyrant`
* note text containing `solar`

Query: `moonthorn`
Matches:

* house field
* pin titled `Moonthorn Estate`
* suspect note mentioning Moonthorn

---

## Search Query Behavior

### Empty query

Returns:

* no results, or
* default browse state

Recommended v1:

* empty query returns default browse state, not full global result dump

### Whitespace-only query

Treat as empty query.

### Partial query

Allowed.

Example:

* `moonth`
* `sera`
* `pend`

### Multi-word query

Supported as plain substring matching.
No advanced token logic is required in v1.

Example:

* `solar tyrant`
* `moonthorn estate`

---

## Ranking Rules

v1 ranking should remain simple and deterministic.

### Recommended ranking priority for player search

1. exact or near-exact NPC name matches
2. canonical alias matches
3. personal alias matches
4. primary metadata matches such as house or title
5. player-owned content matches such as suspects, notes, and pins

### Recommended ranking priority for DM search

1. NPC name matches
2. canonical alias matches
3. personal alias matches
4. core NPC metadata matches
5. admin records like archive and import logs
6. player-owned content matches

### Within same class

Sort alphabetically or by stable UI relevance rules.

---

## Search Result Grouping

Recommended grouped result sections:

### Player search groups

* NPCs
* My Aliases
* My Suspects
* My Notes
* My Map Pins
* Recaps

### DM search groups

* NPCs
* Canonical Aliases
* Player Aliases
* Archive
* Imports
* Recaps
* Player Content

Grouping results makes mixed-surface search much easier to read.

---

## Search Permissions Matrix

### Player can search

* visible NPCs
* visible canonical aliases
* own aliases
* own suspects
* own notes
* own pins
* visible recaps

### Player cannot search

* hidden NPCs
* other players’ aliases
* other players’ suspects
* other players’ notes
* other players’ pins
* archives
* import logs
* DM-only metadata

### DM can search

* all NPCs
* all aliases
* archives
* import logs
* recaps
* player-created content in DM/admin views

---

## Index Update Triggers

The search index must refresh when relevant content changes.

### NPC triggers

* create NPC
* update NPC metadata
* change visibility
* archive NPC
* restore NPC

### Alias triggers

* create alias
* edit alias
* archive alias
* restore alias

### Suspect triggers

* create suspect
* edit suspect
* archive suspect
* restore suspect

### Personal note triggers

* create note
* update note
* archive note
* restore note

### Map pin triggers

* create pin
* edit pin
* archive pin
* restore pin

### Recap triggers

* publish recap
* edit recap
* archive recap if later supported

### Admin triggers

* import commit
* archive restore
* hard delete may remove searchability entirely

---

## Archive Search Rules

Archive search is DM-only.

### Indexed archive envelope fields

* `object_label`
* `object_type`
* `archive_reason`

### Indexed payload fields by type

#### Board

* board name

#### Board node

* note title
* note body if text node

#### Map pin

* title
* note
* category

#### Suspect

* name
* note

#### Alias

* alias text

#### NPC

* name
* slug
* aliases if retained in payload

#### Portrait asset

* original filename

---

## Search Index Storage

v1 can use one of these approaches:

### Option A

On-demand filtering in SQL or app code for smaller datasets.

### Option B

Precomputed normalized columns for searchable fields.

### Recommended v1 approach

Use normalized searchable columns or normalized shadow fields where easy, and keep the search system simple.

Examples:

* `alias_normalized`
* optional `name_normalized`
* optional normalized search blob for NPCs later

---

## Searchable Field Standards

### NPC searchable text blob, recommended later

You may eventually build a combined NPC search string from:

* name
* canonical aliases
* rank title
* house
* faction
* court
* ring
* introduced_in
* met_summary
* short_blurb

This is optional for v1.
v1 can also search across individual fields.

### Personal note searchable text

Use raw content plus normalized shadow text if desired.

### Suspect searchable text

Use name, status, and note.

### Pin searchable text

Use title, note, category, and map layer.

---

## Exclusions

These should not be indexed for player search in v1:

* hidden NPC raw markdown body
* DM-only notes
* import source labels
* raw imported markdown body
* archived content
* other players’ private content

### DM-only optional exclusions

Even for DM search, raw markdown body can remain unindexed in v1 if you want to keep the search surface cleaner.
Recommended v1:

* do not index raw markdown body yet
* keep DM search focused on structured metadata and admin records

---

## Performance Rules

v1 search should stay lightweight.

### Requirements

* fast enough for normal campaign-sized datasets
* no expensive full-text infrastructure required
* predictable permission filtering
* no client-side exposure of hidden data

### Recommendation

Permission filtering should happen server-side before or during result generation.

---

## UI Rules

### Search input placement

At minimum:

* NPC Directory search
* global search entry point later in shell or drawer if desired

### Result presentation

Grouped sections are preferred over one undifferentiated mixed list.

### Empty state

Show:

* no matches found
* optional hint to search by alias, house, or title

### Highlighting

Optional in v1.
Not required.

---

## Example Result Shapes

### NPC result example

```json id="djmjlwm"
{
  "result_type": "npc",
  "id": 12,
  "label": "Empress Titania",
  "subtext": "Empress of Summer • Imperial Solar Throne",
  "matched_on": "canonical_alias",
  "match_value": "The Empress"
}
```

### Personal alias result example

```json id="es0grs"
{
  "result_type": "personal_alias",
  "id": 103,
  "npc_id": 12,
  "label": "Solar Tyrant",
  "subtext": "Alias for Empress Titania",
  "matched_on": "alias"
}
```

### Pin result example

```json id="uvf3sd"
{
  "result_type": "map_pin",
  "id": 52,
  "label": "Moonthorn Estate",
  "subtext": "Inner Ring • danger",
  "matched_on": "title"
}
```

---

## Locked Decisions

These decisions are final for v1:

* search is permission-aware
* players search only what they can see or own
* DM can search all player-added content in DM/admin views
* hidden NPCs do not appear in player search
* canonical aliases follow NPC visibility
* personal aliases are private to the owner in player-facing search
* v1 search uses simple normalized text matching
* raw imported markdown body is not indexed in v1
* archive and import logs are DM-searchable only

---

## Non-Goals for v1

This schema does not include:

* semantic search
* embeddings
* typo correction
* fuzzy phonetic search
* synonym engines
* result personalization
* popularity-based ranking
* natural-language query interpretation

These can be added later if needed.

---

## Implementation Notes

A clean v1 search flow should look like this:

1. user enters query
2. query is normalized
3. server determines role and ownership scope
4. server searches allowed indexed fields only
5. results are grouped by entity type
6. UI renders grouped results
7. selecting a result routes to the correct surface

### Good first implementation order

1. NPC Directory search
2. alias-aware NPC search
3. player dashboard content search
4. map pin search
5. DM/admin search
6. archive and import log search
