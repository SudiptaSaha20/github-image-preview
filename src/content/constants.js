/*
 * GHIP.constants — shared regexes, tunables, and the URL eligibility test.
 * Loaded first; every other content module reads from window.GHIP.
 */
window.GHIP = window.GHIP || {};

(function (NS) {
  "use strict";
  if (NS.CONSTANTS) return; // already initialized (e.g. injected twice)

  const IMAGE_EXT_RE = /\.(apng|avif|bmp|gif|jpeg|jpg|png|svg|webp)(\?[^#]*)?(#.*)?$/i;

  function githubImageHostTest(url) {
    let u;
    try {
      u = new URL(url, location.href);
    } catch (e) {
      return false;
    }
    const host = u.hostname;
    const path = u.pathname;

    if (IMAGE_EXT_RE.test(path)) return true;

    if (host === "github.com") {
      if (path.includes("/user-attachments/assets/")) return true;
      if (/\/assets\/[^/]+\/?/.test(path)) return true;
      return false;
    }
    if (host === "user-images.githubusercontent.com") return true;
    if (host === "private-user-images.githubusercontent.com") return true;
    if (host === "camo.githubusercontent.com") return true;
    if (host.endsWith(".githubusercontent.com")) {
      if (host === "avatars.githubusercontent.com") return false;
      return true;
    }
    return false;
  }

  NS.CONSTANTS = {
    IMAGE_EXT_RE,
    ZOOM_MIN: 1,
    ZOOM_MAX: 8,
    ZOOM_STEP: 0.25,
    ZOOM_CLICK: 2.5,
    SWIPE_THRESHOLD: 50,
    STORAGE_KEY: "ghip_sites",
    SECTION_SELECTOR: [
      "article#readme",
      ".markdown-body",
      ".TimelineItem",
      ".review-comment",
      ".js-comment-container",
      ".js-timeline-item",
      "[data-testid='comment-viewer-outer-box']",
      "[data-testid='issue-body']",
      "[data-testid='timeline-comment']",
      "[data-ghip-group]",
    ].join(","),
  };

  NS.githubImageHostTest = githubImageHostTest;
})(window.GHIP);
