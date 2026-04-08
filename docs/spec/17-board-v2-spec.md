# Board v2 Spec

## Purpose

Defines the redesigned Investigation Board surface for v1.

## Locked Decisions

- board keeps a strong crime-board identity
- board is per-user
- multiple saved boards per user are allowed
- controls move into the board canvas
- player remove actions archive content
- dangerous board-wide actions move into overflow and confirmation flows
- footer status text replaces bulky board-side status UI

## Board Model

- each user has one default board
- users can create additional named boards
- users can switch boards
- users can duplicate boards
- users can archive boards
- DM can inspect player boards where intended

## Board Layout

The board surface fills the main content area.

### Remove

- left board sidebar

### Add

- floating control cluster inside the board
- quiet board footer along the bottom
- cleaner fullscreen presentation

## Floating Control Cluster

### Required actions

- `+`
- `💾`
- fullscreen
- overflow menu

### Plus menu options

- Add Note
- Add NPC

### Overflow menu options

- Clear Board
- archive or other low-frequency board actions as needed

## Add Note Flow

- user taps `+`
- user selects `Add Note`
- note appears on board immediately
- note gets a default color
- note is editable inline

## Add NPC Flow

- user taps `+`
- user selects `Add NPC`
- searchable picker opens
- user selects NPC
- NPC node is added to board

### Picker rules

- searchable by name
- should support alias-aware search later through search/index rules
- mobile friendly
- players only see valid player-accessible NPCs
- DM sees correct NPC pool for current board context

## Note Nodes

### Visual direction

- real sticky-note feel
- soft paper styling
- slight rotation on create
- readable text
- editable title and body

### Required note colors

- yellow
- pink
- mint
- blue

### Note behavior

- inline editing
- remove archives the note
- future undo/redo is desirable

## NPC Nodes

### Visual direction

- pinned photo-card look
- push pin detail
- tactile paper/photo treatment
- slight positional variation acceptable
- clear name readability

### Behavior

- preserve linked NPC identity in node data
- support remove/archive behavior
- keep editable or visible supporting text minimal and readable

## Edges

### Rules

- preserve editable edge labels
- support evidence-line / relationship-line feel
- keep labels readable
- support remove/archive behavior if archived at board-state level or edge level as implemented

## Footer Status

Display quiet text along the bottom edge of the board:

- autosave state
- last saved time

This text should stay visible in normal and fullscreen modes.

## Fullscreen Mode

### Required behavior

- preserve floating controls
- preserve footer status
- preserve add flows
- preserve save access
- preserve exit affordance

## Save Rules

- autosave remains active
- manual save stays available through `💾`
- save state should remain understandable without clutter

## Destructive Actions

### Clear Board

- not a primary visible button
- lives in overflow
- requires confirmation

### Board archive

- explicit action
- board leaves normal list
- restorable by DM

## Export Rules

### Required exports

- PNG
- JSON

### PNG export

- current visual board state

### JSON export

- board metadata
- nodes
- edges
- viewport

## Mobile Rules

- floating controls remain reachable
- note editing remains practical
- drag threshold reduces accidental movement
- fullscreen remains usable
- clear-board action remains safe

## Acceptance Targets

- board opens quickly
- switching between boards works
- Add Note works
- Add NPC works
- searchable picker works
- save and autosave work
- fullscreen works
- archive-first removal behavior works
- board exports work
- board looks like a murder-board surface
