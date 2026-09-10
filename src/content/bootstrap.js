/*
 * GHIP bootstrap — the only module with a real "run once" guard. The other
 * content modules just (re)populate window.GHIP properties, which is
 * harmless if this script is ever injected more than once; only the actual
 * side effects here (DOM creation, event listeners) must run exactly once.
 */
(function () {
  "use strict";
  if (window.__ghImagePreviewInstalled) return;
  window.__ghImagePreviewInstalled = true;

  const NS = window.GHIP;
  const { STORAGE_KEY } = NS.CONSTANTS;

  // Per-site enable/disable, set via the popup or options page.
  const state = { enabled: true }; // optimistic default until storage responds

  function refreshEnabledState() {
    if (!(window.chrome && chrome.storage && chrome.storage.local)) return;
    chrome.storage.local.get(STORAGE_KEY, (data) => {
      const sites = (data && data[STORAGE_KEY]) || {};
      const info = sites[location.hostname];
      state.enabled = info ? info.enabled !== false : true;
    });
  }
  refreshEnabledState();

  if (window.chrome && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes[STORAGE_KEY]) return;
      const sites = changes[STORAGE_KEY].newValue || {};
      const info = sites[location.hostname];
      state.enabled = info ? info.enabled !== false : true;
      if (!state.enabled) lightbox.close();
    });
  }

  const lightbox = new NS.Lightbox(state);
})();
