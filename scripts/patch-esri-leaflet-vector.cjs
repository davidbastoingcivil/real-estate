/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");

const modulePath = path.join(
  process.cwd(),
  "node_modules",
  "esri-leaflet-vector",
  "src",
  "MaplibreGLLayer.js",
);
const file = fs.readFileSync(modulePath, "utf8");
const oldImport = 'import maplibregl from "maplibre-gl";';
const compatibleImport = 'import * as maplibregl from "maplibre-gl";';

if (file.includes(compatibleImport)) process.exit(0);
if (!file.includes(oldImport)) {
  throw new Error("The installed Esri Leaflet Vector module changed; review its MapLibre import before building.");
}

fs.writeFileSync(modulePath, file.replace(oldImport, compatibleImport));
