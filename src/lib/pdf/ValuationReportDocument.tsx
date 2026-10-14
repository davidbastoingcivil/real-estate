import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { CadastralReportData } from "@/lib/pdf/types";

const forest = "#10251d";
const gold = "#c4a15b";
const ink = "#1f2933";
const muted = "#68737d";
const line = "#e2e6e4";
const pale = "#f5f6f4";
const cop = (value: number | null) => value === null ? "Sin dato" : `$ ${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(value)} COP`;
const dateLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Fecha no disponible" : new Intl.DateTimeFormat("es-CO", { dateStyle: "long" }).format(date);
};
const areaLabel = (value: number | null) => value === null ? "Sin dato" : `${value.toLocaleString("es-CO")} m²`;

const styles = StyleSheet.create({
  cover: { backgroundColor: forest, paddingTop: 54, paddingHorizontal: 48, paddingBottom: 54, color: "#fff", fontFamily: "Helvetica" },
  page: { paddingTop: 42, paddingHorizontal: 46, paddingBottom: 54, fontFamily: "Helvetica", color: ink, fontSize: 9 },
  brand: { color: gold, fontSize: 12, letterSpacing: 2, marginBottom: 8 },
  brandSub: { color: "#c6d0cb", fontSize: 7, letterSpacing: 2, marginBottom: 44 },
  coverImage: { width: "100%", height: 175, objectFit: "cover", marginBottom: 22, borderRadius: 4 },
  coverPlaceholder: { height: 145, marginBottom: 22, borderRadius: 4, backgroundColor: "#1a3429", justifyContent: "center", alignItems: "center" },
  coverPlaceholderText: { color: gold, fontSize: 8, letterSpacing: 1.2 },
  eyebrow: { color: gold, fontSize: 8, letterSpacing: 1.7, marginBottom: 10 },
  coverTitle: { fontSize: 25, lineHeight: 1.2, marginBottom: 10 },
  coverAddress: { color: "#c6d0cb", lineHeight: 1.5, fontSize: 10, marginBottom: 14 },
  coverRule: { borderBottomWidth: 1, borderBottomColor: gold, width: 55, marginVertical: 13 },
  heroTitle: { color: "#fff", fontSize: 13, letterSpacing: 0.7, marginBottom: 12 },
  heroGrid: { flexDirection: "row", gap: 10 },
  heroMetric: { flexGrow: 1, backgroundColor: "#1a3429", padding: 12, borderRadius: 4 },
  heroLabel: { color: "#c6d0cb", fontSize: 6.5, letterSpacing: 0.6, marginBottom: 6 },
  heroValue: { color: "#fff", fontSize: 10 },
  coverMeta: { color: "#c6d0cb", fontSize: 7, lineHeight: 1.5, marginTop: 26 },
  heading: { fontSize: 19, color: forest, marginBottom: 6 },
  intro: { color: muted, fontSize: 9, lineHeight: 1.5, marginBottom: 20 },
  section: { marginBottom: 18 },
  sectionTitle: { color: forest, fontSize: 10, letterSpacing: 0.7, marginBottom: 9 },
  facts: { flexDirection: "row", flexWrap: "wrap", borderTopWidth: 1, borderTopColor: line },
  fact: { width: "50%", paddingVertical: 9, paddingRight: 10, borderBottomWidth: 1, borderBottomColor: line },
  factLabel: { color: muted, fontSize: 7, marginBottom: 4 },
  factValue: { color: ink, fontSize: 9 },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: { width: "31%", backgroundColor: forest, padding: 12, borderRadius: 4 },
  metricLabel: { color: "#c6d0cb", fontSize: 6.5, marginBottom: 6 },
  metricValue: { color: "#fff", fontSize: 9 },
  callout: { backgroundColor: pale, borderLeftWidth: 3, borderLeftColor: gold, padding: 11, marginVertical: 8 },
  calloutText: { color: ink, fontSize: 8, lineHeight: 1.5 },
  map: { width: "100%", height: 285, objectFit: "cover", borderRadius: 5 },
  mapPlaceholder: { height: 285, backgroundColor: pale, borderRadius: 5, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: line },
  mapPlaceholderText: { color: muted, fontSize: 10 },
  mapCaption: { color: muted, fontSize: 6.5, marginTop: 5, marginBottom: 14 },
  sourceNote: { fontSize: 7, color: muted, lineHeight: 1.45, marginTop: 4 },
  bullet: { fontSize: 8, lineHeight: 1.5, color: ink, marginBottom: 6 },
  legal: { fontSize: 8, lineHeight: 1.55, color: muted, marginBottom: 8 },
  footer: { position: "absolute", bottom: 25, left: 46, right: 46, borderTopWidth: 1, borderTopColor: line, paddingTop: 8, flexDirection: "row", justifyContent: "space-between", color: muted, fontSize: 7 },
  coverFooter: { position: "absolute", bottom: 25, left: 48, right: 48, borderTopWidth: 1, borderTopColor: gold, paddingTop: 8, flexDirection: "row", justifyContent: "space-between", color: "#c6d0cb", fontSize: 7 },
});

function Footer({ data }: { data: CadastralReportData }) {
  return <View style={styles.footer} fixed>
    <Text>DAVID BASTO REAL ESTATE · Informe predial orientativo</Text>
    <Text>{data.metadata.reportId} · <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}/></Text>
  </View>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <View style={styles.fact}><Text style={styles.factLabel}>{label}</Text><Text style={styles.factValue}>{value}</Text></View>;
}

function OfficialCadastralSpecs({ data }: { data: CadastralReportData }) {
  const official = data.officialData;
  return <>
    <View style={styles.metrics}>
      <View style={styles.metric}><Text style={styles.metricLabel}>AVALÚO CATASTRAL IGAC</Text><Text style={styles.metricValue}>{cop(official.cadastralAppraisal)}</Text></View>
      <View style={styles.metric}><Text style={styles.metricLabel}>ÁREA DE TERRENO OFICIAL</Text><Text style={styles.metricValue}>{areaLabel(official.officialLotArea)}</Text></View>
      <View style={styles.metric}><Text style={styles.metricLabel}>ÁREA CONSTRUIDA OFICIAL</Text><Text style={styles.metricValue}>{areaLabel(official.officialBuiltArea)}</Text></View>
    </View>
    <View style={styles.facts}>
      <Fact label="NÚMERO PREDIAL REPORTADO POR IGAC" value={official.cadastralNumber || "No disponible"}/>
      <Fact label="DESTINACIÓN ECONÓMICA" value={official.economicDestination || "No disponible"}/>
      <Fact label="ESTRATO INDIVIDUAL DEL INMUEBLE" value={official.stratum}/>
      <Fact label="MUNICIPIO / CÓDIGO DIVIPOLA" value={`${official.municipality || "No disponible"}${official.municipalityCode ? ` · ${official.municipalityCode}` : ""}`}/>
    </View>
  </>;
}

function NormativeAndSpatialAnalysis({ data }: { data: CadastralReportData }) {
  const { potNormative, poiCounts } = data.geoSpatialContext;
  return <>
    <View wrap={false}>
      {data.subjectProperty.staticMapBase64
        ? <Image src={data.subjectProperty.staticMapBase64} style={styles.map}/>
        : <View style={styles.mapPlaceholder}><Text style={styles.mapPlaceholderText}>Mapa no disponible</Text></View>}
      <Text style={styles.mapCaption}>Radio de análisis: {data.geoSpatialContext.poiSearchRadiusUsed.toLocaleString("es-CO")} m · Punto del inmueble en dorado · POI agregados · © Mapbox · © OpenStreetMap.</Text>
    </View>
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>NORMA URBANA · POT</Text>
      <View style={styles.facts}>
        <Fact label="USO DEL SUELO POT" value={potNormative.landUse}/>
        <Fact label="ALTURA MÁXIMA" value={potNormative.maxHeight}/>
        <Fact label="TRATAMIENTO URBANÍSTICO" value={potNormative.treatment}/>
        <Fact label="USO / DESTINO ECONÓMICO CATASTRAL IGAC" value={data.officialData.economicDestination || "No disponible"}/>
      </View>
      <Text style={styles.sourceNote}>La destinación económica catastral no reemplaza la norma urbanística. No se encontró un resultado POT verificable por punto en la consulta documentada; para confirmar edificabilidad se requiere el instrumento y certificado de la autoridad municipal.</Text>
    </View>
    <View style={styles.section}>
        <Text style={styles.sectionTitle}>PUNTOS DE INTERÉS · RADIO DE {data.geoSpatialContext.poiSearchRadiusUsed.toLocaleString("es-CO")} M</Text>
      <View style={styles.facts}>
        <Fact label="TRANSPORTE" value={String(poiCounts.transport)}/>
        <Fact label="EDUCACIÓN" value={String(poiCounts.education)}/>
        <Fact label="COMERCIO" value={String(poiCounts.commercial)}/>
        <Fact label="SALUD" value={String(poiCounts.health)}/>
        <Fact label="PARQUES Y RECREACIÓN" value={String(poiCounts.parks)}/>
      </View>
      <Text style={styles.sourceNote}>Los conteos se calculan con los POI presentes en la plataforma al momento de generar el informe; el mapa muestra celdas agregadas. No se descargan ni almacenan nuevos puntos en Supabase.</Text>
    </View>
  </>;
}

export default function ValuationReportDocument({ data }: { data: CadastralReportData }) {
  const property = data.subjectProperty;
  const noCadastralRecord = data.officialData.recordFound === false;
  return <Document title={`Informe predial y de norma urbana - ${property.title}`} author="David Basto Real Estate" subject="Informe de inteligencia catastral y contexto territorial">
    <Page size="A4" style={styles.cover}>
      <Text style={styles.brand}>DB</Text>
      <Text style={styles.brandSub}>DAVID BASTO · REAL ESTATE</Text>
      {property.mainImageBase64
        ? <Image src={property.mainImageBase64} style={styles.coverImage}/>
        : <View style={styles.coverPlaceholder}><Text style={styles.coverPlaceholderText}>FICHA PREDIAL · {property.title.toLocaleUpperCase("es-CO")}</Text></View>}
      <Text style={styles.eyebrow}>INFORMACIÓN CATASTRAL Y CONTEXTO TERRITORIAL</Text>
      <Text style={styles.coverTitle}>INFORME DE INTELIGENCIA TERRITORIAL Y FICHA PREDIAL</Text>
      <Text style={styles.coverAddress}>{property.title}{"\n"}{property.address}</Text>
      <View style={styles.coverRule}/>
      <Text style={styles.heroTitle}>DATOS CATASTRALES DISPONIBLES</Text>
      <View style={styles.heroGrid}>
        <View style={styles.heroMetric}><Text style={styles.heroLabel}>AVALÚO CATASTRAL</Text><Text style={styles.heroValue}>{cop(data.officialData.cadastralAppraisal)}</Text></View>
        <View style={styles.heroMetric}><Text style={styles.heroLabel}>ÁREA DE TERRENO</Text><Text style={styles.heroValue}>{areaLabel(data.officialData.officialLotArea)}</Text></View>
        <View style={styles.heroMetric}><Text style={styles.heroLabel}>ÁREA CONSTRUIDA</Text><Text style={styles.heroValue}>{areaLabel(data.officialData.officialBuiltArea)}</Text></View>
      </View>
      {data.metadata.isMacroLotWarning && <View style={[styles.callout, { backgroundColor: "#392a24", borderLeftColor: gold }]}><Text style={[styles.calloutText, { color: "#fff" }]}>Búsqueda por coordenadas espaciales. Los datos pueden corresponder a un predio de mayor extensión no desenglobado.</Text></View>}
      <Text style={styles.coverMeta}>Emitido el {dateLabel(data.metadata.issueDate)} · Informe {data.metadata.reportId}{"\n"}Consulta priorizada por CHIP/identificador; coordenadas como alternativa.</Text>
      <View style={styles.coverFooter} fixed><Text>FICHA PREDIAL · FUENTES PÚBLICAS</Text><Text>{data.metadata.reportId}</Text></View>
    </Page>

    <Page size="A4" style={styles.page}>
      <Text style={styles.eyebrow}>01 · IDENTIFICACIÓN Y FICHA CATASTRAL</Text>
      <Text style={styles.heading}>Datos del inmueble</Text>
      <Text style={styles.intro}>Cruce al vuelo con registros catastrales y fuentes públicas. Los datos consultados no se almacenan en la plataforma.</Text>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>IDENTIFICACIÓN</Text>
        <View style={styles.facts}>
          <Fact label="INMUEBLE" value={property.title}/>
          <Fact label="DIRECCIÓN / UBICACIÓN" value={property.address}/>
          <Fact label="CÉDULA CATASTRAL REGISTRADA" value={property.legal.cadastralId}/>
          <Fact label="MATRÍCULA INMOBILIARIA" value={property.legal.realEstateId}/>
          <Fact label="COORDENADAS WGS84" value={property.coordinates ? `${property.coordinates.lat.toFixed(6)}, ${property.coordinates.lng.toFixed(6)}` : "No registradas"}/>
          <Fact label="MÉTODO DE CONSULTA" value={data.officialData.lookupMethod === "cadastral_id" ? "Número predial" : data.officialData.lookupMethod === "coordinates" ? "Coordenadas" : "Sin consulta"}/>
        </View>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>FICHA FÍSICA DEL INMUEBLE</Text>
        <View style={styles.facts}>
          <Fact label="TIPO DE INMUEBLE" value={property.type}/>
          <Fact label="ÁREA PUBLICADA" value={areaLabel(property.listedAreaM2)}/>
          <Fact label="HABITACIONES" value={String(property.bedrooms)}/>
          <Fact label="BAÑOS" value={String(property.bathrooms)}/>
          <Fact label="EDAD / CONSERVACIÓN" value="Sin dato estructurado"/>
          <Fact label="PARQUEADEROS / DEPÓSITOS" value="Sin dato estructurado"/>
        </View>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DATOS OFICIALES IGAC</Text>
        <OfficialCadastralSpecs data={data}/>
        {noCadastralRecord && <View style={styles.callout}><Text style={styles.calloutText}>No se encontraron registros públicos para esta cédula catastral. Verifica el identificador y la cobertura del gestor catastral del municipio.</Text></View>}
        {data.officialData.checkedAt && <Text style={styles.sourceNote}>Fecha de consulta indicada por la fuente: {dateLabel(data.officialData.checkedAt)}{data.officialData.servedFrom ? ` · modo de respuesta: ${data.officialData.servedFrom}` : ""}.</Text>}
        <Text style={styles.sourceNote}>El avalúo catastral es una referencia fiscal/administrativa: no representa avalúo comercial ni precio de mercado.</Text>
      </View>
      <View style={styles.callout}><Text style={styles.calloutText}>Área publicada en la ficha: {areaLabel(property.listedAreaM2)}. Las áreas oficiales mostradas provienen del catastro; para valores ausentes se conserva “Sin dato”.</Text></View>
      <Footer data={data}/>
    </Page>

    <Page size="A4" style={styles.page}>
      <Text style={styles.eyebrow}>02 · ANÁLISIS NORMATIVO Y ESPACIAL</Text>
      <Text style={styles.heading}>El predio y su entorno</Text>
      <Text style={styles.intro}>Vista satelital, contexto de puntos de interés y cobertura disponible de información normativa y de riesgos.</Text>
      <NormativeAndSpatialAnalysis data={data}/>
      <Footer data={data}/>
    </Page>

    <Page size="A4" style={styles.page}>
      <Text style={styles.eyebrow}>03 · CONTEXTO TERRITORIAL Y ALCANCE</Text>
      <Text style={styles.heading}>Indicadores municipales y fuentes</Text>
      <Text style={styles.intro}>Informe determinístico de fuentes públicas consultadas al vuelo. Los indicadores DANE son agregados municipales; no describen individualmente el inmueble.</Text>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>PERFIL MUNICIPAL DANE</Text>
        <View style={styles.facts}>
          <Fact label="POBLACIÓN CENSADA" value={data.geoSpatialContext.dane.population?.toLocaleString("es-CO") || "Sin dato"}/>
          <Fact label="HOGARES" value={data.geoSpatialContext.dane.households?.toLocaleString("es-CO") || "Sin dato"}/>
          <Fact label="VIVIENDAS" value={data.geoSpatialContext.dane.dwellings?.toLocaleString("es-CO") || "Sin dato"}/>
          <Fact label="AÑO CENSAL" value={data.geoSpatialContext.dane.censusYear?.toString() || "Sin dato"}/>
          <Fact label="IPM MUNICIPAL" value={data.geoSpatialContext.dane.ipm === null ? "Sin dato" : `${data.geoSpatialContext.dane.ipm.toLocaleString("es-CO")} %`}/>
          <Fact label="ACTUALIZACIÓN DEL DATASET" value={data.geoSpatialContext.dane.asOf || "Sin dato"}/>
        </View>
        {data.geoSpatialContext.dane.municipalStratumDistribution && <Text style={styles.sourceNote}>Distribución municipal de viviendas por estrato en el censo: {Object.entries(data.geoSpatialContext.dane.municipalStratumDistribution).map(([key, value]) => `${key.toUpperCase()}: ${value.toLocaleString("es-CO")}`).join(" · ")}. No es el estrato del predio consultado.</Text>}
        {data.officialData.municipalStatistics && <Text style={styles.sourceNote}>Estadística catastral municipal IGAC {data.officialData.municipalStatistics.year || "(año no indicado)"}: {data.officialData.municipalStatistics.propertyCount?.toLocaleString("es-CO") || "—"} predios y avalúo agregado {cop(data.officialData.municipalStatistics.appraisalTotal)}. Este total municipal no corresponde al inmueble.</Text>}
      </View>
      <View style={styles.section} wrap={false}>
        <Text style={styles.sectionTitle}>CAPA PREDICTIVA · COBERTURA DISPONIBLE</Text>
        <View style={styles.facts}>
          <Fact label="RIESGO DE REMOCIÓN EN MASA" value={data.predictiveAnalysis.physicalRisks.landslide}/>
          <Fact label="RIESGO DE INUNDACIÓN" value={data.predictiveAnalysis.physicalRisks.flooding}/>
          <Fact label="CATALIZADORES DE DESARROLLO" value={data.predictiveAnalysis.capitalGainCatalysts.length ? `${data.predictiveAnalysis.capitalGainCatalysts.length} identificados` : "No hay proyectos verificables en las fuentes consultadas"}/>
        </View>
      </View>
      {data.warnings.map((warning, index) => <Text key={`${index}-${warning}`} style={styles.bullet}>• {warning}</Text>)}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>FUENTES Y FECHA</Text>
        <Text style={styles.sourceNote}>IGAC: consulta predial por número o coordenadas y estadísticas catastrales. DANE: Censo Nacional de Población y Vivienda e IPM municipal. Los resultados se solicitan al generar el documento y no se escriben en las tablas de la aplicación.</Text>
        <Text style={styles.sourceNote}>Consulta emitida: {dateLabel(data.metadata.issueDate)} · Solicitante: {data.metadata.requestedBy} · Responsable del sistema: {data.metadata.evaluator}.</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ASPECTOS LEGALES Y ALCANCE</Text>
        <Text style={styles.legal}>Documento generado al vuelo mediante cruces espaciales de fuentes públicas abiertas (IGAC, DANE, OSM y servicios disponibles). No se guardan permanentemente estos resultados en la base de datos. Las áreas físicas y la norma expuesta no sustituyen una visita pericial, un Certificado de Tradición y Libertad, ni un Concepto de Norma Urbana emitido por la Curaduría Urbana o Secretaría de Planeación respectiva.</Text>
        <Text style={styles.legal}>La disponibilidad y vigencia dependen de la cobertura del gestor catastral y de las fuentes consultadas. La geometría catastral, si la fuente la entrega, es referencial y no certifica linderos. Los datos del censo municipal corresponden al nivel agregado.</Text>
        <Text style={styles.legal}>La consulta IGAC por coordenadas puede no encontrar predios en municipios cuyo catastro es administrado por un gestor distinto del IGAC. Para decisiones jurídicas, financieras o de edificabilidad, solicita certificados vigentes a las autoridades competentes.</Text>
      </View>
      <View style={styles.callout}><Text style={styles.calloutText}>Informe informativo generado automáticamente. La plataforma no certifica derechos reales, avalúos comerciales, uso del suelo ni edificabilidad.</Text></View>
      <Footer data={data}/>
    </Page>
  </Document>;
}
