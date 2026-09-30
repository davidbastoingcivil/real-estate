"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, Film, Images, X } from "lucide-react";
import DriveImage from "@/components/DriveImage";

function mediaKind(source: string) {
  try {
    const url = new URL(source);
    const explicitVideo = url.searchParams.get("type") === "video" || url.searchParams.get("media") === "video" || url.hash.includes("media=video");
    const extensionVideo = /\.(mp4|webm|mov|m4v|ogv)$/i.test(url.pathname);
    return { video: explicitVideo || extensionVideo, drive: url.hostname === "drive.google.com" || url.hostname === "www.drive.google.com" };
  } catch {
    return { video: /\.(mp4|webm|mov|m4v|ogv)(?:$|[?#])/i.test(source), drive: false };
  }
}

function PropertyMedia({ source, title, className = "" }: { source: string; title: string; className?: string }) {
  const kind = mediaKind(source);
  if (kind.video && kind.drive) {
    const id = source.match(/\/file\/d\/([^/]+)/)?.[1];
    const preview = id ? `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview` : source;
    return <iframe className={`property-gallery-drive-video ${className}`} src={preview} title={`Video: ${title}`} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen loading="lazy"/>;
  }
  if (kind.video) return <video className={className} src={source} controls playsInline preload="metadata" aria-label={`Video de ${title}`}/>;
  return <DriveImage className={className} src={source} alt={`${title}, imagen de la propiedad`} highPriority/>;
}

export default function PropertyGallery({ media, title }: { media: string[]; title: string }) {
  const items = useMemo(() => media.filter(Boolean), [media]);
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const current = items[index] || "";
  const move = useCallback((step: number) => setIndex(position => (position + step + items.length) % items.length), [items.length]);
  const touchStart = useRef<number | null>(null);

  useEffect(() => {
    if (!expanded) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setExpanded(false);
      if (event.key === "ArrowRight") move(1);
      if (event.key === "ArrowLeft") move(-1);
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [expanded, move]);

  if (!items.length) return <div className="property-gallery-empty"><Images size={28}/><span>Imágenes y videos próximamente</span></div>;
  const video = mediaKind(current).video;
  return <>
    <section className="property-gallery" aria-label={`Galería de ${title}`}>
      <div className="property-gallery-stage" onTouchStart={event => { touchStart.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={event => { if (touchStart.current === null) return; const delta = event.changedTouches[0].clientX - touchStart.current; if (Math.abs(delta) > 48 && items.length > 1) move(delta < 0 ? 1 : -1); touchStart.current = null; }}>
        {!expanded && <div className={`property-gallery-media-target ${video ? "is-video" : "is-image"}`} onClick={event => { if (!video && !(event.target as HTMLElement).closest("button")) setExpanded(true); }}><PropertyMedia source={current} title={title} className="property-gallery-media"/></div>}
        {items.length > 1 && <>
          <button type="button" className="property-gallery-arrow previous" onClick={() => move(-1)} aria-label="Ver archivo anterior"><ChevronLeft size={21}/></button>
          <button type="button" className="property-gallery-arrow next" onClick={() => move(1)} aria-label="Ver archivo siguiente"><ChevronRight size={21}/></button>
        </>}
        {!video && <button type="button" className="property-gallery-expand" onClick={() => setExpanded(true)} aria-label="Ampliar imagen a pantalla completa"><Expand size={17}/><span>Ampliar</span></button>}
        {video && <button type="button" className="property-gallery-expand" onClick={() => setExpanded(true)} aria-label="Abrir video a pantalla completa"><Expand size={17}/><span>Ampliar</span></button>}
        {items.length > 1 && <div className="property-gallery-dots" role="tablist" aria-label="Seleccionar archivo de la galería">{items.map((item, itemIndex) => <button type="button" role="tab" key={`${item}-${itemIndex}`} onClick={() => setIndex(itemIndex)} className={itemIndex === index ? "active" : ""} aria-label={`Ver archivo ${itemIndex + 1}`} aria-selected={itemIndex === index}/>)}</div>}
      </div>
      {items.length > 1 && <div className="property-gallery-thumbnails" aria-label="Todos los archivos">
        {items.map((item, itemIndex) => <button type="button" key={`${item}-${itemIndex}`} onClick={() => setIndex(itemIndex)} className={itemIndex === index ? "active" : ""} aria-label={`Seleccionar archivo ${itemIndex + 1}`}>
          {mediaKind(item).video ? <span className="property-gallery-video-thumb"><Film size={20}/></span> : <DriveImage className="property-gallery-thumb-image" src={item} alt=""/>}
        </button>)}
      </div>}
    </section>
    {expanded && <div className="property-gallery-lightbox" role="dialog" aria-modal="true" aria-label={`Galería ampliada de ${title}`} onClick={event => { if (event.target === event.currentTarget) setExpanded(false); }}>
      <button type="button" className="property-gallery-close" onClick={() => setExpanded(false)} aria-label="Cerrar pantalla completa"><X size={23}/></button>
      {items.length > 1 && <button type="button" className="property-gallery-lightbox-arrow previous" onClick={() => move(-1)} aria-label="Archivo anterior"><ChevronLeft size={28}/></button>}
      <div className="property-gallery-lightbox-stage"><PropertyMedia source={current} title={title} className="property-gallery-lightbox-media"/></div>
      {items.length > 1 && <button type="button" className="property-gallery-lightbox-arrow next" onClick={() => move(1)} aria-label="Archivo siguiente"><ChevronRight size={28}/></button>}
    </div>}
  </>;
}
