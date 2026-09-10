# GitHub Image Preview

Ever clicked an image in a GitHub README, issue, or pull request and ended
up somewhere else instead? **GitHub Image Preview** keeps the image right
where you are, in a fast in-page lightbox.

Browse screenshots, diagrams, GIFs, and attached images without losing your
place in the conversation.

> Manifest V3 · No build step · No dependencies · Everything runs locally

## What you get

- **Stay in context** — view images in READMEs, issues, pull requests,
  reviews, comments, and timeline events.
- **Move through a page quickly** — use the arrow keys or swipe between
  images, with section-aware navigation when you need it.
- **Inspect the details** — zoom, pan, and pinch without opening another tab.
- **Get out of the way** — modifier-click or middle-click any image link to
  open it normally; the viewer will not intercept it.
- **Works with GitHub Enterprise** — add self-hosted domains when you need
  them, with permission requested only for that site.

## Install

This extension is distributed as an unpacked Chrome extension.

1. Download or unzip this folder somewhere on your computer.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select the `github-image-preview` folder.
5. Open or refresh a GitHub README, issue, pull request, review, or comment
   thread.

That is it. `github.com` is enabled out of the box.

## Use it

Click any eligible image or image link to open the viewer.

| Action | What it does |
| --- | --- |
| `←` / `→` | Previous or next image; wraps at the ends |
| `Shift` + `←` / `→` | Jump to the previous or next page section and scroll to it |
| Click the image | Zoom in around the pointer; click again to reset |
| `Ctrl` + scroll | Zoom around the cursor |
| Pinch with two fingers | Zoom around the pinch midpoint on touch devices |
| `+` / `−` / `0` | Zoom in, zoom out, or reset zoom |
| Drag while zoomed | Pan around the image |
| Swipe left or right | Navigate on touch devices |
| `Esc`, `×`, or click outside | Close the viewer |

Hold `Cmd`/`Ctrl`/`Shift`/`Alt` while clicking an image link, or use the
middle mouse button, to open it normally while leaving the viewer out of the
way.

## GitHub Enterprise

The toolbar popup includes a quick on/off switch for the current site. To
use the extension on a self-hosted **GitHub Enterprise** instance:

1. Open the extension popup on that site.
2. Choose **Manage sites…**, or right-click the extension icon and choose
   **Options**.
3. Add the Enterprise domain and approve Chrome's host permission request.

You can disable or remove sites from the popup or options page at any time.

## What counts as an eligible image

Direct links ending in `.apng .avif .bmp .gif .jpeg .jpg .png .svg .webp`,
plus GitHub's own image delivery/attachment hosts (`user-attachments`
asset links, `user-images.githubusercontent.com`,
`private-user-images.githubusercontent.com`, `camo.githubusercontent.com`,
and other `*.githubusercontent.com` hosts). Avatars and small icons are
ignored so normal navigation isn't affected.

Avatars and small icons are ignored so normal GitHub navigation is not
affected.

## Project structure

```
github-image-preview/
├── manifest.json
├── icons/                  toolbar/extension icons
├── shared/
│   └── ui.css              shared popup + options styling
└── src/
    ├── content/            injected into GitHub pages
    │   ├── constants.js    regexes, tunables, URL eligibility test
    │   ├── github.js       DOM detection, metadata, section grouping
    │   ├── zoom.js         zoom/pan/pinch geometry helpers
    │   ├── icons.js        inline SVG icons for the lightbox controls
    │   ├── lightbox.js     the Lightbox class (UI, nav, input handling)
    │   ├── bootstrap.js    double-injection guard, per-site enable check, init
    │   └── styles.css      isolated, responsive lightbox styling
    ├── background/
    │   └── background.js   per-site state + dynamic registration for custom domains
    ├── popup/
    │   ├── popup.html
    │   └── popup.js         toolbar popup — quick per-site toggle
    └── options/
        ├── options.html
        └── options.js       full site management page
```

The `src/content/*.js` files are loaded by the manifest as separate,
non-module scripts in the order listed above, in the same isolated-world
scope. They share state through a single `window.GHIP` namespace object
instead of a bundler. When you add a custom GitHub Enterprise domain,
`background.js` registers that same file list dynamically so both paths run
identical code.

## Privacy

No analytics. No telemetry. `github.com` is enabled by default and needs no
extra permission. Adding a custom Enterprise domain requests host access
only for that specific domain, used solely to load the same content script
there. Nothing is sent off-device; everything runs locally in the tab.
