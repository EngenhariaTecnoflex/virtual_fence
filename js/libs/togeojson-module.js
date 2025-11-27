/*!
 * togeojson.js - Biblioteca convertendo KML/GPX para GeoJSON
 * Licenciado sob BSD 2-Clause
 * Copyright (c) MapBox
 * https://github.com/mapbox/togeojson
 */

// Importa o arquivo original como script clássico
import "./togeojson.js";

// A biblioteca original expõe "toGeoJSON" no globalThis
// Agora nós a reexportamos no estilo de módulo ES
export const toGeoJSON = window.toGeoJSON;
