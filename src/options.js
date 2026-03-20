// ===================================================================
// Options Page — Calculadora ECOCARDIOGRAMA
// Salva/restaura preferência de modo de exibição
// ===================================================================

const STORAGE_MODE_KEY = "ecoDisplayMode";
const DEFAULT_MODE = "popup";

function showStatus(msg) {
  const el = document.getElementById("status");
  el.textContent = msg;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 2000);
}

function saveMode(mode) {
  chrome.storage.local.set({ [STORAGE_MODE_KEY]: mode }, () => {
    showStatus("Configuração salva!");
    // Notifica o background para aplicar o modo imediatamente
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

document.addEventListener("DOMContentLoaded", () => {
  restoreMode();

  document.querySelectorAll('input[name="displayMode"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      saveMode(e.target.value);
    });
  });
});
