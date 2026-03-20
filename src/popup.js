// ===================================================================
// Cálculo ECO — Chrome Extension
// ===================================================================

document.addEventListener("DOMContentLoaded", () => {
  initDisplayMode();
  initTheme();
  initTabs();
  initCalculations();
  initCopyButtons();
  initLaudo();
  initClearButton();
  initBottomBar();
  initRecovery();
  initPersistence();
});

// ===================== MODO DE EXIBIÇÃO =====================
function initDisplayMode() {
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get("ecoDisplayMode", (result) => {
      const mode = result.ecoDisplayMode || "popup";
      document.body.dataset.mode = mode;
      document.documentElement.dataset.mode = mode;
      updateModeButtons(mode);
    });
  } else {
    const mode = window.innerWidth < 900 ? "popup" : "tab";
    document.body.dataset.mode = mode;
    document.documentElement.dataset.mode = mode;
    updateModeButtons(mode);
  }
}

// ===================== TEMA =====================
function initTheme() {
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme || "light";
    updateThemeIcon(theme || "light");
  }
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get("ecoTheme", (result) => {
      applyTheme(result.ecoTheme || "light");
    });
    // Atualiza tema em tempo real quando mudar nas opções
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.ecoTheme) {
        applyTheme(changes.ecoTheme.newValue || "light");
      }
    });
  }
}

// ===================== ABAS =====================
function initTabs() {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".tab")
        .forEach((t) => t.classList.remove("active"));
      document
        .querySelectorAll(".tab-content")
        .forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
    });
  });
}

// ===================== CÁLCULOS =====================
function initCalculations() {
  // Todos os inputs que disparam recalculo
  const triggerIds = [
    "peso",
    "aorta",
    "atrioEsquerdo",
    "volAtrioEsquerdo",
    "ddf",
    "dsf",
    "septo",
    "pp",
    "volAtrioDireito",
  ];

  triggerIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", recalculate);
  });

  const alturaEl = document.getElementById("altura");
  if (alturaEl) {
    alturaEl.dataset.digits = "";

    // Mapa: posição do cursor no display → índice no buffer de dígitos
    function _altDisplayToDigit(p, n) {
      if (n === 0) return 0;
      if (n === 1) return p <= 3 ? 0 : 1; // "0,0d"
      if (n === 2) return p <= 2 ? 0 : p === 3 ? 1 : 2; // "0,d0d1"
      return p === 0 ? 0 : p <= 2 ? 1 : p === 3 ? 2 : 3; // "d0,d1d2"
    }

    // Mapa: índice no buffer de dígitos → posição do cursor no display
    function _altDigitToDisplay(d, n) {
      if (n === 0) return 0;
      if (n === 1) return d === 0 ? 3 : 4;
      if (n === 2) return d === 0 ? 2 : d === 1 ? 3 : 4;
      return d === 0 ? 0 : d === 1 ? 2 : d === 2 ? 3 : 4;
    }

    alturaEl.addEventListener("keydown", function (e) {
      if (["Tab", "ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
        return;
      if (e.ctrlKey || e.metaKey) return; // permite Ctrl+A, Ctrl+C, etc.

      e.preventDefault();

      const digits = (this.dataset.digits || "").split("");
      const n = digits.length;
      const sStart = this.selectionStart;
      const sEnd = this.selectionEnd;

      let dcStart = _altDisplayToDigit(sStart, n);
      let dcEnd = _altDisplayToDigit(sEnd, n);

      let arr = [...digits];
      let newDc;

      if (e.key === "Backspace") {
        if (dcStart !== dcEnd) {
          arr.splice(dcStart, dcEnd - dcStart);
          newDc = dcStart;
        } else if (dcStart > 0) {
          arr.splice(dcStart - 1, 1);
          newDc = dcStart - 1;
        } else {
          newDc = 0;
        }
      } else if (e.key === "Delete") {
        if (dcStart !== dcEnd) {
          arr.splice(dcStart, dcEnd - dcStart);
          newDc = dcStart;
        } else if (dcStart < n) {
          arr.splice(dcStart, 1);
          newDc = dcStart;
        } else {
          newDc = dcStart;
        }
      } else if (/^\d$/.test(e.key)) {
        // Apaga seleção primeiro
        if (dcStart !== dcEnd) arr.splice(dcStart, dcEnd - dcStart);
        if (arr.length < 3) {
          arr.splice(dcStart, 0, e.key);
          newDc = dcStart + 1;
        } else {
          newDc = dcStart;
        }
      } else {
        return;
      }

      this.dataset.digits = arr.join("");
      _renderAltura(this);

      const newN = arr.length;
      const newPos = _altDigitToDisplay(newDc, newN);
      this.setSelectionRange(newPos, newPos);

      recalculate();
    });

    alturaEl.addEventListener("paste", function (e) {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData)
        .getData("text")
        .replace(/\D/g, "")
        .slice(0, 3);
      this.dataset.digits = text;
      _renderAltura(this);
      recalculate();
    });
  }

  recalculate();
}

function getNum(id) {
  const raw = document.getElementById(id)?.value ?? "";
  const v = parseFloat(raw.replace(",", "."));
  return isNaN(v) ? 0 : v;
}

function setCalc(id, value, decimals = 2) {
  const el = document.getElementById(id);
  if (!el) return;
  if (value === null || !isFinite(value)) {
    el.value = "";
  } else {
    el.value = value.toFixed(decimals).replace(".", ",");
  }
}

function recalculate() {
  const peso = getNum("peso");
  const alturaCm = getNum("altura") * 100; // converter m -> cm
  const alturaM = getNum("altura");

  // 1. BSA (DuBois)
  let bsa = 0;
  if (peso > 0 && alturaCm > 0) {
    bsa = 0.007184 * Math.pow(peso, 0.425) * Math.pow(alturaCm, 0.725);
  }
  setCalc("bsa", bsa > 0 ? bsa : null);

  // Câmaras Esquerdas — valores em mm (inputs)
  const aorta = getNum("aorta");
  const ae = getNum("atrioEsquerdo");
  const volAE = getNum("volAtrioEsquerdo");
  const ddfMm = getNum("ddf");
  const dsfMm = getNum("dsf");
  const septoMm = getNum("septo");
  const ppMm = getNum("pp");

  // Converter mm -> cm para fórmulas de volume (Teichholz) e massa
  const ddfCm = ddfMm / 10;
  const dsfCm = dsfMm / 10;
  const septoCm = septoMm / 10;
  const ppCm = ppMm / 10;

  // 2. Índice de Vol. Átrio Esquerdo = volAE / BSA
  setCalc("indVolAtrioEsq", bsa > 0 && volAE > 0 ? volAE / bsa : null);

  // 3. DDF/SC = DDF(mm) / BSA
  setCalc("ddfSc", bsa > 0 && ddfMm > 0 ? ddfMm / bsa : null);

  // 4. Relação AE/Aorta
  setCalc("relAeAorta", aorta > 0 && ae > 0 ? ae / aorta : null);

  // 5. VDF (Teichholz) = (7 / (2.4 + D)) * D^3, D em cm
  let vdf = null;
  if (ddfCm > 0) {
    vdf = (7 / (2.4 + ddfCm)) * Math.pow(ddfCm, 3);
  }
  setCalc("vdf", vdf);

  // 6. VDF/SC = VDF / BSA
  setCalc("vdfSc", vdf !== null && bsa > 0 ? vdf / bsa : null);

  // 7. VSF (Teichholz) = (7 / (2.4 + D)) * D^3, D em cm (DSF)
  let vsf = null;
  if (dsfCm > 0) {
    vsf = (7 / (2.4 + dsfCm)) * Math.pow(dsfCm, 3);
  }
  setCalc("vsf", vsf);

  // 8. Fração de Ejeção (Modo M) = ((VDF - VSF) / VDF) * 100
  setCalc(
    "feModoM",
    vdf !== null && vsf !== null && vdf !== 0
      ? ((vdf - vsf) / vdf) * 100
      : null,
  );

  // 9. Fração de Encurtamento = ((DDF - DSF) / DDF) * 100
  setCalc(
    "fracEncurt",
    ddfMm > 0 && dsfMm > 0 ? ((ddfMm - dsfMm) / ddfMm) * 100 : null,
  );

  // 10. Massa VE (ASE) = 0.8 * [1.04 * ((DDF + Septo + PP)^3 - DDF^3)] + 0.6
  // Valores em cm
  let massaVE = null;
  if (ddfCm > 0 && septoCm > 0 && ppCm > 0) {
    const soma = ddfCm + septoCm + ppCm;
    massaVE = 0.8 * (1.04 * (Math.pow(soma, 3) - Math.pow(ddfCm, 3))) + 0.6;
  }
  setCalc("massaVE", massaVE);

  // 11. Índice de Massa = Massa / BSA
  setCalc("indMassa", massaVE !== null && bsa > 0 ? massaVE / bsa : null);

  // 12. Volume / Massa = VDF / Massa
  setCalc(
    "volMassa",
    vdf !== null && massaVE !== null && massaVE > 0 ? vdf / massaVE : null,
  );

  // 13. Espessura Relativa = (2 * PP) / DDF (mm)
  setCalc("espRelativa", ppMm > 0 && ddfMm > 0 ? (2 * ppMm) / ddfMm : null);

  // 14. Índice de Vol. Átrio Direito = volAD / BSA
  const volAD = getNum("volAtrioDireito");
  setCalc("indVolAtrioDir", bsa > 0 && volAD > 0 ? volAD / bsa : null);
}

// ===================== COPIAR =====================
function initCopyButtons() {
  document
    .getElementById("btnCopiarLaudoBar")
    .addEventListener("click", copiarTudo);
}

function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg || "Copiado!";
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 2000);
}

function formatVal(id) {
  const el = document.getElementById(id);
  if (!el) return "";
  return el.value || "";
}

// Formata uma linha tabular: "Label:          valor  unidade   V.Ref.: ..."
// labelW: largura da coluna de label, valW: largura da coluna de valor
function fmtRow(label, id, unit, ref, labelW = 44, valW = 10) {
  const val = formatVal(id);
  const labelCol = (label + ":").padEnd(labelW);
  const valCol = val.padStart(valW);
  const unitCol = unit ? ("  " + unit).padEnd(8) : "".padEnd(8);
  const refCol = ref ? "   " + ref : "";
  return labelCol + valCol + unitCol + refCol;
}

function buildMedidasLines() {
  const lines = [];

  // --- Dados gerais ---
  lines.push("Peso:" + formatVal("peso").padStart(12) + "  Kg");
  lines.push("Altura:" + formatVal("altura").padStart(10) + "  m");
  lines.push("Superfície Corpórea:" + formatVal("bsa").padStart(8) + "  m2");
  lines.push("");

  // --- Câmaras Esquerdas ---
  lines.push("Câmaras Esquerdas:");
  lines.push("");
  lines.push(
    fmtRow(
      "Aorta",
      "aorta",
      "mm",
      "V. Ref.: 27-35mm (mulher) / 31-37mm (homem)",
    ),
  );
  lines.push(
    fmtRow(
      "Átrio Esquerdo",
      "atrioEsquerdo",
      "mm",
      "V. Ref.: 27-38mm (mulher) / 30-40mm (homem)",
    ),
  );
  lines.push(
    fmtRow(
      "Vol. Átrio Esquerdo",
      "volAtrioEsquerdo",
      "ml",
      "V. Ref.: 22-52mL (mulher) / 18-58mL (homem)",
    ),
  );
  lines.push(
    fmtRow(
      "Índice de Vol. Átrio Esquerdo",
      "indVolAtrioEsq",
      "ml/m2",
      "V. Ref.: 16-34mL/m2",
    ),
  );
  lines.push(
    fmtRow(
      "VE - Diâmetro Diastólico Final",
      "ddf",
      "mm",
      "V. Ref.: 37,8-52,2mm (mulher) / 42-58,4mm (homem)",
    ),
  );
  lines.push(
    fmtRow(
      "VE - Diâmetro Sistólico Final",
      "dsf",
      "mm",
      "V. Ref.: 21,6-38,4mm (mulher) / 25-39,8mm (homem)",
    ),
  );
  lines.push(
    fmtRow(
      "Septo Interventricular",
      "septo",
      "mm",
      "V. Ref.: 6-9mm (mulher) / 6-10mm (homem)",
    ),
  );
  lines.push(
    fmtRow(
      "Espessura Parede Posterior",
      "pp",
      "mm",
      "V. Ref.: 6-9mm (mulher) / 6-10mm (homem)",
    ),
  );
  lines.push(
    fmtRow(
      "VE - DDF/SC",
      "ddfSc",
      "mm/m2",
      "V. Ref.: 23-31mm/m2 (mulher) / 22-30mm/m2 (homem)",
    ),
  );
  lines.push(
    fmtRow(
      "Relação Átrio Esquerdo / Aorta",
      "relAeAorta",
      "",
      "V. Ref.: 1.0 +- 0.5",
    ),
  );
  lines.push(
    fmtRow(
      "VE - Volume Diastólico Final",
      "vdf",
      "ml",
      "V. Ref.: 46-106ml (mulher) / 62-150ml (homem)",
    ),
  );
  lines.push(
    fmtRow(
      "VE - VDF/SC",
      "vdfSc",
      "ml",
      "V. Ref.: 29-61ml (mulher) / 34-74ml (homem)",
    ),
  );
  lines.push(
    fmtRow(
      "VE - Volume Sistólico Final",
      "vsf",
      "ml",
      "V. Ref.: 14-42ml (mulher) / 21-61ml (homem)",
    ),
  );
  lines.push(
    fmtRow("Fração de Ejeção (Modo M)", "feModoM", "%", "V. Ref.: > 55%"),
  );
  lines.push(
    fmtRow(
      "Fração Ejeção (Biplanar Simpson)",
      "feBiplanar",
      "",
      "V. Ref.: 54-74% (mulher) / 52-72% (homem)",
    ),
  );
  lines.push("");
  lines.push(
    fmtRow("Fração de Encurtamento - AD", "fracEncurt", "%", "V. Ref.: > 30%"),
  );
  lines.push(
    fmtRow(
      "Massa Ventricular Esquerda",
      "massaVE",
      "g",
      "V. Ref.: 67-162g (mulher) / 88-224g (homem)",
    ),
  );
  lines.push(
    fmtRow(
      "Índice de Massa",
      "indMassa",
      "g/m2",
      "V. Ref.: 43-95g/m2 (mulher) / 49-114g/m2 (homem)",
    ),
  );
  lines.push(
    fmtRow("Volume de Massa", "volMassa", "ml/g", "V. Ref.: 0.45 - 0.90ml/g"),
  );
  lines.push(
    fmtRow(
      "Espessura Relativa",
      "espRelativa",
      "mm",
      "V. Ref.: 0,22-0,42mm (mulher) / 0,24-0,42mm (homem)",
    ),
  );
  lines.push("");

  // --- Câmaras Direitas ---
  lines.push("Câmaras Direitas:");
  lines.push("");
  lines.push(fmtRow("Volume do Átrio Direito", "volAtrioDireito", "ml", ""));
  lines.push(
    fmtRow(
      "Índice de Vol. Átrio Direiro",
      "indVolAtrioDir",
      "ml/m2",
      "V. Ref.: 9-33ml/m2 (mulher) / 11-39ml/m2 (homem)",
    ),
  );
  lines.push(
    fmtRow(
      "Diâmetro Basal do Ventrículo Direito",
      "diamBasalVD",
      "mm",
      "V. Ref.: 25-41mm",
    ),
  );
  lines.push(
    fmtRow(
      "Diâmetro Médio do Ventrículo Direito",
      "diamMedioVD",
      "mm",
      "V. Ref.: 19-35mm",
    ),
  );
  lines.push(
    fmtRow(
      "Diâmetro Longitudinal do VD",
      "diamLongVD",
      "mm",
      "V. Ref.: 59-83mm",
    ),
  );
  lines.push(
    fmtRow(
      "Diâmetro da VSVD Proximal (PET)",
      "vsvdProximal",
      "mm",
      "V. Ref.: 21-35mm",
    ),
  );
  lines.push(
    fmtRow("Espessura da Parede do VD", "espParedeVD", "mm", "V. Ref.: 1-5mm"),
  );
  lines.push(fmtRow("TAPSE", "tapse", "mm", "V. Ref.: >17mm"));
  lines.push(fmtRow("Onda S Doppler Pulsado", "ondaSDoppler", "cm/s", ""));
  lines.push(
    fmtRow(
      "Redução da Área Fracional do VD",
      "redAreaFrac",
      "%",
      "V. Ref.: < 35%",
    ),
  );
  lines.push(fmtRow("Diâmetro da Vaia Cava Inferior", "diamVCI", "mm", ""));
  lines.push(
    fmtRow("Colabamento Insp. da Veia Cava Inferior", "colabVCI", "%", ""),
  );
  lines.push("");

  // --- Estudo Doppler ---
  lines.push("Estudo Doppler:");
  lines.push("");
  const pad = (n) => n.padEnd(24);
  lines.push("".padEnd(44) + pad("Velocidade máxima") + "Gradiente máximo");
  const fAortVel = formatVal("fluxoAortVel");
  const fAortGrad = formatVal("fluxoAortGrad");
  lines.push(
    "Fluxo Aórtico:".padEnd(44) +
      (fAortVel + "  m/seg").padEnd(24) +
      (fAortGrad ? fAortGrad + "  mm hg" : ""),
  );
  const fPulmVel = formatVal("fluxoPulmVel");
  const fPulmGrad = formatVal("fluxoPulmGrad");
  lines.push(
    "Fluxo Pulmonar:".padEnd(44) +
      (fPulmVel + "  m/seg").padEnd(24) +
      (fPulmGrad ? fPulmGrad + "  mm hg" : ""),
  );
  lines.push(fmtRow("T de Desaceleração (TD)", "tDesaceleracao", "m/seg", ""));
  lines.push(fmtRow("Relação E/A", "relEA", "", ""));
  lines.push(fmtRow("Relação E/e", "relEe", "", ""));

  return lines;
}

function buildMedidasHtml() {
  const isCalc = (id) => {
    const el = document.getElementById(id);
    return el && (el.readOnly || el.classList.contains("calculated"));
  };

  const th = (text, extra = "") =>
    `<th style="padding:4px 8px;border:1px solid #555;background:#222;color:#fff;text-align:left;${extra}">${text}</th>`;

  const sectionRow = (title) =>
    `<tr><td colspan="4" style="padding:5px 8px;border:1px solid #555;background:#555;color:#fff;font-weight:bold;">${title}</td></tr>`;

  const dataRow = (label, id, unit, ref) => {
    const val = formatVal(id);
    const bg = isCalc(id) ? "background:#f0f0f0;" : "";
    const vStyle = val ? "font-weight:bold;" : "color:#aaa;";
    return `<tr>
      <td style="padding:3px 8px;border:1px solid #ccc;${bg}">${label}</td>
      <td style="padding:3px 8px;border:1px solid #ccc;text-align:right;${bg}${vStyle}">${val || "-"}</td>
      <td style="padding:3px 8px;border:1px solid #ccc;${bg}">${unit || ""}</td>
      <td style="padding:3px 8px;border:1px solid #ccc;font-size:10px;color:#555;${bg}">${ref || ""}</td>
    </tr>`;
  };

  let h = `<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:11px;"><tbody>`;

  // --- Dados Gerais ---
  h += sectionRow("Dados Gerais");
  h += dataRow("Peso", "peso", "Kg", "");
  h += dataRow("Altura", "altura", "m", "");
  h += dataRow("Superfície Corpórea", "bsa", "m²", "");

  // --- Câmaras Esquerdas ---
  h += sectionRow("Câmaras Esquerdas");
  h += dataRow(
    "Aorta",
    "aorta",
    "mm",
    "V. Ref.: 27-35mm (mulher) / 31-37mm (homem)",
  );
  h += dataRow(
    "Átrio Esquerdo",
    "atrioEsquerdo",
    "mm",
    "V. Ref.: 27-38mm (mulher) / 30-40mm (homem)",
  );
  h += dataRow(
    "Vol. Átrio Esquerdo",
    "volAtrioEsquerdo",
    "ml",
    "V. Ref.: 22-52mL (mulher) / 18-58mL (homem)",
  );
  h += dataRow(
    "Índice de Vol. Átrio Esquerdo",
    "indVolAtrioEsq",
    "ml/m²",
    "V. Ref.: 16-34mL/m²",
  );
  h += dataRow(
    "VE - Diâmetro Diastólico Final",
    "ddf",
    "mm",
    "V. Ref.: 37,8-52,2mm (mulher) / 42-58,4mm (homem)",
  );
  h += dataRow(
    "VE - Diâmetro Sistólico Final",
    "dsf",
    "mm",
    "V. Ref.: 21,6-38,4mm (mulher) / 25-39,8mm (homem)",
  );
  h += dataRow(
    "Septo Interventricular",
    "septo",
    "mm",
    "V. Ref.: 6-9mm (mulher) / 6-10mm (homem)",
  );
  h += dataRow(
    "Espessura Parede Posterior",
    "pp",
    "mm",
    "V. Ref.: 6-9mm (mulher) / 6-10mm (homem)",
  );
  h += dataRow(
    "VE - DDF/SC",
    "ddfSc",
    "mm/m²",
    "V. Ref.: 23-31mm/m² (mulher) / 22-30mm/m² (homem)",
  );
  h += dataRow(
    "Relação Átrio Esquerdo / Aorta",
    "relAeAorta",
    "",
    "V. Ref.: 1,0 ± 0,5",
  );
  h += dataRow(
    "VE - Volume Diastólico Final",
    "vdf",
    "ml",
    "V. Ref.: 46-106ml (mulher) / 62-150ml (homem)",
  );
  h += dataRow(
    "VE - VDF/SC",
    "vdfSc",
    "ml",
    "V. Ref.: 29-61ml (mulher) / 34-74ml (homem)",
  );
  h += dataRow(
    "VE - Volume Sistólico Final",
    "vsf",
    "ml",
    "V. Ref.: 14-42ml (mulher) / 21-61ml (homem)",
  );
  h += dataRow("Fração de Ejeção (Modo M)", "feModoM", "%", "V. Ref.: > 55%");
  h += dataRow(
    "Fração Ejeção (Biplanar Simpson)",
    "feBiplanar",
    "",
    "V. Ref.: 54-74% (mulher) / 52-72% (homem)",
  );
  h += dataRow("Fração de Encurtamento", "fracEncurt", "%", "V. Ref.: > 30%");
  h += dataRow(
    "Massa Ventricular Esquerda",
    "massaVE",
    "g",
    "V. Ref.: 67-162g (mulher) / 88-224g (homem)",
  );
  h += dataRow(
    "Índice de Massa",
    "indMassa",
    "g/m²",
    "V. Ref.: 43-95g/m² (mulher) / 49-114g/m² (homem)",
  );
  h += dataRow(
    "Volume de Massa",
    "volMassa",
    "ml/g",
    "V. Ref.: 0,45 - 0,90ml/g",
  );
  h += dataRow(
    "Espessura Relativa",
    "espRelativa",
    "mm",
    "V. Ref.: 0,22-0,42mm (mulher) / 0,24-0,42mm (homem)",
  );

  // --- Câmaras Direitas ---
  h += sectionRow("Câmaras Direitas");
  h += dataRow("Volume do Átrio Direito", "volAtrioDireito", "ml", "");
  h += dataRow(
    "Índice de Vol. Átrio Direito",
    "indVolAtrioDir",
    "ml/m²",
    "V. Ref.: 9-33ml/m² (mulher) / 11-39ml/m² (homem)",
  );
  h += dataRow(
    "Diâmetro Basal do Ventrículo Direito",
    "diamBasalVD",
    "mm",
    "V. Ref.: 25-41mm",
  );
  h += dataRow(
    "Diâmetro Médio do Ventrículo Direito",
    "diamMedioVD",
    "mm",
    "V. Ref.: 19-35mm",
  );
  h += dataRow(
    "Diâmetro Longitudinal do VD",
    "diamLongVD",
    "mm",
    "V. Ref.: 59-83mm",
  );
  h += dataRow(
    "Diâmetro da VSVD Proximal (PET)",
    "vsvdProximal",
    "mm",
    "V. Ref.: 21-35mm",
  );
  h += dataRow(
    "Espessura da Parede do VD",
    "espParedeVD",
    "mm",
    "V. Ref.: 1-5mm",
  );
  h += dataRow("TAPSE", "tapse", "mm", "V. Ref.: >17mm");
  h += dataRow("Onda S Doppler Pulsado", "ondaSDoppler", "cm/s", "");
  h += dataRow(
    "Redução da Área Fracional do VD",
    "redAreaFrac",
    "%",
    "V. Ref.: < 35%",
  );
  h += dataRow("Diâmetro da Veia Cava Inferior", "diamVCI", "mm", "");
  h += dataRow("Colabamento Insp. da Veia Cava Inferior", "colabVCI", "%", "");

  // --- Estudo Doppler ---
  h += sectionRow("Estudo Doppler");
  h += dataRow(
    "Fluxo Aórtico — Velocidade máxima",
    "fluxoAortVel",
    "m/seg",
    "",
  );
  h += dataRow(
    "Fluxo Aórtico — Gradiente máximo",
    "fluxoAortGrad",
    "mm Hg",
    "",
  );
  h += dataRow(
    "Fluxo Pulmonar — Velocidade máxima",
    "fluxoPulmVel",
    "m/seg",
    "",
  );
  h += dataRow(
    "Fluxo Pulmonar — Gradiente máximo",
    "fluxoPulmGrad",
    "mm Hg",
    "",
  );
  h += dataRow("T de Desaceleração (TD)", "tDesaceleracao", "m/seg", "");
  h += dataRow("Relação E/A", "relEA", "", "");
  h += dataRow("Relação E/e", "relEe", "", "");

  h += `</tbody></table>`;
  return h;
}

function copiarComHtml(htmlContent, plainText, msg) {
  try {
    const item = new ClipboardItem({
      "text/html": new Blob([htmlContent], { type: "text/html" }),
      "text/plain": new Blob([plainText], { type: "text/plain" }),
    });
    navigator.clipboard.write([item]).then(() => {
      showToast(msg);
      markAsCopied();
    });
  } catch {
    // Fallback para plain text se ClipboardItem não estiver disponível
    navigator.clipboard.writeText(plainText).then(() => {
      showToast(msg);
      markAsCopied();
    });
  }
}

function copiarMedidas() {
  copiarComHtml(
    buildMedidasHtml(),
    buildMedidasLines().join("\n"),
    "Medidas copiadas!",
  );
}

function copiarTudo() {
  const laudo = document.getElementById("laudoTexto").value;
  const html =
    buildMedidasHtml() +
    `<br><hr><p><strong>LAUDO</strong></p>` +
    laudoToHtml(laudo);
  const texto =
    buildMedidasLines().join("\n") + "\n\n=== LAUDO ===\n\n" + laudo;
  copiarComHtml(html, texto, "Medidas + Laudo copiados!");
}

function laudoToHtml(texto) {
  const LABELS = [
    "Ventrículo esquerdo",
    "Átrio esquerdo",
    "Aorta ascendente",
    "Átrio direito e ventrículo direito",
    "Septos",
    "Válvula mitral",
    "Válvula aórtica",
    "Válvula tricúspide",
    "Válvula pulmonar",
    "Artéria Pulmonar",
    "Pericárdio",
  ];
  // Escapar HTML
  let html = texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  // Negrito nos rótulos
  LABELS.forEach((label) => {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    html = html.replace(
      new RegExp(escaped + ":", "g"),
      `<strong>${label}:</strong>`,
    );
  });
  // Quebras de linha
  html = html.replace(/\n/g, "<br>");
  return `<p style="font-family:Arial,sans-serif;font-size:13px;line-height:1.6;">${html}</p>`;
}

function copiarLaudo() {
  const texto = document.getElementById("laudoTexto").value;
  copiarComHtml(laudoToHtml(texto), texto, "Laudo copiado!");
}

// ===================== LIMPAR =====================
function _renderAltura(el) {
  const d = el.dataset.digits || "";
  if (d.length === 0) el.value = "";
  else if (d.length === 1) el.value = "0,0" + d;
  else if (d.length === 2) el.value = "0," + d;
  else el.value = d[0] + "," + d.slice(1);
}

function limparCalculo() {
  document
    .querySelectorAll('#tab-calculo input[type="number"]')
    .forEach((el) => {
      el.value = "";
    });
  const alturaEl = document.getElementById("altura");
  if (alturaEl) {
    alturaEl.dataset.digits = "";
    alturaEl.value = "";
  }
  recalculate();
}

function limparLaudo() {
  document.getElementById("laudoTexto").value = LAUDO_PADRAO;
}

function initClearButton() {
  document.getElementById("btnLimparBar").addEventListener("click", () => {
    const isCalculo = document
      .getElementById("tab-calculo")
      .classList.contains("active");
    if (isCalculo) {
      limparCalculo();
    } else {
      limparLaudo();
    }
    clearStorage();
    hideRecoveryBanner();
    updateRecuperarBtn();
  });
}

// ===================== BARRA FIXA — MODOS, TEMA, CONFIG =====================

function updateModeButtons(currentMode) {
  const map = {
    popup: "btnModoPopup",
    sidepanel: "btnModoSidepanel",
    tab: "btnModoTab",
  };
  Object.entries(map).forEach(([mode, id]) => {
    const btn = document.getElementById(id);
    if (btn) btn.hidden = mode === currentMode;
  });
}

function updateThemeIcon(theme) {
  const btn = document.getElementById("btnToggleTema");
  if (!btn) return;
  const moonSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
  const sunSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`;
  btn.innerHTML = theme === "dark" ? sunSvg : moonSvg;
  btn.title =
    theme === "dark" ? "Alternar para modo claro" : "Alternar para modo escuro";
}

async function switchMode(newMode) {
  if (typeof chrome === "undefined" || !chrome.storage) return;

  // Persiste o novo modo
  await new Promise((res) =>
    chrome.storage.local.set({ ecoDisplayMode: newMode }, res),
  );

  // Notifica o background para reconfigurar as APIs do Chrome
  if (chrome.runtime) {
    chrome.runtime.sendMessage({ action: "setMode", mode: newMode }, () => {
      // Suprimir erros de runtime (ex: popup fechou antes da resposta)
      void chrome.runtime.lastError;
    });
  }

  const currentMode = document.body.dataset.mode || "tab";

  if (newMode === "tab") {
    if (currentMode !== "tab") {
      chrome.tabs.create({ url: chrome.runtime.getURL("src/popup.html") });
      window.close();
    }
  } else if (newMode === "sidepanel") {
    try {
      const win = await new Promise((res) => chrome.windows.getCurrent(res));
      await chrome.sidePanel.open({ windowId: win.id });
      setTimeout(() => window.close(), 300);
    } catch {
      showToast("Modo Lateral ativado!");
    }
  } else if (newMode === "popup") {
    showToast("Modo Pop-up ativado!");
    setTimeout(() => window.close(), 2000);
  }
}

function initBottomBar() {
  // Modo
  document
    .getElementById("btnModoPopup")
    .addEventListener("click", () => switchMode("popup"));
  document
    .getElementById("btnModoSidepanel")
    .addEventListener("click", () => switchMode("sidepanel"));
  document
    .getElementById("btnModoTab")
    .addEventListener("click", () => switchMode("tab"));

  // Tema
  document.getElementById("btnToggleTema").addEventListener("click", () => {
    const current = document.documentElement.dataset.theme || "light";
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    updateThemeIcon(next);
    if (
      typeof chrome !== "undefined" &&
      chrome.storage &&
      chrome.storage.local
    ) {
      chrome.storage.local.set({ ecoTheme: next });
    }
  });

  // Configurações
  document.getElementById("btnConfiguracoes").addEventListener("click", () => {
    if (
      typeof chrome !== "undefined" &&
      chrome.runtime &&
      chrome.runtime.openOptionsPage
    ) {
      chrome.runtime.openOptionsPage();
    }
  });

  // Inicializa ícone do tema conforme estado atual
  updateThemeIcon(document.documentElement.dataset.theme || "light");
}

// ===================== PERSISTÊNCIA LOCAL =====================
const STORAGE_KEY = "ecoFormData";

// Campos editáveis pelo usuário (excluindo campos calculados readonly)
const USER_INPUT_IDS = [
  "peso",
  "altura",
  "aorta",
  "atrioEsquerdo",
  "volAtrioEsquerdo",
  "ddf",
  "dsf",
  "septo",
  "pp",
  "feBiplanar",
  "volAtrioDireito",
  "diamBasalVD",
  "diamMedioVD",
  "diamLongVD",
  "vsvdProximal",
  "espParedeVD",
  "tapse",
  "ondaSDoppler",
  "redAreaFrac",
  "diamVCI",
  "colabVCI",
  "fluxoAortVel",
  "fluxoAortGrad",
  "fluxoPulmVel",
  "fluxoPulmGrad",
  "tDesaceleracao",
  "relEA",
  "relEe",
];

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveToStorage() {
  const inputs = {};
  USER_INPUT_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (el) inputs[id] = el.value;
  });
  const laudo = document.getElementById("laudoTexto")?.value ?? "";
  const data = {
    timestamp: new Date().toISOString(),
    copied: false,
    inputs,
    laudo,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function clearStorage() {
  localStorage.removeItem(STORAGE_KEY);
}

function markAsCopied() {
  const existing = loadFromStorage();
  if (!existing) return;
  existing.copied = true;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  updateRecuperarBtn();
}

function restoreFromStorage(data) {
  USER_INPUT_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (el && data.inputs?.[id] !== undefined) el.value = data.inputs[id];
  });
  const laudoEl = document.getElementById("laudoTexto");
  if (laudoEl && data.laudo) laudoEl.value = data.laudo;
  recalculate();
}

let _bannerTimer = null;

function showRecoveryBanner(timestamp) {
  const timeStr = new Date(timestamp).toLocaleString("pt-BR");
  document.getElementById("recuperacaoTime").textContent = timeStr;
  document.getElementById("recuperacaoBanner").classList.remove("hidden");

  // Reinicia a barra de progresso
  const bar = document.getElementById("bannerProgressBar");
  bar.classList.remove("running");
  void bar.offsetWidth; // força reflow para reiniciar a animação CSS
  bar.classList.add("running");

  // Fecha automaticamente após 5 segundos
  if (_bannerTimer) clearTimeout(_bannerTimer);
  _bannerTimer = setTimeout(hideRecoveryBanner, 5000);
}

function hideRecoveryBanner() {
  if (_bannerTimer) {
    clearTimeout(_bannerTimer);
    _bannerTimer = null;
  }
  document.getElementById("recuperacaoBanner").classList.add("hidden");
  document.getElementById("bannerProgressBar").classList.remove("running");
}

function updateRecuperarBtn() {
  const data = loadFromStorage();
  const btn = document.getElementById("btnRecuperarHistorico");
  if (data) {
    btn.classList.remove("hidden");
  } else {
    btn.classList.add("hidden");
  }
}

function initRecovery() {
  const data = loadFromStorage();
  if (data) {
    const hasContent = Object.values(data.inputs || {}).some((v) => v !== "");
    if (!data.copied && hasContent) {
      restoreFromStorage(data);
      showRecoveryBanner(data.timestamp);
    }
    updateRecuperarBtn();
  }

  document
    .getElementById("btnFecharBanner")
    .addEventListener("click", hideRecoveryBanner);

  document
    .getElementById("btnDescartarRecuperacao")
    .addEventListener("click", () => {
      limparCalculo();
      limparLaudo();
      clearStorage();
      hideRecoveryBanner();
      updateRecuperarBtn();
    });

  document
    .getElementById("btnRecuperarHistorico")
    .addEventListener("click", () => {
      const d = loadFromStorage();
      if (!d) return;
      restoreFromStorage(d);
      showRecoveryBanner(d.timestamp);
      document.getElementById("btnRecuperarHistorico").classList.add("hidden");
      showToast("Dados recuperados!");
    });
}

function initPersistence() {
  USER_INPUT_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", saveToStorage);
  });
  const laudoEl = document.getElementById("laudoTexto");
  if (laudoEl) laudoEl.addEventListener("input", saveToStorage);
}

// ===================== LAUDO — MODELOS =====================
const LAUDO_PADRAO = `Exame realizado com boa qualidade técnica. As medidas apresentadas representam a media das diversas aferições.

Ventrículo esquerdo: Diâmetros e espessura miocárdica preservados. Função sistólica global e segmentar preservada em repouso. Função diastólica preservada.

Átrio esquerdo: Apresenta diâmetros normais. Volume de  ml/m2. (VR até 34ml/m²).

Aorta ascendente: Normal.

Átrio direito e ventrículo direito: Diâmetros preservados. Função sistólica de ventrículo direito preservada em repouso.

Septos: Aparentemente Íntegros.

Válvula mitral: Normal. Estudo Doppler normal

Válvula aórtica: Normal. Estudo Doppler normal

Válvula tricúspide: Normal. Estudo Doppler normal.

Válvula pulmonar: Normal. Estudo Doppler normal.

Artéria Pulmonar: Normal.

Pericárdio: Normal.

Não foi observada presença de trombos ou vegetações no exame realizado.
PSAP em torno de  mmHg, considerando uma PAD de 5mmHg.
Não foi possível estimar PSAP por ausência de refluxo tricúspide mensurável`;

function initLaudo() {
  document.getElementById("laudoTexto").value = LAUDO_PADRAO;
}
