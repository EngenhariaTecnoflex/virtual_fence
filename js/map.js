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

  // Se for o primeiro ponto, cria um marcador para indicar o início
  if (state.pontosMedicao.length === 1) {
    try {
      const m = L.marker(e.latlng).addTo(state.map);
      if (!Array.isArray(state.marcadoresMedicao)) state.marcadoresMedicao = [];
      state.marcadoresMedicao.push(m);
    } catch (err) {
      console.warn("Não foi possível criar marcador de medição:", err);
    }
    // Atualiza display com distância zero
    try {
      const el = document.getElementById("medicaoInfo");
      if (el) el.textContent = "Distância: 0.00 m";
    } catch (_) {}
  }

  if (state.pontosMedicao.length >= 2) {
    if (state.linhaMedicao) {
      state.map.removeLayer(state.linhaMedicao);
    }

    state.linhaMedicao = L.polyline(state.pontosMedicao, { color: "black" }).addTo(state.map);
    const distanciaTotal = calcularDistanciaTotal(state.pontosMedicao);

    // Atualiza medicaoInfo (se presente)
    try {
      const el = document.getElementById("medicaoInfo");
      if (el) el.textContent = "Distância: " + distanciaTotal.toFixed(2) + " m";
    } catch (_) {}

    // Tooltip permanente no centro da linha para ficar sempre visível
    try {
      // Remove tooltip anterior se existir
      if (state.linhaMedicao && state.linhaMedicao.unbindTooltip) {
        try { state.linhaMedicao.unbindTooltip(); } catch (_) {}
      }
      state.linhaMedicao
        .bindTooltip("Distância total: " + distanciaTotal.toFixed(2) + " m", { permanent: true, direction: 'center' })
        .openTooltip();
    } catch (err) {
      console.warn('Erro ao associar tooltip permanente à linha de medição:', err);
    }
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
  // Se já estiver ativa, desliga (toggle)
  if (state.medicaoAtiva) {
    resetMedicao();
    atualizarStatusSistema();
    return;
  }

  // Limpa medições anteriores e ativa
  resetMedicao();
  state.medicaoAtiva = true;
  atualizarStatusSistema();
  alert(
    "Clique no mapa para marcar pontos de medição. Clique novamente em '📏 Medir Distância' para desativar."
  );
}

export function limparMedicao() {
  resetMedicao();
  atualizarStatusSistema();
}
