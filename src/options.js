// ===================================================================
// Options Page — Calculadora ECOCARDIOGRAMA
// Salva/restaura preferência de modo de exibição e tema
// ===================================================================

const STORAGE_MODE_KEY = "ecoDisplayMode";
const STORAGE_THEME_KEY = "ecoTheme";
const DEFAULT_MODE = "popup";
const DEFAULT_THEME = "light";

function showStatus(msg) {
  const el = document.getElementById("status");
  el.textContent = msg;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 2000);
}

function saveMode(mode) {
  chrome.storage.local.set({ [STORAGE_MODE_KEY]: mode }, () => {
    showStatus("Configuração salva!");
    chrome.runtime.sendMessage({ action: "modeChanged", mode });
  });
}

function restoreMode() {
  chrome.storage.local.get(STORAGE_MODE_KEY, (result) => {
    const mode = result[STORAGE_MODE_KEY] || DEFAULT_MODE;
    const radio = document.querySelector(
      `input[name="displayMode"][value="${mode}"]`,
    );
    if (radio) radio.checked = true;
  });
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const toggle = document.getElementById("themeToggle");
  if (toggle) toggle.checked = theme === "dark";
}

function saveTheme(theme) {
  chrome.storage.local.set({ [STORAGE_THEME_KEY]: theme }, () => {
    showStatus("Tema salvo!");
  });
}

function restoreTheme() {
  chrome.storage.local.get(STORAGE_THEME_KEY, (result) => {
    applyTheme(result[STORAGE_THEME_KEY] || DEFAULT_THEME);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  restoreMode();
  restoreTheme();

  document.querySelectorAll('input[name="displayMode"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      saveMode(e.target.value);
    });
  });

  const themeToggle = document.getElementById("themeToggle");
  if (themeToggle) {
    themeToggle.addEventListener("change", (e) => {
      const theme = e.target.checked ? "dark" : "light";
      applyTheme(theme);
      saveTheme(theme);
    });
  }
});
