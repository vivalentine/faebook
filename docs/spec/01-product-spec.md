# FaeBook Product Spec v1

## Product Summary

FaeBook is a campaign companion app for a fae murder mystery campaign. It gives players a private place to organize theories and gives the DM full control over content, visibility, imports, archives, and session recaps.

## Product Principles

1. Private by default for players
2. Full control for DM
3. Archive instead of destructive delete
4. Strong campaign flavor
5. Stable role enforcement
6. Searchable and scalable content model
7. Production-feeling UI over dev-build UI

## Users

### DM

The DM manages campaign content, player visibility, imports, archives, recaps, and recovery flows.

### Player

Each player gets a private workspace for theory work, saved boards, aliases, personal notes, suspects, and map pins.

## Major Surfaces

### Home Dashboard

The post-login landing page.

Player dashboard includes:

- Continue to Board
- Continue to Maps
- Recently unlocked NPCs
- Suspect list
- Personal notes
- Latest session recap
- Recent personal changes

DM dashboard includes:

- core dashboard widgets
- quick links to player boards
- recent imports
- recent changed NPCs
- archive activity summary

### NPC Directory

Shows NPC cards and detail pages.

Player view:

- visible NPCs only
- personal aliases
- personal notes

DM view:

- all NPCs
- direct NPC editing
- portrait controls
- visibility controls
- archive controls

### Investigation Board

The main theory surface.

Key behavior:

- private per-user boards
- multiple saved boards
- searchable Add NPC flow
- sticky-note Add Note flow
- floating controls inside the canvas
- crime-board presentation
- archive instead of delete

### Maps

A Google-Maps-style viewing page for campaign maps.

Key behavior:

- map switching
- zoom and pan
- personal pins
- pin archive behavior

### DM Tools

DM-only ingestion and admin surface.

Key behavior:

- markdown NPC import
- portrait pairing
- staging preview
- import result reporting
- future expansion point for content administration

## Session Recap

The recap widget is titled `Lumi’s Session Recap`.

Rules:

- DM-authored only
- editable in-app
- player read-only
- latest recap appears on dashboard

## Player-Created Content Model

Player-created content stays private by default.

v1 player-created content includes:

- suspect entries
- personal notes
- personal aliases
- boards
- map pins

Shared player-created systems are removed from scope.

## Alias Model

Two alias types exist.

### Canonical aliases

Created by DM.
Visible and searchable to users who can access the NPC.

### Personal aliases

Created by a player.
Private in player view.
Searchable for that player.
Visible to DM in DM/admin contexts.

## Archive Model

Players can remove their own content from their own view.

Actual data behavior:

- item moves to archive
- DM can restore
- DM can hard delete
- player cannot restore or hard delete

This applies across boards, notes, pins, aliases, and similar player-owned content.

## Design Direction

Overall app:

- dark mode
- polished
- fae-themed
- clean navigation
- reduced dev-build feel

Investigation board:

- tactile
- corkboard / evidence-board energy
- pinned photos
- sticky notes
- strong mystery-campaign identity

## Future Hosting Direction

v1 targets local and controlled deployment first.
Mini-PC deployment is planned later.
Remote access decisions happen after the app is hardened.
