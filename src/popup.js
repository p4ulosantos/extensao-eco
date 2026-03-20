// ===================================================================
// Cálculo ECO — Chrome Extension
// ===================================================================

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initCalculations();
  initCopyButtons();
  initLaudo();
  initClearButton();
  initRecovery();
  initPersistence();
});

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
    "altura",
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

  recalculate();
}

function getNum(id) {
  const v = parseFloat(document.getElementById(id)?.value);
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
    .getElementById("btnCopiarMedidas")
    .addEventListener("click", copiarMedidas);
  document
    .getElementById("btnCopiarLaudo")
    .addEventListener("click", copiarLaudo);
  document
    .getElementById("btnCopiarTudo")
    .addEventListener("click", copiarTudo);
  document
    .getElementById("btnCopiarTudo2")
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
function limparCalculo() {
  document
    .querySelectorAll('#tab-calculo input[type="number"]')
    .forEach((el) => {
      el.value = "";
    });
  recalculate();
}

function limparLaudo() {
  document.getElementById("laudoTexto").value = LAUDO_PADRAO;
}

function initClearButton() {
  document
    .getElementById("btnLimparCalculo")
    .addEventListener("click", limparCalculo);
  document
    .getElementById("btnLimparLaudo")
    .addEventListener("click", limparLaudo);
  document.getElementById("btnLimparTudoTopo").addEventListener("click", () => {
    limparCalculo();
    limparLaudo();
    clearStorage();
    hideRecoveryBanner();
    updateRecuperarBtn();
  });
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

  // Fecha automaticamente após 10 segundos
  if (_bannerTimer) clearTimeout(_bannerTimer);
  _bannerTimer = setTimeout(hideRecoveryBanner, 10000);
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
