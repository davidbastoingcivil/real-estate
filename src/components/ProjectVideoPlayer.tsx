import type { VideoPresentation } from "@/data/properties";
import { Film } from "lucide-react";

export default function ProjectVideoPlayer({ videos, projectName }: { videos: VideoPresentation[]; projectName: string }) {
  if (!videos.length) return null;
  return <section className="detail-block project-media-block" aria-label={`Presentaciones de ${projectName}`}>
    <div className="eyebrow"><span/> RECORRE EL PROYECTO</div>
    <h2>Conócelo en <em>video.</em></h2>
    <div className="project-video-grid">{videos.map((video,index)=><article className="project-video-card" key={`${video.url}-${index}`}>
      <video controls playsInline preload="none" poster={video.thumbnail} aria-label={`${video.title} · ${projectName}`}>
        <source src={video.url} type="video/mp4"/>Tu navegador no puede reproducir este video.
      </video>
      <div><Film size={15}/><span>{video.title}</span></div>
    </article>)}</div>
  </section>;
}
