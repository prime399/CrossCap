# Export Pipeline Fix Plan

Audit date: 2026-02-21

## Root Cause Analysis

The "stuck on Exporting Video" state is caused by multiple hang paths in the export pipeline where promises can never resolve/reject, leaving the UI permanently in the exporting state.

## Issues by File

### streamingDecoder.ts

| # | Severity | Line(s) | Issue | Fix |
|---|----------|---------|-------|-----|
| 1 | Critical | 131-147 | `getNextFrame()` cancel-check identity comparison `frameResolve === resolve` is always false because `frameResolve` is overwritten by wrapper closure on line 143. Cancellation polling never fires — deadlock window. | Compare against wrapper closure, not original resolve |
| 2 | Medium | 297-298 | Cloned VideoFrame leaked if `onFrame` throws (no try/finally) | Wrap clone+callback in try/finally, close clone on error |
| 3 | Medium | 203-212 | `segmentBuffer` frames leaked if `deliverSegment` throws | Add try/finally around segment delivery + buffer cleanup |

### videoExporter.ts

| # | Severity | Line(s) | Issue | Fix |
|---|----------|---------|-------|-----|
| 4 | Critical | 651-654 | Audio encoder backpressure loop has no stall detection — infinite spin | Add stall timeout matching video encoder pattern |
| 5 | Critical | 681 | Audio encoder flush has no timeout — bare `await` hangs forever | Wrap in `Promise.race` with timeout like video flush |
| 6 | High | 374-378, 641-644 | Encoder error callbacks set `cancelled=true` but don't store the error. User sees "Export cancelled" instead of real error | Add `encoderError` field, store error, check after loops |
| 7 | High | 388 | `latencyMode: "realtime"` degrades export quality — should be `"quality"` for offline export | Change to `"quality"` |
| 8 | Low | 307 | `lastEncoderOutputTime` initialized at construction, not first encode. False-positive stall on slow first keyframe | Initialize to 0, set on first `encode()` call |
| 9 | Low | 249-258 | Flush timeout timer never cleared if flush wins the race | Clear timer on flush success |
| 10 | Low | 193-198 | Silent frame drop when encoder is in error state — export completes with missing frames | Throw error instead of warn |
| 11 | Low | 428 | `pruneMuxingPromises` combined promise missing `.catch()` | Add `.catch(() => undefined)` |

### gifExporter.ts

| # | Severity | Line(s) | Issue | Fix |
|---|----------|---------|-------|-----|
| 12 | Medium | 215-246 | No `error` event handler on gif.js. Worker failures cause 30s hang before stall timer catches it | Add `this.gif.on("error", ...)` handler that rejects immediately |
| 13 | Medium | 260-268 | `cancel()` calls `cleanup()` which destroys renderer while frame callback may be in-flight. Race between check (136) and `await renderFrame` (143) | Remove `cleanup()` from `cancel()`, let `export()` finally handle it (match VideoExporter pattern) |

### VideoEditor.tsx

| # | Severity | Line(s) | Issue | Fix |
|---|----------|---------|-------|-----|
| 14 | Low | 1253 | Inline arrow `onClose` is not referentially stable — re-triggers success animation useEffect. Also doesn't clear `exportProgress`/`exportError` | Use `handleCloseExportDialog` like the export view does |

### frameRenderer.ts

| # | Severity | Line(s) | Issue | Fix |
|---|----------|---------|-------|-----|
| 15 | Medium | 231-272 | Gradient `params.split(",")` breaks on `rgba()` colors with commas inside parens | Use regex-aware split that respects parentheses |
| 16 | Medium | 239 | Linear gradient direction always top-to-bottom, ignores `to right`, `45deg`, etc. | Parse direction from first param |
| 17 | Low | 196-203 | Background image load can hang forever if neither onload nor onerror fires | Add 10s timeout |

## Fix Order

Fixes are independent per file and can be done in parallel:

1. **streamingDecoder.ts** — issues 1, 2, 3
2. **videoExporter.ts** — issues 4, 5, 6, 7, 8, 9, 10, 11
3. **gifExporter.ts** — issues 12, 13
4. **VideoEditor.tsx** — issue 14
5. **frameRenderer.ts** — issues 15, 16, 17

## Verification

After all fixes:
- `biome check .` must pass
- `vitest --run` must pass
- `tsc --noEmit` must pass (or match pre-existing error count)
