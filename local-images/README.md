# Local image drop zone

1. Put photos in **`inbox/`** (any filenames / jpg・png・webp・gif・heic OK).
2. Run from repo root:

```bash
pnpm upload:images
```

3. Tool always converts to **JPEG** (max edge 800px, quality 75, EXIF stripped),
   uploads to Storage, then moves each file to **`done/<hash>.jpg`**
   (same name as Storage). No manual rename / Mac export needed.

Stdout prints `publicUrl` lines for the sheet「画像」B column.

`--dry-run` uploads nothing and does not move files.
