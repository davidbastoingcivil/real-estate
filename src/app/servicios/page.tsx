import Link from "next/link";
import { ArrowRight, FileCheck2, Handshake, House, Scale, SearchCheck } from "lucide-react";

export const metadata = { title: "Servicios inmobiliarios | David Basto Real Estate", description: "Acompañamiento inmobiliario para comprar, vender y arrendar en Colombia." };

const services = [
  { icon: SearchCheck, title: "Búsqueda y compra", body: "Definimos criterios, revisamos las características de cada opción y organizamos las preguntas y pasos antes de avanzar." },
  { icon: House, title: "Venta de inmuebles", body: "Revisamos contexto, valor esperado, presentación y documentación para acordar una estrategia de comercialización." },
  { icon: Handshake, title: "Arriendo de inmuebles", body: "Acompañamiento en publicación, conversaciones con interesados, requisitos, contrato y entrega." },
  { icon: Scale, title: "Orientación inmobiliaria", body: "Conversación inicial para entender tu objetivo y ayudarte a identificar las verificaciones que conviene hacer." },
  { icon: FileCheck2, title: "Análisis de inversión", body: "Explora precio, cuota inicial, financiación estimada y rentabilidad bruta desde la calculadora de cada inmueble." },
];

const questions = [
  ["¿Qué información necesito para consultar un inmueble?", "Cuéntanos qué inmueble te interesa y comparte tu nombre y teléfono. Si es una solicitud sobre un inmueble propio, agrega ubicación, tipo y valor esperado."],
  ["¿La cuota del simulador es una oferta de crédito?", "No. Es una estimación basada en precio, cuota inicial, tasa y plazo elegidos. La entidad financiera define sus condiciones y costos."],
  ["¿Puedo ofrecer un inmueble para venta o arriendo?", "Sí. Usa el formulario de venta o arriendo para compartir los datos iniciales. David confirmará contigo el alcance y los siguientes pasos."],
  ["¿Trabajas solo en Bogotá?", "El catálogo puede incluir inmuebles en varias ciudades y municipios de Colombia. La disponibilidad cambia por propiedad; confirma la ubicación con el asesor."],
];

export default function ServicesPage() {
  return <main className="owner-page services-page"><section className="owner-hero"><div className="eyebrow"><span/> ACOMPAÑAMIENTO INMOBILIARIO</div><h1>Decisiones importantes,<br/><em>con alguien a tu lado.</em></h1><p>Orientación personal para explorar una compra, vender o poner en arriendo un inmueble con información clara en cada paso.</p><Link href="/#propiedades" className="button button-gold">Explorar propiedades <ArrowRight size={16}/></Link></section><section className="services-grid">{services.map(({icon:Icon,title,body})=><article key={title}><Icon size={22}/><h2>{title}</h2><p>{body}</p></article>)}</section><section className="services-steps"><div className="eyebrow"><span/> CÓMO TRABAJAMOS</div><h2>De la primera pregunta <em>a un siguiente paso claro.</em></h2><div><article><b>01</b><h3>Entendemos tu objetivo</h3><p>Nos cuentas si quieres comprar, vender, arrendar o comparar opciones.</p></article><article><b>02</b><h3>Revisamos la información</h3><p>Concretamos lo que falta y compartimos alternativas de forma transparente.</p></article><article><b>03</b><h3>Acordamos el siguiente paso</h3><p>Avanzamos contigo según el inmueble, la disponibilidad y las verificaciones necesarias.</p></article></div></section><section className="services-faq"><div className="eyebrow"><span/> PREGUNTAS FRECUENTES</div><h2>Respuestas para <em>decidir tranquilo.</em></h2>{questions.map(([question,answer])=><details key={question}><summary>{question}</summary><p>{answer}</p></details>)}<div className="services-cta"><Link href="/vender-mi-inmueble">Vender mi inmueble <ArrowRight size={15}/></Link><Link href="/arrendar-mi-inmueble">Arrendar mi inmueble <ArrowRight size={15}/></Link></div></section></main>;
}
