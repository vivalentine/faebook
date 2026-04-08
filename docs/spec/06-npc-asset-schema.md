# NPC Asset Schema v1

## Purpose

This document defines the required standards, matching behavior, storage rules, archive behavior, and validation rules for NPC portrait assets used by FaeBook.

This schema governs:

* NPC portrait upload
* portrait matching during DM import
* direct DM portrait replacement in-app
* portrait storage expectations
* portrait archive behavior
* portrait rendering expectations for dark UI surfaces

This schema does not govern:

* map images
* favicon / branding assets
* session recap media
* player-generated uploads

---

## Scope

This schema applies to:

* DM Tools batch import
* DM Tools single-asset upload
* direct in-app DM portrait replacement
* portrait preview rendering in directory, board, and detail views
* archive handling for replaced portrait assets

---

## Accepted File Types

Supported portrait file extensions:

* `.png`
* `.webp`
* `.jpg`
* `.jpeg`

### Preferred formats

Preferred formats for v1:

* transparent `.png`
* transparent `.webp`

These give the cleanest results on the dark UI and crime-board surfaces.

### Allowed but less preferred

* `.jpg`
* `.jpeg`

These are acceptable for non-transparent portraits, but they should be used only when the image itself is already cleanly framed for a dark background.

---

## Format Policy

### Transparency policy

Transparency is strongly preferred.

Portraits should avoid:

* hard white rectangular backgrounds
* baked-in card frames
* aggressive studio-white backgrounds
* bright edge halos that look harsh on dark UI

### Recommended use by format

* `.png`: best default for transparent portraits and easiest asset handling
* `.webp`: acceptable when transparent export is clean and stable
* `.jpg` / `.jpeg`: acceptable only when transparency is not needed and edges still present cleanly in UI

---

## Portrait Content Standards

### Visual requirements

Portraits should:

* read clearly on dark backgrounds
* have clean silhouette edges
* have no distracting white box around the character
* fit the campaign’s fantasy tone
* remain readable at small card and node sizes

### Recommended content framing

Allowed portrait crops:

* full body
* three-quarter body
* waist-up

Preferred framing for consistency:

* three-quarter body or waist-up for directory and detail use
* enough head and silhouette clarity to still read well in board nodes

### Background expectation

Preferred:

* transparent background

Acceptable:

* very soft dark-compatible background
* subtle painterly backdrop that does not clash with the UI

Avoid:

* hard white background
* bright studio backdrop
* baked mockup / print sheet context
* decorative borders baked into the image

---

## File Constraints

### Recommended maximum dimensions

* longest edge: 2048 px recommended

### Allowed dimensions

* any portrait-oriented or square dimension is allowed if it renders cleanly
* importer should not reject purely on aspect ratio unless the image is unusable

### Maximum file size

* 10 MB per portrait

### Color mode

* standard RGB
* no CMYK source files in v1

---

## Canonical Matching Rules

Portrait assets are matched during import using staged image uploads and metadata from the NPC content file.

### Matching order

1. exact `portrait_filename`
2. exact basename equals NPC slug
3. exact basename equals normalized NPC name
4. no match

### Definitions

#### Exact `portrait_filename`

If the NPC markdown frontmatter includes:

```yaml
portrait_filename: empress-titania.png
```

then the importer first searches staged image uploads for that exact filename.

#### Basename equals slug

If the slug is:

```yaml
slug: empress-titania
```

then importer may match:

* `empress-titania.png`
* `empress-titania.webp`
* `empress-titania.jpg`
* `empress-titania.jpeg`

#### Basename equals normalized name

If the name is:

```yaml
name: Empress Titania
```

normalized name may become:

* `empress-titania`

This is a fallback only.

### Matching priority rule

A direct `portrait_filename` match always wins over slug or name fallback.

---

## Unmatched Asset Behavior

If a portrait cannot be matched:

* NPC import may still succeed
* importer must show an unmatched warning in staging preview
* unmatched portrait file remains available for manual pairing in DM Tools

### Preview state examples

* matched
* unmatched
* duplicate filename conflict
* ambiguous match

---

## Ambiguous Match Behavior

If more than one file could match an NPC:

* auto-commit must not guess
* staging preview must flag ambiguity
* DM must manually choose the correct file before commit if the importer cannot resolve the match deterministically

### Example ambiguous situation

Files uploaded:

* `titania.png`
* `empress-titania.png`

NPC file:

```yaml
name: Empress Titania
slug: empress-titania
```

If `portrait_filename` is not supplied, the slug-based exact basename should still win over name-based ambiguity.

---

## Storage Rules

### Stored asset policy

For each active portrait, the system should store:

* original uploaded asset
* canonical asset path
* original filename
* mime type if available
* upload timestamp
* uploader user id
* associated NPC id

### Storage path behavior

Portrait assets should be stored in a dedicated portrait asset location, separate from generic uploads if possible.

Suggested path pattern:

```text
/uploads/npcs/{slug}/{filename}
```

or

```text
/uploads/npc-portraits/{slug}-{timestamp}.{ext}
```

The implementation may choose either pattern as long as:

* paths stay stable
* replacements do not overwrite history invisibly
* archive restore remains possible

### Filename policy

Stored filenames may be:

* preserved from upload, or
* normalized on ingest

Preferred behavior:

* preserve original filename in metadata
* store canonical server filename safely for deduplication and restore

---

## Replacement Rules

Portrait replacement can happen in two ways:

1. import-based replacement
2. direct DM in-app replacement

### Always-archive rule

If a portrait is replaced:

* previous active portrait is always archived
* new portrait becomes active portrait
* archive entry retains enough metadata to restore later
* audit log entry is required

This is a locked policy for v1.

---

## Archive Behavior

### Archive record requirements

When a portrait is replaced or archived, retain:

* original asset path
* original filename
* file type
* associated NPC id
* archived timestamp
* archived by user id
* source action

  * `import-replacement`
  * `manual-replacement`
  * `npc-archive`
  * `cleanup`

### Restore behavior

DM can restore an archived portrait later from DM/admin views.

Restoring a portrait should:

* make that portrait active again
* archive the currently active portrait if one exists
* create an audit log entry

### Hard delete behavior

Only DM can hard delete archived portrait assets.

Hard delete should:

* remove the archive record
* remove file from storage if safe
* create an audit log entry

---

## Validation Rules

A portrait file is invalid if:

* extension is not supported
* file exceeds max size
* file is unreadable or corrupted
* mime type and file contents disagree in a way the system treats as unsafe
* image decode fails

### Soft warnings

These do not block upload by default:

* no transparency present
* dimensions larger than recommended
* dimensions smaller than recommended
* non-preferred format
* harsh background likely

These warnings are useful in DM preview and admin QA tooling.

---

## Preview Requirements

DM Tools should show portrait preview before commit.

For each portrait, preview should show:

* filename
* matched NPC, if any
* resolution
* file size
* file format
* transparency status if detectable
* warning state
* archive/replacement consequence if replacing an existing portrait

### Suggested preview states

* ready
* matched
* unmatched
* invalid
* replacement
* warning

---

## Transparency Detection

If technically feasible, importer or preview may detect alpha presence.

### Detection use

Transparency detection is for preview and warnings only.

It should not block import.

### Suggested warning copy

* `No transparency detected`
* `Large image; may be resized later`
* `Non-preferred format`
* `Potential bright background`

---

## Rendering Expectations in FaeBook

Portraits must render cleanly in these surfaces:

### NPC Directory card

* readable at card size
* no harsh white block feel
* balanced against dark page background

### NPC detail page

* larger display
* clean edges
* consistent framing

### Investigation board NPC node

* readable at smaller evidence-board scale
* pin/photo styling must still feel natural
* transparency should help the portrait sit cleanly on the board

### DM/admin preview

* show raw asset clearly
* show warnings and metadata

---

## Thumbnail and Derivative Policy

v1 may start with direct use of original asset files.

Future-friendly expectation:

* support thumbnail or optimized derivatives later for performance

### If derivatives are added later

Store:

* original asset
* thumbnail asset
* board/node asset variant if needed

v1 does not require thumbnail generation, but the schema should not block it.

---

## Canonical Metadata Fields

Recommended portrait asset record fields:

* `id`
* `npc_id`
* `asset_path`
* `original_filename`
* `mime_type`
* `file_extension`
* `width`
* `height`
* `file_size_bytes`
* `has_alpha` nullable
* `uploaded_by_user_id`
* `created_at`
* `archived_at` nullable
* `archived_by_user_id` nullable
* `archive_reason` nullable

These may live in:

* a dedicated portrait assets table, or
* NPC row plus archive table
* whichever implementation is simpler, as long as archive/restore is preserved

---

## Import Interaction with NPC Content Schema

Portrait assets are driven by the NPC content schema but remain distinct from it.

### NPC content file controls identity

* `slug`
* `portrait_filename`

### Asset file controls binary media

* actual uploaded image
* preview
* replacement
* archive

Portrait import must never override canonical NPC identity rules.
It only affects the active portrait attached to the already-identified NPC.

---

## Failure Handling

### File-level failure

Reject portrait when:

* unsupported extension
* corrupted file
* over size limit
* unreadable image

### Batch-level behavior

Allow partial success:

* valid portraits proceed
* invalid portraits fail
* unmatched portraits remain available for manual pairing

### Result categories

* `matched`
* `unmatched`
* `invalid`
* `replacement`
* `warning`

---

## Example Good Portrait Cases

### Best case

* transparent PNG
* clean silhouette
* filename exactly matches `portrait_filename`
* dimensions around 2048 px longest edge

### Good case

* transparent WebP
* slug-based filename match
* clean rendering on dark UI

### Acceptable fallback

* JPEG with dark-compatible cropped background
* clean close-up portrait
* no transparency, but still visually acceptable

---

## Example Problem Cases

### White box portrait

* transparent not present
* hard white rectangle background
* acceptable only as temporary fallback
* should produce warning

### Oversized file

* 25 MB PNG
* reject if over configured limit

### Ambiguous filename

* multiple possible matches
* require manual pairing

### Decorative mockup image

* character on product mockup sheet
* reject or warn based on implementation policy
* recommended to reject if clearly not a portrait asset

---

## Locked Decisions

These are final for v1:

* accepted file types: png, webp, jpg, jpeg
* preferred formats: transparent png and transparent webp
* portrait replacement always archives previous image
* unmatched portrait does not block NPC import
* portrait matching uses filename metadata and deterministic fallback rules
* portrait rendering must work well on dark UI surfaces
* DM can restore archived portrait assets
* DM is the only role allowed to hard delete portrait assets from archive

---

## Implementation Notes

A clean portrait ingest flow should look like this:

1. upload portrait files
2. inspect file metadata
3. validate extension and size
4. decode image
5. detect dimensions
6. optionally detect alpha
7. attempt automatic NPC match
8. show preview state
9. allow manual pairing for unmatched or ambiguous files
10. commit create/update
11. archive replaced portrait if needed
12. write audit log
