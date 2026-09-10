window.GHIP = window.GHIP || {};

(function (NS) {
  "use strict";

  const { ZOOM_MIN, ZOOM_MAX, ZOOM_STEP, ZOOM_CLICK, SWIPE_THRESHOLD } = NS.CONSTANTS;
  const { collectItems, extractUrlFromElement, looksLikeAvatarOrIcon } = NS;
  const { clampPan, touchDist, touchMidpoint } = NS;
  const ICONS = NS.ICONS;
  const githubImageHostTest = NS.githubImageHostTest;

  class Lightbox {
    constructor(state) {
      this.state = state;
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

          <div class="ghip-caption" aria-live="polite">
            <div class="ghip-caption-main">
              <span class="ghip-filename"></span>
              <span class="ghip-counter"></span>
            </div>
            <div class="ghip-caption-meta">
              <span class="ghip-section"></span>
              <span class="ghip-time"></span>
            </div>
          </div>

          <div class="ghip-toast" role="status" hidden></div>
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
      this.toastEl = root.querySelector(".ghip-toast");

      root.querySelector(".ghip-close").addEventListener("click", () => this.close());
      root.querySelector(".ghip-prev").addEventListener("click", () => this.go(-1));
      root.querySelector(".ghip-next").addEventListener("click", () => this.go(1));
      root.querySelector(".ghip-section-prev").addEventListener("click", () => this.goSection(-1));
      root.querySelector(".ghip-section-next").addEventListener("click", () => this.goSection(1));
      root.querySelector(".ghip-zoom-in").addEventListener("click", () => this.setZoom(this.scale + ZOOM_STEP));
      root.querySelector(".ghip-zoom-out").addEventListener("click", () => this.setZoom(this.scale - ZOOM_STEP));
      root.querySelector(".ghip-zoom-reset").addEventListener("click", () => this.resetZoom());

      this.imgWrap.addEventListener("click", (e) => {
        if (e.target !== this.img) return;
        if (this._didDrag) {
          this._didDrag = false;
          return;
        }
        this._toggleClickZoom(e);
      });

      this.img.addEventListener("mousedown", (e) => this._onDragStart(e));
      this.img.addEventListener("dragstart", (e) => e.preventDefault());

      this.imgWrap.addEventListener("wheel", (e) => this._onWheel(e), { passive: false });

      this.imgWrap.addEventListener("touchstart", (e) => this._onTouchStart(e), { passive: true });
      this.imgWrap.addEventListener("touchmove", (e) => this._onTouchMove(e), { passive: false });
      this.imgWrap.addEventListener("touchend", (e) => this._onTouchEnd(e), { passive: true });
      this.imgWrap.addEventListener("touchcancel", (e) => this._onTouchEnd(e), { passive: true });

      this.img.addEventListener("load", () => this._onImgLoad());
      this.img.addEventListener("error", () => this._onImgError());
    }

    _bindGlobalHandlers() {
      document.addEventListener(
        "click",
        (e) => {
          if (!this.state.enabled) return;
          if (e.defaultPrevented) return;
          if (!this.root.hidden && this.root.contains(e.target)) return;
          if (e.button !== 0) return;
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          const target = e.target.closest("img, a[href]");
          if (!target) return;
          const url = extractUrlFromElement(target);
          if (!url || !githubImageHostTest(url)) return;
          if (target.tagName === "IMG" && looksLikeAvatarOrIcon(target)) return;
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
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
      const closeBtn = this.root.querySelector(".ghip-close");
      if (closeBtn) closeBtn.focus();
    }

    _focusableEls() {
      return Array.from(this.root.querySelectorAll("button")).filter(
        (el) => !el.disabled && el.offsetParent !== null
      );
    }

    _onTabKey(e) {
      const focusable = this._focusableEls();
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = this.root.getRootNode().activeElement || document.activeElement;
      if (e.shiftKey) {
        if (active === first || !this.root.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !this.root.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
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
      this.resetZoom();
      this.spinner.hidden = false;
      this.errorEl.hidden = true;
      this.img.style.visibility = "hidden";
      this.img.src = item.url;
      this.img.alt = item.caption || "";

      this.filenameEl.textContent = item.caption;
      this.counterEl.textContent = `Image ${idx + 1} of ${this.items.length}`;
      const secCount = new Set(this.items.map((i) => i.sectionIndex)).size;
      this.sectionEl.textContent = `${item.section.label} (section ${item.sectionIndex + 1} of ${secCount})`;
      this.timeEl.textContent = item.section.postedTime ? this._formatTime(item.section.postedTime) : "";

      this._preload(idx + 1);
      this._preload(idx - 1);
      this._updateSectionNavLabels(item);
    }

    _updateSectionNavLabels(item) {
      const sections = [];
      this.items.forEach((it) => {
        if (!sections.find((s) => s.sectionIndex === it.sectionIndex)) {
          sections.push({ sectionIndex: it.sectionIndex, label: it.section.label });
        }
      });
      const curPos = sections.findIndex((s) => s.sectionIndex === item.sectionIndex);
      const n = sections.length;
      const prev = sections[(curPos - 1 + n) % n];
      const next = sections[(curPos + 1) % n];
      const truncate = (s) => (s.length > 22 ? s.slice(0, 21) + "\u2026" : s);
      this.sectionPrevLabel.textContent = n > 1 ? truncate(prev.label) : "Section";
      this.sectionNextLabel.textContent = n > 1 ? truncate(next.label) : "Section";
    }

    _formatTime(raw) {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) return d.toLocaleString();
      return raw;
    }

    _preload(idx) {
      if (!this.items.length) return;
      const n = this.items.length;
      const wrapped = ((idx % n) + n) % n;
      const img = new Image();
      img.src = this.items[wrapped].url;
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

    async _copyImage() {
      const item = this.items[this.index];
      if (!item) return;

      if (!navigator.clipboard || !window.ClipboardItem) {
        this._flashToast("Copy not supported in this browser", true);
        return;
      }

      try {
        const response = await fetch(item.url, { mode: "cors", credentials: "omit" });
        if (!response.ok) throw new Error("Fetch failed: " + response.status);
        const blob = await response.blob();
        const pngBlob = await this._toPngBlob(blob);

        await navigator.clipboard.write([
          new ClipboardItem({ [pngBlob.type]: pngBlob }),
        ]);
        this._flashToast("Copied image");
      } catch (err) {
        console.error("GHIP: copy failed", err);
        this._flashToast("Couldn't copy image", true);
      }
    }

    _toPngBlob(blob) {
      if (blob.type === "image/png") return Promise.resolve(blob);
      return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const imgEl = new Image();
        imgEl.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = imgEl.naturalWidth;
          canvas.height = imgEl.naturalHeight;
          canvas.getContext("2d").drawImage(imgEl, 0, 0);
          canvas.toBlob((pngBlob) => {
            URL.revokeObjectURL(url);
            pngBlob ? resolve(pngBlob) : reject(new Error("Canvas conversion failed"));
          }, "image/png");
        };
        imgEl.onerror = (e) => {
          URL.revokeObjectURL(url);
          reject(e);
        };
        imgEl.src = url;
      });
    }

    _flashToast(message, isError) {
      if (!this.toastEl) return;
      this.toastEl.textContent = message;
      this.toastEl.classList.toggle("ghip-toast-error", !!isError);
      this.toastEl.hidden = false;
      requestAnimationFrame(() => this.toastEl.classList.add("ghip-toast-visible"));
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => {
        this.toastEl.classList.remove("ghip-toast-visible");
        setTimeout(() => { this.toastEl.hidden = true; }, 200);
      }, 1400);
    }

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
      this.pan = clampPan(this.pan.x, this.pan.y, this.scale, containerRect, baseRect);
      this._applyTransform();
    }

    resetZoom() {
      this.scale = 1;
      this.pan = { x: 0, y: 0 };
      this._applyTransform();
    }

    _baseImgRect() {
      const r = this.img.getBoundingClientRect();
      return { width: r.width / this.scale || r.width, height: r.height / this.scale || r.height };
    }

    _applyTransform() {
      this.img.style.transform = `translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.scale})`;
      this.imgWrap.classList.toggle("ghip-zoomed", this.scale > 1);
      this.zoomPctEl.textContent = `${Math.round(this.scale * 100)}%`;
    }

    _toggleClickZoom(e) {
      if (this.scale > 1) this.resetZoom();
      else this.setZoom(ZOOM_CLICK, { x: e.clientX, y: e.clientY });
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
      this._didDrag = false;
      this.dragStart = { x: e.clientX, y: e.clientY, panX: this.pan.x, panY: this.pan.y };
      this.imgWrap.classList.add("ghip-dragging");
    }

    _onDragMove(e) {
      if (!this.dragging) return;
      const dx = e.clientX - this.dragStart.x;
      const dy = e.clientY - this.dragStart.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this._didDrag = true;
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

    _onTouchStart(e) {
      if (e.touches.length === 2) {
        this.touchStartX = null;
        this.touchStartY = null;
        this._pinchLastDist = touchDist(e.touches[0], e.touches[1]);
        return;
      }
      if (e.touches.length === 1) {
        this._pinchLastDist = null;
        this.touchStartX = e.touches[0].clientX;
        this.touchStartY = e.touches[0].clientY;
      }
    }

    _onTouchMove(e) {
      if (e.touches.length === 2 && this._pinchLastDist != null) {
        e.preventDefault();
        const dist = touchDist(e.touches[0], e.touches[1]);
        const ratio = dist / this._pinchLastDist;
        this._pinchLastDist = dist;
        const mid = touchMidpoint(e.touches[0], e.touches[1]);
        this.setZoom(this.scale * ratio, mid);
      }
    }

    _onTouchEnd(e) {
      if (e.touches.length > 0) {
        this._pinchLastDist = null;
        this.touchStartX = null;
        this.touchStartY = null;
        return;
      }
      this._pinchLastDist = null;
      if (this.touchStartX == null) return;
      const t = e.changedTouches && e.changedTouches[0];
      const endX = t ? t.clientX : this.touchStartX;
      const endY = t ? t.clientY : this.touchStartY;
      const dx = endX - this.touchStartX;
      const dy = endY - this.touchStartY;
      this.touchStartX = null;
      this.touchStartY = null;
      if (this.scale > 1) return;
      if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      if (dx > 0) this.go(-1);
      else this.go(1);
    }

    _onKeyDown(e) {
      if (this.root.hidden) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        e.preventDefault();
        this._copyImage();
        return;
      }

      switch (e.key) {
        case "Tab":
          this._onTabKey(e);
          break;
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

  NS.Lightbox = Lightbox;
})(window.GHIP);
