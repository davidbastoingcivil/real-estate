import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { AvmResult } from "@/lib/avm/valuationEngine";

const navy = "#10251d";
const gold = "#c4a15b";
const ink = "#1f2933";
const muted = "#68737d";
const line = "#e2e6e4";
const pale = "#f5f6f4";
const cop = (value: number) => `$ ${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(value)} COP`;
const dateLabel = (value: string) => new Intl.DateTimeFormat("es-CO", { dateStyle: "long" }).format(new Date(value));

const styles = StyleSheet.create({
  page: { paddingTop: 42, paddingHorizontal: 46, paddingBottom: 54, fontFamily: "Helvetica", color: ink, fontSize: 9 },
  cover: { backgroundColor: navy, paddingTop: 58, paddingHorizontal: 50, paddingBottom: 54, color: "#fff" },
  brand: { color: gold, fontSize: 11, letterSpacing: 2, marginBottom: 8 },
  brandSub: { color: "#c6d0cb", fontSize: 7, letterSpacing: 2, marginBottom: 54 },
  coverImage: { width: "100%", height: 170, objectFit: "cover", marginBottom: 22, borderRadius: 4 },
  coverPlaceholder: { height: 120, marginBottom: 22, borderRadius: 4, backgroundColor: "#1a3429", justifyContent: "center", alignItems: "center" },
  coverPlaceholderText: { color: gold, fontSize: 8, letterSpacing: 1.2 },
  eyebrow: { color: gold, fontSize: 8, letterSpacing: 1.8, marginBottom: 10 },
  title: { fontSize: 28, lineHeight: 1.2, marginBottom: 10, maxWidth: 450 },
  subtitle: { color: "#c6d0cb", lineHeight: 1.55, fontSize: 10, marginBottom: 26 },
  coverRule: { borderBottomWidth: 1, borderBottomColor: gold, width: 54, marginVertical: 14 },
  heroLabel: { color: "#c6d0cb", fontSize: 8, letterSpacing: 1.4, marginTop: 18 },
  heroValue: { color: "#fff", fontSize: 29, marginTop: 8, marginBottom: 8 },
  range: { color: "#e2c989", fontSize: 10 },
  coverGrid: { flexDirection: "row", gap: 12, marginTop: 26 },
  coverMetric: { flexGrow: 1, backgroundColor: "#1a3429", padding: 13, borderRadius: 5 },
  coverMetricLabel: { color: "#c6d0cb", fontSize: 7, marginBottom: 6 },
  coverMetricValue: { color: "#fff", fontSize: 10 },
  coverFoot: { color: "#c6d0cb", fontSize: 8, lineHeight: 1.5, marginTop: 45 },
  heading: { fontSize: 19, color: navy, marginBottom: 6 },
  intro: { color: muted, fontSize: 9, lineHeight: 1.5, marginBottom: 20 },
  section: { marginBottom: 18 },
  sectionTitle: { color: navy, fontSize: 10, letterSpacing: 0.8, marginBottom: 9 },
  facts: { flexDirection: "row", flexWrap: "wrap", borderTopWidth: 1, borderTopColor: line },
  fact: { width: "50%", paddingVertical: 9, paddingRight: 10, borderBottomWidth: 1, borderBottomColor: line },
  factLabel: { color: muted, fontSize: 7, marginBottom: 4 },
  factValue: { color: ink, fontSize: 9 },
  callout: { backgroundColor: pale, borderLeftWidth: 3, borderLeftColor: gold, padding: 12, marginVertical: 8 },
  calloutText: { color: ink, fontSize: 8, lineHeight: 1.5 },
  table: { borderTopWidth: 1, borderTopColor: line },
  tableHead: { flexDirection: "row", backgroundColor: navy, padding: 7 },
  tableRow: { flexDirection: "row", paddingVertical: 8, paddingHorizontal: 7, borderBottomWidth: 1, borderBottomColor: line },
  tableCell: { fontSize: 7, color: ink, paddingRight: 3 },
  tableHeadCell: { fontSize: 6.5, color: "#fff", paddingRight: 3, letterSpacing: 0.2 },
  colTitle: { width: "28%" }, colArea: { width: "11%" }, colDistance: { width: "13%" },
  colPrice: { width: "17%" }, colFactor: { width: "12%" }, colAdjusted: { width: "19%" },
  scoreRow: { flexDirection: "row", gap: 10, marginTop: 6 },
  score: { flexGrow: 1, backgroundColor: pale, padding: 11, borderRadius: 4 },
  scoreLabel: { fontSize: 7, color: muted, marginBottom: 6 },
  scoreValue: { fontSize: 14, color: navy },
  disclosureTitle: { fontSize: 10, color: navy, marginBottom: 8 },
  disclosure: { fontSize: 8, lineHeight: 1.5, color: muted, marginBottom: 8 },
  bullet: { fontSize: 8, lineHeight: 1.5, color: ink, marginBottom: 6 },
  footer: { position: "absolute", bottom: 25, left: 46, right: 46, borderTopWidth: 1, borderTopColor: line, paddingTop: 8, flexDirection: "row", justifyContent: "space-between", color: muted, fontSize: 7 },
});

function Footer({ code }: { code: string }) {
  return <View style={styles.footer} fixed>
    <Text>DAVID BASTO REAL ESTATE · Estimación AVM orientativa</Text>
    <Text>{code} · <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}/></Text>
  </View>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <View style={styles.fact}><Text style={styles.factLabel}>{label}</Text><Text style={styles.factValue}>{value}</Text></View>;
}

export default function ValuationReportDocument({ data, code, coverImage }: { data: AvmResult; code: string; coverImage?: Buffer | null }) {
  const property = data.property;
  return <Document title={`Estimación AVM - ${property.title}`} author="David Basto Real Estate" subject="Estimación automática orientativa de valor inmobiliario">
    <Page size="A4" style={styles.cover}>
      <Text style={styles.brand}>DB</Text>
      <Text style={styles.brandSub}>DAVID BASTO · REAL ESTATE</Text>
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      {coverImage ? <Image src={coverImage} style={styles.coverImage}/> : <View style={styles.coverPlaceholder}><Text style={styles.coverPlaceholderText}>FICHA INMOBILIARIA · {property.type.toUpperCase()}</Text></View>}
      <Text style={styles.eyebrow}>INFORME DE ESTIMACIÓN AUTOMÁTICA</Text>
      <Text style={styles.title}>{property.title}</Text>
      <Text style={styles.subtitle}>{property.location}</Text>
      <View style={styles.coverRule}/>
      <Text style={styles.heroLabel}>VALOR COMERCIAL ESTIMADO</Text>
      <Text style={styles.heroValue}>{cop(data.estimated_value)}</Text>
      <Text style={styles.range}>Rango orientativo: {cop(data.value_min)} — {cop(data.value_max)}</Text>
      <View style={styles.coverGrid}>
        <View style={styles.coverMetric}><Text style={styles.coverMetricLabel}>VALOR POR M²</Text><Text style={styles.coverMetricValue}>{cop(data.value_per_m2)}</Text></View>
        <View style={styles.coverMetric}><Text style={styles.coverMetricLabel}>CANON MENSUAL ESTIMADO</Text><Text style={styles.coverMetricValue}>{cop(data.estimated_rent)}</Text></View>
        <View style={styles.coverMetric}><Text style={styles.coverMetricLabel}>CONFIANZA DE LA MUESTRA</Text><Text style={styles.coverMetricValue}>{data.confidence_score}%</Text></View>
      </View>
      <Text style={styles.coverFoot}>Emitido el {dateLabel(data.valuation_date)} · Referencia {code}{"\n"}Documento informativo basado en anuncios comparables y datos disponibles al momento del cálculo.</Text>
      <Footer code={code}/>
    </Page>

    <Page size="A4" style={styles.page}>
      <Text style={styles.eyebrow}>01 · FICHA DEL INMUEBLE</Text>
      <Text style={styles.heading}>Características y alcance</Text>
      <Text style={styles.intro}>Resumen de la información registrada para este inmueble en la plataforma.</Text>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DATOS DISPONIBLES</Text>
        <View style={styles.facts}>
          <Fact label="TIPO DE INMUEBLE" value={property.type}/>
          <Fact label="UBICACIÓN" value={property.location}/>
          <Fact label="ÁREA REGISTRADA" value={`${property.area.toLocaleString("es-CO")} m²`}/>
          <Fact label="PRECIO PUBLICADO" value={cop(property.price)}/>
          <Fact label="HABITACIONES" value={String(property.bedrooms)}/>
          <Fact label="BAÑOS" value={String(property.bathrooms)}/>
          <Fact label="COORDENADAS" value={`${property.lat.toFixed(5)}, ${property.lng.toFixed(5)}`}/>
          <Fact label="MUESTRA COMPARABLE" value={`${data.methodology.comparable_count} inmueble(s)`}/>
        </View>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>MÉTODO APLICADO</Text>
        <Text style={styles.disclosure}>{data.methodology.description}</Text>
        <View style={styles.callout}><Text style={styles.calloutText}>Homogenización: {Math.round(data.methodology.negotiation_factor * 100)}% por negociación; factor de escala de área con exponente {data.methodology.area_exponent}; comparables dentro de {data.methodology.max_distance_meters.toLocaleString("es-CO")} m; ponderación por similitud y distancia. El ajuste GeoAI aplicado fue {data.geoai.adjustment_percent}%.</Text></View>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>INGRESO POR ARRIENDO</Text>
        <Text style={styles.disclosure}>Canon mensual de referencia: {cop(data.estimated_rent)}. Rendimiento bruto anual estimado: {data.cap_rate.toFixed(2)}%. Se aplica una tasa indicativa mensual del {data.monthly_rent_rate.toFixed(2)}% sobre el valor calculado; no corresponde a una oferta de arrendamiento ni descuenta vacancia, gastos o impuestos.</Text>
      </View>
      <Footer code={code}/>
    </Page>

    <Page size="A4" style={styles.page}>
      <Text style={styles.eyebrow}>02 · ESTUDIO DE MERCADO</Text>
      <Text style={styles.heading}>Inmuebles comparables</Text>
      <Text style={styles.intro}>Muestra de ofertas activas publicadas de tipología coincidente, área ±20% y radio máximo de 1,5 km. Los precios corresponden a oferta publicada.</Text>
      {data.comparables.length ? <View style={styles.table}>
        <View style={styles.tableHead}>
          <Text style={[styles.tableHeadCell, styles.colTitle]}>INMUEBLE</Text><Text style={[styles.tableHeadCell, styles.colArea]}>ÁREA</Text>
          <Text style={[styles.tableHeadCell, styles.colDistance]}>DISTANCIA</Text><Text style={[styles.tableHeadCell, styles.colPrice]}>PRECIO OFERTA</Text>
          <Text style={[styles.tableHeadCell, styles.colFactor]}>FACTOR</Text><Text style={[styles.tableHeadCell, styles.colAdjusted]}>VALOR HOMOG.</Text>
        </View>
        {data.comparables.slice(0, 8).map(item => <View style={styles.tableRow} key={item.id}>
          <Text style={[styles.tableCell, styles.colTitle]}>{item.title}</Text><Text style={[styles.tableCell, styles.colArea]}>{item.area_m2.toLocaleString("es-CO")} m²</Text>
          <Text style={[styles.tableCell, styles.colDistance]}>{Math.round(item.distance_meters).toLocaleString("es-CO")} m</Text><Text style={[styles.tableCell, styles.colPrice]}>{cop(item.price)}</Text>
          <Text style={[styles.tableCell, styles.colFactor]}>{item.area_factor.toFixed(2)} × .93</Text><Text style={[styles.tableCell, styles.colAdjusted]}>{cop(item.adjusted_estimated_value)}</Text>
        </View>)}
      </View> : <View style={styles.callout}><Text style={styles.calloutText}>No se encontraron comparables que cumplan los filtros en el radio configurado. El valor de referencia mostrado usa el precio publicado del inmueble y una banda provisional; no se calculó con evidencia de mercado suficiente.</Text></View>}
      <View style={styles.scoreRow}>
        <View style={styles.score}><Text style={styles.scoreLabel}>MUESTRA UTILIZADA</Text><Text style={styles.scoreValue}>{data.methodology.comparable_count}</Text></View>
        <View style={styles.score}><Text style={styles.scoreLabel}>DISPERSIÓN DE PRECIOS</Text><Text style={styles.scoreValue}>{data.methodology.dispersion_percent}%</Text></View>
        <View style={styles.score}><Text style={styles.scoreLabel}>CONFIANZA</Text><Text style={styles.scoreValue}>{data.confidence_score}%</Text></View>
      </View>
      <View style={[styles.callout, { marginTop: 20 }]}><Text style={styles.calloutText}>El rango P25–P75 se obtiene de los valores comparables homogenizados. La estimación central es un promedio ponderado por similitud y distancia, ajustado por señales GeoAI disponibles.</Text></View>
      <Footer code={code}/>
    </Page>

    <Page size="A4" style={styles.page}>
      <Text style={styles.eyebrow}>03 · CONTEXTO, DATOS Y LIMITACIONES</Text>
      <Text style={styles.heading}>Lectura responsable del resultado</Text>
      <Text style={styles.intro}>Indicadores espaciales y consideraciones que delimitan el alcance de esta estimación.</Text>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SEÑALES GEOAI DISPONIBLES</Text>
        <View style={styles.scoreRow}>
          <View style={styles.score}><Text style={styles.scoreLabel}>ACCESIBILIDAD</Text><Text style={styles.scoreValue}>{data.geoai.accessibility_score ?? "—"}</Text></View>
          <View style={styles.score}><Text style={styles.scoreLabel}>COMERCIO</Text><Text style={styles.scoreValue}>{data.geoai.commercial_density_score ?? "—"}</Text></View>
          <View style={styles.score}><Text style={styles.scoreLabel}>INFRAESTRUCTURA</Text><Text style={styles.scoreValue}>{data.geoai.infrastructure_growth_score ?? "—"}</Text></View>
          <View style={styles.score}><Text style={styles.scoreLabel}>RIESGO</Text><Text style={styles.scoreValue}>{data.geoai.risk_score ?? "—"}</Text></View>
        </View>
        <Text style={[styles.disclosure, { marginTop: 10 }]}>Confianza de cobertura espacial: {data.geoai.confidence || "sin datos"}. La cobertura depende de los POI que hayan sido cargados y verificados en la base de datos. El cálculo no incorpora una red vial, catastro ni análisis normativo automático.</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>LIMITACIONES Y DESCARGO</Text>
        {data.limitations.map((limitation, index) => <Text style={styles.bullet} key={`${index}-${limitation}`}>• {limitation}</Text>)}
        <Text style={styles.disclosure}>Este documento no incluye visita al inmueble, estudio de títulos, verificación catastral, certificado de uso del suelo/POT, revisión estructural, firma digital, código QR de autenticidad ni registro de valuador. La base disponible no contiene de forma estructurada antigüedad, estrato, estado de conservación, parqueaderos, depósitos o administración; estos factores no se ajustaron.</Text>
      </View>
      <View style={styles.callout}><Text style={styles.calloutText}>Estimación automática orientativa. No es un avalúo comercial certificado, peritaje, concepto jurídico ni compromiso de compra o financiación. Para decisiones crediticias, judiciales o transaccionales, solicita un avalúo físico por un profesional habilitado.</Text></View>
      <Text style={[styles.disclosure, { marginTop: 12 }]}>Fuente de los comparables: anuncios publicados en David Basto Real Estate. Fecha de cálculo: {dateLabel(data.valuation_date)}. ID de inmueble: {property.id}.</Text>
      <Footer code={code}/>
    </Page>
  </Document>;
}
