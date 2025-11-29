import { initMap, ativarMedicao, limparMedicao } from "./map.js";
import {
  criarNovoProjeto,
  importarMultiplosJSON,
  importarJsonDaSerial,
  atualizarStatusSistema,
  setSidebarMode,
} from "./projects.js";
import { conectarSerial, desconectarSerial } from "./serial.js";


window.addEventListener("DOMContentLoaded", () => {
  initMap();
  atualizarStatusSistema();

  // Botões principais da lateral
  const btnNovoProjeto = document.getElementById("btnNovoProjeto");
  if (btnNovoProjeto) {
    btnNovoProjeto.addEventListener("click", criarNovoProjeto);
  }

  const jsonUpload = document.getElementById("jsonUpload");
  if (jsonUpload) {
    jsonUpload.addEventListener("change", importarMultiplosJSON);
  }

  const btnAtivarMedicao = document.getElementById("btnAtivarMedicao");
  if (btnAtivarMedicao) {
    btnAtivarMedicao.addEventListener("click", ativarMedicao);
  }

  const btnLimparMedicao = document.getElementById("btnLimparMedicao");
  if (btnLimparMedicao) {
    btnLimparMedicao.addEventListener("click", limparMedicao);
  }

  // Serial
  const btnConectarSerial = document.getElementById("btnConectarSerial");
  if (btnConectarSerial) {
    btnConectarSerial.addEventListener("click", conectarSerial);
  }

  const btnDesconectarSerial = document.getElementById("btnDesconectarSerial");
  if (btnDesconectarSerial) {
    btnDesconectarSerial.addEventListener("click", desconectarSerial);
  }

  const btnImportarSerial = document.getElementById("btnImportarSerial");
  if (btnImportarSerial) {
    btnImportarSerial.addEventListener("click", importarJsonDaSerial);
  }

  // Aba Geral no topo do mapa
  const tabGeneral = document.getElementById("tabGeneral");
  if (tabGeneral) {
    tabGeneral.addEventListener("click", () => setSidebarMode("global"));
  } else {
    console.warn("Elemento #tabGeneral não encontrado no DOM.");
  }

  // Começa em modo geral (configs/importação, todas as cercas visíveis)
  setSidebarMode("global");
});


