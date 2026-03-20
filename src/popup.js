// ===================================================================
// Cálculo ECO — Chrome Extension
// ===================================================================

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initCalculations();
  initCopyButtons();
  initLaudo();
  initClearButton();
});

// ===================== ABAS =====================
function initTabs() {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
  });
}

// ===================== CÁLCULOS =====================
function initCalculations() {
  // Todos os inputs que disparam recalculo
  const triggerIds = [
    'peso', 'altura',
    'aorta', 'atrioEsquerdo', 'volAtrioEsquerdo',
    'ddf', 'dsf', 'septo', 'pp',
    'volAtrioDireito'
  ];

  triggerIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', recalculate);
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
    el.value = '';
  } else {
    el.value = value.toFixed(decimals).replace('.', ',');
  }
}

function recalculate() {
  const peso = getNum('peso');
  const alturaCm = getNum('altura') * 100; // converter m -> cm
  const alturaM = getNum('altura');

  // 1. BSA (DuBois)
  let bsa = 0;
  if (peso > 0 && alturaCm > 0) {
    bsa = 0.007184 * Math.pow(peso, 0.425) * Math.pow(alturaCm, 0.725);
  }
  setCalc('bsa', bsa > 0 ? bsa : null);

  // Câmaras Esquerdas — valores em mm (inputs)
  const aorta = getNum('aorta');
  const ae = getNum('atrioEsquerdo');
  const volAE = getNum('volAtrioEsquerdo');
  const ddfMm = getNum('ddf');
  const dsfMm = getNum('dsf');
  const septoMm = getNum('septo');
  const ppMm = getNum('pp');

  // Converter mm -> cm para fórmulas de volume (Teichholz) e massa
  const ddfCm = ddfMm / 10;
  const dsfCm = dsfMm / 10;
  const septoCm = septoMm / 10;
  const ppCm = ppMm / 10;

  // 2. Índice de Vol. Átrio Esquerdo = volAE / BSA
  setCalc('indVolAtrioEsq', bsa > 0 && volAE > 0 ? volAE / bsa : null);

  // 3. DDF/SC = DDF(mm) / BSA
  setCalc('ddfSc', bsa > 0 && ddfMm > 0 ? ddfMm / bsa : null);

  // 4. Relação AE/Aorta
  setCalc('relAeAorta', aorta > 0 && ae > 0 ? ae / aorta : null);

  // 5. VDF (Teichholz) = (7 / (2.4 + D)) * D^3, D em cm
  let vdf = null;
  if (ddfCm > 0) {
    vdf = (7 / (2.4 + ddfCm)) * Math.pow(ddfCm, 3);
  }
  setCalc('vdf', vdf);

  // 6. VDF/SC = VDF / BSA
  setCalc('vdfSc', vdf !== null && bsa > 0 ? vdf / bsa : null);

  // 7. VSF (Teichholz) = (7 / (2.4 + D)) * D^3, D em cm (DSF)
  let vsf = null;
  if (dsfCm > 0) {
    vsf = (7 / (2.4 + dsfCm)) * Math.pow(dsfCm, 3);
  }
  setCalc('vsf', vsf);

  // 8. Fração de Ejeção (Modo M) = ((VDF - VSF) / VDF) * 100
  setCalc('feModoM', vdf !== null && vsf !== null && vdf !== 0 ? ((vdf - vsf) / vdf) * 100 : null);

  // 9. Fração de Encurtamento = ((DDF - DSF) / DDF) * 100
  setCalc('fracEncurt', ddfMm > 0 && dsfMm > 0 ? ((ddfMm - dsfMm) / ddfMm) * 100 : null);

  // 10. Massa VE (ASE) = 0.8 * [1.04 * ((DDF + Septo + PP)^3 - DDF^3)] + 0.6
  // Valores em cm
  let massaVE = null;
  if (ddfCm > 0 && septoCm > 0 && ppCm > 0) {
    const soma = ddfCm + septoCm + ppCm;
    massaVE = 0.8 * (1.04 * (Math.pow(soma, 3) - Math.pow(ddfCm, 3))) + 0.6;
  }
  setCalc('massaVE', massaVE);

  // 11. Índice de Massa = Massa / BSA
  setCalc('indMassa', massaVE !== null && bsa > 0 ? massaVE / bsa : null);

  // 12. Volume / Massa = VDF / Massa
  setCalc('volMassa', vdf !== null && massaVE !== null && massaVE > 0 ? vdf / massaVE : null);

  // 13. Espessura Relativa = (2 * PP) / DDF (mm)
  setCalc('espRelativa', ppMm > 0 && ddfMm > 0 ? (2 * ppMm) / ddfMm : null);

  // 14. Índice de Vol. Átrio Direito = volAD / BSA
  const volAD = getNum('volAtrioDireito');
  setCalc('indVolAtrioDir', bsa > 0 && volAD > 0 ? volAD / bsa : null);
}

// ===================== COPIAR =====================
function initCopyButtons() {
  document.getElementById('btnCopiarMedidas').addEventListener('click', copiarMedidas);
  document.getElementById('btnCopiarLaudo').addEventListener('click', copiarLaudo);
  document.getElementById('btnCopiarTudo').addEventListener('click', copiarTudo);
  document.getElementById('btnCopiarTudo2').addEventListener('click', copiarTudo);
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg || 'Copiado!';
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 2000);
}

function formatVal(id) {
  const el = document.getElementById(id);
  if (!el) return '';
  return el.value || '';
}

function buildMedidasLines() {
  const lines = [];

  lines.push(`Peso: ${formatVal('peso')} Kg | Altura: ${formatVal('altura')} m | Superfície Corpórea: ${formatVal('bsa')} m2`);
  lines.push('');

  lines.push('=== Câmaras Esquerdas ===');
  const camposEsq = [
    ['Aorta', 'aorta', 'mm'],
    ['Átrio Esquerdo', 'atrioEsquerdo', 'mm'],
    ['Vol. Átrio Esquerdo', 'volAtrioEsquerdo', 'ml'],
    ['Índice de Vol. Átrio Esquerdo', 'indVolAtrioEsq', 'ml/m2'],
    ['VE - Diâmetro Diastólico Final', 'ddf', 'mm'],
    ['VE - Diâmetro Sistólico Final', 'dsf', 'mm'],
    ['Septo Interventricular', 'septo', 'mm'],
    ['Espessura Parede Posterior', 'pp', 'mm'],
    ['VE - DDF/SC', 'ddfSc', 'mm/m2'],
    ['Relação Átrio Esquerdo / Aorta', 'relAeAorta', ''],
    ['VE - Volume Diastólico Final', 'vdf', 'ml'],
    ['VE - VDF/SC', 'vdfSc', 'ml'],
    ['VE - Volume Sistólico Final', 'vsf', 'ml'],
    ['Fração de Ejeção (Modo M)', 'feModoM', '%'],
    ['Fração Ejeção (Biplanar Simpson)', 'feBiplanar', ''],
    ['Fração de Encurtamento - AD', 'fracEncurt', '%'],
    ['Massa Ventricular Esquerda', 'massaVE', 'g'],
    ['Índice de Massa', 'indMassa', 'g/m2'],
    ['Volume / Massa', 'volMassa', 'ml/g'],
    ['Espessura Relativa', 'espRelativa', 'mm'],
  ];
  camposEsq.forEach(([label, id, unit]) => {
    const v = formatVal(id);
    if (v) lines.push(`${label}: ${v} ${unit}`.trim());
  });

  lines.push('');
  lines.push('=== Câmaras Direitas ===');
  const camposDir = [
    ['Volume do Átrio Direito', 'volAtrioDireito', 'ml'],
    ['Índice de Vol. Átrio Direito', 'indVolAtrioDir', 'ml/m2'],
    ['Diâmetro Basal do Ventrículo Direito', 'diamBasalVD', 'mm'],
    ['Diâmetro Médio do Ventrículo Direito', 'diamMedioVD', 'mm'],
    ['Diâmetro Longitudinal do VD', 'diamLongVD', 'mm'],
    ['Diâmetro da VSVD Proximal (PET)', 'vsvdProximal', 'mm'],
    ['Espessura da Parede do VD', 'espParedeVD', 'mm'],
    ['TAPSE', 'tapse', 'mm'],
    ['Onda S Doppler Pulsado', 'ondaSDoppler', 'cm/s'],
    ['Redução da Área Fracional do VD', 'redAreaFrac', '%'],
    ['Diâmetro da Veia Cava Inferior', 'diamVCI', 'mm'],
    ['Colabamento Insp. da Veia Cava Inferior', 'colabVCI', '%'],
  ];
  camposDir.forEach(([label, id, unit]) => {
    const v = formatVal(id);
    if (v) lines.push(`${label}: ${v} ${unit}`.trim());
  });

  lines.push('');
  lines.push('=== Estudo Doppler ===');
  const fAortVel = formatVal('fluxoAortVel');
  const fAortGrad = formatVal('fluxoAortGrad');
  if (fAortVel || fAortGrad) {
    lines.push(`Fluxo Aórtico: Vel. máx. ${fAortVel} m/seg | Grad. máx. ${fAortGrad} mm hg`);
  }
  const fPulmVel = formatVal('fluxoPulmVel');
  const fPulmGrad = formatVal('fluxoPulmGrad');
  if (fPulmVel || fPulmGrad) {
    lines.push(`Fluxo Pulmonar: Vel. máx. ${fPulmVel} m/seg | Grad. máx. ${fPulmGrad} mm hg`);
  }
  const camposDoppler = [
    ['T de Desaceleração (TD)', 'tDesaceleracao', 'm/seg'],
    ['Relação E/A', 'relEA', ''],
    ['Relação E/e', 'relEe', ''],
  ];
  camposDoppler.forEach(([label, id, unit]) => {
    const v = formatVal(id);
    if (v) lines.push(`${label}: ${v} ${unit}`.trim());
  });

  return lines;
}

function copiarMedidas() {
  const lines = buildMedidasLines();
  navigator.clipboard.writeText(lines.join('\n')).then(() => showToast('Medidas copiadas!'));
}

function copiarTudo() {
  const lines = buildMedidasLines();
  const laudo = document.getElementById('laudoTexto').value;
  const texto = lines.join('\n') + '\n\n=== LAUDO ===\n\n' + laudo;
  navigator.clipboard.writeText(texto).then(() => showToast('Medidas + Laudo copiados!'));
}

function copiarLaudo() {
  const texto = document.getElementById('laudoTexto').value;
  navigator.clipboard.writeText(texto).then(() => showToast('Laudo copiado!'));
}

// ===================== LIMPAR =====================
function limparCalculo() {
  document.querySelectorAll('#tab-calculo input[type="number"]').forEach(el => { el.value = ''; });
  recalculate();
}

function limparLaudo() {
  document.getElementById('laudoTexto').value = LAUDO_PADRAO;
}

function initClearButton() {
  document.getElementById('btnLimparCalculo').addEventListener('click', limparCalculo);
  document.getElementById('btnLimparLaudo').addEventListener('click', limparLaudo);
  document.getElementById('btnLimparTudoTopo').addEventListener('click', () => { limparCalculo(); limparLaudo(); });
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
  document.getElementById('laudoTexto').value = LAUDO_PADRAO;
}
