import { state } from "./state.js";
import {
  enviarComandoSerial,
  delay,
  normalizarNomeArquivoRoot,
  escaparTextoFedit,
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

  const container = document.createElement("div");
  container.className = "projeto-container";
  container.id = "projeto_" + id;

  const projeto = state.projetos[id];

  container.innerHTML = `
    <h3>${projeto.nome}</h3>
    <div class="campo">
      <label>Nome do Projeto:</label>
      <input type="text" value="${projeto.nome}">
    </div>
    <div class="campo">
      <label>Descrição:</label>
      <textarea rows="2">${projeto.descricao}</textarea>
    </div>

    <div class="btn-row">
      <button class="btn-interna-add">Adicionar Interna 🔴</button>
      <button class="btn-interna-del">🗑️ Apagar Interna 🔴</button>
    </div>
    <div class="btn-row">
      <button class="btn-externa-add">Adicionar Externa 🟡</button>
      <button class="btn-externa-del">🗑️ Apagar Externa 🟡</button>
    </div>
    <div class="btn-row">
      <button class="btn-box-add">Adicionar Box 🔵</button>
      <button class="btn-box-del">🗑️ Apagar Box 🔵</button>
    </div>
    <div class="btn-row">
      <button class="btn-export-json">📤 Exportar JSON</button>
      <button class="btn-export-serial">📡 Enviar p/ ESP32</button>
      <button class="btn-remover">🗑️ Remover Projeto</button>
    </div>

    <div style="margin-top: 8px;">
      <label>Importar KML para:</label>
      <select class="kml-tipo">
        <option value="internal">🔴 Interna</option>
        <option value="external">🟡 Externa</option>
      </select>
      <input type="file" class="kml-file" accept=".kml">
    </div>

    <ul class="lista-internal"></ul>
    <ul class="lista-external"></ul>
    <ul class="lista-box"></ul>
  `;

  document.getElementById("projetosContainer").appendChild(container);

  // Cria aba para o projeto
  createProjectTab(id, projeto.nome);

  // Liga eventos dos inputs
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

  // Botões de cerca
  container
    .querySelector(".btn-interna-add")
    .addEventListener("click", () => selecionarCerca(id, "internal"));
  container
    .querySelector(".btn-interna-del")
    .addEventListener("click", () => apagarCerca(id, "internal"));

  container
    .querySelector(".btn-externa-add")
    .addEventListener("click", () => selecionarCerca(id, "external"));
  container
    .querySelector(".btn-externa-del")
    .addEventListener("click", () => apagarCerca(id, "external"));

  container
    .querySelector(".btn-box-add")
    .addEventListener("click", () => selecionarCerca(id, "box"));
  container
    .querySelector(".btn-box-del")
    .addEventListener("click", () => apagarCerca(id, "box"));

  // Export / remover
  container
    .querySelector(".btn-export-json")
    .addEventListener("click", () => exportarProjeto(id));
  container
    .querySelector(".btn-export-serial")
    .addEventListener("click", () => exportarProjetoParaSerial(id));
  container
    .querySelector(".btn-remover")
    .addEventListener("click", () => removerProjeto(id));

  // KML
  const selectKml = container.querySelector(".kml-tipo");
  const inputKml = container.querySelector(".kml-file");
  inputKml.addEventListener("change", (e) =>
    handleKMLUpload(e, id, selectKml.value)
  );

  // Carrega cercas (se já vieram do JSON)
  carregarCercas(id, data);

  // Ativa esse projeto (modo projeto)
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

// ---------------- Carregar cercas (JSON/KML/serial) ---------------- //
export function carregarCercas(projetoId, data) {
  (data.internal || []).forEach((p) =>
    adicionarPontoCerca(projetoId, "internal", p.latitude / 1e6, p.longitude / 1e6)
  );
  (data.external || []).forEach((p) =>
    adicionarPontoCerca(projetoId, "external", p.latitude / 1e6, p.longitude / 1e6)
  );
  (data.box || []).forEach((p) =>
    adicionarPontoCerca(projetoId, "box", p.latitude / 1e6, p.longitude / 1e6)
  );

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
      alert("KML importado com sucesso para a cerca " + tipo.toUpperCase() + ".");
    } catch (error) {
      console.error("Erro ao processar KML:", error);
      alert("Erro ao processar o arquivo KML: " + error.message);
    }
  };

  reader.readAsText(file);
}


// ---------------- JSON export local ---------------- //
export function gerarJsonProjeto(projetoId) {
  const projeto = state.projetos[projetoId];
  const dados = {};

  dados.fence_name = projeto.nome;
  dados.description = projeto.descricao;

  for (let tipo in projeto.cercas) {
    const pontos = projeto.cercas[tipo].pontos;
    dados[tipo] = pontos.map((p) => ({
      latitude: Math.round(p.lat * 1e6),
      longitude: Math.round(p.lng * 1e6),
    }));
  }

  return JSON.stringify(dados, null, 2);
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

      await enviarComandoSerial(cmd, 2000);
      await delay(10);

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
    if (statusEl) {
      statusEl.textContent = statusAnterior || "🟢 Sistema pronto";
    }
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
  if (container) container.remove();

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
