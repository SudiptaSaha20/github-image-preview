const BUILTIN_HOST = "github.com";

function sendMessage(msg) {
  return chrome.runtime.sendMessage(msg);
}

function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([k, v]) => {
    if (k === "text") node.textContent = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  });
  children.forEach((c) => node.appendChild(c));
  return node;
}

function switchRow(hostname, checked, onChange) {
  const input = el("input", { type: "checkbox" });
  input.checked = checked;
  input.addEventListener("change", () => onChange(input.checked));
  const label = el(
    "label",
    { class: "ghip-switch" },
    input,
    el("span", { class: "ghip-slider" })
  );
  return el(
    "div",
    { class: "ghip-row" },
    el("span", { class: "ghip-host", text: hostname }),
    label
  );
}

async function getActiveTabHostname() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) return null;
  try {
    const u = new URL(tab.url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.hostname;
  } catch (e) {
    return null;
  }
}

async function render() {
  const content = document.getElementById("content");
  content.innerHTML = "";

  const hostname = await getActiveTabHostname();
  if (!hostname) {
    content.appendChild(
      el("p", { class: "ghip-muted", text: "Open a GitHub page to control this extension for it." })
    );
    return;
  }

  const { sites } = await sendMessage({ type: "ghip_getSites" });
  const known = sites[hostname];

  if (known) {
    content.appendChild(
      switchRow(hostname, known.enabled, async (checked) => {
        await sendMessage({ type: "ghip_toggleSite", hostname, enabled: checked });
      })
    );
    content.appendChild(
      el("p", {
        class: "ghip-note",
        text:
          hostname === BUILTIN_HOST
            ? "Built in — works out of the box."
            : "Enabled for this GitHub Enterprise site.",
      })
    );
    if (!known.builtin) {
      content.appendChild(
        el("button", {
          class: "ghip-btn ghip-danger",
          text: "Remove this site",
          onclick: async () => {
            await sendMessage({ type: "ghip_removeSite", hostname });
            render();
          },
        })
      );
    }
    return;
  }

  // Unknown host — offer to add it (e.g. a GitHub Enterprise instance).
  content.appendChild(
    el(
      "p",
      { class: "ghip-note" },
      document.createTextNode(
        `${hostname} isn't set up yet. If this is a GitHub Enterprise ` +
          `instance, you can turn on the image viewer for it.`
      )
    )
  );
  const errorEl = el("p", { class: "ghip-error" });
  content.appendChild(
    el("button", {
      class: "ghip-btn ghip-primary",
      text: `Enable on ${hostname}`,
      onclick: async (e) => {
        e.target.disabled = true;
        errorEl.textContent = "";
        const res = await sendMessage({ type: "ghip_addSite", hostname });
        if (res.ok) {
          render();
        } else {
          errorEl.textContent = res.error || "Couldn't enable it.";
          e.target.disabled = false;
        }
      },
    })
  );
  content.appendChild(errorEl);
}

document.getElementById("openOptions").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

render();
