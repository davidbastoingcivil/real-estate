import type { AvmComparable } from "@/lib/avm/valuationEngine";

const cop = (value: number) => `$ ${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(value)}`;

export default function ComparablesTable({ comparables }: { comparables: AvmComparable[] }) {
  if (!comparables.length) return <p className="avm-empty">No encontramos comparables publicados en un radio de 1,5 km con tipología y área similares.</p>;
  return <div className="avm-table-scroll"><table className="avm-table">
    <thead><tr><th>Inmueble</th><th>Área</th><th>Distancia</th><th>Oferta</th><th>Homogenizado</th></tr></thead>
    <tbody>{comparables.slice(0, 5).map(item => <tr key={item.id}>
      <td>{item.title}</td><td>{item.area_m2.toLocaleString("es-CO")} m²</td><td>{Math.round(item.distance_meters).toLocaleString("es-CO")} m</td>
      <td>{cop(item.price)}</td><td>{cop(item.adjusted_estimated_value)}</td>
    </tr>)}</tbody>
  </table></div>;
}
