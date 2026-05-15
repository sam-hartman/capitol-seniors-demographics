"use client";

import { useEffect, useRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import L from "leaflet";
import { MapPin } from "lucide-react";

interface Props {
  center: { lat: number; lon: number } | null;
  label?: string | null;
  ringMiles?: number[];
}

const RING_COLORS = [
  { stroke: "#0f2540", fill: "rgba(15, 37, 64, 0.08)" },
  { stroke: "#1a3a5c", fill: "rgba(26, 58, 92, 0.05)" },
  { stroke: "#b8924a", fill: "rgba(184, 146, 74, 0.04)" },
];

const MILES_TO_METERS = 1609.344;

// Lucide MapPin viewBox is 24x24 with the tip at roughly (12, 22). At size=36
// that scales the tip to (18, 33). We anchor the icon at that exact pixel so
// the tip sits on the geographic point.
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

// Pulse circle is centered on the icon's anchor (the tip of the pin).
const PIN_HTML = `
<div style="position: relative; width: ${PIN_SIZE}px; height: ${PIN_SIZE}px;">
  <div style="position: absolute; left: ${PIN_ANCHOR_X}px; top: ${PIN_ANCHOR_Y}px; transform: translate(-50%, -50%); width: 18px; height: 18px; border-radius: 50%; background: rgba(184, 146, 74, 0.5); pointer-events: none;" class="csh-pin-pulse"></div>
  ${PIN_SVG}
</div>`;

export default function MapView({ center, label, ringMiles = [1, 3, 5] }: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

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

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

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
      const color = RING_COLORS[colorIdx % RING_COLORS.length];
      L.circle(latlng, {
        radius: mile * MILES_TO_METERS,
        color: color.stroke,
        weight: 1.4,
        fillColor: color.fill,
        fillOpacity: 1,
        opacity: 0.85,
        dashArray: i === 0 ? "4 4" : undefined,
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
  }, [center, label, ringMiles]);

  return (
    <div
      ref={containerRef}
      data-tutorial="map"
      className="w-full h-full"
      style={{ minHeight: 360 }}
    />
  );
}
