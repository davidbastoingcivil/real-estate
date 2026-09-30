"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
const LeafletMap = dynamic(() => import("./PropertyMap"), { ssr: false, loading: () => <div className="map-loading">Preparando el mapa…</div> });
export default function MapView() { const [ready, setReady] = useState(false); useEffect(() => setReady(true), []); return ready ? <LeafletMap/> : <div className="map-loading">Preparando el mapa…</div>; }
