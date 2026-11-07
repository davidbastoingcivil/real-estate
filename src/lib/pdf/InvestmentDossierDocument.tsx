import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ProjectDossier } from "@/data/properties";

export type InvestmentDossierData = {
  generatedAt: string;
  client: { name: string; whatsapp: string };
  advisor: { name: string; role: string; phone: string };
  property: { id: string; slug: string; title: string; code: string; type: string; operation: string; location: string; price: number; periodicity: string; area: number; bedrooms: number; bathrooms: number; garages: number; description: string };
  dossier: ProjectDossier;
  simulation: { downPayment: number; downPaymentPercent: number; annualRate: number; termYears: number; financedCapital: number; monthlyPayment: number; monthlyRent: number; grossYield: number; cashFlow: number };
};

const forest = "#10251b";
const dark = "#101713";
const gold = "#c4a15b";
const cream = "#f5f1e7";
const muted = "#aeb8b0";
const cop = (value: number) => `$ ${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(value)} COP`;

const styles = StyleSheet.create({
  cover: { backgroundColor: forest, color: "#fff", paddingTop: 42, paddingHorizontal: 48, paddingBottom: 44, fontFamily: "Helvetica" },
  coverTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 64 },
  brandBox: { width: 56, height: 56, backgroundColor: dark, alignItems: "center", justifyContent: "center" },
  brandMark: { color: "#fff", fontFamily: "Times-Bold", fontSize: 25 },
  brandLabel: { color: gold, fontSize: 5, letterSpacing: 1.2, marginTop: 2 },
  builder: { borderWidth: 1, borderColor: gold, paddingVertical: 9, paddingHorizontal: 12, color: "#fff", fontSize: 8, letterSpacing: 1.4 },
  eyebrow: { color: gold, fontSize: 8, letterSpacing: 2.2, marginBottom: 12 },
  coverTitle: { color: "#fff", fontFamily: "Times-Roman", fontSize: 31, lineHeight: 1.15, marginBottom: 12 },
  coverText: { color: muted, fontSize: 10, lineHeight: 1.65, maxWidth: 435, marginBottom: 26 },
  rule: { width: 56, borderBottomWidth: 2, borderBottomColor: gold, marginBottom: 23 },
  prepared: { color: "#fff", fontSize: 11, marginBottom: 5 },
  client: { color: gold, fontFamily: "Times-Roman", fontSize: 20, marginBottom: 28 },
  propertyCard: { backgroundColor: "#193125", borderWidth: 1, borderColor: "#506451", padding: 17, marginBottom: 18 },
  propertyName: { color: "#fff", fontFamily: "Times-Roman", fontSize: 21, marginBottom: 6 },
  propertyLocation: { color: muted, fontSize: 9, marginBottom: 14 },
  metrics: { flexDirection: "row", gap: 8 },
  metric: { flexGrow: 1, backgroundColor: "#10251b", padding: 10 },
  metricLabel: { color: gold, fontSize: 6, letterSpacing: 1.2, marginBottom: 6 },
  metricValue: { color: "#fff", fontSize: 10 },
  coverFoot: { position: "absolute", left: 48, right: 48, bottom: 25, borderTopWidth: 1, borderTopColor: "#526251", paddingTop: 8, flexDirection: "row", justifyContent: "space-between", color: muted, fontSize: 7 },
  page: { backgroundColor: cream, paddingTop: 38, paddingHorizontal: 40, paddingBottom: 46, fontFamily: "Helvetica", color: dark, fontSize: 8 },
  pageHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  pageEyebrow: { color: "#8c6b2e", fontSize: 7, letterSpacing: 1.7, marginBottom: 7 },
  pageTitle: { color: forest, fontFamily: "Times-Roman", fontSize: 22, lineHeight: 1.15 },
  pageBrand: { color: forest, fontFamily: "Times-Bold", fontSize: 16 },
  locationLine: { color: "#707970", marginTop: 4, fontSize: 8 },
  summary: { color: "#465047", fontSize: 8, lineHeight: 1.5, marginBottom: 14 },
  keyFacts: { flexDirection: "row", gap: 7, marginBottom: 18 },
  keyFact: { backgroundColor: forest, padding: 9, flexGrow: 1 },
  keyLabel: { color: gold, fontSize: 5.5, letterSpacing: 0.7, marginBottom: 5 },
  keyValue: { color: "#fff", fontSize: 8 },
  sectionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  section: { width: "48.5%", padding: 11, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e4dfd3", minHeight: 130 },
  sectionTitle: { color: forest, fontFamily: "Times-Roman", fontSize: 12, marginBottom: 5 },
  sectionDescription: { color: "#687269", fontSize: 7, lineHeight: 1.4, marginBottom: 6 },
  bullet: { color: "#333c35", fontSize: 6.8, lineHeight: 1.35, marginBottom: 3 },
  footer: { position: "absolute", bottom: 21, left: 40, right: 40, borderTopWidth: 1, borderTopColor: "#d9d3c6", paddingTop: 7, flexDirection: "row", justifyContent: "space-between", color: "#717970", fontSize: 6.5 },
  finance: { backgroundColor: forest, color: "#fff", paddingTop: 39, paddingHorizontal: 45, paddingBottom: 42, fontFamily: "Helvetica" },
  financeTitle: { color: "#fff", fontFamily: "Times-Roman", fontSize: 26, marginBottom: 7 },
  financeIntro: { color: muted, fontSize: 8, lineHeight: 1.55, marginBottom: 20 },
  financeHero: { backgroundColor: dark, borderLeftWidth: 3, borderLeftColor: gold, padding: 17, marginBottom: 13 },
  financeLabel: { color: muted, fontSize: 7, letterSpacing: 1.1, marginBottom: 6 },
  financeValue: { color: "#f2d18c", fontFamily: "Times-Roman", fontSize: 25, marginBottom: 5 },
  financeSmall: { color: muted, fontSize: 7 },
  financeTable: { borderWidth: 1, borderColor: "#465348", marginBottom: 14 },
  financeRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 9, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: "#39483d" },
  financeRowLast: { borderBottomWidth: 0 },
  financeRowLabel: { color: "#c6cec6", fontSize: 8 },
  financeRowValue: { color: "#fff", fontSize: 8, fontFamily: "Helvetica-Bold" },
  financeNote: { color: "#9ca79d", fontSize: 6.5, lineHeight: 1.45, marginBottom: 16 },
  cta: { backgroundColor: "#193125", borderWidth: 1, borderColor: gold, padding: 14 },
  ctaTitle: { color: gold, fontSize: 7, letterSpacing: 1.4, marginBottom: 6 },
  ctaText: { color: "#fff", fontFamily: "Times-Roman", fontSize: 15, marginBottom: 6 },
  ctaLink: { color: "#e4e8e1", fontSize: 8, marginBottom: 3 },
  financeFooter: { position: "absolute", bottom: 23, left: 45, right: 45, borderTopWidth: 1, borderTopColor: "#465348", paddingTop: 8, flexDirection: "row", justifyContent: "space-between", color: muted, fontSize: 6.5 },
});

function Footer({ data, darkMode = false }: { data: InvestmentDossierData; darkMode?: boolean }) {
  const footer = darkMode ? styles.financeFooter : styles.footer;
  return <View style={footer} fixed><Text>DAVID BASTO REAL ESTATE · DOSSIER PERSONALIZADO</Text><Text>{data.property.code} · {data.generatedAt}</Text></View>;
}

function Section({ section }: { section: NonNullable<ProjectDossier["sections"]>[number] }) {
  return <View style={styles.section} wrap={false}>
    <Text style={styles.sectionTitle}>{section.title}</Text>
    {section.description ? <Text style={styles.sectionDescription}>{section.description}</Text> : null}
    {(section.items || []).map((item, index) => <Text key={`${section.title}-${index}`} style={styles.bullet}>•  {item}</Text>)}
  </View>;
}

export default function InvestmentDossierDocument({ data }: { data: InvestmentDossierData }) {
  const projectDescription = data.dossier.description || data.property.description;
  const sections = data.dossier.sections?.length ? data.dossier.sections : [{ title: "Sobre el inmueble", description: projectDescription, items: [] }];
  return <Document title={`Dossier ${data.property.title} - ${data.client.name}`} author="David Basto Real Estate" subject="Ficha comercial y simulación financiera personalizada">
    <Page size="A4" style={styles.cover}>
      <View style={styles.coverTop}><View style={styles.brandBox}><Text style={styles.brandMark}>DB</Text><Text style={styles.brandLabel}>REAL ESTATE</Text></View><View style={styles.builder}><Text>{(data.dossier.developer || "PROPIEDADES CON PROPÓSITO").toUpperCase()}</Text></View></View>
      <Text style={styles.eyebrow}>DOSSIER EXCLUSIVO · {data.property.location.toUpperCase()}</Text>
      <Text style={styles.coverTitle}>{data.dossier.tagline || data.property.title}</Text>
      <Text style={styles.coverText}>{projectDescription}</Text>
      <View style={styles.rule}/>
      <Text style={styles.prepared}>Dossier exclusivo preparado para:</Text>
      <Text style={styles.client}>{data.client.name}</Text>
      <View style={styles.propertyCard}>
        <Text style={styles.propertyName}>{data.property.title}</Text>
        <Text style={styles.propertyLocation}>{data.property.code} · {data.property.type} · {data.property.location}</Text>
        <View style={styles.metrics}>
          <View style={styles.metric}><Text style={styles.metricLabel}>PRECIO {data.property.periodicity === "Mensual" ? "MENSUAL" : "DEL INMUEBLE"}</Text><Text style={styles.metricValue}>{cop(data.property.price)}</Text></View>
          <View style={styles.metric}><Text style={styles.metricLabel}>ÁREA</Text><Text style={styles.metricValue}>{data.property.area.toLocaleString("es-CO")} m²</Text></View>
          <View style={styles.metric}><Text style={styles.metricLabel}>OPERACIÓN</Text><Text style={styles.metricValue}>{data.property.operation}</Text></View>
        </View>
      </View>
      <Text style={{ color: muted, fontSize: 8 }}>Preparado el {data.generatedAt} · Para uso privado de {data.client.name}</Text>
      <Footer data={data} darkMode/>
    </Page>
    <Page size="A4" style={styles.page}>
      <View style={styles.pageHead}><View><Text style={styles.pageEyebrow}>FICHA TÉCNICA · {data.dossier.developer || "DAVID BASTO REAL ESTATE"}</Text><Text style={styles.pageTitle}>Arquitectura y espacios</Text><Text style={styles.locationLine}>{data.property.location}{data.dossier.travelTime ? ` · ${data.dossier.travelTime}` : ""}</Text></View><Text style={styles.pageBrand}>DB</Text></View>
      <Text style={styles.summary}>{projectDescription}</Text>
      <View style={styles.keyFacts}>
        {[["ÁREA", `${data.property.area.toLocaleString("es-CO")} m²${data.property.id === "condominio-bambu-carmen-de-apicala" || data.property.slug.includes("bambu") ? " + terraza" : ""}`], ["HABITACIONES", String(data.property.bedrooms)], ["BAÑOS", String(data.property.bathrooms)], ["GARAJES", String(data.property.garages) ]].map(([label,value])=><View key={label} style={styles.keyFact}><Text style={styles.keyLabel}>{label}</Text><Text style={styles.keyValue}>{value}</Text></View>)}
      </View>
      <View style={styles.sectionGrid}>{sections.map((section,index)=><Section key={`${section.title}-${index}`} section={section}/>)}</View>
      <Footer data={data}/>
    </Page>
    <Page size="A4" style={styles.finance}>
      <Text style={styles.eyebrow}>SIMULACIÓN FINANCIERA · ESCENARIO PERSONAL</Text>
      <Text style={styles.financeTitle}>Una inversión clara, paso a paso</Text>
      <Text style={styles.financeIntro}>Escenario calculado con los parámetros seleccionados en la calculadora para {data.property.title}. El resultado es orientativo y no representa una oferta de crédito.</Text>
      <View style={styles.financeHero}><Text style={styles.financeLabel}>CUOTA MENSUAL ESTIMADA</Text><Text style={styles.financeValue}>{cop(data.simulation.monthlyPayment)}</Text><Text style={styles.financeSmall}>{data.simulation.termYears} años · Tasa efectiva anual {data.simulation.annualRate.toFixed(2)}%</Text></View>
      <View style={styles.financeTable}>
        {[["Valor del inmueble", cop(data.property.price)], ["Cuota inicial", `${cop(data.simulation.downPayment)} · ${data.simulation.downPaymentPercent.toFixed(0)}%`], ["Capital financiado", cop(data.simulation.financedCapital)], ["Tasa efectiva anual", `${data.simulation.annualRate.toFixed(2)}%`], ["Plazo del escenario", `${data.simulation.termYears} años`], ...(data.simulation.monthlyRent > 0 ? [["Arriendo mensual supuesto", cop(data.simulation.monthlyRent)], ["Rentabilidad bruta anual", `${data.simulation.grossYield.toFixed(2)}%`], ["Flujo mensual estimado", cop(data.simulation.cashFlow)]] : [])].map(([label,value],index,rows)=><View key={label} style={[styles.financeRow, index === rows.length-1 ? styles.financeRowLast : {}]}><Text style={styles.financeRowLabel}>{label}</Text><Text style={styles.financeRowValue}>{value}</Text></View>)}
      </View>
      <Text style={styles.financeNote}>Estimación matemática sobre capital, tasa y plazo indicados. No incluye seguros, gastos bancarios, impuestos, administración, mantenimiento, vacancia ni otros costos. Las condiciones reales dependen de la entidad financiera y de la disponibilidad del inmueble.</Text>
      <View style={styles.cta}><Text style={styles.ctaTitle}>ASESORÍA PERSONAL</Text><Text style={styles.ctaText}>¿Lo conversamos, {data.client.name.split(" ")[0]}?</Text><Text style={styles.ctaLink}>{data.advisor.name} · {data.advisor.role}</Text><Text style={styles.ctaLink}>WhatsApp: +{data.advisor.phone}</Text><Text style={styles.ctaLink}>Solicitud preparada para: +{data.client.whatsapp}</Text></View>
      <Footer data={data} darkMode/>
    </Page>
  </Document>;
}
