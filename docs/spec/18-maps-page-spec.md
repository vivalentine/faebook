# Maps Page Spec v1

## Purpose

Defines the Maps page behavior and user experience for v1.

## Locked Decisions

- Maps is a first-class top-level page
- map data is file/config-backed
- map pins are per-user in v1
- players manage their own pins
- player pin removal archives pins
- maps should feel smooth and readable on mobile

## Supported Maps

- Overworld
- Inner Ring
- Outer Ring

## Primary Layout

Maps page includes:

- map viewport
- layer selector
- zoom controls
- reset view control
- pin add/edit flow

## Layer Selector

### Required options

- Overworld
- Inner Ring
- Outer Ring

### Rules

- switching maps should preserve correct config metadata
- preferred last-used map can become a setting later
- layer switch UI should remain simple on mobile

## Viewport Behavior

### Required interactions

- pan
- zoom
- reset view

### View rules

- initial state comes from map config
- zoom is clamped by config values
- map remains readable in dark app shell

## Pins

### v1 scope

- personal pins only

### Pin fields

- title
- note
- category
- x
- y
- map_layer

### Categories

- clue
- lead
- suspect
- danger
- meeting
- theory

### Pin actions

- add
- edit
- archive

## Pin Placement Rules

- use normalized coordinates from 0 to 1
- pin locations should remain stable if the same image is rendered responsively
- accidental placement should be avoided during pan gestures

## Add Pin Flow

Suggested flow:

- explicit add mode or clear add button
- user taps map
- editor opens
- user enters title and optional note
- user selects category
- save creates the pin

## Edit Pin Flow

- tap pin
- open editor
- edit title
- edit note
- edit category
- archive pin

## Archive Rules

- player remove action archives the pin
- player cannot restore archived pins
- DM can restore or hard delete from archive

## Search Expectations

Map pins should be searchable for the owning player in map-relevant or global search contexts if implemented there.

## Mobile Rules

- pinch zoom supported
- pan supported
- controls remain reachable
- pin edit UI remains comfortable on small screens
- map switching remains easy to understand

## Future Extensions

Possible later additions:

- shared party pins
- DM pins
- route overlays
- icon-based pin styles

These are outside v1 scope.
