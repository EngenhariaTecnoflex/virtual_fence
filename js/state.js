export const state = {
  map: null,
  streetsLayer: null,
  satelliteLayer: null,

  projetos: {},
  projetoAtual: null,
  cercaAtual: null,

  medicaoAtiva: false,
  pontosMedicao: [],
  linhaMedicao: null,
  marcadoresMedicao: [],

  // novo: modo da aba lateral: 'global' ou 'project'
  sidebarMode: "global",
};

export function setProjetoAtual(id, tipoCerca) {
  state.projetoAtual = id;
  state.cercaAtual = tipoCerca || null;
}

export function resetMedicao() {
  state.medicaoAtiva = false;
  state.pontosMedicao = [];
  // Remove linha de medição
  if (state.linhaMedicao && state.map) {
    state.map.removeLayer(state.linhaMedicao);
  }
  state.linhaMedicao = null;

  // Remove marcadores de medição (se houver)
  if (Array.isArray(state.marcadoresMedicao)) {
    state.marcadoresMedicao.forEach((m) => {
      try {
        if (m && state.map) state.map.removeLayer(m);
      } catch (_) {}
    });
  }
  state.marcadoresMedicao = [];

  // Limpa display da medição (se presente)
  try {
    const el = document.getElementById("medicaoInfo");
    if (el) el.textContent = "Distância: —";
  } catch (_) {}
}
