# GitHub Image Preview

An in-page image viewer for GitHub repository README pages, issues, pull requests, reviews, and comments. It turns screenshots, GIFs, and other image attachments into a focused lightbox while keeping the surrounding document or discussion available in the browser tab.

![GitHub Image Preview demo](media/demo.gif)

The project ships as both a Manifest V3 Chromium extension and a standalone userscript. The checked-in bundle has no runtime dependencies and can be installed without a build step.

## What It Does

### In-page viewing

- Intercepts eligible GitHub image links and opens them in a full-screen overlay instead of navigating away.
- Displays the image centered over the current GitHub page with a dark, blurred backdrop.
- Shows the file name, image number, section number, section label, caption, and available posting time.
- Shows a loading state while an image is fetched and a clear error state when it cannot be loaded.
- Preloads the previous and next images to make navigation feel immediate.
- Preserves the browser's normal page when the lightbox is closed, including the user's prior focus target and overflow settings.

### Image navigation

- Moves through all eligible images on the current GitHub page.
- Wraps from the last image to the first and from the first image to the last.
- Groups images by GitHub document or discussion section, including repository README content, issue comments, pull request comments, reviews, timeline items, articles, and explicitly marked custom groups.
- Moves directly between sections while selecting the first image when moving forward and the last image when moving backward.
- Smoothly scrolls the underlying GitHub page to keep the active image's README or discussion section aligned with the lightbox.
- Provides arrow buttons, keyboard navigation, section buttons, and horizontal touch swipes.

### Zooming and panning

- Clicks the image to zoom in around the pointer, then click again to reset.
- Zooms with Ctrl + mouse wheel around the cursor position.
- Provides zoom in, zoom out, and reset controls with a live percentage indicator.
- Supports `+`, `-`, and `0` keyboard shortcuts.
- Supports zoom levels from 100% through 800%.
- Allows drag-to-pan while zoomed in.
- Clamps panning to the image bounds and recalculates the limits when the viewport is resized.

### Interaction and browser behavior

- Closes with `Esc`, the close button, or a click on the empty viewport area.
- Locks page scrolling while the lightbox is open and restores the original overflow settings afterward.
- Restores focus to the element that opened the viewer.
- Uses accessible dialog semantics, labels, focusable controls, visible focus states, and button tooltips.
- Disables image dragging inside the viewer so dragging is reserved for panning.
- Keeps native link behavior for Cmd-click, Ctrl-click, Shift-click, Alt-click, and middle-click.
- Avoids installing itself twice if the generated script is loaded more than once.
- Adapts controls and image spacing for narrow screens; section button labels collapse on mobile widths to preserve space.

## Supported Images

The viewer recognizes direct image links ending in:

```text
.apng  .avif  .bmp  .gif  .jpeg  .jpg  .png  .svg  .webp
```

It also recognizes common GitHub image delivery and attachment URLs:

- `github.com/user-attachments/assets/...`
- GitHub asset paths under `github.com/.../assets/<id>/...`
- `user-images.githubusercontent.com`
- `private-user-images.githubusercontent.com`
- `camo.githubusercontent.com`
- Other `*.githubusercontent.com` image URLs, excluding avatars

Small avatars and other images that do not look like screenshots are ignored to avoid interfering with normal GitHub navigation. Image titles come from useful alt text, link text, or the URL, with file extensions removed from the displayed caption when appropriate.

## Controls

| Action | Controls |
| --- | --- |
| Open an image | Click an eligible README image or GitHub image link |
| Next image | Right arrow, next button, or swipe left |
| Previous image | Left arrow, previous button, or swipe right |
| Next section | Shift + Right arrow or next section button |
| Previous section | Shift + Left arrow or previous section button |
| Zoom in | Click the image, Ctrl + mouse wheel up, `+`, `=`, or zoom-in button |
| Zoom out | Ctrl + mouse wheel down, `-`, or zoom-out button |
| Reset zoom | Click a zoomed image, press `0`, or use the reset button |
| Pan | Drag the image while zoomed in |
| Close | `Esc`, close button, or click outside the image |
| Open normally | Cmd-click, Ctrl-click, Shift-click, Alt-click, or middle-click |

## Installation

### Chromium extension

1. Clone or download this repository.
2. Open the browser's extensions page, such as `chrome://extensions` or `edge://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select the repository folder.
5. Open or refresh a GitHub repository README, issue, pull request, review, or comment page.

The extension injects `github-screenshot-lightbox.user.js` on `https://github.com/*` at document idle. After updating the source or generated bundle, click **Reload** on the extension card and refresh open GitHub tabs.

### Userscript or site script

Install the generated `github-screenshot-lightbox.user.js` file in a userscript manager or browser site-script feature. Use this match pattern:

```text
https://github.com/*
```

The file begins with a standard userscript metadata block and can also be pasted into browser tools that accept raw JavaScript. No package installation is required for end users.

## Development

The TypeScript source is in `src/`, and `scripts/build.ts` bundles `src/index.ts` into the root-level generated userscript. The extension and userscript intentionally share this generated artifact.

Requirements:

- [Bun](https://bun.sh/)

Install dependencies, if needed, and run the build check:

```bash
bun install
bun run check
```

`bun run check` rebuilds the bundle and verifies that the build completed. To build without the extra confirmation, run:

```bash
bun run build
```

The generated `github-screenshot-lightbox.user.js` file is committed intentionally so the repository can be loaded directly as an unpacked extension or installed as a userscript without requiring Bun.

## Project Structure

| Path | Responsibility |
| --- | --- |
| `src/index.ts` | One-time installation entry point |
| `src/lightbox.ts` | Overlay lifecycle, rendering, navigation, input, focus, and scroll behavior |
| `src/github.ts` | GitHub link detection, metadata extraction, grouping, and item collection |
| `src/zoom.ts` | Zoom, pointer-centered scaling, and bounded panning calculations |
| `src/styles.ts` | Isolated lightbox styles and responsive layout |
| `src/icons.ts` | Inline control icons |
| `src/constants.ts` | URL, grouping, zoom, and interaction constants |
| `src/types.ts` | Shared lightbox and grouping types |
| `src/meta.ts` | Userscript metadata and version |
| `scripts/build.ts` | Bun browser bundle build |
| `manifest.json` | Manifest V3 extension configuration |
| `github-screenshot-lightbox.user.js` | Committed generated browser bundle |

## Privacy

The project has no analytics, telemetry, server, account access, background service, or persistent browsing-data store. It runs only on GitHub pages, reads links and image metadata already present in the current document, loads the selected image from its existing URL, and changes the page UI locally.

## License

Released under the MIT License. See [LICENSE](LICENSE).
