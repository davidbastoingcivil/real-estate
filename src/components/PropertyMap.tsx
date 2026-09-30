"use client";
import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import DriveImage from "@/components/DriveImage";
import Link from "next/link";
import "leaflet/dist/leaflet.css";
import { formatCOP } from "@/data/properties";
import { usePropertyApp } from "@/components/AppProvider";
const pin = L.divIcon({ className: "gold-pin-wrap", html: '<span class="gold-pin">✦</span>', iconSize: [36, 42], iconAnchor: [18, 38] });
function FitVisibleProperties({properties}:{properties:ReturnType<typeof usePropertyApp>["visibleProperties"]}){const map=useMap();useEffect(()=>{if(!properties.length)return;if(properties.length===1){map.setView([properties[0].lat,properties[0].lng],11,{animate:true});return;}map.fitBounds(properties.map(property=>[property.lat,property.lng] as [number,number]),{padding:[44,44],maxZoom:11,animate:true});},[map,properties]);return null;}
export default function PropertyMap() { const { visibleProperties } = usePropertyApp(); return <MapContainer center={[4.15, -74.72]} zoom={7} scrollWheelZoom={false} className="leaflet-map"><TileLayer className="brand-map-tiles" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/><FitVisibleProperties properties={visibleProperties}/>{visibleProperties.map(p => <Marker key={p.id} position={[p.lat, p.lng]} icon={pin}><Popup><div className="map-popup"><div className="popup-image"><DriveImage className="media-fill" src={p.image} alt={p.name}/></div><div className="popup-body"><span>{p.location}</span><b>{p.name}</b><strong>Desde {formatCOP(p.price)}</strong><Link href={`/propiedades/${p.slug}`}>Ver propiedad →</Link></div></div></Popup></Marker>)}</MapContainer>; }
