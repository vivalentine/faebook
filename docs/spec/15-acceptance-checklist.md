# Acceptance Checklist v1

## Global Release Criteria

- app runs successfully
- role-based behavior is enforced in frontend and backend
- no DM-only surfaces leak to player users
- archive-first removal behavior works
- major views are usable on desktop and mobile
- UI feels production-ready and campaign-specific

## Auth and Navigation

- login works
- logout works
- Home is the default post-login route
- drawer navigation works on desktop
- drawer navigation works on mobile
- settings is bottom-left in utility row
- sign out is bottom-right in utility row
- DM Tools is visible only to DM

## Player Permissions

- player cannot access DM Tools from UI
- player cannot access DM Tools by direct URL
- player cannot call DM-only APIs successfully
- player cannot restore archived content
- player cannot hard delete archived content
- player cannot edit canonical NPC data
- player cannot publish or edit recaps

## DM Permissions

- DM can access DM Tools
- DM can import NPC content
- DM can edit NPC cards in-app
- DM can browse archive
- DM can restore archived content
- DM can hard delete archived content
- DM can view player-created aliases and other player-created content in DM/admin views

## Dashboard

### Player dashboard

- suspect list loads
- suspect list saves
- personal notes load
- personal notes save
- latest recap displays read-only
- recent activity surfaces load

### DM dashboard

- DM widgets load
- quick links to player boards work
- recent import surfaces load
- archive activity summary loads
- latest recap is editable in DM flow

## NPC Directory

### Player

- visible NPCs only
- search works
- personal aliases can be added
- personal aliases are searchable
- personal notes can be created and edited
- remove/archive flow works

### DM

- all NPCs visible
- metadata edit works
- portrait replacement works
- prior portrait is archived
- visibility toggle works
- canonical alias editing works
- archive NPC flow works

## Investigation Board

- board opens
- multiple boards per user work
- default board exists
- board switching works
- Add Note works
- Add NPC works
- searchable NPC picker works
- edge label editing works
- save works
- autosave works
- last-saved status updates
- fullscreen works
- clear-board flow requires confirmation
- board archive works
- board export PNG works
- board export JSON works

## Maps

- maps page opens
- layer switching works
- zoom works
- pan works
- add pin works
- edit pin works
- remove/archive pin works
- pin persistence works
- personal pin scope is preserved

## DM Tools

- markdown upload works with sample files
- portrait upload works with sample files
- staging preview works
- slug-based update works
- create flow works
- import log entry is written
- malformed file handling is safe
- player cannot access any DM Tools behavior

## Search

### Player search

- visible NPC search works
- canonical alias search works
- personal alias search works
- suspect search works where surfaced
- personal note search works where surfaced
- map pin search works where surfaced

### DM search

- admin search surfaces work
- canonical and personal aliases can be found
- archive records can be found
- import logs can be found

## Archive

- player remove action creates archive record
- removed content disappears from normal player view
- DM archive browser loads
- DM can restore archived item
- restored item returns correctly
- DM can hard delete archived item
- audit or archive trace is preserved where required

## Visual and UX

- overall dark fae presentation feels consistent
- board reads as a murder-board surface
- portraits sit cleanly on dark backgrounds
- dev-helper copy is removed
- spacing and controls feel intentional
- mobile Chrome usability is acceptable

## Deployment Readiness

- build passes
- environment setup is documented
- backup path is documented
- local deployment is still stable
