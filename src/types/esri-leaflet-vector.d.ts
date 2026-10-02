declare module "esri-leaflet-vector/src/EsriLeafletVector.js" {
  import type { Layer } from "leaflet";

  export function vectorBasemapLayer(
    style: string,
    options: { apikey: string; version: 1 | 2; language?: string },
  ): Layer;
}
