# DM Tools Spec v1

## Purpose

Defines the DM-only administration surface for importing and managing NPC content.

## Locked Decisions

- DM Tools is DM-only in nav, route, and API
- markdown body content is stored raw in v1
- slug is the stable NPC identity for import/update
- portrait replacement archives the old portrait
- player-created content is preserved during NPC updates
- DM can edit NPCs directly in-app

## Access Rules

### Player

- cannot see DM Tools
- cannot access DM Tools route
- cannot call DM Tools APIs

### DM

- full access to DM Tools surface and APIs

## Core Features

### 1. Markdown import

- accept `.md` NPC files
- parse YAML frontmatter
- stage data before commit

### 2. Portrait import

- accept portrait images
- stage portrait pairing
- support manual pairing if needed

### 3. Staging preview

Preview should show:

- parsed NPC name
- slug
- create or update status
- matched portrait
- unmatched files
- validation issues

### 4. Finalize import

- create new NPC on new slug
- update existing NPC on matching slug
- preserve player-owned data
- archive replaced portrait if applicable

### 5. Import results report

Result categories:

- created
- updated
- skipped
- errored

### 6. Import audit trail

Each import action should write a log entry.

## Import Input Sources

### Required v1 support

- drag-and-drop upload
- file picker upload

### Files

- markdown files
- portrait files

## Matching Rules

Use schema docs as source of truth.

Expected order:

1. slug match
2. exact portrait filename match if declared
3. basename-to-slug fallback
4. unmatched files remain in staging preview

## Validation Rules

Reject or flag:

- missing required frontmatter
- missing slug
- invalid slug
- duplicate slug in same batch
- invalid visibility value
- unsupported file type

## Direct NPC Editing

DM Tools or DM admin views should support direct edit actions for NPC data.

### Editable fields

- name
- rank title
- house
- faction
- court
- ring
- introduced in
- met summary
- short blurb
- canonical aliases
- visibility
- portrait

### Additional admin info

- source file label
- source filename
- last import result later if surfaced
- archive state in admin contexts

## Safety Rules

- imports must never overwrite player-created aliases
- imports must never remove player-owned notes or personal content
- imports should preserve stable slug identity
- changes should be auditable

## Required Fixtures for Development

DM Tools should be built and tested against:

- sample markdown NPC files
- sample portrait files
- mixed create/update cases
- malformed file case

## Acceptance Targets

- DM can upload markdown
- DM can upload portraits
- staging preview works
- create flow works
- update flow works
- portrait replacement archives prior image
- malformed files fail safely
- players cannot access any DM Tools behavior
