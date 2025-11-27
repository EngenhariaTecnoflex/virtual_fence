import { state, resetMedicao } from "./state.js";
import {
  adicionarPontoCerca,
  atualizarPoligonos,
  atualizarListas,
  atualizarStatusSistema,
} from "./projects.js";

export function initMap() {
  state.map = L.map("map", { maxZoom: 19 }).setView([-23.5505, -46.6333], 10);

  state.streetsLayer = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    { maxZoom: 19, attribution: "© OpenStreetMap contributors" }
  ).addTo(state.map);

  state.satelliteLayer = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 19, attribution: "Esri" }
  );

  L.control.layers(
    { "Mapa": state.streetsLayer, "Satélite": state.satelliteLayer }
  ).addTo(state.map);

  registrarEventosMap();
}

function registrarEventosMap() {
  state.map.on("click", (e) => {
    if (state.medicaoAtiva) {
      lidarCliqueMedicao(e);
      return;
    }

    // só permite edição quando estamos na aba "Projeto"
    if (state.sidebarMode !== "project") return;

    if (!state.projetoAtual || !state.cercaAtual) return;

    adicionarPontoCerca(state.projetoAtual, state.cercaAtual, e.latlng.lat, e.latlng.lng);
    atualizarPoligonos(state.projetoAtual);
    atualizarListas(state.projetoAtual);
  });
}

function lidarCliqueMedicao(e) {
  state.pontosMedicao.push(e.latlng);

  if (state.pontosMedicao.length >= 2) {
    if (state.linhaMedicao) {
      state.map.removeLayer(state.linhaMedicao);
    }

    state.linhaMedicao = L.polyline(state.pontosMedicao, { color: "black" }).addTo(state.map);
    const distanciaTotal = calcularDistanciaTotal(state.pontosMedicao);
    state.linhaMedicao
      .bindTooltip("Distância total: " + distanciaTotal.toFixed(2) + " m")
      .openTooltip();
  }
}

function calcularDistanciaTotal(pontos) {
  let d = 0;
  for (let i = 1; i < pontos.length; i++) {
    d += state.map.distance(pontos[i - 1], pontos[i]);
  }
  return d;
}

export function ativarMedicao() {
  state.medicaoAtiva = true;
  resetMedicao();
  atualizarStatusSistema();
  alert("Clique no mapa para marcar pontos de medição. Clique novamente em '📏 Medir Distância' para desativar.");
}

export function limparMedicao() {
  resetMedicao();
  atualizarStatusSistema();
}
