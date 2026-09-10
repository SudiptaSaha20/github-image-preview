/*
 * GHIP.ICONS — inline SVG markup for the lightbox's control buttons.
 */
window.GHIP = window.GHIP || {};

(function (NS) {
  "use strict";
  if (NS.ICONS) return; // already initialized

  NS.ICONS = {
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
})(window.GHIP);
