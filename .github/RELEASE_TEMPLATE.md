## What's New

### Features
- **Project Save/Load** — Save and restore your editing sessions as `.openscreen` project files. Use `Ctrl+S` / `Cmd+S` to save, `Ctrl+O` / `Cmd+O` to open.
- **Cursor Telemetry Zoom** — Automatic zoom suggestions based on cursor movement during recording.
- **Audio Export** — MP4 exports now preserve source audio from your recordings.
- **Settings Persistence** — Editor settings (wallpaper, effects, export preferences) are saved to localStorage and restored between sessions.
- **Custom Backgrounds** — Add your own images as video backgrounds alongside the built-in wallpapers.

### Improvements
- Switched from ESLint to Biome for faster linting and formatting
- Refined HUD overlay and launch window styling
- Timeline UX improvements: keyframe snapping, drag behavior, and visual polish
- Added 16:10 aspect ratio support
- Anti-aliasing enabled for smoother video playback

### Fixes
- Fixed stale closure bug in editor state management
- Fixed motion blur defaulting to enabled
- Corrected file path handling across platforms

---

## Downloads

| Platform | File |
|----------|------|
| Windows | `Openscreen-Setup-1.1.3.exe` |
| macOS (Intel) | `Openscreen-Mac-x64-1.1.3-Installer.dmg` |
| macOS (Apple Silicon) | `Openscreen-Mac-arm64-1.1.3-Installer.dmg` |
| Linux | `Openscreen-Linux-1.1.3.AppImage` |

### Installation

**Windows** — Run the `.exe` installer. Windows may show a SmartScreen warning since the app is unsigned — click "More info" then "Run anyway".

**macOS** — Open the `.dmg` and drag Openscreen to Applications. On first launch, right-click the app and select "Open" to bypass Gatekeeper. If you encounter permission issues, grant Full Disk Access in System Settings > Privacy & Security.

**Linux** — Make the AppImage executable and run it:
```bash
chmod +x Openscreen-Linux-1.1.3.AppImage
./Openscreen-Linux-1.1.3.AppImage
```
If you see a sandbox error, run with `--no-sandbox` or see the [troubleshooting guide](../../README.md).
