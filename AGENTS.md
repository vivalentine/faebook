# FaeBook Agent Instructions

## Project Overview

FaeBook is a dark, fae-themed campaign companion app for a murder mystery tabletop campaign.

The app supports two roles:

- `dm`
- `player`

The DM has full admin access.
Players have private personal workspaces and should never see DM-only surfaces.

This repository contains a working app that must remain runnable throughout development.
Changes should be made in milestone-sized slices.
Do not attempt a full rewrite.

## Primary Product Rules

These rules are locked and must be preserved unless a task explicitly changes them.

1. DM-only tools must never be visible to player users.
2. DM-only routes must reject player users.
3. DM-only APIs must reject player users.
4. Player-created content is private by default.
5. Shared player-created notes are out of scope and should not be reintroduced.
6. Player "delete" actions are archive actions.
7. Archive management is DM-only.
8. DM can view player-created content in DM/admin views.
9. Session recaps are DM-authored and player read-only.
10. Boards are per-user.
11. Multiple saved boards per user are allowed in v1.
12. Personal NPC aliases are allowed and searchable for the owning player.
13. Canonical NPC aliases are DM-managed.
14. Preserve the crime-board identity of the investigation board.
15. Keep the rest of the app visually dark, polished, and fae-themed.

## Development Philosophy

- Keep the app runnable after each milestone.
- Make focused changes.
- Prefer extending the current app over replacing it.
- Preserve existing working auth and role behavior unless the task requires a change.
- Avoid broad refactors unless they are necessary for the milestone.
- Respect existing data whenever possible.
- Add migrations instead of destructive schema resets.

## Source of Truth

Always read these before implementation:

- `docs/spec/00-v1-scope.md`
- `docs/spec/01-product-spec.md`
- `docs/spec/02-routes-and-nav.md`
- `docs/spec/03-permissions-matrix.md`
- `docs/spec/04-data-model.md`
- all other files in `docs/spec/`

If any spec file conflicts with existing code, follow the spec unless the user explicitly says otherwise.

## Repo Expectations

Treat this repository as the canonical codebase.

Before making changes:

1. read `AGENTS.md`
2. read the milestone-specific spec files
3. inspect the relevant existing files
4. keep changes scoped to the assigned milestone

## Required Behavior for Agents

When implementing a task:

- make the minimum necessary changes
- keep naming consistent
- keep role checks explicit
- add or update DB migrations carefully
- preserve backwards compatibility when practical
- maintain dark mode styling
- keep board interactions safe on desktop and mobile

When finishing a task:

- run the verification script
- summarize changed files
- summarize DB changes
- summarize any open risks
- do not claim success if verification failed

## Tech Stack

Current app stack:

- frontend: React + TypeScript + Vite
- backend: Node.js + Express
- database: SQLite
- auth: session-based auth
- board UI: React Flow based canvas
- proxy / local serving: Caddy in local deployment

## Commands

From the repo root, use these commands.

### Install

- `npm install`
- `npm install --prefix apps/client`
- `npm install --prefix apps/server`

### Run client dev

- `npm --prefix apps/client run dev`

### Run server

- `npm --prefix apps/server run start`

### Build client

- `npm run build`

### Verify

- `bash scripts/codex/verify.sh`

If a command fails, report the failure clearly.

## Files and Folders to Respect

Important application areas:

- `apps/client/`
- `apps/server/`
- `docs/spec/`
- `config/maps/`
- `fixtures/`

Do not commit:

- real `.env` files
- database files
- uploads
- local backups
- generated archives
- `node_modules`
- build output unless explicitly requested

## Auth and Permissions

Always enforce permissions in both places:

- frontend visibility
- backend authorization

Never rely on frontend hiding alone.

### Player must not be able to

- access DM Tools
- use DM import endpoints
- restore archived content
- hard delete archived content
- edit canonical NPC data
- publish session recaps

### DM must be able to

- access DM Tools
- import NPC markdown and portraits
- edit NPC data in-app
- view archives
- restore archived items
- hard delete archived items
- view player-created aliases and other private player content in DM/admin views

## Archive Rules

For player-facing UX, remove actions can look like deletion.
In data behavior, they are archive operations.

Archive behavior rules:

- players can archive their own removable content
- players cannot restore
- players cannot hard delete from archive
- DM can restore
- DM can hard delete
- archive actions should be auditable

## Board Rules

The investigation board is a core product surface.

Required board behavior:

- preserve crime-board styling direction
- support sticky-note-like notes
- support searchable NPC add flow
- support multiple boards per user
- support archive instead of hard delete
- keep dangerous actions behind confirmation or overflow actions
- keep in-canvas controls for board v2
- preserve editable edge labels

## Maps Rules

Maps are per-user in v1.

Required map behavior:

- support map switching
- support personal pins
- support pin edit and archive
- use config/file-backed map metadata
- keep mobile interactions usable

## Search Rules

Search must respect permissions.

Player search should only return data visible to that player.
DM search may include admin-visible data.

Search should include:

- NPC names
- canonical aliases
- player personal aliases where applicable
- relevant player-owned content
- archive and admin content only in DM/admin contexts

## Import Rules

NPC import is DM-only.

Use the schema docs as the source of truth:

- NPC markdown import schema
- NPC asset schema
- alias schema

Important import rules:

- slug is the primary stable identity
- markdown body content is stored raw in v1
- portrait replacement archives the prior portrait
- preserve player-created content on NPC updates
- do not overwrite player personal aliases with imports

## UI and Design Rules

Overall app:

- dark mode
- polished
- fae-themed
- minimal dev-build feel

Investigation board:

- more tactile
- more crime-board-like
- sticky notes
- push pins
- evidence-board feel

Navigation:

- hamburger drawer
- page links at top
- bottom utility row
- settings button on bottom-left
- sign out on bottom-right

## Data Safety Rules

- prefer migrations over destructive resets
- do not drop tables unless explicitly instructed
- do not destroy existing user content
- when unsure, archive instead of delete
- preserve existing IDs and slugs when possible
- report any risky migration clearly

## Testing and Verification Rules

Before finishing, always:

1. run `bash scripts/codex/verify.sh`
2. report whether verification passed
3. report any known gaps

When adding new behavior:

- add tests where practical
- add at least smoke coverage for permissions-sensitive flows
- prioritize auth, route protection, archive, import, and board persistence testing

## Communication Rules for Agents

When returning work:

- list changed files
- explain what changed
- explain any migration or data model changes
- explain any manual follow-up needed
- note any unresolved risk

Do not:

- claim a feature is complete if a required part is missing
- ignore failing verification
- silently change scope
- reintroduce shared player notes or shared player-created surfaces without explicit instruction

## Milestone Strategy

Work should be organized in milestone-sized slices.

Preferred implementation order:

1. app shell and navigation
2. dashboard
3. board v2
4. maps
5. DM Tools and NPC editing
6. search, aliases, archive UI
7. export, backup, audit
8. visual polish
9. deployment hardening

Keep each milestone mergeable and runnable.

## If Specs Are Missing

If a needed spec is missing:

- make the smallest reasonable assumption
- state the assumption clearly in the completion summary
- do not invent large new systems without documentation

## Final Rule

Treat `docs/spec/` plus `AGENTS.md` as the operating contract for the project.
Preserve role safety, data safety, and the campaign-specific UX identity at all times.
