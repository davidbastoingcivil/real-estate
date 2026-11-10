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
  municipality_code?: string | null;
  department: string | null;
  cadastral_id: string | null;
  chip?: string | null;
  national_cadastral_number?: string | null;
  real_estate_registration?: string | null;
  stratum?: number | null;
  cadastral_appraisal?: number | null;
  official_lot_area?: number | null;
  official_built_area?: number | null;
  garage_spaces?: number | null;
  deposits?: number | null;
  dossier?: { sections?: Array<{ title: string; description?: string; items?: string[] }> } | null;
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
    description: string | null;
    price: number;
    municipalityCode: string | null;
    type: string;
    listedAreaM2: number;
    bedrooms: number;
    bathrooms: number;
    coordinates: { lat: number; lng: number } | null;
    legal: { cadastralId: string; chip: string; nationalCadastralNumber: string; realEstateId: string };
    stratum: string;
    garages: number;
    deposits: number;
    dossierSections: Array<{ title: string; description?: string; items?: string[] }>;
    mainImageBase64: Buffer | null;
    galleryImagesBase64: Buffer[];
    staticMapBase64: string | null;
    mapUnavailableReason: string | null;
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
    poiAvailable: boolean;
    poiStatus: string;
    potNormative: { landUse: string; maxHeight: string; treatment: string };
    poiCounts: { transport: number; commercial: number; health: number; education: number; parks: number };
    poiCells: Array<{ lat: number; lng: number; count: number }>;
    poiSource: "OpenStreetMap" | "No disponible";
    poiFetchedAt: string | null;
    dane: {
      censusAvailable: boolean;
      ipmAvailable: boolean;
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
  client: { name: string; whatsapp: string } | null;
  financialSimulation: {
    propertyValue: number; downPaymentPercent: number; downPaymentValue: number; financedCapital: number;
    annualEffectiveRate: number; termYears: number; monthlyPayment: number; estimatedRent: number;
    grossAnnualYield: number; monthlyCashFlow: number;
  } | null;
};
