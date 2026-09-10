const BUILTIN_HOST = "github.com";
const STORAGE_KEY = "ghip_sites";

function registrationId(hostname) {
  return `ghip-${hostname}`;
}

async function getSites() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const sites = data[STORAGE_KEY] || {};
  if (!sites[BUILTIN_HOST]) {
    sites[BUILTIN_HOST] = { enabled: true, builtin: true };
  }
  return sites;
}

async function setSites(sites) {
  await chrome.storage.local.set({ [STORAGE_KEY]: sites });
}

chrome.runtime.onInstalled.addListener(async () => {
  const sites = await getSites();
  await setSites(sites);
});

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

async function addCustomSite(hostname) {
  hostname = hostname.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!hostname || hostname === BUILTIN_HOST) {
    return { ok: false, error: "Enter a different domain (github.com is already built in)." };
  }

  const origin = `https://${hostname}/*`;
  let granted = false;
  try {
    granted = await chrome.permissions.request({ origins: [origin] });
  } catch (e) {
    return { ok: false, error: "Permission request failed: " + e.message };
  }
  if (!granted) {
    return { ok: false, error: "Permission was not granted." };
  }

  try {
    const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [registrationId(hostname)] });
    if (existing.length) {
      await chrome.scripting.unregisterContentScripts({ ids: [registrationId(hostname)] });
    }
    await chrome.scripting.registerContentScripts([
      {
        id: registrationId(hostname),
        matches: [origin],
        js: [
          "src/content/constants.js",
          "src/content/github.js",
          "src/content/zoom.js",
          "src/content/icons.js",
          "src/content/lightbox.js",
          "src/content/bootstrap.js",
        ],
        css: ["src/content/styles.css"],
        runAt: "document_idle",
        persistAcrossSessions: true,
      },
    ]);
  } catch (e) {
    return { ok: false, error: "Could not register on that site: " + e.message };
  }

  const sites = await getSites();
  sites[hostname] = { enabled: true, builtin: false };
  await setSites(sites);
  return { ok: true, sites };
}

async function removeCustomSite(hostname) {
  if (hostname === BUILTIN_HOST) return { ok: false, error: "github.com can't be removed, only disabled." };

  try {
    await chrome.scripting.unregisterContentScripts({ ids: [registrationId(hostname)] });
  } catch (e) {
    
  }
  try {
    await chrome.permissions.remove({ origins: [`https://${hostname}/*`] });
  } catch (e) {
    
  }

  const sites = await getSites();
  delete sites[hostname];
  await setSites(sites);
  return { ok: true, sites };
}

async function toggleSite(hostname, enabled) {
  const sites = await getSites();
  if (!sites[hostname]) {
    sites[hostname] = { enabled: !!enabled, builtin: hostname === BUILTIN_HOST };
  } else {
    sites[hostname].enabled = !!enabled;
  }
  await setSites(sites);
  return { ok: true, sites };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg && msg.type) {
      case "ghip_getSites": {
        sendResponse({ ok: true, sites: await getSites() });
        break;
      }
      case "ghip_addSite": {
        sendResponse(await addCustomSite(msg.hostname));
        break;
      }
      case "ghip_removeSite": {
        sendResponse(await removeCustomSite(msg.hostname));
        break;
      }
      case "ghip_toggleSite": {
        sendResponse(await toggleSite(msg.hostname, msg.enabled));
        break;
      }
      default:
        sendResponse({ ok: false, error: "Unknown message" });
    }
  })();
  return true;
});
