// Importa o arquivo original como script clássico
import "./togeojson.js";

// A biblioteca original expõe "toGeoJSON" no globalThis
// Agora nós a reexportamos no estilo de módulo ES
export const toGeoJSON = window.toGeoJSON;
