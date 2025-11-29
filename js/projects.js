import { state } from "./state.js";
import {
  enviarComandoSerial,
  enviarComandoSerialAtePrompt,
  delay,
  normalizarNomeArquivoRoot,
  escaparTextoFedit,
  isSerialConected,
} from "./serial.js";
import { toGeoJSON } from "./libs/togeojson-module.js";

// ---------------- Helpers UI: abas de projeto + aba Geral ---------------- //
function createProjectTab(id, name) {
  const tabsBar = document.getElementById("tabsBar");
  if (!tabsBar) return;

  const btn = document.createElement("button");
  btn.className = "tab-button";
  btn.textContent = name;
  btn.dataset.projetoId = id;

  btn.addEventListener("click", () => {
    ativarProjeto(id);
  });

  tabsBar.appendChild(btn);
}

function updateTopTabsUI() {
  const generalBtn = document.getElementById("tabGeneral");
  const tabsBar = document.getElementById("tabsBar");
  if (!tabsBar || !generalBtn) return;

  const projButtons = tabsBar.querySelectorAll(".tab-button[data-projeto-id]");

  if (state.sidebarMode === "global") {
    generalBtn.classList.add("tab-active");
    projButtons.forEach((b) => b.classList.remove("tab-active"));
  } else {
    generalBtn.classList.remove("tab-active");
    projButtons.forEach((b) => {
      if (b.dataset.projetoId === state.projetoAtual) {
        b.classList.add("tab-active");
      } else {
        b.classList.remove("tab-active");
      }
    });
  }
}

function updateProjectCardsVisibility(activeId) {
  const container = document.getElementById("projetosContainer");
  if (!container) return;

  const cards = container.querySelectorAll(".projeto-container");
  cards.forEach((card) => {
    card.style.display = card.id === "projeto_" + activeId ? "block" : "none";
  });
}

// ---------------- Lateral: mostrar controles ou card do projeto ---------------- //
function updateSidebarPanelsVisibility() {
  const controlsPanel = document.getElementById("controlsPanel");
  const projectsPanel = document.getElementById("projectsPanel");
  if (!controlsPanel || !projectsPanel) return;

  if (state.sidebarMode === "global") {
    controlsPanel.style.display = "";
    projectsPanel.style.display = "none";
  } else {
    controlsPanel.style.display = "none";
    projectsPanel.style.display = "";
  }
}

// ---------------- Map helpers: global e por projeto ---------------- //
function showAllProjectsOnMap() {
  if (!state.map) return;

  // Remove qualquer polígono existente
  for (let pid in state.projetos) {
    const projeto = state.projetos[pid];
    for (let tipo in projeto.cercas) {
      const cerca = projeto.cercas[tipo];
      if (cerca.polygonLayer && state.map.hasLayer(cerca.polygonLayer)) {
        state.map.removeLayer(cerca.polygonLayer);
      }
    }
  }

  const allPoints = [];

  // Recria polígonos de todos os projetos, marcadores invisíveis e sem drag
  for (let pid in state.projetos) {
    const projeto = state.projetos[pid];
    for (let tipo in projeto.cercas) {
      const cerca = projeto.cercas[tipo];

      if (cerca.pontos.length > 2) {
        cerca.polygonLayer = L.polygon(
          cerca.pontos.map((p) => [p.lat, p.lng]),
          { color: cerca.color }
        ).addTo(state.map);

        cerca.polygonLayer.setStyle({
          opacity: 1,
          fillOpacity: 0.15,
        });

        cerca.pontos.forEach((p) => allPoints.push([p.lat, p.lng]));
      } else {
        cerca.polygonLayer = null;
      }

      if (Array.isArray(cerca.markers)) {
        cerca.markers.forEach((marker) => {
          if (marker && typeof marker.setOpacity === "function") {
            marker.setOpacity(0); // invisíveis na aba Geral
          }
          if (marker && marker.dragging) {
            marker.dragging.disable(); // sem drag na aba Geral
          }
        });
      }
    }
  }

  if (allPoints.length > 0) {
    const bounds = L.latLngBounds(allPoints);
    state.map.fitBounds(bounds, { padding: [20, 20] });
  }
}

function refreshMapForProjectMode(projetoId) {
  if (!state.map) return;
  const projetoAtivo = state.projetos[projetoId];
  if (!projetoAtivo) return;

  // 1) Limpa polígonos e oculta TODOS os marcadores de TODOS os projetos
  for (let pid in state.projetos) {
    const proj = state.projetos[pid];
    for (let tipo in proj.cercas) {
      const cerca = proj.cercas[tipo];

      // Remove polígonos existentes
      if (cerca.polygonLayer && state.map.hasLayer(cerca.polygonLayer)) {
        state.map.removeLayer(cerca.polygonLayer);
      }
      cerca.polygonLayer = null;

      // Oculta e desabilita drag de todos os marcadores
      if (Array.isArray(cerca.markers)) {
        cerca.markers.forEach((marker) => {
          if (!marker) return;
          if (typeof marker.setOpacity === "function") {
            marker.setOpacity(0); // outros projetos sempre invisíveis
          }
          if (marker.dragging) {
            marker.dragging.disable();
          }
        });
      }
    }
  }

  // 2) Recria polígonos e configura marcadores SÓ do projeto ativo
  for (let tipo in projetoAtivo.cercas) {
    const cerca = projetoAtivo.cercas[tipo];

    // Polígono do projeto ativo
    if (cerca.pontos.length > 2) {
      cerca.polygonLayer = L.polygon(
        cerca.pontos.map((p) => [p.lat, p.lng]),
        { color: cerca.color }
      ).addTo(state.map);

      cerca.polygonLayer.setStyle({
        opacity: 1,
        fillOpacity: tipo === state.cercaAtual ? 0.25 : 0.1,
      });
    } else {
      cerca.polygonLayer = null;
    }

    // Marcadores do projeto ativo
    if (Array.isArray(cerca.markers)) {
      cerca.markers.forEach((marker) => {
        if (!marker) return;

        // Só a cerca ativa tem marcadores visíveis e arrastáveis
        const ativa = tipo === state.cercaAtual;

        if (typeof marker.setOpacity === "function") {
          marker.setOpacity(ativa ? 1 : 0);
        }

        if (marker.dragging) {
          if (ativa) {
            marker.dragging.enable();
          } else {
            marker.dragging.disable();
          }
        }
      });
    }
  }
}

// ---------------- Modo da sidebar (chamado de fora) ---------------- //
export function setSidebarMode(mode) {
  if (mode === "global") {
    state.sidebarMode = "global";
    updateSidebarPanelsVisibility();
    showAllProjectsOnMap();
    updateTopTabsUI();
    atualizarStatusSistema();
  } else if (mode === "project") {
    const ids = Object.keys(state.projetos);
    if (ids.length === 0) return;
    const targetId = state.projetoAtual || ids[0];
    ativarProjeto(targetId);
  }
}

// ---------------- Importar JSON local ---------------- //
export function importarMultiplosJSON(event) {
  const files = event.target.files;
  for (let file of files) {
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const data = JSON.parse(e.target.result);
        const id = file.name.replace(".json", "") + "_" + Date.now();
        criarProjeto(id, data);
      } catch (error) {
        alert("Erro ao ler o arquivo " + file.name + ": " + error.message);
      }
    };
    reader.readAsText(file);
  }
}

// ---------------- Criar projeto novo ---------------- //
export function criarNovoProjeto() {
  const nome = prompt("Nome do projeto:");
  if (!nome) return;
  const descricao = prompt("Descrição do projeto:") || "";
  const id = nome.replace(/\s+/g, "_") + "_" + Date.now();

  const data = {
    fence_name: nome,
    description: descricao,
    internal: [],
    external: [],
    box: [],
  };

  criarProjeto(id, data);
}

// ---------------- Criar projeto (DOM + estado) ---------------- //
export function criarProjeto(id, data) {
  state.projetos[id] = {
    nome: data.fence_name || "Projeto sem nome",
    descricao: data.description || "",
    cercas: {
      internal: {
        pontos: [],
        markers: [],
        color: "red",
        polygonLayer: null,
      },
      external: {
        pontos: [],
        markers: [],
        color: "yellow",
        polygonLayer: null,
      },
      box: {
        pontos: [],
        markers: [],
        color: "blue",
        polygonLayer: null,
      },
    },
  };

  const projeto = state.projetos[id];

  // 🔹 Bloco que vai ficar dentro de #projetosContainer
  const bloco = document.createElement("div");
  bloco.className = "projeto-bloco";

  // 🔹 HTML do bloco: botões + cercas + card do projeto (projeto-container)
  bloco.innerHTML = `
   <div class="projeto-container" id="projeto_${id}">
      <div class="btn-row">
        <button class="btn-export-json">📤 Exportar JSON</button>
        <button class="btn-export-serial">🔌 Enviar p/ disp</button>
        <button class="btn-remover">🗑️ Apagar Projeto</button>
      </div>

      <div style="margin-top: 8px;"></div>

      <div class="cerca-row">
        <label>🔴 Área controlada</label>
        <div class="cerca-buttons">
          <button class="btn-main btn-small btn-interna-add">➕</button>
          <button class="btn-main btn-small btn-interna-del">🗑️</button>
          <!-- Importar KML para ÁREA CONTROLADA -->
          <input type="file" class="kml-file kml-file-internal" accept=".kml" hidden>
          <label class="btn-main btn-small kml-btn kml-btn-internal">📁</label>
        </div>
      </div>

      <div class="cerca-row">
        <label>🟡 Faixa de pista</label>
        <div class="cerca-buttons">
          <button class="btn-main btn-small btn-externa-add">➕</button>
          <button class="btn-main btn-small btn-externa-del">🗑️</button>
          <!-- Importar KML para FAIXA -->
          <input type="file" class="kml-file kml-file-external" accept=".kml" hidden>
          <label class="btn-main btn-small kml-btn kml-btn-external">📁</label>
        </div>
      </div>

      <div class="cerca-row">
        <label>🔵 Box</label>
        <div class="cerca-buttons">
          <button class="btn-main btn-small btn-box-add">➕</button>
          <button class="btn-main btn-small btn-box-del">🗑️</button>
          <!-- Importar KML para BOX -->
          <input type="file" class="kml-file kml-file-box" accept=".kml" hidden>
          <label class="btn-main btn-small kml-btn kml-btn-box">📁</label>
        </div>
      </div>

    
      <h3>${projeto.nome}</h3>
      <div class="campo">
        <label>Nome do Projeto:</label>
        <input type="text" value="${projeto.nome}">
      </div>
      <div class="campo">
        <label>Descrição:</label>
        <textarea rows="2">${projeto.descricao}</textarea>
      </div>

      <ul class="lista-internal"></ul>
      <ul class="lista-external"></ul>
      <ul class="lista-box"></ul>
    </div>
  `;

  // Anexa bloco no painel de projetos
  document.getElementById("projetosContainer").appendChild(bloco);

  // 🔹 Referência ao card interno (continua com id="projeto_<id>")
  const container = bloco.querySelector("#projeto_" + id);

  // ---------- Liga eventos dos inputs de nome/descrição ----------
  const [inputNome] = container.getElementsByTagName("input");
  const textareaDescricao = container.getElementsByTagName("textarea")[0];

  inputNome.addEventListener("change", (e) => {
    const novoNome = e.target.value.trim();
    if (!novoNome) return;
    projeto.nome = novoNome;
    container.querySelector("h3").textContent = novoNome;

    const tabsBar = document.getElementById("tabsBar");
    const tab = tabsBar.querySelector(
      `.tab-button[data-projeto-id="${id}"]`
    );
    if (tab) tab.textContent = novoNome;

    atualizarStatusSistema();
  });

  textareaDescricao.addEventListener("change", (e) => {
    projeto.descricao = e.target.value;
  });

  // ---------- Botões de cerca (agora fora da .projeto-container) ----------
  bloco
    .querySelector(".btn-interna-add")
    .addEventListener("click", () => selecionarCerca(id, "internal"));
  bloco
    .querySelector(".btn-interna-del")
    .addEventListener("click", () => apagarCerca(id, "internal"));

  bloco
    .querySelector(".btn-externa-add")
    .addEventListener("click", () => selecionarCerca(id, "external"));
  bloco
    .querySelector(".btn-externa-del")
    .addEventListener("click", () => apagarCerca(id, "external"));

  bloco
    .querySelector(".btn-box-add")
    .addEventListener("click", () => selecionarCerca(id, "box"));
  bloco
    .querySelector(".btn-box-del")
    .addEventListener("click", () => apagarCerca(id, "box"));

  // ---------- Export / remover ----------
  bloco
    .querySelector(".btn-export-json")
    .addEventListener("click", () => exportarProjeto(id));
  bloco
    .querySelector(".btn-export-serial")
    .addEventListener("click", () => exportarProjetoParaSerial(id));
  bloco
    .querySelector(".btn-remover")
    .addEventListener("click", () => removerProjeto(id));

  // ---------- KML por cerca (cada botão importa direto para sua cerca) ----------
  function configurarBotaoKml(tipo) {
    const btn = bloco.querySelector(`.kml-btn-${tipo}`);
    const input = bloco.querySelector(`.kml-file-${tipo}`);
    if (!btn || !input) return;

    btn.addEventListener("click", () => input.click());
    input.addEventListener("change", (e) => handleKMLUpload(e, id, tipo));
  }

  configurarBotaoKml("internal");
  configurarBotaoKml("external");
  configurarBotaoKml("box");

  // ---------- Aba do projeto ----------
  createProjectTab(id, projeto.nome);

  // ---------- Carrega cercas (se vieram do JSON) ----------
  carregarCercas(id, data);

  // Após carregar, ajusta visibilidade dos botões KML conforme existência de pontos
  atualizarVisibilidadeKmlPorCerca(id, "internal");
  atualizarVisibilidadeKmlPorCerca(id, "external");
  atualizarVisibilidadeKmlPorCerca(id, "box");

  // ---------- Ativa esse projeto (modo projeto) ----------
  ativarProjeto(id);
}

// ---------------- Ativar projeto (aba de projeto + sidebar modo projeto) ---------------- //
export function ativarProjeto(projetoId) {
  if (!state.projetos[projetoId]) return;

  state.sidebarMode = "project";
  if (
    !state.cercaAtual ||
    !state.projetos[projetoId].cercas[state.cercaAtual]
  ) {
    state.cercaAtual = "internal";
  }
  state.projetoAtual = projetoId;

  updateSidebarPanelsVisibility();
  refreshMapForProjectMode(projetoId);
  updateTopTabsUI();
  updateProjectCardsVisibility(projetoId);
  centralizarProjetoNoMapa(projetoId);
  atualizarStatusSistema();
}

// ---------------- Seleção de cerca (camada) ---------------- //
function selecionarCerca(projetoId, tipo) {
  state.projetoAtual = projetoId;
  state.cercaAtual = tipo;

  const projeto = state.projetos[projetoId];

  for (let nome in projeto.cercas) {
    const cerca = projeto.cercas[nome];
    const ativa = nome === tipo;

    if (Array.isArray(cerca.markers)) {
      cerca.markers.forEach((marker) => {
        if (marker && typeof marker.setOpacity === "function") {
          marker.setOpacity(ativa ? 1 : 0);
        }
      });
    }

    if (cerca.polygonLayer && typeof cerca.polygonLayer.setStyle === "function") {
      cerca.polygonLayer.setStyle({
        opacity: 1,
        fillOpacity: ativa ? 0.25 : 0.1,
      });
    }
  }

  atualizarStatusSistema();
}

// ---------------- Helper: visibilidade botão KML por cerca ---------------- //
function atualizarVisibilidadeKmlPorCerca(projetoId, tipo) {
  const container = document.getElementById("projeto_" + projetoId);
  if (!container) return;
  const bloco = container.closest(".projeto-bloco");
  if (!bloco) return;

  const btn = bloco.querySelector(`.kml-btn-${tipo}`);
  if (!btn) return;

  const projeto = state.projetos[projetoId];
  const cerca = projeto?.cercas?.[tipo];
  if (!cerca) return;

  if (cerca.pontos.length > 0) {
    btn.style.display = "none";
  } else {
    btn.style.display = "inline-flex";
  }
}

// ---------------- Cercas ---------------- //
export function adicionarPontoCerca(projetoId, tipo, lat, lng) {
  const projeto = state.projetos[projetoId];
  const cerca = projeto.cercas[tipo];

  // BOX: no máximo 4 pontos
  if (tipo === "box" && cerca.pontos.length >= 4) {
    alert("A cerca BOX (azul) pode ter no máximo 4 pontos.");
    return;
  }

  const marker = L.marker([lat, lng], { draggable: true }).addTo(state.map);

  // Atualiza ponto após arrastar – só se estiver em modo projeto E no projeto ativo
  marker.on("dragend", (e) => {
    if (
      state.sidebarMode !== "project" ||
      state.projetoAtual !== projetoId
    ) {
      return; // ignora movimentos em modo geral ou em outro projeto
    }

    const novaPosicao = e.target.getLatLng();
    const idx = cerca.markers.indexOf(marker);
    if (idx !== -1) {
      cerca.pontos[idx] = { lat: novaPosicao.lat, lng: novaPosicao.lng };
      atualizarPoligonos(projetoId);
      atualizarListas(projetoId);
    }
  });

  // Remover ponto (clique direito) – só se estiver em modo projeto E no projeto ativo
  marker.on("contextmenu", () => {
    if (
      state.sidebarMode !== "project" ||
      state.projetoAtual !== projetoId
    ) {
      return; // não remove nada na aba Geral
    }

    const idx = cerca.markers.indexOf(marker);
    if (idx !== -1) {
      cerca.markers.splice(idx, 1);
      cerca.pontos.splice(idx, 1);
      state.map.removeLayer(marker);
      atualizarPoligonos(projetoId);
      atualizarListas(projetoId);
      atualizarVisibilidadeKmlPorCerca(projetoId, tipo);
    }
  });

  // Se não for o projeto/cerca ativos, começa oculto e com drag desabilitado
  if (state.projetoAtual !== projetoId || state.cercaAtual !== tipo) {
    if (typeof marker.setOpacity === "function") {
      marker.setOpacity(0);
    }
  }

  // Em modo Geral, sempre desabilita drag
  if (state.sidebarMode !== "project" || state.projetoAtual !== projetoId) {
    if (marker.dragging) {
      marker.dragging.disable();
    }
  }

  cerca.markers.push(marker);
  cerca.pontos.push({ lat, lng });

  // Atualiza visibilidade do botão KML (esconde se passou a ter pontos)
  atualizarVisibilidadeKmlPorCerca(projetoId, tipo);
}

export function apagarCerca(projetoId, tipo) {
  const projeto = state.projetos[projetoId];
  const cerca = projeto.cercas[tipo];

  cerca.markers.forEach((marker) => state.map.removeLayer(marker));
  cerca.markers = [];

  if (cerca.polygonLayer) {
    state.map.removeLayer(cerca.polygonLayer);
    cerca.polygonLayer = null;
  }

  cerca.pontos = [];
  atualizarListas(projetoId);

  // Reexibe botão KML dessa cerca (agora vazia)
  atualizarVisibilidadeKmlPorCerca(projetoId, tipo);
}

// ---------------- Polígonos / listas ---------------- //
export function atualizarPoligonos(projetoId) {
  const projeto = state.projetos[projetoId];
  for (let tipo in projeto.cercas) {
    const cerca = projeto.cercas[tipo];
    if (cerca.polygonLayer && state.map.hasLayer(cerca.polygonLayer)) {
      state.map.removeLayer(cerca.polygonLayer);
    }
    if (cerca.pontos.length > 2) {
      cerca.polygonLayer = L.polygon(
        cerca.pontos.map((p) => [p.lat, p.lng]),
        { color: cerca.color }
      ).addTo(state.map);
    } else {
      cerca.polygonLayer = null;
    }
  }
}

export function atualizarListas(projetoId) {
  const projeto = state.projetos[projetoId];
  const container = document.getElementById("projeto_" + projetoId);
  if (!container) return;

  const listaInternal = container.querySelector(".lista-internal");
  const listaExternal = container.querySelector(".lista-external");
  const listaBox = container.querySelector(".lista-box");

  listaInternal.innerHTML = projeto.cercas.internal.pontos
    .map(
      (p, i) =>
        `<li>Ponto ${i + 1}: (${p.lat.toFixed(6)}, ${p.lng.toFixed(6)})</li>`
    )
    .join("");

  listaExternal.innerHTML = projeto.cercas.external.pontos
    .map(
      (p, i) =>
        `<li>Ponto ${i + 1}: (${p.lat.toFixed(6)}, ${p.lng.toFixed(6)})</li>`
    )
    .join("");

  listaBox.innerHTML = projeto.cercas.box.pontos
    .map(
      (p, i) =>
        `<li>Ponto ${i + 1}: (${p.lat.toFixed(6)}, ${p.lng.toFixed(6)})</li>`
    )
    .join("");
}

// ---------------- Centralizar projeto no mapa ---------------- //
export function centralizarProjetoNoMapa(projetoId) {
  if (!state.map) return;
  const projeto = state.projetos[projetoId];
  if (!projeto) return;

  const pts = [];
  for (let tipo in projeto.cercas) {
    projeto.cercas[tipo].pontos.forEach((p) => {
      pts.push([p.lat, p.lng]);
    });
  }

  if (pts.length === 0) return;

  const bounds = L.latLngBounds(pts);
  state.map.fitBounds(bounds, { padding: [20, 20] });
}

// ---------------- Helper para normalizar formato antigo/novo ---------------- //
function converterPontoJsonParaLatLng(p) {
  // Formato novo: [latitude_scaled, longitude_scaled]
  if (Array.isArray(p) && p.length >= 2) {
    const latEsc = Number(p[0]);
    const lngEsc = Number(p[1]);
    if (!Number.isNaN(latEsc) && !Number.isNaN(lngEsc)) {
      return {
        lat: latEsc / 1e6,
        lng: lngEsc / 1e6,
      };
    }
  }

  // Formato antigo: { latitude: ..., longitude: ... }
  if (p && typeof p === "object") {
    const latEsc = Number(p.latitude);
    const lngEsc = Number(p.longitude);
    if (!Number.isNaN(latEsc) && !Number.isNaN(lngEsc)) {
      return {
        lat: latEsc / 1e6,
        lng: lngEsc / 1e6,
      };
    }
  }

  // Formato inválido
  return null;
}

// ---------------- Carregar cercas (JSON/KML/serial) ---------------- //
export function carregarCercas(projetoId, data) {
  (data.internal || []).forEach((p) => {
    const pt = converterPontoJsonParaLatLng(p);
    if (pt) {
      adicionarPontoCerca(projetoId, "internal", pt.lat, pt.lng);
    }
  });

  (data.external || []).forEach((p) => {
    const pt = converterPontoJsonParaLatLng(p);
    if (pt) {
      adicionarPontoCerca(projetoId, "external", pt.lat, pt.lng);
    }
  });

  (data.box || []).forEach((p) => {
    const pt = converterPontoJsonParaLatLng(p);
    if (pt) {
      adicionarPontoCerca(projetoId, "box", pt.lat, pt.lng);
    }
  });

  atualizarPoligonos(projetoId);
  atualizarListas(projetoId);
}

// ---------------- KML ---------------- //
export function handleKMLUpload(event, projetoId, tipo) {
  const file = event.target.files[0];
  if (!file) {
    alert("Nenhum arquivo selecionado.");
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const text = e.target.result;
      const parser = new DOMParser();
      const kmlDoc = parser.parseFromString(text, "text/xml");

      // ✅ Garante que a biblioteca foi carregada
      const tg = toGeoJSON;
      if (!tg || typeof tg.kml !== "function") {
        throw new Error(
          "Biblioteca toGeoJSON não carregada. Verifique se o script UMD está incluído no index.html."
        );
      }

      const geojson = tg.kml(kmlDoc);
      const coords = [];

      geojson.features.forEach((feature) => {
        if (feature.geometry && feature.geometry.type === "Polygon") {
          feature.geometry.coordinates[0].forEach((coord) => {
            coords.push({ lat: coord[1], lng: coord[0] });
          });
        }
      });

      if (coords.length === 0) {
        alert("Nenhum polígono válido encontrado no KML.");
        return;
      }

      const projeto = state.projetos[projetoId];
      const cerca = projeto.cercas[tipo];

      // limpa cerca antiga
      cerca.markers.forEach((marker) => state.map.removeLayer(marker));
      cerca.markers = [];
      if (cerca.polygonLayer) {
        state.map.removeLayer(cerca.polygonLayer);
        cerca.polygonLayer = null;
      }
      cerca.pontos = [];

      coords.forEach((p) => adicionarPontoCerca(projetoId, tipo, p.lat, p.lng));

      atualizarPoligonos(projetoId);
      atualizarListas(projetoId);
      centralizarProjetoNoMapa(projetoId);
      atualizarVisibilidadeKmlPorCerca(projetoId, tipo);
      alert("KML importado com sucesso para a cerca " + tipo.toUpperCase() + ".");
    } catch (error) {
      console.error("Erro ao processar KML:", error);
      alert("Erro ao processar o arquivo KML: " + error.message);
    }
  };

  reader.readAsText(file);
}

// ---------------- JSON export local ---------------- //
// Sempre exporta no FORMATO NOVO: arrays [lat, lng] * 1e6.
// Mantém quebras de linha e coloca cada par lat,long na mesma linha.
export function gerarJsonProjeto(projetoId) {
  const projeto = state.projetos[projetoId];

  const tipos = Object.keys(projeto.cercas);

  const linhas = [];

  const nomeStr = JSON.stringify(projeto.nome);
  const descStr = JSON.stringify(projeto.descricao);

  linhas.push("{");
  linhas.push(`"fence_name":${nomeStr},`);
  linhas.push(`"description":${descStr},`);

  tipos.forEach((tipo, idxTipo) => {
    const pontos = projeto.cercas[tipo].pontos;
    const isLastTipo = idxTipo === tipos.length - 1;

    linhas.push(`"${tipo}":[`);

    pontos.forEach((p, idxP) => {
      const lat = Math.round(p.lat * 1e6);
      const lng = Math.round(p.lng * 1e6);
      const isLastPonto = idxP === pontos.length - 1;

      // Cada par na MESMA linha, sem espaços
      linhas.push(`[${lat},${lng}]${isLastPonto ? "" : ","}`);
    });

    linhas.push(`]${isLastTipo ? "" : ","}`);
  });

  linhas.push("}");

  return linhas.join("\n");
}

export function exportarProjeto(projetoId) {
  const projeto = state.projetos[projetoId];
  const json = gerarJsonProjeto(projetoId);

  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = projeto.nome.replace(/\s+/g, "_") + ".json";
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------- Import / Export via Serial ---------------- //
export async function importarJsonDaSerial() {
  try {
    const lsOutput = await enviarComandoSerial("ls", 2000);
    const linhasBrutas = lsOutput
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const arquivosJson = [];

    for (let linha of linhasBrutas) {
      let texto = linha;
      const prefix = "found file:";
      if (texto.toLowerCase().startsWith(prefix)) {
        texto = texto.slice(prefix.length).trim();
      }

      const partes = texto.split(/\s+/);
      const possivelNome = partes[partes.length - 1];

      if (possivelNome.toLowerCase().endsWith(".json")) {
        const baseNome = possivelNome.replace(/^\/+/, "").split("/").pop();
        arquivosJson.push(baseNome);
      }
    }

    if (arquivosJson.length === 0) {
      alert("Nenhum arquivo .json encontrado na ESP32 (comando ls).");
      console.log("Saída do ls:", lsOutput);
      return;
    }

    const escolha = prompt(
      "Arquivos JSON encontrados na ESP32 (raiz):\n" +
        arquivosJson.map((f, i) => `${i + 1}. ${f}`).join("\n") +
        "\n\nDigite o número do arquivo que deseja importar:"
    );

    const idx = parseInt(escolha, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= arquivosJson.length) {
      alert("Escolha inválida.");
      return;
    }

    const nomeArquivo = arquivosJson[idx];
    const caminhoArquivo = normalizarNomeArquivoRoot(nomeArquivo);

    const catOutput = await enviarComandoSerial("cat " + caminhoArquivo, 4000);

    const inicioJson = catOutput.indexOf("{");
    const fimJson = catOutput.lastIndexOf("}");

    if (inicioJson === -1 || fimJson === -1 || fimJson <= inicioJson) {
      alert("Não foi possível encontrar um JSON válido em " + nomeArquivo);
      console.log("Saída bruta do cat:\n", catOutput);
      return;
    }

    const jsonText = catOutput.substring(inicioJson, fimJson + 1);
    const jsonData = JSON.parse(jsonText);

    const id = nomeArquivo.replace(".json", "") + "_" + Date.now();
    criarProjeto(id, jsonData);
    alert("Projeto importado a partir de " + nomeArquivo);
  } catch (e) {
    console.error(e);
    alert("Erro ao importar via serial:\n" + e);
  }
}

export async function exportarProjetoParaSerial(projetoId) {
  const statusEl = document.getElementById("statusSistema");
  const statusAnterior = statusEl ? statusEl.textContent : "";

  try {
    const projeto = state.projetos[projetoId];
    if (!projeto) {
      alert("Projeto não encontrado.");
      return;
    }

    // Sempre exporta usando o formato novo (arrays) com quebras de linha
    const json = gerarJsonProjeto(projetoId);

    const nomePadrao = projeto.nome.replace(/\s+/g, "_") + ".json";
    const entradaUsuario = prompt(
      "Informe o NOME do arquivo na ESP32 (apenas nome, sem diretórios):",
      nomePadrao
    );

    if (!entradaUsuario) {
      return;
    }

    const caminhoFinal = normalizarNomeArquivoRoot(entradaUsuario);
    const tempPath = "/temp.txt";

    if (statusEl) {
      statusEl.textContent =
        "⏳ Enviando arquivo para a ESP32... Não desconecte ou desligue o dispositivo.";
    }
    alert(
      "O arquivo será enviado para a ESP32.\n" +
        "Não desconecte nem desligue o dispositivo até o término da operação."
    );

    try {
      await enviarComandoSerial("rm " + tempPath, 2000);
    } catch (_) {}

    try {
      await enviarComandoSerial("rm " + caminhoFinal, 2000);
    } catch (_) {}

    const linhas = json.split("\n");

    for (let i = 0; i < linhas.length; i++) {
      const linhaOriginal = linhas[i];
      const textoEscapado = escaparTextoFedit(linhaOriginal);
      const cmd = `fedit ${tempPath} -t "${textoEscapado}"`;

      //   await enviarComandoSerial(cmd, 2000);
      //   await delay(10);

      await enviarComandoSerialAtePrompt(cmd);

      if (statusEl) {
        statusEl.textContent =
          `⏳ Enviando arquivo para a ESP32... ` +
          `Não desconecte ou desligue o dispositivo. (${i + 1}/${linhas.length})`;
      }
    }

    await enviarComandoSerial(`mv ${tempPath} ${caminhoFinal}`, 2000);
    alert("Projeto exportado para " + caminhoFinal + " na ESP32.");
  } catch (e) {
    console.error(e);
    alert("Erro ao exportar via serial:\n" + e);
  } finally {

    obterUsoDisco();

    if (statusEl) {
      statusEl.textContent = statusAnterior || "🟢 Sistema pronto";
    }
  }
}

export async function apagarJsonDaSerial() {
  try {
    const lsOutput = await enviarComandoSerial("ls", 2000);
    const linhasBrutas = lsOutput
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const arquivosJson = [];

    for (let linha of linhasBrutas) {
      let texto = linha;
      const prefix = "found file:";
      if (texto.toLowerCase().startsWith(prefix)) {
        texto = texto.slice(prefix.length).trim();
      }

      const partes = texto.split(/\s+/);
      const possivelNome = partes[partes.length - 1];

      if (possivelNome.toLowerCase().endsWith(".json")) {
        const baseNome = possivelNome.replace(/^\/+/, "").split("/").pop();
        arquivosJson.push(baseNome);
      }
    }

    if (arquivosJson.length === 0) {
      alert("Nenhum arquivo .json encontrado na ESP32 (comando ls).");
      console.log("Saída do ls:", lsOutput);
      return;
    }

    const escolha = prompt(
      "Arquivos JSON encontrados na ESP32 (raiz):\n" +
        arquivosJson.map((f, i) => `${i + 1}. ${f}`).join("\n") +
        "\n\nDigite o número do arquivo que deseja REMOVER:"
    );

    const idx = parseInt(escolha, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= arquivosJson.length) {
      alert("Escolha inválida.");
      return;
    }

    
    const nomeArquivo = arquivosJson[idx];
    const caminhoArquivo = normalizarNomeArquivoRoot(nomeArquivo);
    
    
    if (confirm("Realmente deseja apagar o arquivo: " + caminhoArquivo )== false)
    {
        return;
    }

    const catOutput = await enviarComandoSerialAtePrompt("rm " + caminhoArquivo);

    obterUsoDisco();
    
    alert("Arquivo " + nomeArquivo + " apagado com sucesso");

  } catch (e) {
    console.error(e);
    alert("Erro ao apagar arquivo:\n" + e);
  }
}

// ---------------- Remoção e status ---------------- //
export function removerProjeto(projetoId) {
  const projeto = state.projetos[projetoId];
  if (!projeto) return;

  for (let tipo in projeto.cercas) {
    const cerca = projeto.cercas[tipo];
    cerca.markers.forEach((marker) => state.map.removeLayer(marker));
    cerca.markers = [];
    if (cerca.polygonLayer) {
      state.map.removeLayer(cerca.polygonLayer);
      cerca.polygonLayer = null;
    }
    cerca.pontos = [];
  }

  const container = document.getElementById("projeto_" + projetoId);
  if (container) {
    const bloco = container.closest(".projeto-bloco");
    if (bloco) bloco.remove();
    else container.remove();
  }

  const tabsBar = document.getElementById("tabsBar");
  if (tabsBar) {
    const tab = tabsBar.querySelector(
      `.tab-button[data-projeto-id="${projetoId}"]`
    );
    if (tab) tabsBar.removeChild(tab);
  }

  delete state.projetos[projetoId];

  if (state.projetoAtual === projetoId) {
    state.projetoAtual = null;
    state.cercaAtual = null;

    const ids = Object.keys(state.projetos);
    if (ids.length > 0) {
      ativarProjeto(ids[0]);
    } else {
      // volta para modo global sem projetos
      state.sidebarMode = "global";
      updateSidebarPanelsVisibility();
      showAllProjectsOnMap();
      updateTopTabsUI();
      atualizarStatusSistema();
    }
  } else {
    if (state.sidebarMode === "global") {
      showAllProjectsOnMap();
    }
    atualizarStatusSistema();
  }
}

export function atualizarStatusSistema() {
  let texto = "🟢 Sistema pronto";

  if (state.medicaoAtiva) {
    texto = "📏 Medindo distância";
  } else if (state.sidebarMode === "global") {
    texto = "⚙️ Modo geral: todas as cercas visíveis (sem edição).";
  } else if (state.projetoAtual && state.cercaAtual) {
    const nomeProjeto =
      state.projetos[state.projetoAtual]?.nome || "Projeto desconhecido";
    texto = `✏️ Editando cerca "${state.cercaAtual}" do projeto "${nomeProjeto}"`;
  }

  document.getElementById("statusSistema").textContent = texto;
}


// ---------------- Uso do disco ---------------- //

/**
 * Atualiza status do disco
 */
export function atualizarUsoDisco(percent) {
  const bar = document.getElementById("diskUsageBar");
  const container = document.querySelector(".device-interactions-container");
  const text = document.getElementById("diskUsagePercent");

  if (percent < 0)
  {
    // "Desliga" o componente
    container.style.opacity = "0.4";
    container.style.pointerEvents = "none";
    bar.style.width = "0%";
    bar.style.backgroundColor = "#aaa";
    text.textContent = "—";
    return;
  }

  // Reabilita exibição
  container.style.opacity = "1.0";
  container.style.pointerEvents = "auto";
  text.textContent = text.dataset.lastValue || "0%";

  percent = Math.min(Math.max(percent, 0), 100); // clamp

  document.getElementById("diskUsageBar").style.width = percent + "%";
  document.getElementById("diskUsagePercent").textContent = percent + "%";

  // Troca de cor
  if (percent < 60) bar.style.backgroundColor = "#4caf50"; // verde
  else if (percent < 85) bar.style.backgroundColor = "#ffc107"; // amarelo
  else bar.style.backgroundColor = "#f44336"; // vermelho
}

export async function obterUsoDisco()
{

  if (isSerialConected() == false)
  {
    atualizarUsoDisco(-1); 
    return;
  }

  enviarComandoSerial('mount_fs', 100);

  const lsOutput = await enviarComandoSerial('fsinfo', 100);
  const linhasBrutas = lsOutput
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  for (let linha of linhasBrutas) {
    const texto = linha;

    // Detectar linha do tipo:
    // "Used : 7028 bytes (6.86 KiB) (0.78 %)"
    if (texto.toLowerCase().startsWith("used")) {
      const matchPercent = texto.match(/\(([\d.]+)\s*%\)/);
      if (matchPercent) {
        const percent = parseFloat(matchPercent[1]);
        if (!isNaN(percent)) {
          atualizarUsoDisco(percent); 
        }
      }
    }
  }

}


export async function format() 
{

  if (confirm("Deseja realmente formatar o dispositivo?\nTodos os dados serão apagados") == false)
  {
    return;
  }  

  atualizarUsoDisco(-1);

  await enviarComandoSerialAtePrompt('fsformat');

  alert("Dispositivo formatado com sucesso\n");

  obterUsoDisco();
}