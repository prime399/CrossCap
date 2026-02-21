# Export Pipeline Fix Plan

Audit date: 2026-02-21

## Root Cause Analysis

The "stuck on Exporting Video" state was caused by two categories of issues:

1. **OOM from unbounded frame buffering** (PRIMARY) — The VFR→CFR resampling buffered ALL decoded VideoFrames per segment before delivering any. With no trim regions, the entire video is one segment, so ~1000 frames × ~8MB each accumulated in GPU memory, causing OOM/hang.

2. **Multiple hang paths** — Promises that could never resolve/reject, leaving the UI permanently in the exporting state.

## Issues Found and Fixed

### streamingDecoder.ts

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| 1 | Critical | `getNextFrame()` cancel-check identity comparison always false — deadlock window | Fixed |
| 2 | Critical | Entire segment buffered in memory before delivery — OOM on any non-trivial video | Fixed (streaming CFR delivery) |
| 3 | Medium | Cloned VideoFrame leaked if `onFrame` throws | Fixed |
| 4 | Medium | `segmentBuffer` frames leaked if `deliverSegment` throws | Fixed (removed with rewrite) |

### videoExporter.ts

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| 5 | Critical | Audio encoder backpressure loop has no stall detection — infinite spin | Fixed |
| 6 | Critical | Audio encoder flush has no timeout — bare `await` hangs forever | Fixed |
| 7 | High | Encoder error callbacks don't store the error — user sees "Export cancelled" | Fixed |
| 8 | High | `latencyMode: "realtime"` degrades export quality | Fixed → `"quality"` |
| 9 | Low | Flush timeout timer never cleared if flush wins the race | Fixed |
| 10 | Low | Silent frame drop when encoder is in error state | Fixed → throws |
| 11 | Low | `pruneMuxingPromises` combined promise missing `.catch()` | Fixed |

### gifExporter.ts

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| 12 | Medium | No `error` event handler on gif.js — 30s hang on worker failure | Fixed |
| 13 | Medium | `cancel()` destroys renderer while frame callback in-flight | Fixed |

### VideoEditor.tsx

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| 14 | Low | Inline arrow `onClose` not referentially stable | Fixed |

### frameRenderer.ts

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| 15 | Medium | Gradient `params.split(",")` breaks on `rgba()` colors | Fixed |
| 16 | Medium | Linear gradient direction always top-to-bottom | Fixed |
| 17 | Low | Background image load can hang forever | Fixed (10s timeout) |

### editorStore.ts

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| 18 | Medium | `nextZoomId`/`nextTrimId`/`nextAnnotationId` reset to 1 on reload but regions are persisted — duplicate React keys | Fixed (onRehydrateStorage) |

## Commits

```
3b5c293 fix: stream CFR frames instead of buffering entire segment
0ea0f3d fix: derive next region IDs from persisted state on rehydration
f23e8f7 chore: add granular decode-loop logging to diagnose export stalls
815e15a chore: add diagnostic logging to export pipeline
6545d17 fix: resolve export pipeline hangs, improve error propagation and quality
```

## Key Architecture Notes

- **Streaming decoder** uses a sliding window of 2 frames (prev + current) for VFR→CFR conversion. Memory is O(1) not O(n).
- **Encoder backpressure** uses 15s stall timeout for both video and audio encoders.
- **Error propagation** flows: encoder error → `encoderError` field → checked after decode loop and in cancelled check.
- **Muxing errors** propagate via `muxingError` field, checked after `Promise.all(muxingPromises)`.
- **Cancel** sets `this.cancelled = true` and cancels the streaming decoder. Cleanup happens in `export()` finally block, not in `cancel()`.

## Verification

All checks pass:
- `biome check .` — clean (pre-existing `noExplicitAny` in frameRenderer.ts only)
- `vitest --run` — 33/33 pass
- `tsc --noEmit` — clean
