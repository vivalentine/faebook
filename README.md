# FaeBook

FaeBook is a dark, fae-themed campaign companion app for a murder mystery tabletop campaign.

It gives players private tools for theory work and gives the DM full control over content, visibility, imports, archives, and session recaps.

## Current status

FaeBook is an active in-progress project.

The current codebase includes:

- a React + TypeScript + Vite client
- a Node + Express server
- SQLite persistence
- session-based authentication
- role-aware DM and player views
- a local-network deployment flow using Caddy

The project is being prepared for milestone-based development with Codex.

## Core product goals

- private player workspaces
- DM-only admin tools
- a polished dark fae UI
- a crime-board-style investigation board
- per-user maps and pins
- DM-managed archive and recovery flows
- import tools for NPC markdown and portraits
- export and backup tooling

## Roles

### DM

The DM can:

- manage NPC visibility
- import NPC markdown and portraits
- edit NPC data in-app
- view archives
- restore archived content
- hard delete archived content
- publish session recaps

### Player

Players can:

- browse visible NPCs
- create private theory boards
- create personal notes
- maintain a private suspect list
- create personal aliases for NPCs
- place personal map pins

## Locked product rules

- DM Tools never appear to player users
- DM-only routes and APIs reject player users
- player-created content is private by default
- shared player-created notes are out of scope
- player remove actions archive content instead of permanently deleting it
- archive management is DM-only
- session recaps are DM-authored and player read-only
- boards are per-user
- the investigation board should feel like a murder board
- the rest of the app should feel dark, polished, and fae-themed

## Repository structure

```text
.
├─ apps/
│  ├─ client/        # React + TypeScript + Vite frontend
│  └─ server/        # Node + Express backend
├─ config/
│  └─ maps/          # map metadata config files
├─ docs/
│  └─ spec/          # locked product and schema specs
├─ fixtures/         # sample NPC markdown and image fixtures
├─ scripts/
│  └─ codex/         # Codex setup and verification scripts
├─ AGENTS.md         # project operating rules for coding agents
└─ .env.example      # safe example environment values
```

## Local development

### Prerequisites

- Node.js
- npm

### Install dependencies

```bash
npm install
npm install --prefix apps/client
npm install --prefix apps/server
```

### Run the server

```bash
npm --prefix apps/server run start
```

### Run the client in dev mode

```bash
npm --prefix apps/client run dev
```

### Build the client

```bash
npm run build
```

## v1 exports and backups

### Board exports (player and DM)

- Open **Investigation Board**.
- Use the overflow menu (`⋯`) to export:
  - **Export Board JSON**
  - **Export Board PNG**

Board export files are timestamped in UTC using `yyyy-mm-dd-hhmm`.

### Map pin exports (player and DM)

- Open **Maps**.
- Use toolbar actions:
  - **Export Current Pins**
  - **Export All Pins**

Map pin export files use `map-pins-{scope}-{yyyy-mm-dd-hhmm}.json`.

### DM local backup workflow

- Open **DM Tools**.
- In **Local Backup**, click **Create Local Backup**.
- The server creates a local backup directory at:
  - `backups/faebook-backup-{yyyy-mm-dd-hhmm}/`

Each backup includes:

- `data/faebook.db` (plus `faebook.db-wal` and `faebook.db-shm` when present)
- `uploads/` copy of portrait assets from `uploads/npc-portraits`
- `config/maps/*.yml`
- `manifest.json` with metadata and included assets

Backup creation is DM-only and writes an audit log entry.

## Environment files

Use these files locally:

- `apps/server/.env`
- `apps/client/.env.local`

Use these example files as references:

- `.env.example`
- `apps/server/.env.example`
- `apps/client/.env.local.example`

Do not commit real secrets, local databases, uploads, backups, or generated build artifacts.

## Specs and project guidance

The project is driven by the files in `docs/spec/`.

Important files:

- `docs/spec/00-v1-scope.md`
- `docs/spec/01-product-spec.md`
- `docs/spec/02-routes-and-nav.md`
- `docs/spec/03-permissions-matrix.md`
- `docs/spec/04-data-model.md`

Agent guidance lives in:

- `AGENTS.md`

## Codex workflow

This repo is being prepared for milestone-based Codex work.

Codex should:

- read `AGENTS.md`
- read the relevant files in `docs/spec/`
- implement one milestone at a time
- keep the app runnable after each milestone
- run `scripts/codex/verify.sh` before finishing work

## Near-term roadmap

1. App shell and drawer navigation
2. Home dashboard
3. Board v2
4. Maps page
5. DM Tools and in-app NPC editing
6. Search, aliases, and archive UI
7. Export, backup, and audit
8. Visual polish
9. Deployment hardening

## Deployment direction

Current deployment is local/private.

Planned path:

- stable local development
- mini-PC hosting on the LAN
- later remote access after the app is hardened

## Notes

FaeBook is a campaign-specific app built around a custom world, a private player theory workflow, and a DM-controlled content model.
