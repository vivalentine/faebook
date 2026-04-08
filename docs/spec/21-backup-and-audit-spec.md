# Backup and Audit Spec v1

## Purpose

Defines v1 backup/export expectations and audit trail behavior.

## Locked Decisions

- backups are smart and required
- board export should exist
- player-facing export exists for working data
- admin-facing backup exists for recovery
- audit surfaces should help the DM understand content changes and recovery events

## Export Scope

### Player-facing exports

- board PNG
- board JSON
- map pin export
- suspect list export
- personal notes export later if practical in v1

### DM-facing exports

- same exports where appropriate
- backup-oriented data access
- future admin export surfaces can expand later

## Backup Scope

### Required v1 backup target

- local backup of application data

### Backup should include

- database
- uploaded portraits
- config-backed map metadata where needed
- important app state required for restore

### Backup ownership

- DM/admin-controlled workflow

## Restore Philosophy

- archive handles routine restore
- backup handles disaster recovery
- v1 can prioritize backup creation over a full self-serve restore UI

## Audit Scope

Audit logs should capture:

- NPC import actions
- NPC edit actions
- visibility changes
- archive events
- restore events
- hard delete events
- recap publish/update events
- major board/admin actions where practical

## Audit Record Expectations

Audit records should include:

- actor
- action type
- object type
- object id where available
- human-readable message
- timestamp

## Dashboard and Admin Surfaces

### DM dashboard can show

- recent imports
- recent archive activity
- recently changed NPCs

### DM tools/admin views can show

- import result history
- archive actions
- recent edits

## Export File Naming Guidance

### Board PNG

- `board-{board-name}-{yyyy-mm-dd-hhmm}.png`

### Board JSON

- `board-{board-name}-{yyyy-mm-dd-hhmm}.json`

### Map pins

- `map-pins-{user}-{yyyy-mm-dd-hhmm}.json`

Naming can be refined in implementation.

## Acceptance Targets

- board PNG export works
- board JSON export works
- map pin export works
- local backup workflow is documented and functional
- audit records are written for major admin-sensitive actions
- DM can review recent activity in at least one admin-facing surface
