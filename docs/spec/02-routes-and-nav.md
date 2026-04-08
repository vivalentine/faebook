# Routes and Navigation Spec v1

## Navigation Model

FaeBook uses a persistent app shell with a hamburger drawer.

### Drawer Top Section

- Home
- NPC Directory
- Investigation Board
- Maps
- DM Tools, DM only

### Drawer Bottom Utility Row

- `⚙️` on the left
- `Sign Out` on the right

## Post-Login Route

The default post-login destination is:

- `/`

This route loads the Home dashboard.

## Shared Authenticated Routes

### `/`

Home dashboard

### `/directory`

NPC Directory

### `/directory/:slug`

NPC detail page

### `/board`

Investigation Board

### `/maps`

Maps page

### `/settings`

Settings page

## DM-Only Routes

### `/dm-tools`

DM import and admin tools

### `/archive`

DM archive management

Optional later routes may include:

- `/recaps`
- `/imports`
- `/audit`

## Route Visibility Rules

### Player

Visible routes:

- `/`
- `/directory`
- `/directory/:slug`
- `/board`
- `/maps`
- `/settings`

Player users do not see:

- `/dm-tools`
- `/archive`
- other DM-only routes

### DM

Visible routes:

- all shared authenticated routes
- all DM-only routes

## Route Protection Rules

Frontend rules:

- hide DM-only navigation from players
- redirect player users away from DM-only routes

Backend rules:

- reject player access to DM-only endpoints
- never rely on frontend hiding alone

## Navigation UX Rules

- the drawer is the primary navigation surface
- page-level sign-out buttons are removed
- settings lives in the bottom-left utility area
- sign out lives in the bottom-right utility area
- the navigation layout stays consistent across DM and player views

## Page Identity

### Home

Dashboard and recent activity

### NPC Directory

Search and browse NPCs

### Investigation Board

Theory canvas with in-board controls

### Maps

Map viewer with map switching and pins

### DM Tools

Import and admin surface for DM only

### Settings

Personal app preferences

## Future Navigation Rule

As the app grows, DM-only sections stay grouped in the top nav area under the same drawer model.
The bottom utility row remains reserved for settings and sign out.
