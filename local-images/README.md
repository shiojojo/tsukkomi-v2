# Local image drop zone

**macOS only** — processing uses system `sips` (no npm `sharp` / postinstall).

1. Put photos in **`inbox/`** (any filenames; jpg / png / gif / heic).
2. Run from repo root:

```bash
pnpm upload:images
```

3. Tool converts to **JPEG** (max edge 800px, quality 75 via sips),
   uploads to Storage, then moves each file to **`done/<hash>.jpg`**.

Stdout prints `publicUrl` lines for the sheet「画像」B column.

`--dry-run` uploads nothing and does not move files.
