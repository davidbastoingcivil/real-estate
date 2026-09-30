"use client";

import { useState } from "react";

/** Turns common Google Drive share URLs into a URL that returns the image bytes. */
export function resolveImageUrl(source: string) {
  try {
    const url = new URL(source);
    if (url.hostname === "drive.google.com" || url.hostname === "www.drive.google.com") {
      const fileId = url.pathname.match(/\/file\/d\/([^/]+)/)?.[1] || url.searchParams.get("id");
      if (fileId) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1600`;
    }
  } catch {
    return source;
  }
  return source;
}

export default function DriveImage({ src, alt, className, highPriority = false }: { src: string; alt: string; className: string; highPriority?: boolean }) {
  const [unavailable, setUnavailable] = useState(false);
  if (!src || unavailable) return <span className={`image-unavailable ${className}`} role="img" aria-label={alt} />;
  return <img
    className={className}
    src={resolveImageUrl(src)}
    alt={alt}
    loading={highPriority ? "eager" : "lazy"}
    fetchPriority={highPriority ? "high" : "auto"}
    onError={() => setUnavailable(true)}
  />;
}
