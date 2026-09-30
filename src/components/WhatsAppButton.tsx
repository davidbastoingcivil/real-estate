"use client";
import { MessageCircle } from "lucide-react";
import { usePropertyApp } from "@/components/AppProvider";
export default function WhatsAppButton({ property }: { property?: string }) {
  const { settings }=usePropertyApp(); const phone=settings.whatsappPhone.replace(/\D/g,"");
  const message = encodeURIComponent(property ? `Hola ${settings.contactName}, quiero recibir más información sobre ${property}.` : `Hola ${settings.contactName}, quiero conocer las propiedades disponibles.`);
  return <a className="whatsapp" href={`https://wa.me/${phone}?text=${message}`} target="_blank" rel="noreferrer" aria-label="Escribir por WhatsApp"><MessageCircle size={21} fill="currentColor"/><span>Hablemos</span></a>;
}
