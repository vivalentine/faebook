# Dashboard Widget Spec v1

## Purpose

Defines the Home dashboard content for player and DM users.

## Locked Decisions

- Home is the post-login landing page
- dashboard differs by role
- suspect list is per-user
- personal notes are per-user
- latest recap is read-only for players
- DM sees additional admin widgets

## Shared Dashboard Layout Rules

- keep dashboard readable at a glance
- use modular cards/widgets
- support mobile stacking
- surface recent activity without clutter
- preserve role-safe data visibility

## Player Dashboard Widgets

### 1. Continue to Board

Purpose:

- quick re-entry into the player’s working board

Expected content:

- button or card
- optional last-saved timestamp

### 2. Continue to Maps

Purpose:

- quick access to the player’s map work

Expected content:

- button or card
- optional last-used map layer

### 3. Recently Unlocked NPCs

Purpose:

- remind player what new entries are available

Expected content:

- compact list or card set
- recent visible NPC entries
- link into directory or detail page

### 4. Suspect List

Purpose:

- player-managed suspect tracking

Fields:

- name
- status
- short note
- sort order

Actions:

- add
- edit
- reorder
- archive

Suggested statuses:

- active
- cleared
- unknown

### 5. Personal Notes

Purpose:

- freeform personal theory and miscellaneous notes

Behavior:

- editable
- autosaved
- private to player
- searchable if implemented in the relevant search surface

### 6. Latest Session Recap

Purpose:

- DM-authored read-only recap surface

Display:

- latest published recap
- title shown as `Lumi’s Session Recap`
- optional session number
- optional link to recap history later

### 7. Recent Personal Activity

Purpose:

- reinforce continuity

Can include:

- recently edited board
- recently updated suspects
- recently updated notes
- recently added pins

## DM Dashboard Widgets

DM sees the shared utility widgets plus DM-focused admin widgets.

### 1. Continue to Board

DM board entry point

### 2. Continue to Maps

DM map entry point

### 3. Latest Session Recap

Editable access path for DM

### 4. Quick Links to Player Boards

Purpose:

- jump into player board review

Expected content:

- one link per player
- maybe most recently updated first later

### 5. Recent NPC Imports

Purpose:

- recent DM Tools awareness

Expected content:

- filename
- result
- timestamp

### 6. Recently Changed NPCs

Purpose:

- admin visibility into content changes

Expected content:

- name
- changed field summary later if desired
- timestamp

### 7. Archive Activity Summary

Purpose:

- surface recent archive and restore activity

Expected content:

- recently archived items
- recently restored items
- quick link to archive page

## Widget Data Scope Rules

### Player

Can only see:

- own suspects
- own notes
- own recent activity
- visible NPC content
- latest recap

### DM

Can see:

- DM widgets
- admin summaries
- player board jump links
- import/admin activity

## Mobile Rules

- widgets stack vertically on small screens
- avoid dense multi-column layouts
- suspect list remains editable on mobile
- personal notes remain comfortable to type in
