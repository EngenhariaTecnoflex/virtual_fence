import { initMap, ativarMedicao, limparMedicao } from "./map.js";
import {
  criarNovoProjeto,
  importarMultiplosJSON,
  importarJsonDaSerial,
  atualizarStatusSistema,
} from "./projects.js";
import { conectarSerial, desconectarSerial } from "./serial.js";

window.addEventListener("DOMContentLoaded", () => {
  initMap();
  atualizarStatusSistema();

  document.getElementById("btnNovoProjeto")
    .addEventListener("click", criarNovoProjeto);

  document.getElementById("jsonUpload")
    .addEventListener("change", importarMultiplosJSON);

  document.getElementById("btnAtivarMedicao")
    .addEventListener("click", ativarMedicao);

  document.getElementById("btnLimparMedicao")
    .addEventListener("click", limparMedicao);

  document.getElementById("btnConectarSerial")
    .addEventListener("click", conectarSerial);

  document.getElementById("btnDesconectarSerial")
    .addEventListener("click", desconectarSerial);

  document.getElementById("btnImportarSerial")
    .addEventListener("click", importarJsonDaSerial);
});
