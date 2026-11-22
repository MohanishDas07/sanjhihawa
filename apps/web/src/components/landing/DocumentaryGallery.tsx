"use client";

import React from "react";
import Image from "next/image";
import { useTranslation } from "@/lib/i18n";

interface DocumentaryGalleryProps {
  onSelectCity: (city: string, lat: number, lon: number) => void;
}

export function DocumentaryGallery({ onSelectCity }: DocumentaryGalleryProps) {
  const { t } = useTranslation();

  const corridors = [
    {
      city: "Delhi",
      lat: 28.6139,
      lon: 77.2090,
      image: "/images/smog_delhi.jpg",
      alt: "Delhi NCR winter smog with India Gate fading into dense particulate haze",
      record: "Delhi NCR • Field Record",
      region: "Indo-Gangetic Basin",
      title: "Delhi NCR Corridor",
      subtitle: "Rajpath & Kartavya Path Inversion",
      description: "Post-harvest biomass residue meets calm winds and a collapsed 120m thermal boundary layer, trapping toxic aerosols at street level.",
      btnText: "Inspect Live Air for Delhi",
    },
    {
      city: "Kolkata",
      lat: 22.5726,
      lon: 88.3639,
      image: "/images/smog_kolkata.jpg",
      alt: "Kolkata winter smog over Hooghly River and Howrah bridge",
      record: "Kolkata • Riverfront Inversion",
      region: "Lower Gangetic Plain",
      title: "Kolkata / Riverfront",
      subtitle: "Hooghly Basin & Howrah Span",
      description: "High river moisture condenses with industrial sulfur and domestic solid-fuel emissions, creating persistent morning particulate smog.",
      btnText: "Inspect Live Air for Kolkata",
    },
    {
      city: "Mumbai",
      lat: 19.0760,
      lon: 72.8777,
      image: "/images/smog_mumbai.jpg",
      alt: "Mumbai winter marine temperature inversion haze over Sea Link skyline",
      record: "Mumbai • Coastal Marine Layer",
      region: "Western Coast",
      title: "Mumbai Coastal Line",
      subtitle: "Bandra-Worli Marine Inversion",
      description: "Winter land-sea breeze transition traps heavy construction dust and coastal transport soot beneath a low marine temperature inversion.",
      btnText: "Inspect Live Air for Mumbai",
    },
    {
      city: "Bengaluru",
      lat: 12.9716,
      lon: 77.5946,
      image: "/images/smog_bengaluru.jpg",
      alt: "Bengaluru Vidhana Soudha veiled in winter morning particulate smog and atmospheric haze",
      record: "Bengaluru • Plateau Inversion",
      region: "Deccan Plateau (~920m)",
      title: "Bengaluru Tech Corridor",
      subtitle: "Vidhana Soudha & Outer Ring Road",
      description: "Morning radiational cooling over the 920m plateau confines diesel vehicular particulate into low valleys before midday solar convection clears the layer.",
      btnText: "Inspect Live Air for Bengaluru",
    },
    {
      city: "Lucknow",
      lat: 26.8467,
      lon: 80.9462,
      image: "/images/smog_lucknow.jpg",
      alt: "Lucknow highway corridor shrouded in dense winter thermal inversion smog",
      record: "Lucknow • Indo-Gangetic Basin",
      region: "Central Gangetic Plain",
      title: "Lucknow / Indo-Gangetic",
      subtitle: "Transport Corridor & Gomti Basin",
      description: "Intense nighttime radiative ground cooling creates an impermeable lid, holding diesel exhaust and regional biomass smoke near the surface.",
      btnText: "Inspect Live Air for Lucknow",
    },
    {
      city: "Hyderabad",
      lat: 17.3850,
      lon: 78.4867,
      image: "/images/smog_hyderabad.jpg",
      alt: "Hyderabad Charminar rising into dense winter atmospheric inversion smog",
      record: "Hyderabad • Deccan Basin",
      region: "Telangana Plateau",
      title: "Hyderabad Corridor",
      subtitle: "Charminar & Hussain Sagar Basin",
      description: "Seasonal winter inversions trap urban vehicular exhaust and commercial activity over the Musi basin, creating persistent haze until late afternoon.",
      btnText: "Inspect Live Air for Hyderabad",
    },
  ];

  return (
    <section className="space-y-5 font-sans" aria-label="Field Documentary Records">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b hairline border-rule pb-3 gap-2">
        <div>
          <span className="font-sans text-xs uppercase tracking-widest text-ink-muted font-bold block mb-1">
            {t("landing.photos_eyebrow")}
          </span>
          <h2 className="font-serif text-2xl md:text-3xl font-bold text-ink tracking-tight">
            {t("landing.photos_title")}
          </h2>
        </div>
        <span className="font-mono text-xs text-ink-muted">
          6 Regional Corridors Documented
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {corridors.map((c) => (
          <button
            key={c.city}
            type="button"
            onClick={() => onSelectCity(c.city, c.lat, c.lon)}
            className="group text-left p-4 sm:p-5 bg-surface border border-rule hover:border-ink hover:bg-paper transition-all duration-200 hover:-translate-y-1 hover:shadow-lg flex flex-col justify-between"
          >
            <div className="space-y-3.5">
              <div className="relative w-full h-56 md:h-64 overflow-hidden bg-neutral-900 border border-rule">
                <Image
                  src={c.image}
                  alt={c.alt}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-500 brightness-95 contrast-105"
                />
                <span className="absolute bottom-2.5 left-2.5 bg-ink/85 text-paper font-sans text-xs px-3 py-1 uppercase tracking-wider backdrop-blur-xs font-bold">
                  {c.record}
                </span>
                <span className="absolute top-2.5 right-2.5 bg-paper/90 text-ink font-sans text-xs px-2.5 py-0.5 border border-rule font-bold">
                  {c.region}
                </span>
              </div>
              <div>
                <h3 className="font-sans text-xl md:text-2xl font-bold text-ink tracking-tight group-hover:text-ink">
                  {c.title}
                </h3>
                <span className="font-sans text-xs text-ink-muted block uppercase tracking-wider mt-1 font-semibold">
                  {c.subtitle}
                </span>
                <p className="text-sm font-sans text-ink/80 mt-2.5 leading-relaxed font-normal">
                  {c.description}
                </p>
              </div>
            </div>
            <span className="font-sans text-xs text-ink font-bold uppercase tracking-wider mt-4 pt-3 border-t hairline border-rule flex items-center justify-between">
              <span>{c.btnText}</span>
              <span className="group-hover:translate-x-1.5 transition-transform">→</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
