# Map Asset Schema v1

## Purpose

This document defines the file, metadata, coordinate, rendering, and persistence rules for map assets used by FaeBook.

This schema governs:

* map source image files
* map metadata config
* map layer identity
* pin coordinate behavior
* zoom and viewport defaults
* map rendering expectations
* future-proofing for pin persistence across image updates

This schema does not govern:

* NPC portrait assets
* favicon or branding assets
* board image export
* recap media

---

## Scope

This schema applies to:

* Overworld map
* Inner Ring map
* Outer Ring map
* future additional map layers if added later

This schema also governs how user pins attach to those maps.

---

## Map Model

Each map layer in FaeBook is a configured asset with:

* a stable `map_id`
* a human-readable `label`
* a source image file
* size metadata
* viewport metadata
* zoom limits

In v1, map metadata lives in file/config, not in the database.

---

## Required Map Layers for v1

These map layers are in scope:

* `overworld`
* `inner-ring`
* `outer-ring`

These are the only required map IDs for v1.

---

## Source Image File Types

Supported file extensions:

* `.png`
* `.jpg`
* `.jpeg`
* `.webp`

### Preferred format

Preferred format for v1:

* `.png`

PNG is preferred because:

* it is simple to manage
* it is predictable for detailed map art
* it avoids format surprises during testing and deployment

### Acceptable alternatives

* `.jpg`
* `.jpeg`
* `.webp`

These are acceptable if image quality and rendering are clean.

---

## Source Image Requirements

### Visual quality requirements

Map source files should:

* render clearly at multiple zoom levels
* have stable aspect ratios
* avoid blurry compressed text
* preserve fine location details
* remain readable on desktop and mobile

### Recommended dimensions

Maps should use large source images.

Recommended baseline:

* 2048 px to 4096 px on the longest edge

Larger is acceptable if performance remains stable.

### File size guidance

There is no hard v1 limit required in this doc, but source images should remain practical for browser loading.
Recommended target:

* under 20 MB per map image

---

## Map Metadata Config

Each map must have a config entry.

### Required metadata fields

```yaml id="4pv48e"
map_id:
label:
image_filename:
width:
height:
default_zoom:
min_zoom:
max_zoom:
```

### Field definitions

#### `map_id`

Stable canonical identifier for the map.

Rules:

* required
* lowercase kebab-case or simple lowercase token
* unique across all maps
* used for routing, persistence, and pin association

Allowed values in v1:

* `overworld`
* `inner-ring`
* `outer-ring`

#### `label`

Human-readable display label.

Examples:

* `Overworld`
* `Inner Ring`
* `Outer Ring`

Rules:

* required
* string
* max 80 characters

#### `image_filename`

The filename of the map source image.

Rules:

* required
* string
* exact filename
* max 255 characters

#### `width`

Source image width in pixels.

Rules:

* required
* positive integer

#### `height`

Source image height in pixels.

Rules:

* required
* positive integer

#### `default_zoom`

Initial zoom value when the map opens.

Rules:

* required
* positive number

#### `min_zoom`

Lowest allowed zoom.

Rules:

* required
* positive number

#### `max_zoom`

Highest allowed zoom.

Rules:

* required
* positive number
* must be greater than `min_zoom`

---

## Optional Metadata Fields

```yaml id="eczk88"
origin_x:
origin_y:
background_color:
pin_scale:
default_center_x:
default_center_y:
```

### Optional field definitions

#### `origin_x`

Optional coordinate origin reference.

Rules:

* number
* default 0

#### `origin_y`

Optional coordinate origin reference.

Rules:

* number
* default 0

#### `background_color`

Optional fallback background color behind the map.

Rules:

* CSS-compatible color string
* optional

#### `pin_scale`

Optional display multiplier for pins on this map.

Rules:

* positive number
* default 1

#### `default_center_x`

Optional normalized x center for initial viewport.

Rules:

* number from 0 to 1

#### `default_center_y`

Optional normalized y center for initial viewport.

Rules:

* number from 0 to 1

---

## Example Config Entry

```yaml id="mkdb4r"
map_id: inner-ring
label: Inner Ring
image_filename: inner-ring-map.png
width: 4096
height: 4096
default_zoom: 1
min_zoom: 0.5
max_zoom: 4
pin_scale: 1
default_center_x: 0.5
default_center_y: 0.5
```

---

## Coordinate System

This is one of the most important locked decisions in the schema.

### Pin coordinates use normalized values

Pins must be stored using normalized decimal coordinates rather than raw pixel positions.

Each pin stores:

* `x`
* `y`

Both values are normalized from 0 to 1 relative to the source image dimensions.

### Meaning

* `x = 0` is the far left edge
* `x = 1` is the far right edge
* `y = 0` is the top edge
* `y = 1` is the bottom edge

### Example

A pin placed in the center of the map:

```json id="4a7zs0"
{
  "x": 0.5,
  "y": 0.5
}
```

### Why normalized coordinates are required

This preserves pin placement when:

* source image dimensions change
* responsive layout changes
* zoom level changes
* map rendering is resized on mobile or desktop

### Prohibited storage model

Do not store pins as raw pixel coordinates tied only to current render size.

---

## Viewport Rules

### Default viewport

Each map opens at:

* configured default zoom
* configured default center if provided
* otherwise centered on the map

### Zoom behavior

Map UI must enforce:

* `min_zoom`
* `max_zoom`

### Reset behavior

Reset view should restore:

* default center
* default zoom

---

## Map Rendering Rules

### Rendering requirements

Map viewer must support:

* pan
* zoom
* reset
* pin placement
* pin editing
* pin deletion

### Layout behavior

The map viewer should:

* preserve source aspect ratio
* avoid distortion
* allow letterboxing if needed
* keep pins visually attached to map coordinates during zoom and pan

### Background treatment

If the image does not fill the visible frame, the viewer may use:

* `background_color` from config
* otherwise a neutral dark UI-compatible fallback

---

## Pin Model Relationship to Maps

Pins belong to:

* one user
* one map layer

### Required pin linkage field

Each pin must store:

* `map_layer` or `map_id`

The value must match a configured `map_id`.

### v1 pin scope

Pins are personal per-user in v1.

There is no shared pin layer in v1.

---

## Pin Categories

Recommended pin categories for v1:

* `clue`
* `lead`
* `suspect`
* `danger`
* `meeting`
* `theory`

These are content-layer categories, not map-layer types.

### Category rules

* stored as short string
* validated against allowed list in v1
* future category expansion allowed

---

## Pin Rendering Rules

Pins should remain legible at varying zoom levels.

### Pin behavior

Pins should:

* remain anchored to normalized coordinates
* scale visually in a predictable way
* remain tappable on mobile
* allow label editing without drifting from the anchor point

### Label behavior

Pin title and note editing should not alter anchor coordinates.

---

## Map Config File Behavior

Because map metadata lives in file/config in v1, the app must load map definitions from a config source.

### Acceptable config forms

* JSON file
* YAML file
* TypeScript or JavaScript config object

### Preferred v1 approach

A single checked-in config file is acceptable and preferred for simplicity.

Example:

```json id="f4b4q7"
[
  {
    "map_id": "overworld",
    "label": "Overworld",
    "image_filename": "overworld-map.png",
    "width": 4096,
    "height": 3072,
    "default_zoom": 1,
    "min_zoom": 0.5,
    "max_zoom": 4
  }
]
```

---

## Validation Rules

A map config entry is invalid if:

* `map_id` missing
* `label` missing
* `image_filename` missing
* `width` missing
* `height` missing
* `default_zoom` missing
* `min_zoom` missing
* `max_zoom` missing
* duplicate `map_id`
* duplicate `image_filename` in the same config if not intentional
* `width <= 0`
* `height <= 0`
* `min_zoom <= 0`
* `max_zoom <= min_zoom`

A map asset file is invalid if:

* unsupported extension
* image file missing
* file unreadable
* file corrupted
* image dimensions do not match config metadata, if strict validation is enabled

### Recommended v1 behavior for dimension mismatch

Treat as warning during development and admin preview.
Allow strict rejection later if desired.

---

## Missing Asset Behavior

If a map config exists but the image file is missing:

* map must not silently render a broken surface
* UI should show a clear DM-facing or user-facing error state
* missing map should not crash the app

Suggested error state:

* `Map asset unavailable`

---

## Image Update Behavior

If a map source image is replaced later:

* `map_id` must remain stable
* normalized pins should remain attached correctly
* config metadata should be updated if dimensions change
* reset view should continue to use configured defaults

This is one of the main reasons normalized pin coordinates are required.

---

## Archive Interaction

Maps themselves are config assets in v1, so archive behavior applies primarily to pins, not base map definitions.

### In v1

* map definitions are config-managed
* pins are user content
* pin removal archives the pin
* DM manages archive restore and hard delete

### Future option

If map source images become editable or replaceable in-app later, image asset archiving can be added under a separate map-asset archive model.

---

## Search Interaction

Map metadata itself is not a primary search surface in v1.

Pin content is searchable.

### Searchable pin fields

* title
* note
* category

### Player search

Players search only their own map pins.

### DM search

DM may search all user pin content if that capability is later exposed in DM/admin views.

---

## Performance Expectations

Map viewer should remain usable on:

* desktop Chrome
* mobile Chrome

### v1 performance expectations

* smooth pan
* reasonable zoom responsiveness
* no severe lag when switching map layers
* pin count should remain workable at normal campaign scale

### Future performance options

If needed later:

* image tiling
* lazy loading
* downscaled preview layers
* thumbnail preloading

None of these are required for v1.

---

## Mobile Interaction Rules

Map schema needs to align with mobile behavior.

### Expected interactions

* tap to select pin
* tap or long press to place pin, implementation choice
* pinch to zoom
* drag to pan
* pin edit UI must remain usable on small screens

### Requirement

Pin placement logic must always convert touch position into normalized map coordinates.

---

## Naming Rules

### `map_id`

Recommended pattern:

```text id="7dqk4w"
^[a-z0-9]+(?:-[a-z0-9]+)*$
```

Examples:

* `overworld`
* `inner-ring`
* `outer-ring`

### `image_filename`

Should match the actual stored asset filename exactly.

Recommended naming examples:

* `overworld-map.png`
* `inner-ring-map.png`
* `outer-ring-map.png`

---

## Example Full Config

```yaml id="h19wlx"
- map_id: overworld
  label: Overworld
  image_filename: overworld-map.png
  width: 4096
  height: 3072
  default_zoom: 1
  min_zoom: 0.5
  max_zoom: 4
  pin_scale: 1
  default_center_x: 0.5
  default_center_y: 0.5

- map_id: inner-ring
  label: Inner Ring
  image_filename: inner-ring-map.png
  width: 4096
  height: 4096
  default_zoom: 1
  min_zoom: 0.5
  max_zoom: 4
  pin_scale: 1
  default_center_x: 0.5
  default_center_y: 0.5

- map_id: outer-ring
  label: Outer Ring
  image_filename: outer-ring-map.png
  width: 4096
  height: 4096
  default_zoom: 1
  min_zoom: 0.5
  max_zoom: 4
  pin_scale: 1
  default_center_x: 0.5
  default_center_y: 0.5
```

---

## Locked Decisions

These decisions are final for v1:

* map metadata lives in file/config
* required maps are Overworld, Inner Ring, and Outer Ring
* PNG is the preferred map source format
* pins use normalized coordinates from 0 to 1
* maps are config assets, not player-managed content
* pins are personal per-user in v1
* map viewer supports pan, zoom, reset, and pin management
* source image replacement must preserve pin positioning through normalized coordinates

---

## Non-Goals for v1

This schema does not include:

* collaborative shared pin layers
* public map publishing
* live synced party map annotations
* map image editing inside the app
* image tiling engine
* GIS-style coordinate systems
* complex geospatial projections

---

## Implementation Notes

A clean map setup flow should look like this:

1. place source map images in the map asset directory
2. define each map in config
3. validate filenames and metadata on app start or DM/admin load
4. render map layers using config
5. store pins with normalized coordinates
6. convert click/tap positions into normalized coordinates
7. restore pins correctly at any zoom or viewport size
