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

  // Botões principais
  document.getElementById("btnNovoProjeto")
    .addEventListener("click", criarNovoProjeto);

  document.getElementById("jsonUpload")
    .addEventListener("change", importarMultiplosJSON);

  document.getElementById("btnAtivarMedicao")
    .addEventListener("click", ativarMedicao);

  document.getElementById("btnLimparMedicao")
    .addEventListener("click", limparMedicao);

  // Serial
  document.getElementById("btnConectarSerial")
    .addEventListener("click", conectarSerial);

  document.getElementById("btnDesconectarSerial")
    .addEventListener("click", desconectarSerial);

  document.getElementById("btnImportarSerial")
    .addEventListener("click", importarJsonDaSerial);

  // Abas da sidebar
  document.getElementById("tabSidebarGlobal")
    .addEventListener("click", () => setSidebarMode("global"));

  document.getElementById("tabSidebarProject")
    .addEventListener("click", () => setSidebarMode("project"));

  // Começa em modo geral (configs/importação)
  setSidebarMode("global");
});
