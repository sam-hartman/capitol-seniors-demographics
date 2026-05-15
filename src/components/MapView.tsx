"use client";

import { useEffect, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import L from "leaflet";
import { MapPin } from "lucide-react";
import { haversineMiles } from "@/lib/geo";

interface Props {
  center: { lat: number; lon: number } | null;
  label?: string | null;
  ringMiles?: number[];
  onRelocate?: (latlon: { lat: number; lon: number }) => void;
  ringColors?: string[];
  ringFills?: string[];
}

const DEFAULT_RING_COLORS = ["#0f2540", "#b8924a", "#5a7a82"];
const DEFAULT_RING_FILLS = [
  "rgba(15,37,64,0.14)",
  "rgba(184,146,74,0.10)",
  "rgba(90,122,130,0.10)",
];

const MILES_TO_METERS = 1609.344;

const PIN_SIZE = 36;
const PIN_ANCHOR_X = 18;
const PIN_ANCHOR_Y = 33;

const PIN_SVG = renderToStaticMarkup(
  <MapPin
    size={PIN_SIZE}
    strokeWidth={1.8}
    color="#1a3a5c"
    fill="#f5f1e8"
    style={{
      display: "block",
      filter: "drop-shadow(0 2px 4px rgba(15,37,64,0.35))",
    }}
  />
);

const PIN_HTML = `
<div style="position: relative; width: ${PIN_SIZE}px; height: ${PIN_SIZE}px;">
  <div style="position: absolute; left: ${PIN_ANCHOR_X}px; top: ${PIN_ANCHOR_Y}px; transform: translate(-50%, -50%); width: 18px; height: 18px; border-radius: 50%; background: rgba(184, 146, 74, 0.5); pointer-events: none;" class="csh-pin-pulse"></div>
  ${PIN_SVG}
</div>`;

export default function MapView({
  center,
  label,
  ringMiles = [1, 3, 5],
  onRelocate,
  ringColors = DEFAULT_RING_COLORS,
  ringFills = DEFAULT_RING_FILLS,
}: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const onRelocateRef = useRef(onRelocate);
  const [hoverDistance, setHoverDistance] = useState<number | null>(null);

  useEffect(() => {
    onRelocateRef.current = onRelocate;
  }, [onRelocate]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [38.8895, -77.0353],
      zoom: 13,
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: true,
    });

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }
    ).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    layerGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    map.on("click", (e: L.LeafletMouseEvent) => {
      onRelocateRef.current?.({ lat: e.latlng.lat, lon: e.latlng.lng });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Hover distance readout, only when a center exists.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!center) {
      setHoverDistance(null);
      return;
    }
    function onMove(e: L.LeafletMouseEvent) {
      setHoverDistance(
        haversineMiles(center!, { lat: e.latlng.lat, lon: e.latlng.lng })
      );
    }
    function onOut() {
      setHoverDistance(null);
    }
    map.on("mousemove", onMove);
    map.on("mouseout", onOut);
    return () => {
      map.off("mousemove", onMove);
      map.off("mouseout", onOut);
    };
  }, [center]);

  // Crosshair cursor when relocating is enabled.
  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.style.cursor = onRelocate ? "crosshair" : "";
  }, [onRelocate]);

  useEffect(() => {
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;
    group.clearLayers();
    if (!center) return;

    const latlng: L.LatLngTuple = [center.lat, center.lon];

    const sortedRings = [...ringMiles].sort((a, b) => b - a);
    sortedRings.forEach((mile, i) => {
      const colorIdx = ringMiles.indexOf(mile);
      const stroke = ringColors[colorIdx % ringColors.length];
      const fill = ringFills[colorIdx % ringFills.length];
      L.circle(latlng, {
        radius: mile * MILES_TO_METERS,
        color: stroke,
        weight: 1.6,
        fillColor: fill,
        fillOpacity: 1,
        opacity: 0.9,
        dashArray: i === 0 ? "4 4" : undefined,
        interactive: false,
      }).addTo(group);
    });

    const pinIcon = L.divIcon({
      html: PIN_HTML,
      className: "csh-pin-marker",
      iconSize: [PIN_SIZE, PIN_SIZE],
      iconAnchor: [PIN_ANCHOR_X, PIN_ANCHOR_Y],
    });
    const marker = L.marker(latlng, { icon: pinIcon }).addTo(group);
    if (label) {
      marker.bindTooltip(label, {
        direction: "top",
        offset: [0, -PIN_ANCHOR_Y],
        className: "csh-tooltip",
      });
    }

    const largest = Math.max(...ringMiles);
    const bounds = L.latLng(latlng).toBounds(largest * MILES_TO_METERS * 2.4);
    map.flyToBounds(bounds, { duration: 0.8, padding: [20, 20] });
  }, [center, label, ringMiles, ringColors, ringFills]);

  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        data-tutorial="map"
        className="w-full h-full"
        style={{ minHeight: 360 }}
      />
      {center && (
        <div className="pointer-events-none absolute top-2 left-2 z-[400] flex flex-col gap-1.5">
          {hoverDistance != null && (
            <div className="bg-white/95 border border-csh-line shadow-sm px-2.5 py-1 text-[12px] tabular-nums text-csh-navy">
              <span className="text-csh-ink-soft mr-1">cursor</span>
              <span className="font-semibold">
                {hoverDistance < 0.1
                  ? `${(hoverDistance * 5280).toFixed(0)} ft`
                  : `${hoverDistance.toFixed(2)} mi`}
              </span>
              <span className="text-csh-ink-soft ml-1">from site</span>
            </div>
          )}
          {onRelocate && (
            <div className="bg-csh-navy/95 text-csh-cream px-2.5 py-1 text-[11px] uppercase tracking-wider">
              Click map to move site
            </div>
          )}
        </div>
      )}
    </div>
  );
}
