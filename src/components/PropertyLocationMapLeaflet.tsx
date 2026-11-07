"use client";

import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Property } from "@/data/properties";

const marker = L.divIcon({ className: "property-location-pin-wrap", html: '<span class="property-location-pin"></span>', iconSize: [22,22], iconAnchor: [11,11] });

export default function PropertyLocationMapLeaflet({ property }: { property: Pick<Property, "name" | "location" | "lat" | "lng"> }) {
  return <div className="property-location-map"><MapContainer center={[property.lat,property.lng]} zoom={14} scrollWheelZoom={false} className="property-location-leaflet"><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'/><Marker position={[property.lat,property.lng]} icon={marker}><Popup><b>{property.name}</b><br/>{property.location}</Popup></Marker></MapContainer></div>;
}
