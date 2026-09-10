# GitHub Image Preview (Chrome Extension)

An in-page lightbox for images in GitHub READMEs, issues, pull requests,
reviews, and comments. Manifest V3, no build step, no dependencies.

## Install (unpacked)

1. Unzip this folder somewhere on disk.
2. Go to `chrome://extensions`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the unzipped folder.
5. Open (or refresh) any GitHub repo README, issue, PR, review, or comment
   thread.

## Using it

- Click an eligible image (or an image link) to open it in the viewer.
- **← / →** — previous / next image. Wraps at the ends.
- **Shift + ← / →** — jump to the previous / next section (README, a
  comment, a review, a timeline event, ...) and scroll the page to it.
- **Click the image** — zoom in around the pointer; click again to reset.
- **Ctrl + scroll** — zoom around the cursor.
- **+ / − / 0** — zoom in / out / reset.
- Drag to pan while zoomed in.
- Swipe left/right on touch devices to navigate.
- **Esc**, the × button, or a click outside the image — close.
- Cmd/Ctrl/Shift/Alt-click or middle-click an image link — opens normally,
  the viewer stays out of the way.

## What counts as an "eligible" image

Direct links ending in `.apng .avif .bmp .gif .jpeg .jpg .png .svg .webp`,
plus GitHub's own image delivery/attachment hosts (`user-attachments`
asset links, `user-images.githubusercontent.com`,
`private-user-images.githubusercontent.com`, `camo.githubusercontent.com`,
and other `*.githubusercontent.com` hosts). Avatars and small icons are
ignored so normal navigation isn't affected.

## Files

| Path | Responsibility |
| --- | --- |
| `manifest.json` | MV3 extension configuration |
| `content.js` | Detection, grouping, lightbox UI, zoom/pan, keyboard & touch input |
| `styles.css` | Isolated, responsive lightbox styling |
| `icons/` | Toolbar icons |

## Privacy

No analytics, telemetry, network requests, or account access beyond
loading the image URLs already present in the page. Everything runs
locally in the tab.
