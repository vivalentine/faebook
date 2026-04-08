# FaeBook v1 Scope

## Goal

Ship a stable, private, role-aware campaign companion app for the current murder mystery campaign.

FaeBook v1 supports:

- DM and player roles
- private player workspaces
- DM-controlled world content
- polished dark fae UI
- a crime-board-style investigation board
- map viewing with personal pins
- DM-only content import tools
- archive-first removal flows
- export and backup basics

## In Scope

### Core shell

- persistent app shell
- hamburger drawer
- Home dashboard
- Settings access from bottom-left utility button
- Sign Out from bottom-right utility button

### Navigation

- Home
- NPC Directory
- Investigation Board
- Maps
- DM Tools for DM only

### Dashboard

- player suspect list widget
- player personal notes widget
- latest session recap widget
- recent activity surfaces
- DM dashboard extras

### NPC Directory

- player-facing visible NPC list
- DM-facing full NPC list
- NPC detail pages
- personal aliases
- DM in-app NPC editing

### Investigation Board

- private per-user boards
- multiple saved boards per user
- searchable NPC picker
- sticky-note note nodes
- editable edge labels
- crime-board styling
- export as PNG and JSON
- archive instead of hard delete

### Maps

- Overworld
- Inner Ring
- Outer Ring
- pan and zoom
- personal pins
- pin edit and archive

### DM Tools

- markdown NPC import
- portrait import
- staging preview
- import audit output
- direct NPC editing support

### Search

- role-aware search
- canonical aliases
- player personal aliases
- player-owned searchable content
- DM admin search surfaces

### Archive

- DM-managed archive
- restore and hard delete in DM/admin views
- player remove flows archive content instead of permanently deleting it

### Export and backup

- board PNG export
- board JSON export
- pin export
- basic backup tooling

## Out of Scope for v1

- shared player-created note systems
- shared player-created map pins
- shared player-created suspect lists
- clue tracker
- timeline tracker
- public internet deployment
- real-time multiplayer collaboration
- player-managed archive restore
- public code release workflow

## v1 Release Standard

FaeBook v1 is ready when:

- DM and player roles are enforced in UI and backend
- major surfaces are usable on desktop and mobile
- archive behavior is safe
- import flow works with sample content
- board persistence is stable
- maps are stable
- exports work
- the app feels production-ready instead of dev-like
