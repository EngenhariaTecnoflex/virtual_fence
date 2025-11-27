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
  if (state.linhaMedicao && state.map) {
    state.map.removeLayer(state.linhaMedicao);
  }
  state.linhaMedicao = null;
}
