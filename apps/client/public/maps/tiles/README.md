# Map tile assets

Regenerate map tiles after source art changes:

```bash
npm run maps:tiles
```

This script reads source art from `apps/client/public/maps/*.png` and writes Deep Zoom tiles under:

- `apps/client/public/maps/tiles/overworld/`
- `apps/client/public/maps/tiles/inner-ring/`
- `apps/client/public/maps/tiles/outer-ring/`

The generated `.dzi` descriptors are used by the Maps page tiled viewer.
