export type CadastralProperty = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  price: number;
  area: number;
  type: string;
  location: string;
  municipality: string | null;
  department: string | null;
  cadastral_id: string | null;
  lat: number;
  lng: number;
  bedrooms: number;
  bathrooms: number;
  images: string[];
};

export type CadastralReportData = {
  metadata: {
    reportId: string;
    issueDate: string;
    requestedBy: string;
    evaluator: string;
    isMacroLotWarning: boolean;
  };
  subjectProperty: {
    id: number;
    title: string;
    address: string;
    type: string;
    listedAreaM2: number;
    bedrooms: number;
    bathrooms: number;
    coordinates: { lat: number; lng: number } | null;
    legal: { cadastralId: string; realEstateId: string };
    mainImageBase64: Buffer | null;
    staticMapBase64: string | null;
  };
  officialData: {
    recordFound: boolean | null;
    lookupMethod: "cadastral_id" | "coordinates" | "none";
    cadastralNumber: string | null;
    cadastralAppraisal: number | null;
    officialBuiltArea: number | null;
    officialLotArea: number | null;
    economicDestination: string | null;
    stratum: string;
    municipality: string | null;
    municipalityCode: string | null;
    checkedAt: string | null;
    servedFrom: string | null;
    municipalStatistics: {
      year: number | null;
      appraisalTotal: number | null;
      propertyCount: number | null;
    } | null;
  };
  geoSpatialContext: {
    poiSearchRadiusUsed: number;
    potNormative: { landUse: string; maxHeight: string; treatment: string };
    poiCounts: { transport: number; commercial: number; health: number; education: number; parks: number };
    poiCells: Array<{ lat: number; lng: number; count: number }>;
    poiSource: "OpenStreetMap" | "No disponible";
    poiFetchedAt: string | null;
    dane: {
      asOf: string | null;
      censusYear: number | null;
      population: number | null;
      households: number | null;
      dwellings: number | null;
      municipalStratumDistribution: Record<string, number> | null;
      ipm: number | null;
    };
  };
  predictiveAnalysis: {
    physicalRisks: { landslide: string; flooding: string };
    capitalGainCatalysts: Array<{ projectType: string; distanceMeters: number; completionYear: number | "En planeación" }>;
  };
  warnings: string[];
};
