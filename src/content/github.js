window.GHIP = window.GHIP || {};

(function (NS) {
  "use strict";
  if (NS.collectItems) return;

  const { IMAGE_EXT_RE, SECTION_SELECTOR } = NS.CONSTANTS;
  const githubImageHostTest = NS.githubImageHostTest;

  function looksLikeAvatarOrIcon(el) {
    if (!el) return false;
    const cls = (el.className && el.className.baseVal) || el.className || "";
    if (
      typeof cls === "string" &&
      /\bavatar\b|\bemoji\b|\boctinit\b|\bicon\b/i.test(cls)
    )
      return true;
    const w = el.getAttribute && (el.getAttribute("width") || "");
    const h = el.getAttribute && (el.getAttribute("height") || "");
    const nw = parseInt(w, 10);
    const nh = parseInt(h, 10);
    if ((nw && nw <= 32) || (nh && nh <= 32)) return true;
    const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    if (rect && rect.width > 0 && rect.width <= 32 && rect.height <= 32)
      return true;
    return false;
  }

  function extractUrlFromElement(el) {
    if (el.tagName === "IMG") return el.currentSrc || el.src;
    if (el.tagName === "A") return el.href;
    return null;
  }

  function isHidden(el) {
    const style = window.getComputedStyle(el);
    return style.display === "none" || style.visibility === "hidden";
  }

  function findEligibleTargets(root) {
    const nodes = root.querySelectorAll("img, a[href]");
    const results = [];
    nodes.forEach((el) => {
      const url = extractUrlFromElement(el);
      if (!url) return;
      if (isHidden(el)) return;
      if (!githubImageHostTest(url)) return;
      if (el.tagName === "IMG" && looksLikeAvatarOrIcon(el)) return;
      if (el.tagName === "A") {
        const img = el.querySelector("img");
        if (img && el.children.length === 1)
          return;
      }
      results.push(el);
    });
    return results;
  }

  function nearestSection(el) {
    return el.closest(SECTION_SELECTOR) || null;
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
        name = decodeURIComponent(seg).replace(IMAGE_EXT_RE, (m) => m);
      } catch (e) {
        name = url;
      }
    }
    return name;
  }

  function displayCaption(rawName) {
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
    const custom =
      sectionEl.getAttribute && sectionEl.getAttribute("data-ghip-group");
    if (custom) return custom;
    const author = sectionEl.querySelector(
      ".author, [data-testid='comment-viewer-outer-box'] a[data-hovercard-type='user'], strong a",
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

  function collectItems() {
    const targets = findEligibleTargets(document.body);
    const sectionMap = new Map();
    const order = [];

    targets.forEach((el) => {
      const sectionEl = nearestSection(el);
      if (!sectionEl) return;

      const url = extractUrlFromElement(el);
      const key = sectionEl;
      if (!sectionMap.has(key)) {
        order.push(key);
        sectionMap.set(key, { sectionEl, items: [], seenUrls: new Set() });
      }

      const entry = sectionMap.get(key);
      let absUrl;
      try {
        absUrl = new URL(url, location.href).href;
      } catch (e) {
        absUrl = url;
      }
      if (entry.seenUrls.has(absUrl)) return;   // <-- skip duplicate
      entry.seenUrls.add(absUrl);

      const rawName = deriveCaption(el, url);
      entry.items.push({
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

  NS.extractUrlFromElement = extractUrlFromElement;
  NS.looksLikeAvatarOrIcon = looksLikeAvatarOrIcon;
  NS.collectItems = collectItems;
})(window.GHIP);
