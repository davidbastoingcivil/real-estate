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
  coverHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  coverBrand: { flexDirection: "row", alignItems: "center", gap: 10 },
  coverBrandMark: { width: 38, height: 38, backgroundColor: gold, color: forest, justifyContent: "center", alignItems: "center", fontSize: 16, fontFamily: "Helvetica-Bold" },
  coverBrandName: { color: "#fff", fontSize: 14, fontFamily: "Helvetica-Bold", letterSpacing: 1 },
  coverBrandSub: { color: gold, fontSize: 7, letterSpacing: 1.2, marginTop: 3 },
  coverBadge: { color: gold, fontSize: 7, letterSpacing: 1, borderWidth: 1, borderColor: gold, paddingVertical: 5, paddingHorizontal: 8 },
  coverIdentity: { backgroundColor: "#1a2027", borderWidth: 1, borderColor: "#303740", borderRadius: 4, padding: 13, flexDirection: "row", flexWrap: "wrap", marginTop: 18 },
  coverIdentityCell: { width: "50%", paddingVertical: 7, paddingRight: 8 },
  coverMetaLabel: { color: "#85909b", fontSize: 6.5, letterSpacing: 1, marginBottom: 5 },
  coverMetaValue: { color: "#f5f6f7", fontSize: 9, fontFamily: "Helvetica-Bold" },
  reportHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderBottomColor: gold, paddingBottom: 7, marginBottom: 13 },
  reportBrand: { flexDirection: "row", alignItems: "center", gap: 7 },
  reportBrandMark: { backgroundColor: forest, color: gold, padding: 5, fontSize: 11, fontFamily: "Helvetica-Bold" },
  reportBrandName: { color: forest, fontSize: 9, fontFamily: "Helvetica-Bold", letterSpacing: 0.5 },
  reportBrandSub: { color: "#9a793d", fontSize: 6.5, letterSpacing: 0.8, marginTop: 2 },
  reportHeaderMeta: { color: muted, fontSize: 6.5, textAlign: "right" },
  reportHeroImage: { width: "100%", height: 138, objectFit: "cover", borderRadius: 4, marginBottom: 9 },
  reportHeroPlaceholder: { width: "100%", height: 138, backgroundColor: forest, borderRadius: 4, padding: 18, justifyContent: "flex-end", gap: 6, marginBottom: 9 },
  reportMetrics: { flexDirection: "row", gap: 6, marginBottom: 13 },
  reportMetric: { width: "24%", backgroundColor: pale, borderTopWidth: 2, borderTopColor: gold, padding: 8 },
  reportMetricLabel: { color: muted, fontSize: 5.5, letterSpacing: 0.5, marginBottom: 5 },
  reportMetricValue: { color: forest, fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  reportMetricNote: { color: "#39714f", fontSize: 6 },
  reportSectionTitle: { color: forest, fontSize: 9, fontFamily: "Helvetica-Bold", letterSpacing: 0.6, borderBottomWidth: 1, borderBottomColor: line, paddingBottom: 5, marginTop: 5, marginBottom: 7 },
  financeSectionTitle: { color: "#f0d58d", fontSize: 9, fontFamily: "Helvetica-Bold", letterSpacing: 0.6, borderBottomWidth: 1, borderBottomColor: "#465348", paddingBottom: 5, marginTop: 5, marginBottom: 7 },
  reportGallery: { flexDirection: "row", gap: 6, marginBottom: 8 },
  reportGalleryImage: { width: "32%", height: 55, objectFit: "cover", borderRadius: 3 },
  reportTable: { marginBottom: 8 },
  reportTableHead: { backgroundColor: "#eef1f3", borderBottomColor: "#cbd2d8", paddingVertical: 6 },
  reportRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e8ebed", paddingVertical: 6, paddingHorizontal: 5 },
  reportCell: { width: "34%", color: ink, fontSize: 7, lineHeight: 1.25, paddingRight: 5 },
  reportLabel: { width: "29%", fontFamily: "Helvetica-Bold" },
  reportDetail: { color: muted },
  reportMap: { width: "100%", height: 150, objectFit: "cover", marginBottom: 9, borderRadius: 4 },
  reportMapPlaceholder: { backgroundColor: pale, borderWidth: 1, borderColor: line, alignItems: "center", justifyContent: "center", color: muted, fontSize: 8 },
  reportContact: { backgroundColor: forest, padding: 9, marginTop: 7 },
  reportContactTitle: { color: gold, fontSize: 7, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  reportContactText: { color: "#fff", fontSize: 7 },  cover: { backgroundColor: forest, paddingTop: 54, paddingHorizontal: 48, paddingBottom: 54, color: "#fff", fontFamily: "Helvetica" },
  page: { paddingTop: 42, paddingHorizontal: 46, paddingBottom: 54, fontFamily: "Helvetica", color: ink, fontSize: 9 },
  brand: { color: gold, fontSize: 12, letterSpacing: 2, marginBottom: 8 },
  brandSub: { color: "#c6d0cb", fontSize: 7, letterSpacing: 2, marginBottom: 44 },
  coverImage: { width: "100%", height: 125, objectFit: "cover", marginBottom: 14, borderRadius: 4 },
  coverPlaceholder: { height: 90, marginBottom: 14, borderRadius: 4, backgroundColor: "#1a3429", justifyContent: "center", alignItems: "center" },
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
  map: { width: "100%", height: 150, objectFit: "cover", borderRadius: 5 },
  mapPlaceholder: { height: 150, backgroundColor: pale, borderRadius: 5, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: line },
  mapPlaceholderText: { color: muted, fontSize: 10 },
  mapCaption: { color: muted, fontSize: 6.5, marginTop: 5, marginBottom: 14 },
  sourceNote: { fontSize: 7, color: muted, lineHeight: 1.45, marginTop: 4 },
  bullet: { fontSize: 8, lineHeight: 1.5, color: ink, marginBottom: 6 },
  legal: { fontSize: 8, lineHeight: 1.55, color: muted, marginBottom: 8 },
  footer: { position: "absolute", bottom: 25, left: 46, right: 46, borderTopWidth: 1, borderTopColor: line, paddingTop: 8, flexDirection: "row", justifyContent: "space-between", color: muted, fontSize: 7 },
  coverFooter: { position: "absolute", bottom: 25, left: 48, right: 48, borderTopWidth: 1, borderTopColor: gold, paddingTop: 8, flexDirection: "row", justifyContent: "space-between", color: "#c6d0cb", fontSize: 7 },
  finance: { backgroundColor: forest, paddingTop: 42, paddingHorizontal: 42, paddingBottom: 50, fontFamily: "Helvetica", color: "#fff" },
  financeTableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#39483d", paddingVertical: 5, paddingHorizontal: 5 },
  financeTableCell: { width: "34%", color: "#f3f4f1", fontSize: 6.3, lineHeight: 1.2, paddingRight: 5, flexShrink: 1 },
  financeTableLabel: { width: "29%", color: "#efd38e", fontFamily: "Helvetica-Bold" },
  financeTableDetail: { color: "#b8c2ba" },
  financeTableHead: { backgroundColor: "#24372c", borderBottomColor: gold },
  financeReportHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderBottomColor: gold, paddingBottom: 7, marginBottom: 13 },
  financeBrandMark: { backgroundColor: gold, color: forest, padding: 5, fontSize: 11, fontFamily: "Helvetica-Bold" },
  financeBrandName: { color: "#fff", fontSize: 9, fontFamily: "Helvetica-Bold", letterSpacing: 0.5 },
  financeBrandSub: { color: "#e2c77f", fontSize: 6.5, letterSpacing: 0.8, marginTop: 2 },
  financeHeaderMeta: { color: "#c6d0cb", fontSize: 6.5, textAlign: "right" },
  financeTitle: { fontSize: 24, marginBottom: 8, color: "#fff" },
  financeIntro: { fontSize: 8, color: "#c6d0cb", lineHeight: 1.5, marginBottom: 20 },
  financeHero: { backgroundColor: "#1a3429", borderLeftWidth: 3, borderLeftColor: gold, padding: 15, marginBottom: 14 },
  financeLabel: { color: gold, fontSize: 7, letterSpacing: 1.2, marginBottom: 6 },
  financeValue: { color: "#f2d18c", fontSize: 23, marginBottom: 5 },
  financeSmall: { color: "#c6d0cb", fontSize: 7, lineHeight: 1.5 },
  financeTable: { borderWidth: 1, borderColor: "#465348", marginBottom: 15 },
  financeRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, paddingHorizontal: 11, borderBottomWidth: 1, borderBottomColor: "#39483d" },
  financeRowLast: { borderBottomWidth: 0 },
  financeRowLabel: { color: "#c6cec6", fontSize: 8 },
  financeRowValue: { color: "#fff", fontSize: 8, fontFamily: "Helvetica-Bold" },
  financeNote: { color: "#9ca79d", fontSize: 7, lineHeight: 1.5, marginBottom: 12 },
  financeFooter: { position: "absolute", bottom: 23, left: 45, right: 45, borderTopWidth: 1, borderTopColor: "#465348", paddingTop: 8, flexDirection: "row", justifyContent: "space-between", color: "#aeb8b0", fontSize: 6.5 },
  cta: { backgroundColor: forest, borderWidth: 1, borderColor: gold, padding: 14, marginTop: 13, marginBottom: 14 },
  ctaTitle: { color: gold, fontSize: 7, letterSpacing: 1.4, marginBottom: 6 },
  ctaText: { color: "#fff", fontSize: 13, marginBottom: 6 },
  ctaLink: { color: "#e4e8e1", fontSize: 8, marginBottom: 3 },
});

function Footer({ data, darkMode = false }: { data: CadastralReportData; darkMode?: boolean }) {
  return <View style={darkMode ? styles.financeFooter : styles.footer} fixed>
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
      <Text style={styles.mapCaption}>Radio de análisis: {data.geoSpatialContext.poiSearchRadiusUsed.toLocaleString("es-CO")} m · Inmueble en dorado · POI cercanos en azul · © Mapbox · © OpenStreetMap.</Text>
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
        <Fact label="TRANSPORTE" value={data.geoSpatialContext.poiAvailable ? String(poiCounts.transport) : "En validación territorial"}/>
        <Fact label="EDUCACIÓN" value={data.geoSpatialContext.poiAvailable ? String(poiCounts.education) : "En validación territorial"}/>
        <Fact label="COMERCIO" value={data.geoSpatialContext.poiAvailable ? String(poiCounts.commercial) : "En validación territorial"}/>
        <Fact label="SALUD" value={data.geoSpatialContext.poiAvailable ? String(poiCounts.health) : "En validación territorial"}/>
        <Fact label="PARQUES Y RECREACIÓN" value={data.geoSpatialContext.poiAvailable ? String(poiCounts.parks) : "En validación territorial"}/>
      </View>
      <Text style={styles.sourceNote}>Fuente: {data.geoSpatialContext.poiSource}. Los puntos se consultan al generar el informe y no se escriben en Supabase. Los datos de OpenStreetMap pueden estar incompletos y se distribuyen bajo ODbL.{data.geoSpatialContext.poiFetchedAt ? ` Consulta: ${dateLabel(data.geoSpatialContext.poiFetchedAt)}.` : ""}</Text>
    </View>
  </>;
}

function ReportTableRow({ label, value, detail = "", darkMode = false }: { label: string; value: string; detail?: string; darkMode?: boolean }) {
  const cellStyle = darkMode ? styles.financeTableCell : styles.reportCell;
  return <View style={darkMode ? styles.financeTableRow : styles.reportRow}>
    <Text style={[cellStyle, darkMode ? styles.financeTableLabel : styles.reportLabel]}>{label}</Text>
    <Text style={cellStyle}>{value || "Sin dato"}</Text>
    <Text style={[cellStyle, darkMode ? styles.financeTableDetail : styles.reportDetail]}>{detail || "Sin dato disponible"}</Text>
  </View>;
}

function ReportHeader({ section, data, darkMode = false }: { section: string; data: CadastralReportData; darkMode?: boolean }) {
  return <View style={darkMode ? styles.financeReportHeader : styles.reportHeader}>
    <View style={styles.reportBrand}><Text style={darkMode ? styles.financeBrandMark : styles.reportBrandMark}>DB</Text><View><Text style={darkMode ? styles.financeBrandName : styles.reportBrandName}>DAVID BASTO REAL ESTATE</Text><Text style={darkMode ? styles.financeBrandSub : styles.reportBrandSub}>{section}</Text></View></View>
    <View style={darkMode ? styles.financeHeaderMeta : styles.reportHeaderMeta}><Text>{data.metadata.reportId}</Text><Text>{dateLabel(data.metadata.issueDate)}</Text></View>
  </View>;
}

export default function ValuationReportDocument({ data }: { data: CadastralReportData }) {
  const property = data.subjectProperty;
  const simulation = data.financialSimulation;
  const money = (value: number) => cop(value);
  const monthlyCashColor = simulation && simulation.monthlyCashFlow < 0 ? "#b52e36" : "#187344";
  const cadastralNumber = property.legal.nationalCadastralNumber;
  return <Document title={`Informe Predial e Inteligencia Territorial con Plan Financiero - ${property.title}`} author="David Basto Real Estate" subject="Informe predial, territorial y simulación financiera">
    <Page size="A4" style={styles.cover}>
      <View style={styles.coverHeader}><View style={styles.coverBrand}><View style={styles.coverBrandMark}><Text>DB</Text></View><View><Text style={styles.coverBrandName}>DAVID BASTO</Text><Text style={styles.coverBrandSub}>REAL ESTATE · PROPIEDADES CON PROPÓSITO</Text></View></View><Text style={styles.coverBadge}>DOSSIER DE INTELIGENCIA</Text></View>
      <View style={{ height: 120 }}/>
      <Text style={styles.eyebrow}>INFORME TÉCNICO INMOBILIARIO Y FINANCIERO</Text>
      <Text style={styles.coverTitle}>Estudio Catastral,{"\n"}Territorial y Plan{"\n"}de Inversión</Text>
      <Text style={styles.coverAddress}>{property.title} · {data.officialData.municipality || property.address}</Text>
      <View style={styles.coverIdentity}>
        <View style={styles.coverIdentityCell}><Text style={styles.coverMetaLabel}>VALOR DEL INMUEBLE</Text><Text style={styles.coverMetaValue}>{cop(property.price)}</Text></View>
        <View style={styles.coverIdentityCell}><Text style={styles.coverMetaLabel}>MUNICIPIO · DIVIPOLA</Text><Text style={styles.coverMetaValue}>{data.officialData.municipality || property.address} · {property.municipalityCode || "Sin validar"}</Text></View>
        <View style={styles.coverIdentityCell}><Text style={styles.coverMetaLabel}>CÓDIGO DE INFORME</Text><Text style={styles.coverMetaValue}>{data.metadata.reportId}</Text></View>
        <View style={styles.coverIdentityCell}><Text style={styles.coverMetaLabel}>FECHA DE EMISIÓN</Text><Text style={styles.coverMetaValue}>{dateLabel(data.metadata.issueDate)}</Text></View>
        <View style={styles.coverIdentityCell}><Text style={styles.coverMetaLabel}>CHIP CATASTRAL</Text><Text style={styles.coverMetaValue}>{property.legal.chip}</Text></View>
        <View style={styles.coverIdentityCell}><Text style={styles.coverMetaLabel}>NÚMERO PREDIAL NACIONAL (30D)</Text><Text style={styles.coverMetaValue}>{cadastralNumber}</Text></View>
        {data.client && <View style={styles.coverIdentityCell}><Text style={styles.coverMetaLabel}>PREPARADO PARA</Text><Text style={styles.coverMetaValue}>{data.client.name}</Text></View>}
      </View>
      <View style={styles.coverFooter}><Text>Preparado por: David Basto · Ing. Civil · Asesor Inmobiliario</Text><Text>Consultoría Inmobiliaria e Inteligencia Territorial</Text></View>
    </Page>

    <Page size="A4" style={styles.finance}>
      <ReportHeader section="ANÁLISIS DE INVERSIÓN Y CORRIDA FINANCIERA" data={data} darkMode/>
      {simulation ? <>
        <View style={styles.reportMetrics}>
          {[[`CUOTA INICIAL (${simulation.downPaymentPercent.toFixed(0)}%)`,money(simulation.downPaymentValue),"Recursos propios"],["CAPITAL FINANCIADO",money(simulation.financedCapital),"Saldo proyectado"],["CUOTA MENSUAL ESTIMADA",money(simulation.monthlyPayment),`Tasa E.A. ${simulation.annualEffectiveRate.toFixed(2)}%`],["FLUJO MENSUAL ESTIMADO",money(simulation.monthlyCashFlow),simulation.estimatedRent > 0 ? "Después de cuota de crédito" : "Sin ingreso de arriendo"]].map(([label,value,note],index)=><View key={label} style={styles.reportMetric}><Text style={styles.reportMetricLabel}>{label}</Text><Text style={[styles.reportMetricValue,index===3?{color:monthlyCashColor}:{}]}>{value}</Text><Text style={styles.reportMetricNote}>{note}</Text></View>)}
        </View>
        <Text style={styles.financeSectionTitle}>01 · CÁLCULOS EJECUTADOS EN LA CALCULADORA DE INVERSIÓN</Text>
        <View style={styles.financeTable}>
          <View style={[styles.financeTableRow,styles.financeTableHead]}><Text style={[styles.financeTableCell,styles.financeTableLabel]}>VARIABLE DEL ANÁLISIS</Text><Text style={styles.financeTableCell}>VALOR / PORCENTAJE CALCULADO</Text><Text style={styles.financeTableCell}>DETALLE FINANCIERO</Text></View>
          <ReportTableRow label="Valor del inmueble" value={money(simulation.propertyValue)} detail="Precio registrado en el catálogo al generar el informe" darkMode/>
          <ReportTableRow label="Porcentaje de cuota inicial" value={`${simulation.downPaymentPercent.toFixed(2)}%`} detail="Porcentaje seleccionado por el usuario" darkMode/>
          <ReportTableRow label="Valor de cuota inicial" value={money(simulation.downPaymentValue)} detail="Valor del inmueble × porcentaje inicial" darkMode/>
          <ReportTableRow label="Capital financiado" value={money(simulation.financedCapital)} detail="Valor del inmueble menos cuota inicial" darkMode/>
          <ReportTableRow label="Tasa efectiva anual (E.A.)" value={`${simulation.annualEffectiveRate.toFixed(2)}% E.A.`} detail="Convertida a tasa efectiva mensual para amortización" darkMode/>
          <ReportTableRow label="Plazo de financiación" value={`${simulation.termYears} años (${simulation.termYears * 12} meses)`} detail="Amortización estimada de cuota fija" darkMode/>
          <ReportTableRow label="Cuota mensual del crédito" value={`${money(simulation.monthlyPayment)} / mes`} detail="Cálculo matemático, sin seguros ni cargos bancarios" darkMode/>
          <ReportTableRow label="Arriendo mensual estimado" value={`${money(simulation.estimatedRent)} / mes`} detail="Valor ingresado por el usuario" darkMode/>
          <ReportTableRow label="Rentabilidad bruta anual" value={`${simulation.grossAnnualYield.toFixed(2)}%`} detail="Arriendo mensual × 12 / valor del inmueble" darkMode/>
          <ReportTableRow label="Flujo neto mensual proyectado" value={`${money(simulation.monthlyCashFlow)} / mes`} detail="Arriendo estimado menos cuota de crédito" darkMode/>
        </View>
        <View style={styles.callout}><Text style={styles.calloutText}>El flujo resta la cuota del crédito al arriendo estimado. No incluye administración, impuestos, seguros, mantenimiento, vacancia ni otros costos. No se agregan escenarios de renta por zona sin una fuente configurable y verificada.</Text></View>
      </> : <View style={styles.callout}><Text style={styles.calloutText}>No se recibió una simulación. Genera el informe desde la calculadora del inmueble para incluir la corrida financiera vigente.</Text></View>}
      <Footer data={data}/>
    </Page>

    <Page size="A4" style={styles.page}>
      <ReportHeader section="FICHA TÉCNICA & CONTEXTO CATASTRAL" data={data}/>
      {property.mainImageBase64 ? <Image src={property.mainImageBase64} style={styles.reportHeroImage}/> : <View style={styles.reportHeroPlaceholder}><Text style={{color:"#fff",fontSize:12}}>{property.title}</Text><Text style={{color:"#c6d0cb",fontSize:8}}>{property.address} · Coordenadas: {property.coordinates ? `${property.coordinates.lat.toFixed(6)}, ${property.coordinates.lng.toFixed(6)}` : "Sin registrar"}</Text></View>}
      {property.galleryImagesBase64.length > 1 && <View style={styles.reportGallery}>{property.galleryImagesBase64.slice(1).map((image, index) => <Image key={index} src={image} style={styles.reportGalleryImage}/>)}</View>}
      <View style={styles.reportMetrics}>
        {[["AVALÚO CATASTRAL",cop(data.officialData.cadastralAppraisal),"Referencia fiscal"],["ÁREA DE TERRENO",areaLabel(data.officialData.officialLotArea),"Fuente catastral"],["ÁREA CONSTRUIDA",areaLabel(data.officialData.officialBuiltArea),"Dato oficial disponible"],["MÉTODO DE CONSULTA",data.officialData.lookupMethod === "cadastral_id" ? "Número predial" : data.officialData.lookupMethod === "coordinates" ? "Coordenadas" : "Sin consulta","Identificador / punto"]].map(([label,value,note])=><View key={label} style={styles.reportMetric}><Text style={styles.reportMetricLabel}>{label}</Text><Text style={styles.reportMetricValue}>{value}</Text><Text style={styles.reportMetricNote}>{note}</Text></View>)}
      </View>
      <Text style={styles.reportSectionTitle}>02 · IDENTIFICACIÓN PREDIAL & INFORMACIÓN CATASTRAL</Text>
      <View style={styles.reportTable}>
        <View style={[styles.reportRow,styles.reportTableHead]}><Text style={[styles.reportCell,styles.reportLabel]}>PARÁMETRO PREDIAL</Text><Text style={styles.reportCell}>FICHA DEL INMUEBLE</Text><Text style={styles.reportCell}>DATO CATASTRAL / FUENTE</Text></View>
        <ReportTableRow label="Tipo / Destinación" value={property.type} detail={data.officialData.economicDestination || "No disponible"}/>
        <ReportTableRow label="Cédula Catastral / CHIP" value={`${property.legal.cadastralId} / ${property.legal.chip}`} detail={property.legal.chip === "No registrado" ? "No disponible en consulta" : "Registrado en ficha"}/>
        <ReportTableRow label="Número Predial Nacional (30D)" value={cadastralNumber} detail={data.officialData.cadastralNumber || "No disponible reportado por fuente"}/>
        <ReportTableRow label="Matrícula inmobiliaria" value={property.legal.realEstateId} detail="Registro suministrado en ficha"/>
        <ReportTableRow label="Coordenadas WGS84" value={property.coordinates ? `${property.coordinates.lat.toFixed(6)}, ${property.coordinates.lng.toFixed(6)}` : "Sin dato"} detail={property.coordinates ? "Punto georreferenciado" : "Sin coordenadas"}/>
        <ReportTableRow label="Área construida" value={areaLabel(property.listedAreaM2)} detail={areaLabel(data.officialData.officialBuiltArea)}/>
        <ReportTableRow label="Estrato / habitaciones" value={`${property.stratum} / ${property.bedrooms}`} detail={`${data.officialData.stratum} / ${property.bedrooms} habitaciones registradas`}/>
        <ReportTableRow label="Baños / parqueaderos / depósitos" value={`${property.bathrooms} / ${property.garages} / ${property.deposits}`} detail="Características de la ficha"/>
        <ReportTableRow label="Municipio / Código DIVIPOLA" value={property.address} detail={`${data.officialData.municipality || "Sin dato"}${data.officialData.municipalityCode ? ` (${data.officialData.municipalityCode})` : ""}`}/>
      </View>
      {property.description && <View style={styles.section}><Text style={styles.reportSectionTitle}>DESCRIPCIÓN DEL INMUEBLE</Text><Text style={{ color: muted, fontSize: 7.5, lineHeight: 1.35 }}>{property.description}</Text></View>}
      {property.dossierSections.length > 0 && <View style={styles.section}><Text style={styles.reportSectionTitle}>CARACTERÍSTICAS Y DISTRIBUCIÓN</Text>{property.dossierSections.slice(0, 3).map((section, index) => <View key={`${section.title}-${index}`} style={{ marginBottom: 4 }}><Text style={{ color: forest, fontSize: 7, fontFamily: "Helvetica-Bold", marginBottom: 2 }}>{section.title}</Text>{section.description && <Text style={{ color: muted, fontSize: 6.5, lineHeight: 1.25 }}>{section.description}</Text>}{section.items?.slice(0, 4).map((item, itemIndex) => <Text key={`${index}-${itemIndex}`} style={{ color: ink, fontSize: 6.5, lineHeight: 1.2 }}>• {item}</Text>)}</View>)}</View>}
      <View style={styles.callout}><Text style={styles.calloutText}>Los datos externos se consultan al generar el informe y no se almacenan en la plataforma. El avalúo catastral es una referencia fiscal, no un avalúo comercial. Si una fuente no responde o no encuentra el predio, se indica “Sin dato”.</Text></View>
      <Footer data={data}/>
    </Page>

    <Page size="A4" style={styles.page}>
      <ReportHeader section="ANÁLISIS NORMATIVO, ESPACIAL Y FUENTES PÚBLICAS" data={data}/>
      <Text style={styles.reportSectionTitle}>03 · ANÁLISIS NORMATIVO Y ESPACIAL (EL PREDIO Y SU ENTORNO)</Text>
      {property.staticMapBase64 ? <Image src={property.staticMapBase64} style={styles.reportMap}/> : <View style={[styles.reportMap,styles.reportMapPlaceholder]}><Text>Mapa no disponible: {property.mapUnavailableReason || "causa no identificada"} · Radio de análisis {data.geoSpatialContext.poiSearchRadiusUsed.toLocaleString("es-CO")} m</Text></View>}
      <Text style={styles.reportSectionTitle}>NORMA URBANA (POT) & PUNTOS DE INTERÉS</Text>
      <View style={styles.reportTable}>
        <View style={[styles.reportRow,styles.reportTableHead]}><Text style={[styles.reportCell,styles.reportLabel]}>DIMENSIÓN TERRITORIAL</Text><Text style={styles.reportCell}>INDICADOR / NORMA POT</Text><Text style={styles.reportCell}>DIAGNÓSTICO / COBERTURA</Text></View>
        <ReportTableRow label="Uso de suelo (POT)" value={data.geoSpatialContext.potNormative.landUse} detail="No reemplaza concepto de autoridad municipal"/>
        <ReportTableRow label="Altura / tratamiento" value={`${data.geoSpatialContext.potNormative.maxHeight} / ${data.geoSpatialContext.potNormative.treatment}`} detail="Sin dato si no hay consulta municipal verificable"/>
        <ReportTableRow label="Servicios y POI (1.000 m)" value={data.geoSpatialContext.poiAvailable ? `${data.geoSpatialContext.poiCounts.commercial} puntos comerciales / ${data.geoSpatialContext.poiCounts.health} de salud` : "En validación territorial"} detail={data.geoSpatialContext.poiAvailable ? `${data.geoSpatialContext.poiSource} · movilidad ${data.geoSpatialContext.poiCounts.transport} · educación ${data.geoSpatialContext.poiCounts.education} · parques ${data.geoSpatialContext.poiCounts.parks}` : data.geoSpatialContext.poiStatus}/>
        <ReportTableRow label="Riesgos / amenazas" value={`${data.predictiveAnalysis.physicalRisks.landslide} · ${data.predictiveAnalysis.physicalRisks.flooding}`} detail="Remoción en masa / inundación"/>
      </View>
      <Text style={styles.reportSectionTitle}>04 · PERFIL MUNICIPAL DANE Y COBERTURA</Text>
      <View style={styles.reportTable}>
        <View style={[styles.reportRow,styles.reportTableHead]}><Text style={[styles.reportCell,styles.reportLabel]}>INDICADOR DANE</Text><Text style={styles.reportCell}>VALOR REGISTRADO</Text><Text style={styles.reportCell}>CAPA / COBERTURA</Text></View>
        <ReportTableRow label="Población / hogares" value={data.geoSpatialContext.dane.censusAvailable ? `${data.geoSpatialContext.dane.population?.toLocaleString("es-CO") ?? "Sin dato en fuente"} / ${data.geoSpatialContext.dane.households?.toLocaleString("es-CO") ?? "Sin dato en fuente"}` : "En validación territorial"} detail="Agregado municipal · DANE"/>
        <ReportTableRow label="Viviendas / año censal" value={data.geoSpatialContext.dane.censusAvailable ? `${data.geoSpatialContext.dane.dwellings?.toLocaleString("es-CO") ?? "Sin dato en fuente"} / ${data.geoSpatialContext.dane.censusYear ?? "Sin dato en fuente"}` : "En validación territorial"} detail="DANE"/>
        <ReportTableRow label="IPM municipal" value={!data.geoSpatialContext.dane.ipmAvailable ? "En validación territorial" : data.geoSpatialContext.dane.ipm === null ? "Sin dato en fuente" : `${data.geoSpatialContext.dane.ipm.toLocaleString("es-CO")}%`} detail="No corresponde a una medición individual del inmueble"/>
        <ReportTableRow label="Catalizadores de valorización" value={data.predictiveAnalysis.capitalGainCatalysts.length ? `${data.predictiveAnalysis.capitalGainCatalysts.length} identificados` : "Sin proyectos verificables"} detail="Fuentes disponibles al generar"/>
      </View>
      <Text style={styles.sourceNote}>Trazabilidad: catastro consultado mediante {data.officialData.servedFrom || data.officialData.lookupMethod};{data.officialData.checkedAt ? ` fecha ${dateLabel(data.officialData.checkedAt)};` : " sin fecha confirmada por la fuente;"} estadísticas DANE{data.geoSpatialContext.dane.asOf ? ` con corte ${dateLabel(data.geoSpatialContext.dane.asOf)}` : " sin fecha de corte disponible"}. Precio mostrado: valor de oferta registrado en la plataforma, no avalúo comercial.</Text>
      {data.warnings.length > 0 && <View style={[styles.callout, { marginTop: 6, marginBottom: 6 }]}><Text style={styles.calloutText}>VALIDACIONES Y FUENTES PENDIENTES: {data.warnings.slice(0, 3).join(" ")}</Text></View>}
      <View style={styles.callout}><Text style={styles.calloutText}>Alcance: informe técnico-comercial automático basado en la ficha del inmueble y fuentes públicas disponibles. No sustituye visita pericial, certificado de tradición, avalúo comercial ni concepto de norma urbana oficial. La geometría y los datos territoriales son referenciales; pueden variar según cobertura y fecha de consulta.</Text></View>
      <View style={styles.reportContact}><Text style={styles.reportContactTitle}>DAVID BASTO · ING. CIVIL · ASESOR INMOBILIARIO</Text><Text style={styles.reportContactText}>Atención personalizada · WhatsApp +57 312 537 2457 · Propiedades con propósito</Text></View>
      <Footer data={data}/>
    </Page>
  </Document>;
}
