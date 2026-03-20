// ===================================================================
// Background Service Worker — Calculadora ECOCARDIOGRAMA
// Gerencia modo de exibição: tab | popup | sidepanel
// ===================================================================

const STORAGE_MODE_KEY = "ecoDisplayMode";
const DEFAULT_MODE = "popup";

// ---------- Ícone dinâmico via SVG ----------
async function setDynamicIcon() {
  try {
    const url = chrome.runtime.getURL("src/icon.png");
    const resp = await fetch(url);
    const svg = await resp.text();
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const sizes = [16, 48, 128];
    const imageData = {};
    for (const size of sizes) {
      const bmp = await createImageBitmap(blob, {
        resizeWidth: size,
        resizeHeight: size,
        resizeQuality: "high",
      });
      const canvas = new OffscreenCanvas(size, size);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(bmp, 0, 0, size, size);
      imageData[size] = ctx.getImageData(0, 0, size, size);
      bmp.close();
    }
    await chrome.action.setIcon({ imageData });
  } catch (e) {
    // Mantém ícone PNG do manifest como fallback
  }
}

// ---------- Aplicar modo ----------
async function applyMode(mode) {
  if (mode === "popup") {
    await chrome.action.setPopup({ popup: "src/popup.html" });
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
  } else if (mode === "tab") {
    await chrome.action.setPopup({ popup: "" });
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
  } else if (mode === "sidepanel") {
    await chrome.action.setPopup({ popup: "" });
    await chrome.sidePanel.setOptions({
      path: "src/popup.html",
      enabled: true,
    });
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
}

async function getMode() {
  const result = await chrome.storage.local.get(STORAGE_MODE_KEY);
  return result[STORAGE_MODE_KEY] || DEFAULT_MODE;
}

// ---------- Instalação ----------
chrome.runtime.onInstalled.addListener(async () => {
  // Menu de contexto "Opções" no ícone da extensão
  chrome.contextMenus.create({
    id: "openOptions",
    title: "Opções",
    contexts: ["action"],
  });

  // Inicializar modo padrão se não existir
  const mode = await getMode();
  await applyMode(mode);
  await setDynamicIcon();
});

// ---------- Startup (re-aplica modo salvo) ----------
chrome.runtime.onStartup.addListener(async () => {
  const mode = await getMode();
  await applyMode(mode);
  await setDynamicIcon();
});

// ---------- Clique no ícone (dispara só quando popup está vazio) ----------
chrome.action.onClicked.addListener(async (tab) => {
  const mode = await getMode();
  if (mode === "tab") {
    chrome.tabs.create({ url: chrome.runtime.getURL("src/popup.html") });
  }
  // modo "sidepanel" é tratado por openPanelOnActionClick: true
  // modo "popup" não dispara este evento (Chrome abre o popup automaticamente)
});

// ---------- Mensagens internas (troca de modo via popup.js) ----------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === "setMode" && msg.mode) {
    chrome.storage.local.set({ [STORAGE_MODE_KEY]: msg.mode }, async () => {
      await applyMode(msg.mode);
      sendResponse({ success: true });
    });
    return true; // mantém canal aberto para resposta assíncrona
  }
});

// ---------- Menu de contexto ----------
chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === "openOptions") {
    chrome.runtime.openOptionsPage();
  }
});

// ---------- Mensagem da options page ----------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === "modeChanged" && msg.mode) {
    applyMode(msg.mode).then(() => sendResponse({ ok: true }));
    return true; // manter canal aberto para resposta assíncrona
  }
});
