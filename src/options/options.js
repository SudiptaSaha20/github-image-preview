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

function siteRow(hostname, info) {
  const input = el("input", { type: "checkbox" });
  input.checked = info.enabled;
  input.addEventListener("change", async () => {
    await sendMessage({ type: "ghip_toggleSite", hostname, enabled: input.checked });
  });

  const label = el(
    "label",
    { class: "ghip-switch" },
    input,
    el("span", { class: "ghip-slider" })
  );

  const meta = el(
    "span",
    { class: "ghip-host" },
    document.createTextNode(hostname + " "),
    info.builtin ? el("span", { class: "ghip-note", text: "(built in)" }) : document.createTextNode("")
  );

  const row = el("div", { class: "ghip-row" }, meta);

  const controls = el("div", { style: "display:flex; align-items:center; gap:10px;" }, label);
  if (!info.builtin) {
    controls.appendChild(
      el("button", {
        class: "ghip-btn ghip-danger",
        text: "Remove",
        onclick: async () => {
          await sendMessage({ type: "ghip_removeSite", hostname });
          renderList();
        },
      })
    );
  }
  row.appendChild(controls);
  return row;
}

async function renderList() {
  const listEl = document.getElementById("sitesList");
  listEl.innerHTML = "";
  const { sites } = await sendMessage({ type: "ghip_getSites" });

  const hostnames = Object.keys(sites).sort((a, b) => {
    if (a === BUILTIN_HOST) return -1;
    if (b === BUILTIN_HOST) return 1;
    return a.localeCompare(b);
  });

  hostnames.forEach((hostname) => {
    listEl.appendChild(siteRow(hostname, sites[hostname]));
  });
}

document.getElementById("addBtn").addEventListener("click", async () => {
  const input = document.getElementById("addInput");
  const errorEl = document.getElementById("addError");
  const hostname = input.value.trim();
  errorEl.textContent = "";
  if (!hostname) return;

  const btn = document.getElementById("addBtn");
  btn.disabled = true;
  const res = await sendMessage({ type: "ghip_addSite", hostname });
  btn.disabled = false;

  if (res.ok) {
    input.value = "";
    renderList();
  } else {
    errorEl.textContent = res.error || "Couldn't add that site.";
  }
});

document.getElementById("addInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("addBtn").click();
});

renderList();
