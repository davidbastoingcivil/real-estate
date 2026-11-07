import type { AudioTour } from "@/data/properties";
import { Headphones } from "lucide-react";

export default function AudioPitchPlayer({ tours, projectName }: { tours: AudioTour[]; projectName: string }) {
  if (!tours.length) return null;
  return <section className="detail-block project-media-block" aria-label={`Audios de asesoría sobre ${projectName}`}>
    <div className="eyebrow"><span/> ESCUCHA AL ASESOR</div>
    <h2>Una explicación <em>para ti.</em></h2>
    <div className="project-audio-list">{tours.map((tour,index)=><article className="project-audio-card" key={`${tour.url}-${index}`}>
      <div className="project-audio-heading"><Headphones size={17}/><span><b>{tour.title}</b>{tour.duration&&<small>{tour.duration}</small>}</span></div>
      <audio controls preload="none" aria-label={`${tour.title} · ${projectName}`}><source src={tour.url} type="audio/mpeg"/>Tu navegador no puede reproducir este audio.</audio>
    </article>)}</div>
  </section>;
}
