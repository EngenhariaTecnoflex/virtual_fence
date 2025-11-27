import { adicionarPontoCerca, atualizarPoligonos, atualizarListas } from "./projects.js";

export function handleKMLUpload(event, projetoId) {
    const file = event.target.files[0];
    if (!file) {
        alert("Nenhum arquivo selecionado.");
        return;
    }

    const tipoSelect = document.getElementById(`kmlTipo_${projetoId}`);
    const tipo = tipoSelect.value;
    const reader = new FileReader();

    reader.onload = function(e) {
    try {
        const text = e.target.result;
        const parser = new DOMParser();
        const kmlDoc = parser.parseFromString(text, "text/xml");

        const geojson = toGeoJSON.kml(kmlDoc);
        const coords = [];

        geojson.features.forEach(feature => {
        if (feature.geometry && feature.geometry.type === "Polygon") {
            feature.geometry.coordinates[0].forEach(coord => {
            coords.push({ lat: coord[1], lng: coord[0] });
            });
        }
        });

        if (coords.length === 0) {
        alert("Nenhum polígono válido encontrado no KML.");
        return;
        }

        const projeto = projetos[projetoId];
        const cerca = projeto.cercas[tipo];

        // 🔴 Apagar dados antigos
        cerca.markers.forEach(marker => map.removeLayer(marker));
        cerca.markers = [];
        if (cerca.polygonLayer) {
        map.removeLayer(cerca.polygonLayer);
        cerca.polygonLayer = null;
        }
        cerca.pontos = [];

        // 🟢 Adicionar novos pontos e marcadores
        coords.forEach(p => adicionarPontoCerca(projetoId, tipo, p.lat, p.lng));

        atualizarPoligonos(projetoId);
        atualizarListas(projetoId);
        alert("KML importado com sucesso para a cerca " + tipo.toUpperCase() + ".");
        } catch (error) {
            console.error("Erro ao processar KML:", error);
            alert("Erro ao processar o arquivo KML: " + error.message);
        }
    };

  reader.readAsText(file);
}
