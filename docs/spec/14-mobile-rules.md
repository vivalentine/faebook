# Mobile Interaction Rules v1

## Purpose

Defines mobile-first interaction rules for the drawer, dashboard, board, maps, and detail pages.

## Locked Decisions

- mobile support is required in v1
- drawer is the primary navigation surface on small screens
- board controls live inside the board canvas
- dangerous actions must be hard to trigger accidentally
- map interactions must remain smooth on phones
- settings and sign out stay in the drawer utility row

## Global Mobile Rules

- prioritize large touch targets
- avoid tightly packed destructive actions
- keep primary actions thumb-reachable
- keep visual density lower on mobile than desktop
- preserve legibility in dark mode
- reduce accidental drag and tap conflicts

## Drawer Behavior

- drawer opens from hamburger button
- drawer should close on route change
- drawer should close on outside tap
- utility row stays pinned to the bottom
- `⚙️` stays bottom-left
- `Sign Out` stays bottom-right

## Touch Target Standards

- minimum target size should feel comfortable on phones
- icon-only actions must still have adequate hit area
- destructive actions should have extra separation from nearby actions

## Dashboard Rules

- widgets stack cleanly on small screens
- avoid overly dense multi-column layouts on phones
- longform notes widget should remain easy to type in
- suspect list actions should remain easy to tap without misfires

## NPC Directory Rules

- search bar remains easy to access
- filters collapse cleanly when screen width is limited
- card layouts should stack naturally
- open-page actions remain clear and thumb-friendly

## Board Rules

### Board controls

- floating control cluster stays visible in mobile view
- controls should not block too much canvas space
- overflow menu should hold destructive actions

### Add flows

- `+` opens a mobile-friendly popover, sheet, or menu
- Add NPC should open a searchable picker optimized for touch
- Add Note should be one tap after opening the add menu

### Drag behavior

- require a deliberate drag threshold before moving nodes
- avoid accidental node drags while trying to select or edit
- editing note text should be easy without unwanted dragging

### Fullscreen

- fullscreen should preserve board controls
- fullscreen exit must remain obvious
- autosave status text remains visible

### Delete behavior

- destructive board-wide actions require confirmation
- per-node removal can remain quick but should still feel intentional

## Maps Rules

### Gesture behavior

- pinch zoom supported
- pan supported
- tap to select pin
- long press or explicit add mode can place a pin

### Pin placement

- avoid accidental placement while panning
- pin editor should feel simple on mobile
- delete/archive action should not sit too close to save action

## Detail Page Rules

- portrait should scale cleanly
- metadata chips should wrap naturally
- note editing should remain comfortable on touch keyboards

## Settings Rules

- settings should remain simple in v1
- avoid deeply nested settings on mobile
- preserve clear save/apply behavior if needed

## Mobile Safety Rules

- destructive actions should be moved into overflow or confirmation flows
- board clear action must never be a one-tap mistake
- archive and restore flows in DM/admin surfaces should remain explicit

## Acceptance Rules

Mobile QA should confirm:

- drawer works smoothly
- dashboard is readable
- board control cluster is usable
- searchable NPC picker is usable
- map zoom and pan feel stable
- sign out remains easy to find
