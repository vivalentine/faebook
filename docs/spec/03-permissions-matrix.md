# Permissions Matrix v1

## Roles

- `dm`
- `player`

## Global Rules

1. Permissions are enforced in UI and backend.
2. DM-only tools never appear to player users.
3. Player-created content is private by default.
4. Player remove actions archive content.
5. Archive management is DM-only.
6. DM can view player-created content in DM/admin views.

## Surface Permissions

### Home Dashboard

#### Player

Can:

- view own dashboard
- edit own suspect list
- edit own personal notes
- view latest recap

Cannot:

- edit recap
- view DM dashboard widgets

#### DM

Can:

- view DM dashboard
- view dashboard admin widgets
- edit recap content

### NPC Directory

#### Player

Can:

- view visible NPCs
- search visible NPCs
- add personal aliases
- edit personal aliases
- archive personal aliases
- add personal notes
- edit personal notes
- archive personal notes

Cannot:

- view hidden NPCs
- edit canonical NPC fields
- edit canonical aliases
- change visibility
- archive NPC records
- import NPCs

#### DM

Can:

- view all NPCs
- edit NPC metadata
- edit canonical aliases
- replace portraits
- change visibility
- archive NPCs
- view player-created aliases and notes in admin contexts

### Investigation Board

#### Player

Can:

- view own boards
- create boards
- switch boards
- duplicate boards
- edit boards
- archive boards
- export own boards
- add/remove nodes and edges on own boards

Cannot:

- restore archived boards
- hard delete archived boards
- access DM-only archive actions

#### DM

Can:

- do all board actions on DM boards
- inspect player boards where supported
- manage archive restore and hard delete
- access admin archive surfaces

### Maps

#### Player

Can:

- view maps
- place personal pins
- edit personal pins
- archive personal pins

Cannot:

- restore archived pins
- hard delete archived pins
- manage other users’ pins

#### DM

Can:

- access DM archive for pins
- restore and hard delete archived pins
- inspect player map content in admin contexts if implemented

### DM Tools

#### Player

Cannot:

- view DM Tools
- access DM Tools routes
- access DM Tools APIs
- import NPC markdown
- import images

#### DM

Can:

- access DM Tools
- upload markdown
- upload portraits
- stage imports
- finalize imports
- review import results

### Archive

#### Player

Can:

- trigger archive behavior through remove actions

Cannot:

- browse archive
- restore
- hard delete
- manage archive records

#### DM

Can:

- browse archive
- filter archive
- restore archived items
- hard delete archived items
- review archive history

### Session Recap

#### Player

Can:

- view latest recap
- view recap content where surfaced

Cannot:

- create recap
- edit recap
- publish recap

#### DM

Can:

- create recap
- edit recap
- publish recap

### Search

#### Player

Can search:

- visible NPCs
- canonical aliases for visible NPCs
- own personal aliases
- own suspects
- own personal notes
- own map pins

Cannot search:

- hidden NPCs
- DM admin data
- archive data
- other players’ private content

#### DM

Can search:

- all NPCs
- canonical aliases
- player-created aliases
- import logs
- archive content
- admin-visible content

## Restore and Hard Delete Rules

### Restore

- DM only

### Hard delete

- DM only

This applies to archived:

- boards
- pins
- notes
- aliases
- NPCs
- portraits
- similar removable records

## Settings

### Player

Can edit own settings

### DM

Can edit own settings

No shared settings management in v1.
