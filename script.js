/*
 * GitHub Image Preview
 * In-page lightbox viewer for images on GitHub README, issue, PR, review,
 * and comment pages.
 *
 * Single-file content script (no build step required). Organized into
 * clearly separated sections mirroring: constants, github detection/
 * grouping, zoom/pan math, lightbox UI, and install/bootstrap.
 */
(function () {
  "use strict";

  // ---------------------------------------------------------------------
  // Guard against double-injection
  // ---------------------------------------------------------------------
  if (window.__ghImagePreviewInstalled) return;
  window.__ghImagePreviewInstalled = true;

  // ---------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------
  const IMAGE_EXT_RE = /\.(apng|avif|bmp|gif|jpeg|jpg|png|svg|webp)(\?[^#]*)?(#.*)?$/i;

  const GITHUB_IMAGE_HOST_TEST = (url) => {
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
  };

  const ZOOM_MIN = 1;
  const ZOOM_MAX = 8;
  const ZOOM_STEP = 0.25;
  const ZOOM_CLICK = 2.5;

  const SWIPE_THRESHOLD = 50;

  const SECTION_SELECTOR = [
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
  ].join(",");

  // ---------------------------------------------------------------------
  // GitHub link detection, metadata extraction, grouping
  // ---------------------------------------------------------------------

  function looksLikeAvatarOrIcon(el) {
    if (!el) return false;
    const cls = (el.className && el.className.baseVal) || el.className || "";
    if (typeof cls === "string" && /\bavatar\b|\bemoji\b|\boctinit\b|\bicon\b/i.test(cls)) return true;
    const w = el.getAttribute && (el.getAttribute("width") || "");
    const h = el.getAttribute && (el.getAttribute("height") || "");
    const nw = parseInt(w, 10);
    const nh = parseInt(h, 10);
    if ((nw && nw <= 32) || (nh && nh <= 32)) return true;
    const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    if (rect && rect.width > 0 && rect.width <= 32 && rect.height <= 32) return true;
    return false;
  }

  function extractUrlFromElement(el) {
    if (el.tagName === "IMG") return el.currentSrc || el.src;
    if (el.tagName === "A") return el.href;
    return null;
  }

  function findEligibleTargets(root) {
    const nodes = root.querySelectorAll("img, a[href]");
    const results = [];
    nodes.forEach((el) => {
      const url = extractUrlFromElement(el);
      if (!url) return;
      if (!GITHUB_IMAGE_HOST_TEST(url)) return;
      if (el.tagName === "IMG" && looksLikeAvatarOrIcon(el)) return;
      if (el.tagName === "A") {
        // Skip anchors wrapping avatars (profile pictures link to profiles)
        const img = el.querySelector("img");
        if (img && looksLikeAvatarOrIcon(img) && el.children.length === 1) return;
      }
      results.push(el);
    });
    return results;
  }

  function nearestSection(el) {
    const found = el.closest(SECTION_SELECTOR);
    return found || null;
  }

  function deriveCaption(el, url) {
    let name = "";
    if (el.tagName === "IMG") {
      name = (el.getAttribute("alt") || "").trim();
    } else {
      name = (el.textContent || "").trim();
    }
    if (!name || name === url) {
      try {
        const u = new URL(url, location.href);
        const seg = u.pathname.split("/").filter(Boolean).pop() || u.hostname;
        name = decodeURIComponent(seg).replace(IMAGE_EXT_RE, (m) => m); // keep ext in filename
      } catch (e) {
        name = url;
      }
    }
    return name;
  }

  function displayCaption(rawName) {
    // Strip a trailing extension for the human-facing caption, keep filename separately.
    return rawName.replace(/\.(apng|avif|bmp|gif|jpeg|jpg|png|svg|webp)$/i, "");
  }

  function findPostedTime(sectionEl) {
    if (!sectionEl) return null;
    const t = sectionEl.querySelector("relative-time, time");
    if (!t) return null;
    return t.getAttribute("datetime") || t.textContent || null;
  }

  function sectionLabel(sectionEl, idx) {
    if (!sectionEl) return "Page";
    if (sectionEl.matches("article#readme")) return "README";
    const custom = sectionEl.getAttribute && sectionEl.getAttribute("data-ghip-group");
    if (custom) return custom;
    const author = sectionEl.querySelector(
      ".author, [data-testid='comment-viewer-outer-box'] a[data-hovercard-type='user'], strong a"
    );
    const authorName = author ? author.textContent.trim() : "";
    if (sectionEl.matches(".TimelineItem")) {
      return authorName ? `Event by ${authorName}` : `Timeline event ${idx}`;
    }
    if (sectionEl.matches(".review-comment")) {
      return authorName ? `Review by ${authorName}` : `Review comment ${idx}`;
    }
    if (authorName) return `Comment by ${authorName}`;
    return `Section ${idx}`;
  }

  /**
   * Scans the document for eligible images/links and builds an ordered,
   * grouped collection describing everything the lightbox can navigate.
   */
  function collectItems() {
    const targets = findEligibleTargets(document.body);
    const sectionMap = new Map(); // sectionEl (or null) -> { label, items: [] }
    const order = [];

    targets.forEach((el) => {
      const url = extractUrlFromElement(el);
      const sectionEl = nearestSection(el);
      const key = sectionEl || document.body;
      if (!sectionMap.has(key)) {
        order.push(key);
        sectionMap.set(key, { sectionEl, items: [] });
      }
      const rawName = deriveCaption(el, url);
      sectionMap.get(key).items.push({
        el,
        url,
        rawName,
        caption: displayCaption(rawName),
      });
    });

    const sections = order.map((key, i) => {
      const entry = sectionMap.get(key);
      return {
        sectionEl: entry.sectionEl,
        label: sectionLabel(entry.sectionEl, i + 1),
        postedTime: findPostedTime(entry.sectionEl),
        items: entry.items,
      };
    });

    // Flatten into a single global, ordered list with section indices.
    const flat = [];
    sections.forEach((sec, sIdx) => {
      sec.items.forEach((item, iIdx) => {
        flat.push({
          ...item,
          section: sec,
          sectionIndex: sIdx,
          indexInSection: iIdx,
        });
      });
    });

    return { sections, flat };
  }

  // ---------------------------------------------------------------------
  // Zoom / pan math
  // ---------------------------------------------------------------------

  function clampPan(tx, ty, scale, containerRect, imgNaturalRect) {
    // imgNaturalRect: the image's rendered (unscaled, base-fit) width/height
    const scaledW = imgNaturalRect.width * scale;
    const scaledH = imgNaturalRect.height * scale;
    const maxX = Math.max(0, (scaledW - containerRect.width) / 2);
    const maxY = Math.max(0, (scaledH - containerRect.height) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, tx)),
      y: Math.min(maxY, Math.max(-maxY, ty)),
    };
  }

  // ---------------------------------------------------------------------
  // Lightbox
  // ---------------------------------------------------------------------

  class Lightbox {
    constructor() {
      this.items = [];
      this.index = -1;
      this.scale = 1;
      this.pan = { x: 0, y: 0 };
      this.dragging = false;
      this.dragStart = null;
      this.prevOverflow = "";
      this.openerEl = null;
      this.touchStartX = null;
      this._buildDom();
      this._bindGlobalHandlers();
    }

    _buildDom() {
      const root = document.createElement("div");
      root.className = "ghip-overlay";
      root.setAttribute("role", "dialog");
      root.setAttribute("aria-modal", "true");
      root.setAttribute("aria-label", "Image viewer");
      root.hidden = true;

      root.innerHTML = `
        <div class="ghip-backdrop"></div>
        <div class="ghip-stage">
          <button class="ghip-btn ghip-close" aria-label="Close (Esc)" title="Close (Esc)">${ICONS.close}</button>

          <button class="ghip-btn ghip-nav ghip-prev" aria-label="Previous image" title="Previous image (←)">${ICONS.chevronLeft}</button>
          <button class="ghip-btn ghip-nav ghip-next" aria-label="Next image" title="Next image (→)">${ICONS.chevronRight}</button>

          <div class="ghip-imgwrap">
            <div class="ghip-spinner" hidden></div>
            <div class="ghip-error" hidden>Couldn't load this image.</div>
            <img class="ghip-img" alt="" draggable="false" />
          </div>

          <div class="ghip-sectionnav">
            <button class="ghip-btn ghip-section-prev" aria-label="Previous section" title="Previous section (Shift+←)">
              ${ICONS.chevronLeft}<span class="ghip-section-label-btn">Section</span>
            </button>
            <button class="ghip-btn ghip-section-next" aria-label="Next section" title="Next section (Shift+→)">
              <span class="ghip-section-label-btn">Section</span>${ICONS.chevronRight}
            </button>
          </div>

          <div class="ghip-zoomctl">
            <button class="ghip-btn ghip-zoom-out" aria-label="Zoom out" title="Zoom out (-)">${ICONS.minus}</button>
            <span class="ghip-zoom-pct">100%</span>
            <button class="ghip-btn ghip-zoom-in" aria-label="Zoom in" title="Zoom in (+)">${ICONS.plus}</button>
            <button class="ghip-btn ghip-zoom-reset" aria-label="Reset zoom" title="Reset zoom (0)">${ICONS.reset}</button>
          </div>

          <div class="ghip-caption">
            <div class="ghip-caption-main">
              <span class="ghip-filename"></span>
              <span class="ghip-counter"></span>
            </div>
            <div class="ghip-caption-meta">
              <span class="ghip-section"></span>
              <span class="ghip-time"></span>
            </div>
          </div>
        </div>
      `;
      document.documentElement.appendChild(root);
      this.root = root;
      this.backdrop = root.querySelector(".ghip-backdrop");
      this.imgWrap = root.querySelector(".ghip-imgwrap");
      this.img = root.querySelector(".ghip-img");
      this.spinner = root.querySelector(".ghip-spinner");
      this.errorEl = root.querySelector(".ghip-error");
      this.filenameEl = root.querySelector(".ghip-filename");
      this.counterEl = root.querySelector(".ghip-counter");
      this.sectionEl = root.querySelector(".ghip-section");
      this.timeEl = root.querySelector(".ghip-time");
      this.zoomPctEl = root.querySelector(".ghip-zoom-pct");
      this.sectionPrevLabel = root.querySelector(".ghip-section-prev .ghip-section-label-btn");
      this.sectionNextLabel = root.querySelector(".ghip-section-next .ghip-section-label-btn");

      root.querySelector(".ghip-close").addEventListener("click", () => this.close());
      root.querySelector(".ghip-prev").addEventListener("click", () => this.go(-1));
      root.querySelector(".ghip-next").addEventListener("click", () => this.go(1));
      root.querySelector(".ghip-section-prev").addEventListener("click", () => this.goSection(-1));
      root.querySelector(".ghip-section-next").addEventListener("click", () => this.goSection(1));
      root.querySelector(".ghip-zoom-in").addEventListener("click", () => this.setZoom(this.scale + ZOOM_STEP));
      root.querySelector(".ghip-zoom-out").addEventListener("click", () => this.setZoom(this.scale - ZOOM_STEP));
      root.querySelector(".ghip-zoom-reset").addEventListener("click", () => this.resetZoom());

      this.backdrop.addEventListener("click", () => this.close());
      this.imgWrap.addEventListener("click", (e) => {
        if (e.target !== this.img) return;
        this._toggleClickZoom(e);
      });

      this.img.addEventListener("mousedown", (e) => this._onDragStart(e));
      this.img.addEventListener("dragstart", (e) => e.preventDefault());

      this.imgWrap.addEventListener("wheel", (e) => this._onWheel(e), { passive: false });

      this.imgWrap.addEventListener("touchstart", (e) => this._onTouchStart(e), { passive: true });
      this.imgWrap.addEventListener("touchend", (e) => this._onTouchEnd(e), { passive: true });

      this.img.addEventListener("load", () => this._onImgLoad());
      this.img.addEventListener("error", () => this._onImgError());
    }

    _bindGlobalHandlers() {
      document.addEventListener(
        "click",
        (e) => {
          if (e.defaultPrevented) return;
          if (e.button !== 0) return; // only plain left-click
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // keep native behavior
          const target = e.target.closest("img, a[href]");
          if (!target) return;
          const url = extractUrlFromElement(target);
          if (!url || !GITHUB_IMAGE_HOST_TEST(url)) return;
          if (target.tagName === "IMG" && looksLikeAvatarOrIcon(target)) return;
          e.preventDefault();
          this.openFromElement(target);
        },
        true
      );

      window.addEventListener("keydown", (e) => this._onKeyDown(e));
      window.addEventListener("mousemove", (e) => this._onDragMove(e));
      window.addEventListener("mouseup", () => this._onDragEnd());
      window.addEventListener("resize", () => this._onResize());
    }

    openFromElement(el) {
      const { flat } = collectItems();
      const idx = flat.findIndex((item) => item.el === el);
      if (idx === -1 || flat.length === 0) return;
      this.items = flat;
      this.openerEl = el;
      this._open(idx);
    }

    _open(idx) {
      this.prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      this.root.hidden = false;
      requestAnimationFrame(() => this.root.classList.add("ghip-visible"));
      this._render(idx);
    }

    close() {
      if (this.root.hidden) return;
      this.root.classList.remove("ghip-visible");
      document.body.style.overflow = this.prevOverflow;
      const done = () => {
        this.root.hidden = true;
        this.root.removeEventListener("transitionend", done);
      };
      this.root.addEventListener("transitionend", done);
      setTimeout(done, 250);
      if (this.openerEl && document.contains(this.openerEl) && this.openerEl.focus) {
        this.openerEl.focus();
      }
    }

    go(delta) {
      if (!this.items.length) return;
      const n = this.items.length;
      const next = (this.index + delta + n) % n;
      this._render(next);
    }

    goSection(delta) {
      if (!this.items.length) return;
      const cur = this.items[this.index];
      const sections = [];
      this.items.forEach((it) => {
        if (!sections.includes(it.sectionIndex)) sections.push(it.sectionIndex);
      });
      const curPos = sections.indexOf(cur.sectionIndex);
      const n = sections.length;
      const nextPos = (curPos + delta + n) % n;
      const targetSectionIdx = sections[nextPos];
      let targetItemIdx;
      if (delta > 0) {
        targetItemIdx = this.items.findIndex((it) => it.sectionIndex === targetSectionIdx);
      } else {
        for (let i = this.items.length - 1; i >= 0; i--) {
          if (this.items[i].sectionIndex === targetSectionIdx) {
            targetItemIdx = i;
            break;
          }
        }
      }
      this._render(targetItemIdx);
      this._scrollSectionIntoView(this.items[targetItemIdx].section);
    }

    _scrollSectionIntoView(section) {
      if (section && section.sectionEl && section.sectionEl.scrollIntoView) {
        section.sectionEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }

    _render(idx) {
      this.index = idx;
      const item = this.items[idx];
      this.resetZoom(true);
      this.spinner.hidden = false;
      this.errorEl.hidden = true;
      this.img.style.visibility = "hidden";
      this.img.src = item.url;
      this.img.alt = item.caption || "";

      this.filenameEl.textContent = item.caption;
      this.counterEl.textContent = `Image ${idx + 1} of ${this.items.length}`;
      const secCount = new Set(this.items.map((i) => i.sectionIndex)).size;
      this.sectionEl.textContent = `${item.section.label} (section ${item.sectionIndex + 1} of ${secCount})`;
      this.timeEl.textContent = item.section.postedTime
        ? this._formatTime(item.section.postedTime)
        : "";

      this._preload(idx + 1);
      this._preload(idx - 1);
    }

    _formatTime(raw) {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) {
        return d.toLocaleString();
      }
      return raw;
    }

    _preload(idx) {
      if (!this.items.length) return;
      const n = this.items.length;
      const wrapped = ((idx % n) + n) % n;
      const url = this.items[wrapped].url;
      const img = new Image();
      img.src = url;
    }

    _onImgLoad() {
      this.spinner.hidden = true;
      this.img.style.visibility = "visible";
    }

    _onImgError() {
      this.spinner.hidden = true;
      this.errorEl.hidden = false;
      this.img.style.visibility = "hidden";
    }

    // --- Zoom / pan -----------------------------------------------------

    setZoom(scale, center) {
      const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, scale));
      const containerRect = this.imgWrap.getBoundingClientRect();
      const baseRect = this._baseImgRect();

      if (center) {
        const prevScale = this.scale;
        const ratio = clamped / prevScale;
        const offX = center.x - containerRect.left - containerRect.width / 2 - this.pan.x;
        const offY = center.y - containerRect.top - containerRect.height / 2 - this.pan.y;
        this.pan.x -= offX * (ratio - 1);
        this.pan.y -= offY * (ratio - 1);
      }

      this.scale = clamped;
      const clampedPan = clampPan(this.pan.x, this.pan.y, this.scale, containerRect, baseRect);
      this.pan = clampedPan;
      this._applyTransform();
    }

    resetZoom(silent) {
      this.scale = 1;
      this.pan = { x: 0, y: 0 };
      if (!silent) this._applyTransform();
      else this._applyTransform();
    }

    _baseImgRect() {
      // The image is scaled to fit the wrap via CSS (object-fit: contain
      // semantics achieved through max-width/max-height); measure it.
      const r = this.img.getBoundingClientRect();
      return { width: r.width / this.scale || r.width, height: r.height / this.scale || r.height };
    }

    _applyTransform() {
      this.img.style.transform = `translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.scale})`;
      this.imgWrap.classList.toggle("ghip-zoomed", this.scale > 1);
      this.zoomPctEl.textContent = `${Math.round(this.scale * 100)}%`;
    }

    _toggleClickZoom(e) {
      if (this.scale > 1) {
        this.resetZoom();
      } else {
        this.setZoom(ZOOM_CLICK, { x: e.clientX, y: e.clientY });
      }
    }

    _onWheel(e) {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
      this.setZoom(this.scale + delta, { x: e.clientX, y: e.clientY });
    }

    _onDragStart(e) {
      if (this.scale <= 1) return;
      this.dragging = true;
      this.dragStart = { x: e.clientX, y: e.clientY, panX: this.pan.x, panY: this.pan.y };
      this.imgWrap.classList.add("ghip-dragging");
    }

    _onDragMove(e) {
      if (!this.dragging) return;
      const dx = e.clientX - this.dragStart.x;
      const dy = e.clientY - this.dragStart.y;
      const containerRect = this.imgWrap.getBoundingClientRect();
      const baseRect = this._baseImgRect();
      this.pan = clampPan(this.dragStart.panX + dx, this.dragStart.panY + dy, this.scale, containerRect, baseRect);
      this._applyTransform();
    }

    _onDragEnd() {
      if (!this.dragging) return;
      this.dragging = false;
      this.imgWrap.classList.remove("ghip-dragging");
    }

    _onResize() {
      if (this.root.hidden) return;
      const containerRect = this.imgWrap.getBoundingClientRect();
      const baseRect = this._baseImgRect();
      this.pan = clampPan(this.pan.x, this.pan.y, this.scale, containerRect, baseRect);
      this._applyTransform();
    }

    // --- Touch swipe ------------------------------------------------------

    _onTouchStart(e) {
      if (e.touches.length !== 1) return;
      this.touchStartX = e.touches[0].clientX;
    }

    _onTouchEnd(e) {
      if (this.touchStartX == null) return;
      const endX = (e.changedTouches && e.changedTouches[0].clientX) || this.touchStartX;
      const dx = endX - this.touchStartX;
      this.touchStartX = null;
      if (this.scale > 1) return; // don't hijack panning gestures
      if (dx > SWIPE_THRESHOLD) this.go(-1);
      else if (dx < -SWIPE_THRESHOLD) this.go(1);
    }

    // --- Keyboard ---------------------------------------------------------

    _onKeyDown(e) {
      if (this.root.hidden) return;
      switch (e.key) {
        case "Escape":
          this.close();
          break;
        case "ArrowRight":
          e.preventDefault();
          if (e.shiftKey) this.goSection(1);
          else this.go(1);
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (e.shiftKey) this.goSection(-1);
          else this.go(-1);
          break;
        case "+":
        case "=":
          e.preventDefault();
          this.setZoom(this.scale + ZOOM_STEP);
          break;
        case "-":
          e.preventDefault();
          this.setZoom(this.scale - ZOOM_STEP);
          break;
        case "0":
          e.preventDefault();
          this.resetZoom();
          break;
      }
    }
  }

  // ---------------------------------------------------------------------
  // Icons
  // ---------------------------------------------------------------------
  const ICONS = {
    close:
      '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"></path></svg>',
    chevronLeft:
      '<svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor"><path d="M9.78 12.78a.75.75 0 0 1-1.06 0L4.47 8.53a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 1.06L6.06 8l3.72 3.72a.75.75 0 0 1 0 1.06Z"></path></svg>',
    chevronRight:
      '<svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor"><path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z"></path></svg>',
    plus:
      '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M8 2a.75.75 0 0 1 .75.75V7.25h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5V2.75A.75.75 0 0 1 8 2Z"></path></svg>',
    minus:
      '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M2.75 7.25a.75.75 0 0 0 0 1.5h10.5a.75.75 0 0 0 0-1.5H2.75Z"></path></svg>',
    reset:
      '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M8 2.5a5.5 5.5 0 1 0 5.28 7h-1.57a4 4 0 1 1-.66-4.24L9.5 6.81 14 7V2.5l-1.66 1.66A5.48 5.48 0 0 0 8 2.5Z"></path></svg>',
  };

  // ---------------------------------------------------------------------
  // Bootstrap
  // ---------------------------------------------------------------------
  let lightbox = null;
  function ensureLightbox() {
    if (!lightbox) lightbox = new Lightbox();
    return lightbox;
  }
  ensureLightbox();
})();
