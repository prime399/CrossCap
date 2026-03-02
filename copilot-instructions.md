# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is CrossCap

CrossCap is a free, open-source desktop screen recording and video editing app (Electron + React + TypeScript). It records screens, applies zoom/crop/annotation effects, and exports to MP4 or GIF. Think simpler Screen Studio alternative.

## Commands

| Task | Command |
|------|---------|
| Dev server | `vite` (run manually in terminal) |
| Build all | `tsc && vite build && electron-builder` |
| Build platform | `pnpm build:mac` / `build:win` / `build:linux` |
| Lint | `biome check .` |
| Lint fix | `biome check --write .` |
| Format | `biome format --write .` |
| Test | `vitest --run` |
| Single test | `vitest --run src/lib/exporter/types.test.ts` |

Build pipeline: `tsc` → Vite bundle → electron-builder. Output: `dist/` (renderer), `dist-electron/` (main process), `release/` (installers).

## Architecture

### Electron multi-window setup

All three windows share one React app (`index.html` → `src/main.tsx` → `App.tsx`). Window type is determined by `?windowType=` query param, not a router.

| Window | Purpose | Created in |
|--------|---------|------------|
| HUD Overlay | Frameless recording control bar | `electron/windows.ts:createHudOverlayWindow` |
| Editor | Main video editing workspace | `electron/windows.ts:createEditorWindow` |
| Source Selector | Screen/app picker dialog | `electron/windows.ts:createSourceSelectorWindow` |

- `electron/main.ts` — app lifecycle, tray icon, macOS menu, recordings directory
- `electron/preload.ts` — `window.electronAPI` via contextBridge (~20 methods)
- `electron/ipc/handlers.ts` — all IPC registrations (screen capture, video storage, cursor telemetry, project save/load)

### Renderer (src/)

**State management:** Zustand store in `src/stores/editorStore.ts` with `persist` middleware for settings (localStorage key: `crosscap_video_editor_settings`). Child components use `useEditorStore(s => s.field)` selectors — no prop drilling for state. Projects serialize to `.crosscap` JSON files.

**Video pipeline:**
- Recording: `hooks/useScreenRecorder.ts` wraps MediaRecorder + desktopCapturer (4K@60fps WebM, codec fallback: AV1 → H264 → VP9 → VP8)
- Preview: PixiJS canvas rendering with GSAP-driven zoom/pan transforms (`components/video-editor/videoPlayback/`)
- Export: `lib/exporter/exportOrchestrator.ts` orchestrates MP4/GIF exports via `runExport()`. Uses `videoExporter.ts` (WebCodecs + mp4box muxer) and `gifExporter.ts` (gif.js), sharing a common `FrameRenderer`. Dimension/bitrate calculation lives in `calculateExportDimensions()`.

**Key directories:**
- `components/ui/` — shadcn/ui primitives (new-york style, Radix-based)
- `components/video-editor/` — domain components (editor, timeline, playback, annotations, settings)
- `components/video-editor/timeline/` — dnd-timeline based timeline editor with zoom region/keyframe management
- `lib/exporter/` — video/GIF export pipeline (orchestrator, muxer, decoder, frame renderer)
- `stores/` — Zustand stores (editorStore)
- `constants/` — shared constants (wallpapers, gradients)

### IPC pattern

Request-response: `ipcMain.handle` / `ipcRenderer.invoke` for most operations. Fire-and-forget: `ipcMain.on` / `ipcRenderer.send` for tray events like stop-recording.

## Tech Stack

- Electron 39, React 18, TypeScript 5.2+, Vite 5 (via vite-plugin-electron)
- Zustand (state management with persist middleware)
- PixiJS 8 (canvas rendering), GSAP 3 (animation), mp4box (muxing), gif.js (GIF export)
- Tailwind CSS 3 + shadcn/ui (Radix primitives)
- Biome (linting + formatting, replaces ESLint/Prettier)
- Vitest + fast-check (testing)

## Conventions

- Biome enforces: tabs, double quotes, 100-char lines, LF endings, `noExplicitAny: error`, `noVar: error`, `useConst: error`
- shadcn/ui components live in `components/ui/`, use `cn()` from `lib/utils.ts` for className merging
- No relative imports with `..` — use `@/` path alias (mapped to `src/`)
- Test files colocated with source: `*.test.ts` pattern
- Electron config: `contextIsolation: true`, `nodeIntegration: false` everywhere

### State management

- Use `useEditorStore` from `@/stores/editorStore` for all editor state — never add new `useState` for settings or regions in VideoEditor.tsx
- Persist-worthy state goes in the store's `partialize` config; transient state (isPlaying, currentTime) stays non-persisted
- Child components read state via selectors: `useEditorStore(s => s.field)`

### Export pipeline

- Export orchestration lives in `lib/exporter/exportOrchestrator.ts` — use `runExport()` and `calculateExportDimensions()` instead of inline logic
- Pure functions (dimension calculations, type utils) belong in `lib/exporter/types.ts` to avoid transitive pixi.js imports in tests

### Shared constants

- Wallpaper paths/count: `@/constants/wallpapers` — never duplicate inline
- Gradient definitions: `@/constants/gradients` — never duplicate inline

### IPC security

- `store-recorded-video`: fileName is sanitized via `path.basename()` and rejects `..`
- `open-external-url`: URL scheme allowlisted to `https:` and `http:` only
- `save-project-file`: existingProjectPath validated to be under recordings dir or home dir

<!-- rtk-instructions v2 -->
# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:
```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)
```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (90-99% savings)
```bash
rtk cargo test          # Cargo test failures only (90%)
rtk vitest run          # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)
```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)
```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)
```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
```

### Files & Search (60-75% savings)
```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%)
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)
```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)
```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)
```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands
```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category | Commands | Typical Savings |
|----------|----------|-----------------|
| Tests | vitest, playwright, cargo test | 90-99% |
| Build | next, tsc, lint, prettier | 70-87% |
| Git | status, log, diff, add, commit | 59-80% |
| GitHub | gh pr, gh run, gh issue | 26-87% |
| Package Managers | pnpm, npm, npx | 70-90% |
| Files | ls, read, grep, find | 60-75% |
| Infrastructure | docker, kubectl | 85% |
| Network | curl, wget | 65-70% |

Overall average: **60-90% token reduction** on common development operations.
<!-- /rtk-instructions -->
