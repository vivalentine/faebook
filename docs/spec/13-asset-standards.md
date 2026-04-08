# Asset Standards v1

## Purpose

Defines the visual asset standards for portraits, logos, icons, and maps used across FaeBook.

## Locked Decisions

- dark mode is the default app presentation
- portraits should sit cleanly on dark surfaces
- transparent backgrounds are preferred for portraits
- map metadata lives in file/config
- portrait replacement archives the previous image
- asset naming should be stable and machine-friendly
- the board has a more tactile murder-board visual language than the rest of the app

## General Rules

- use clean, stable filenames
- avoid spaces in asset filenames
- use lowercase kebab-case where possible
- preserve original source files when practical
- prefer predictable dimensions and consistent framing
- keep display assets optimized for web use
- keep generated or derived assets out of source control unless explicitly needed

## Portrait Standards

### Preferred formats

- `png`
- `webp`

### Accepted formats

- `png`
- `webp`
- `jpg`
- `jpeg`

### Preferred portrait behavior

- transparent background preferred
- clean silhouette edges
- no hard white background blocks
- dark-mode friendly presentation
- consistent crop and framing

### Recommended portrait dimensions

- source max: 2048 px on the longest edge
- recommended card/render target can be derived later
- major NPCs should use the same general framing style

### Portrait naming

Recommended:

- `{slug}.png`
- `{slug}.webp`

Examples:

- `empress-titania.png`
- `aoife-gealach.webp`

### Portrait presentation goals

- directory cards feel clean on dark backgrounds
- board nodes feel pinned and tactile
- detail pages feel polished and readable
- no harsh edge contrast against dark UI

## Logo and Icon Standards

### App branding assets

- primary brand mark: fairy logo
- primary product name: `FaeBook`

### Favicon

- use SVG when supported
- keep shape legible at small sizes
- preserve simple silhouette

### Drawer and utility icons

- use a consistent icon style
- keep icon sizing uniform
- maintain clear touch targets on mobile

## Board Visual Assets

### Sticky notes

- selectable color variants
- lightly textured or styled
- clear title/body readability
- support slight rotation in rendering

### NPC photo cards

- photo-card feel
- pin or taped detail can be decorative
- preserve readable text and image contrast

### Board background

- evidence-board / corkboard feel
- warm dark tone
- subtle texture
- avoid noisy patterns that reduce readability

## Map Asset Standards

### Preferred map format

- `png`

### Accepted map formats

- `png`
- `jpg`
- `jpeg`
- `webp`

### Map file expectations

- high enough resolution for zooming
- stable aspect ratio
- no embedded UI labels that conflict with pins if avoidable
- image dimensions must be declared in config

### Map naming

Examples:

- `overworld-map.png`
- `inner-ring-map.png`
- `outer-ring-map.png`

## File Size Guidance

### Portraits

- preferred under 10 MB
- optimize before import when possible

### Maps

- use the lightest file that still holds up under zoom
- optimize large maps before shipping

## Storage Rules

- store uploaded originals when practical
- store canonical app-facing asset path in DB
- archive replaced portrait assets
- keep map image metadata in config files

## Accessibility and Clarity Rules

- important silhouettes should read clearly on dark mode
- text on image surfaces should maintain strong contrast
- favicon and brand mark should remain recognizable at small sizes
