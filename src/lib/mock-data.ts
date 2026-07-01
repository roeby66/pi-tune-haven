// Deprecated. All music data now lives in Postgres and is fetched via
// src/lib/music.functions.ts. This file remains only to satisfy stale
// tool references and re-exports the canonical types + formatDuration
// from src/lib/types.ts.
export { formatDuration, placeholderCover, type Song, type Artist } from "@/lib/types";
