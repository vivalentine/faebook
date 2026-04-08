# FaeBook Codex Runbook

This runbook is for the Codex web flow against the GitHub repo.

## Preflight

Use this sequence before the first Codex task.

1. Push a clean feature branch to GitHub.
2. Make sure the repo on GitHub contains the exact files you want Codex to read.
3. Let Codex install dependencies in its own environment.
4. Merge one milestone PR at a time.
5. Keep the app runnable after every merge.

## Repo readiness summary

The repo is close to Codex-ready. The planning package is in place:
- `AGENTS.md`
- `docs/spec/00-22`
- `README.md`
- `.env.example` files
- `scripts/codex/setup.sh`
- `scripts/codex/verify.sh`
- sample NPC import fixtures
- map config files

These items deserve attention before the first Codex run.

- The zipped snapshot included a broken local `node_modules` state that caused the client verify step to fail with a Vite permission error in this environment. Codex web will install dependencies fresh, so the GitHub repo should stay clean and should not rely on bundled local dependencies.
- The current code still has a few implementation gaps relative to the locked rules and specs. The milestone order below is designed to close them safely.
- The current import script still reflects an older schema path. The DM Tools milestone replaces that flow.

## Milestone order

Run one prompt per Codex task. Merge one PR before starting the next one.

---

## Milestone 1

### Goal
Implement the shared authenticated shell, shared routes, drawer navigation, and placeholder pages while keeping auth and current app pages working.

### Specs Codex should read
- `AGENTS.md`
- `docs/spec/00-v1-scope.md`
- `docs/spec/01-product-spec.md`
- `docs/spec/02-routes-and-nav.md`
- `docs/spec/03-permissions-matrix.md`
- `docs/spec/14-mobile-rules.md`
- `docs/spec/22-visual-direction.md`

### Files or assets that must exist first
- Clean pushed branch
- Current auth flow
- Current directory and board pages
- `apps/client/public/fairy.svg`
- `apps/client/public/favicon.svg`

### Prompt to paste into Codex
```text
Read AGENTS.md and these specs first:
- docs/spec/00-v1-scope.md
- docs/spec/01-product-spec.md
- docs/spec/02-routes-and-nav.md
- docs/spec/03-permissions-matrix.md
- docs/spec/14-mobile-rules.md
- docs/spec/22-visual-direction.md

Goal:
Implement the shared authenticated shell and shared route model without breaking current auth or role safety.

Required outcomes:
- Add a persistent authenticated app shell with a hamburger drawer.
- Shared authenticated routes:
  - /
  - /directory
  - /directory/:slug
  - /board
  - /maps
  - /settings
- DM-only routes:
  - /dm-tools
  - /archive
- Drawer top links:
  - Home
  - NPC Directory
  - Investigation Board
  - Maps
  - DM Tools only for DM users
- Drawer bottom utility row:
  - settings button on bottom-left
  - sign out on bottom-right
- Hide DM-only nav from player users.
- Keep frontend route protection explicit.
- Keep backend role checks explicit.
- Remove page-level sign-out buttons and page-level nav duplicates.
- Keep the current directory and board pages reachable through the new shared routes.
- Add placeholder pages for Home, Maps, Settings, DM Tools, and Archive for now.
- Preserve existing login flow and role redirects.
- Reuse existing fairy branding assets and keep the UI dark and polished.
- Keep mobile drawer behavior usable.

Scope limits:
- Do not build dashboard widgets yet.
- Do not build maps behavior yet.
- Do not build DM Tools behavior yet.

Implementation notes:
- Prefer small, mergeable changes.
- Keep old routes redirecting safely if needed so the app stays runnable during transition.
- Update README only if startup or route notes need a small correction.

Before finishing:
- run bash scripts/codex/verify.sh
- summarize changed files
- summarize migration/data changes
- report verification result honestly
- list open risks
```

### Manual review after Codex finishes
- Log in as DM and player.
- Confirm the drawer appears on every authenticated page.
- Confirm settings sits bottom-left and sign out sits bottom-right.
- Confirm player cannot see DM Tools.
- Confirm `/`, `/directory`, and `/board` work.

---

## Milestone 2

### Goal
Build the Home dashboard and the first private player workspace data.

### Specs Codex should read
- `AGENTS.md`
- `docs/spec/00-v1-scope.md`
- `docs/spec/01-product-spec.md`
- `docs/spec/02-routes-and-nav.md`
- `docs/spec/03-permissions-matrix.md`
- `docs/spec/04-data-model.md`
- `docs/spec/12-session-recap-rules.md`
- `docs/spec/16-dashboard-widget-spec.md`
- `docs/spec/22-visual-direction.md`

### Files or assets that must exist first
- Milestone 1 merged
- Current SQLite DB setup in `apps/server/db.js`

### Prompt to paste into Codex
```text
Read AGENTS.md and these specs first:
- docs/spec/00-v1-scope.md
- docs/spec/01-product-spec.md
- docs/spec/02-routes-and-nav.md
- docs/spec/03-permissions-matrix.md
- docs/spec/04-data-model.md
- docs/spec/12-session-recap-rules.md
- docs/spec/16-dashboard-widget-spec.md
- docs/spec/22-visual-direction.md

Goal:
Implement the Home dashboard with the first v1 private workspace data model.

Required outcomes:
- Build the real / dashboard page.
- Add SQLite support and APIs for:
  - dashboard_suspects
  - dashboard_notes
  - session_recaps
- Player dashboard widgets:
  - Continue to Board
  - Continue to Maps
  - Recently Unlocked NPCs
  - Suspect List
  - Personal Notes
  - Latest Session Recap
  - Recent Personal Activity
- DM dashboard widgets:
  - shared utility widgets
  - recap editor/publisher access
  - quick links to player boards
  - placeholders or basic cards for recent imports / archive activity summary if full data is not ready yet
- Keep player-created content private by default.
- Keep recap DM-authored and player read-only.
- Make suspect edits and personal notes feel smooth and usable on desktop and mobile.
- Add careful schema migration logic in db.js.
- Keep the app runnable with seeded data.

Assumptions to use:
- v1 personal note support is the dashboard personal notes widget from the specs.
- Do not reintroduce shared player-created note systems.

Scope limits:
- Do not build search yet.
- Do not build archive browser yet.
- Do not build maps yet.

Before finishing:
- run bash scripts/codex/verify.sh
- summarize changed files
- summarize DB changes
- report verification result honestly
- list open risks
```

### Manual review after Codex finishes
- Player can create, edit, and remove suspects and dashboard notes.
- Player sees the latest recap and cannot edit it.
- DM can edit or publish recap.
- Home is the post-login landing page.
- Player dashboard data stays private.

---

## Milestone 3

### Goal
Align NPC pages with the privacy rules and add personal and canonical aliases.

### Specs Codex should read
- `AGENTS.md`
- `docs/spec/01-product-spec.md`
- `docs/spec/03-permissions-matrix.md`
- `docs/spec/04-data-model.md`
- `docs/spec/08-alias-schema.md`
- `docs/spec/11-search-indexing-rules.md`
- `docs/spec/20-search-and-archive-spec.md`
- `docs/spec/22-visual-direction.md`

### Files or assets that must exist first
- Milestones 1 and 2 merged
- Current NPC tables and detail pages
- Existing portrait assets

### Prompt to paste into Codex
```text
Read AGENTS.md and these specs first:
- docs/spec/01-product-spec.md
- docs/spec/03-permissions-matrix.md
- docs/spec/04-data-model.md
- docs/spec/08-alias-schema.md
- docs/spec/11-search-indexing-rules.md
- docs/spec/20-search-and-archive-spec.md
- docs/spec/22-visual-direction.md

Goal:
Bring the NPC directory and detail pages into alignment with the locked privacy rules and add alias support.

Required outcomes:
- Add SQLite support and APIs for npc_aliases.
- Support two alias types:
  - canonical aliases managed by DM
  - personal aliases managed by the owning player
- Player NPC detail page:
  - visible NPCs only
  - personal aliases CRUD for the owning player
  - no shared player-created notes
- DM NPC detail/admin view:
  - all NPCs
  - canonical alias CRUD
  - visibility controls remain
  - admin visibility into player personal aliases
- Remove or retire the current shared NPC note UX from player-facing surfaces.
- Do not leak one player’s personal aliases to another player.
- Keep portraits and current card browsing behavior working.
- Keep current directory filters and polish them where needed.

Assumptions to use:
- v1 personal notes live in the dashboard notes widget.
- NPC detail pages focus on aliases and canonical NPC info.
- If legacy npc_notes data exists, keep it preserved in the database for now, remove it from player-facing UX, and stop treating it as a shared feature.

Scope limits:
- Do not build global search yet.
- Do not build import tooling yet.
- Do not build archive browser yet.

Before finishing:
- run bash scripts/codex/verify.sh
- summarize changed files
- summarize DB changes
- report verification result honestly
- list open risks
```

### Manual review after Codex finishes
- Player sees personal aliases only for their own account.
- DM can see canonical aliases and player aliases in admin view.
- Player no longer sees shared note content on NPC pages.
- Hidden NPCs remain hidden.

---

## Milestone 4

### Goal
Create the archive and audit foundation before boards and maps expand.

### Specs Codex should read
- `AGENTS.md`
- `docs/spec/03-permissions-matrix.md`
- `docs/spec/04-data-model.md`
- `docs/spec/09-archive-object-schema.md`
- `docs/spec/20-search-and-archive-spec.md`
- `docs/spec/21-backup-and-audit-spec.md`

### Files or assets that must exist first
- Milestones 1 through 3 merged

### Prompt to paste into Codex
```text
Read AGENTS.md and these specs first:
- docs/spec/03-permissions-matrix.md
- docs/spec/04-data-model.md
- docs/spec/09-archive-object-schema.md
- docs/spec/20-search-and-archive-spec.md
- docs/spec/21-backup-and-audit-spec.md

Goal:
Implement the archive and audit foundation that later milestones can reuse.

Required outcomes:
- Add SQLite support and APIs for:
  - archive_records
  - audit_logs
- Add the DM-only /archive page and backend endpoints.
- Support archive, restore, and hard delete for at least:
  - dashboard suspects
  - dashboard notes
  - npc_aliases
- Keep player remove flows as archive actions.
- Keep restore and hard delete DM-only.
- Record audit events for archive, restore, and hard delete actions.
- Make the archive page filterable by content type, user, and date in a simple v1 way.
- Keep the UI safe and explicit around destructive actions.

Scope limits:
- Do not add board archive support yet.
- Do not add map pin archive support yet.
- Do not build global search yet.

Implementation notes:
- Prefer reusable archive helper functions so later milestones can plug in boards, map pins, NPCs, and portraits cleanly.
- Preserve existing active views by filtering archived records out of normal queries.

Before finishing:
- run bash scripts/codex/verify.sh
- summarize changed files
- summarize DB changes
- report verification result honestly
- list open risks
```

### Manual review after Codex finishes
- Player remove actions on suspects, notes, and aliases archive the item.
- Archived items disappear from normal player views.
- DM-only archive page shows archived items.
- DM restore works.
- DM hard delete works.

---

## Milestone 5

### Goal
Turn the board into the real v1 murder-board surface with multi-board support.

### Specs Codex should read
- `AGENTS.md`
- `docs/spec/00-v1-scope.md`
- `docs/spec/03-permissions-matrix.md`
- `docs/spec/04-data-model.md`
- `docs/spec/09-archive-object-schema.md`
- `docs/spec/17-board-v2-spec.md`
- `docs/spec/22-visual-direction.md`
- `docs/spec/14-mobile-rules.md`

### Files or assets that must exist first
- Milestones 1 through 4 merged
- Existing board page and board data in SQLite

### Prompt to paste into Codex
```text
Read AGENTS.md and these specs first:
- docs/spec/00-v1-scope.md
- docs/spec/03-permissions-matrix.md
- docs/spec/04-data-model.md
- docs/spec/09-archive-object-schema.md
- docs/spec/17-board-v2-spec.md
- docs/spec/22-visual-direction.md
- docs/spec/14-mobile-rules.md

Goal:
Implement Board v2 with multiple saved boards per user and a stronger murder-board feel.

Required outcomes:
- Replace the one-board-per-user model with a boards table that supports:
  - multiple boards per user
  - one default board per user
  - create board
  - rename board
  - switch board
  - duplicate board
  - archive board
- Migrate existing board_states data into the new boards model safely.
- Keep DM able to inspect player boards in admin context.
- Move board controls into the canvas surface per spec.
- Add a searchable Add NPC flow.
- Keep Add Note, autosave, manual save, fullscreen, and editable edge labels.
- Make board archive actions use the archive foundation from milestone 4.
- Keep the board visually tactile and crime-board-like.
- Keep the board usable on mobile.

Scope limits:
- Do not build PNG or JSON export yet.
- Do not build search integration beyond the board-local NPC picker.

Implementation notes:
- Keep the app runnable after migration.
- Prefer keeping old board_state data preserved until migration is confirmed.
- Dangerous board-wide actions belong in overflow and confirmation flows.

Before finishing:
- run bash scripts/codex/verify.sh
- summarize changed files
- summarize DB changes
- report verification result honestly
- list open risks
```

### Manual review after Codex finishes
- Each user can create multiple boards.
- One default board per user exists.
- Player can archive a board.
- DM can inspect player boards.
- Board still autosaves and edge labels still edit correctly.

---

## Milestone 6

### Goal
Add the maps page with per-user personal pins.

### Specs Codex should read
- `AGENTS.md`
- `docs/spec/00-v1-scope.md`
- `docs/spec/02-routes-and-nav.md`
- `docs/spec/03-permissions-matrix.md`
- `docs/spec/04-data-model.md`
- `docs/spec/07-map-asset-schema.md`
- `docs/spec/09-archive-object-schema.md`
- `docs/spec/18-maps-page-spec.md`
- `docs/spec/22-visual-direction.md`
- `docs/spec/14-mobile-rules.md`

### Files or assets that must exist first
- Milestones 1 through 5 merged
- `config/maps/*.yml`
- `apps/client/public/maps/overworld-map.png`
- `apps/client/public/maps/inner-ring-map.png`
- `apps/client/public/maps/outer-ring-map.png`

### Prompt to paste into Codex
```text
Read AGENTS.md and these specs first:
- docs/spec/00-v1-scope.md
- docs/spec/02-routes-and-nav.md
- docs/spec/03-permissions-matrix.md
- docs/spec/04-data-model.md
- docs/spec/07-map-asset-schema.md
- docs/spec/09-archive-object-schema.md
- docs/spec/18-maps-page-spec.md
- docs/spec/22-visual-direction.md
- docs/spec/14-mobile-rules.md

Goal:
Implement the /maps page with configured map layers and per-user personal pins.

Required outcomes:
- Build the /maps page.
- Read map metadata from config/maps/*.yml.
- Render the configured map images from the existing public/maps assets.
- Add SQLite support and APIs for map_pins.
- Support:
  - map switching
  - pan and zoom
  - per-user pins
  - pin add
  - pin edit
  - pin archive
- Use normalized coordinates from 0 to 1.
- Keep map pin data private to the owning player in player-facing views.
- Make pin archive actions use the archive foundation from milestone 4.
- Keep the maps UI cleaner than the board UI and mobile-friendly.

Scope limits:
- Do not add shared pins.
- Do not build global search integration yet.
- Do not build DM pin restore inside the maps page.

Before finishing:
- run bash scripts/codex/verify.sh
- summarize changed files
- summarize DB changes
- report verification result honestly
- list open risks
```

### Manual review after Codex finishes
- Maps switch correctly.
- Zoom and pan feel stable.
- Player pins persist per user.
- Pin remove archives the pin.
- One player cannot see another player’s pins.

---

## Milestone 7

### Goal
Build the DM-only import pipeline and in-app NPC editing.

### Specs Codex should read
- `AGENTS.md`
- `docs/spec/03-permissions-matrix.md`
- `docs/spec/04-data-model.md`
- `docs/spec/05-npc-content-import-schema.md`
- `docs/spec/06-npc-asset-schema.md`
- `docs/spec/08-alias-schema.md`
- `docs/spec/13-asset-standards.md`
- `docs/spec/19-dm-tools-spec.md`
- `docs/spec/21-backup-and-audit-spec.md`
- `docs/spec/22-visual-direction.md`

### Files or assets that must exist first
- Milestones 1 through 6 merged
- `fixtures/npcs/*.md`
- `fixtures/npc-images/*`
- Existing uploads folder
- Existing NPC data and aliases tables

### Prompt to paste into Codex
```text
Read AGENTS.md and these specs first:
- docs/spec/03-permissions-matrix.md
- docs/spec/04-data-model.md
- docs/spec/05-npc-content-import-schema.md
- docs/spec/06-npc-asset-schema.md
- docs/spec/08-alias-schema.md
- docs/spec/13-asset-standards.md
- docs/spec/19-dm-tools-spec.md
- docs/spec/21-backup-and-audit-spec.md
- docs/spec/22-visual-direction.md

Goal:
Implement the DM-only import and NPC admin surface based on the current fixtures and import specs.

Required outcomes:
- Build the /dm-tools page and DM-only APIs.
- Add staging upload support for:
  - markdown NPC files
  - portrait files
- Add staging preview with:
  - parsed name
  - slug
  - create/update status
  - matched portrait
  - unmatched files
  - validation issues
- Finalize import should:
  - create on new slug
  - update on matching slug
  - preserve player-owned content
  - preserve personal aliases
  - import canonical aliases
  - store raw markdown body
  - archive replaced portrait assets
  - write import_logs
  - write audit_logs
- Add direct DM in-app NPC editing for the editable scalar fields and canonical aliases.
- Use the existing fixture files as development coverage.
- Retire or replace the legacy import-npc.js behavior so it matches the new schema.

Scope limits:
- Keep changes focused on DM tools and NPC admin flows.
- Do not build global search in this milestone.

Before finishing:
- run bash scripts/codex/verify.sh
- summarize changed files
- summarize DB changes
- report verification result honestly
- list open risks
```

### Manual review after Codex finishes
- Player cannot access `/dm-tools` or its APIs.
- DM can upload fixture markdown and portrait files.
- Staging preview shows correct create/update status.
- Import preserves personal aliases.
- Portrait replacement archives the prior portrait.

---

## Milestone 8

### Goal
Add permission-aware global search.

### Specs Codex should read
- `AGENTS.md`
- `docs/spec/03-permissions-matrix.md`
- `docs/spec/04-data-model.md`
- `docs/spec/08-alias-schema.md`
- `docs/spec/11-search-indexing-rules.md`
- `docs/spec/20-search-and-archive-spec.md`

### Files or assets that must exist first
- Milestones 1 through 7 merged

### Prompt to paste into Codex
```text
Read AGENTS.md and these specs first:
- docs/spec/03-permissions-matrix.md
- docs/spec/04-data-model.md
- docs/spec/08-alias-schema.md
- docs/spec/11-search-indexing-rules.md
- docs/spec/20-search-and-archive-spec.md

Goal:
Implement permission-aware global search for player and DM users.

Required outcomes:
- Add a search entry point in the authenticated shell.
- Add backend search APIs with explicit permission filtering.
- Player search scope should include:
  - visible NPC names and metadata
  - canonical aliases for visible NPCs
  - the player’s personal aliases
  - the player’s dashboard suspects
  - the player’s dashboard notes
  - the player’s map pins
  - published recap content if surfaced in search
- DM search scope should include:
  - all NPCs
  - canonical aliases
  - personal aliases
  - import logs
  - archive_records
  - recap content
  - admin-visible player content
- Keep results understandable and clearly labeled by entity type.
- Do not leak hidden NPCs or another player’s private content into player search results.
- Keep the implementation simple and reliable for v1. SQL-backed search is fine.

Before finishing:
- run bash scripts/codex/verify.sh
- summarize changed files
- summarize DB changes if any
- report verification result honestly
- list open risks
```

### Manual review after Codex finishes
- Player search returns only allowed content.
- Personal alias hits work for the owner.
- Hidden NPCs do not appear in player search.
- DM search can find archive and import items.

---

## Milestone 9

### Goal
Add exports and backup.

### Specs Codex should read
- `AGENTS.md`
- `docs/spec/04-data-model.md`
- `docs/spec/10-export-schema.md`
- `docs/spec/17-board-v2-spec.md`
- `docs/spec/18-maps-page-spec.md`
- `docs/spec/21-backup-and-audit-spec.md`

### Files or assets that must exist first
- Milestones 1 through 8 merged

### Prompt to paste into Codex
```text
Read AGENTS.md and these specs first:
- docs/spec/04-data-model.md
- docs/spec/10-export-schema.md
- docs/spec/17-board-v2-spec.md
- docs/spec/18-maps-page-spec.md
- docs/spec/21-backup-and-audit-spec.md

Goal:
Implement the required v1 export and backup features.

Required outcomes:
- Board export:
  - JSON export
  - PNG export
- Map pin export:
  - JSON export
- Add a DM/admin-controlled local backup workflow that captures:
  - database
  - uploaded portraits
  - map config where needed
- Document backup usage in README or docs where appropriate.
- Write audit log entries for major admin-sensitive export and backup actions where practical.
- Keep file naming stable and timestamped per the specs.

Implementation notes:
- Use the existing board page and maps page as the export entry points where it makes sense.
- Keep the backup workflow simple and local-first for v1.
- A documented server-side backup endpoint or script is acceptable if it is clear and safe.

Before finishing:
- run bash scripts/codex/verify.sh
- summarize changed files
- summarize DB changes if any
- report verification result honestly
- list open risks
```

### Manual review after Codex finishes
- Board JSON export round-trips cleanly.
- Board PNG export looks usable.
- Map pin export contains the right user’s pins.
- DM backup output contains the expected files.

---

## Milestone 10

### Goal
Do the polish, mobile pass, deployment hardening, and acceptance pass.

### Specs Codex should read
- `AGENTS.md`
- `docs/spec/00-v1-scope.md`
- `docs/spec/14-mobile-rules.md`
- `docs/spec/15-acceptance-checklist.md`
- `docs/spec/21-backup-and-audit-spec.md`
- `docs/spec/22-visual-direction.md`

### Files or assets that must exist first
- Milestones 1 through 9 merged
- Existing branding and map assets
- Existing Caddyfile and LAN deployment notes

### Prompt to paste into Codex
```text
Read AGENTS.md and these specs first:
- docs/spec/00-v1-scope.md
- docs/spec/14-mobile-rules.md
- docs/spec/15-acceptance-checklist.md
- docs/spec/21-backup-and-audit-spec.md
- docs/spec/22-visual-direction.md

Goal:
Do the v1 polish and hardening pass so the app feels cohesive and ready for controlled campaign use.

Required outcomes:
- Improve visual polish across the shell, dashboard, directory, detail pages, board, maps, DM tools, and archive.
- Strengthen the murder-board feel on the board page.
- Improve spacing, touch targets, and mobile behavior across the app.
- Review the acceptance checklist and close obvious gaps.
- Remove dead or stale code paths where safe.
- Reconcile legacy leftovers that conflict with the shipped v1 behavior.
- Tighten README and deployment notes for the current LAN and Caddy workflow.
- Keep role safety explicit everywhere.
- Keep the app runnable and mergeable at the end of the pass.

Implementation notes:
- Keep this as a polish and hardening pass. Avoid inventing large new features.
- Favor cleanup, consistency, and acceptance-level fixes.
- If any checklist item remains open, report it plainly in the summary.

Before finishing:
- run bash scripts/codex/verify.sh
- summarize changed files
- summarize DB changes if any
- report verification result honestly
- list open risks and remaining checklist gaps
```

### Manual review after Codex finishes
- Walk the acceptance checklist as DM and as player.
- Check mobile layout on the board, maps, drawer, and directory.
- Confirm DM-only surfaces stay hidden and blocked for players.
- Confirm the app feels consistent, dark, polished, and fae-themed.

## Suggested branch naming

Use clear milestone branch names.

- `feat/codex-shell-routes`
- `feat/codex-dashboard`
- `feat/codex-directory-aliases`
- `feat/codex-archive-foundation`
- `feat/codex-board-v2`
- `feat/codex-maps`
- `feat/codex-dm-tools`
- `feat/codex-search`
- `feat/codex-exports-backup`
- `feat/codex-polish`

## Suggested PR naming

- `Milestone 1: shell and shared routes`
- `Milestone 2: dashboard and recap foundation`
- `Milestone 3: directory privacy and aliases`
- `Milestone 4: archive and audit foundation`
- `Milestone 5: board v2`
- `Milestone 6: maps and personal pins`
- `Milestone 7: DM tools and import flow`
- `Milestone 8: global search`
- `Milestone 9: exports and backup`
- `Milestone 10: polish and acceptance pass`

## Final advice

Keep Codex focused on one milestone at a time. Merge each PR only after manual review. If Codex starts making the same mistake across runs, tighten `AGENTS.md` and add one small corrective note for the next milestone.
