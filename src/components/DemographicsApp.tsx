"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { HelpCircle, Printer } from "lucide-react";
import { SearchBar, type GeocodeResult } from "./SearchBar";
import { StatsPanel } from "./StatsPanel";
import { Tutorial } from "./Tutorial";
import type { DemographicsResult } from "@/lib/census";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-csh-stone/40 animate-pulse" />
  ),
});

interface Props {
  initialAddress?: string;
  initialLat?: number;
  initialLon?: number;
}

export function DemographicsApp({ initialAddress, initialLat, initialLon }: Props) {
  const [location, setLocation] = useState<GeocodeResult | null>(
    initialAddress && initialLat != null && initialLon != null
      ? { lat: initialLat, lon: initialLon, label: initialAddress }
      : null
  );
  const [data, setData] = useState<DemographicsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  useEffect(() => {
    if (!location) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    fetch(`/api/demographics?lat=${location.lat}&lon=${location.lon}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json.success) {
          setData(json.data);
        } else {
          setError(json.error ?? "Failed to load demographics");
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? "Network error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [location]);

  // Sync URL with selection
  useEffect(() => {
    if (!location) return;
    const params = new URLSearchParams({
      addr: location.label,
      lat: String(location.lat),
      lon: String(location.lon),
    });
    window.history.replaceState({}, "", `?${params.toString()}`);
  }, [location]);

  const ringMiles = useMemo(() => [1, 3, 5], []);

  return (
    <div className="min-h-screen flex flex-col">
      <Tutorial open={tutorialOpen} onClose={() => setTutorialOpen(false)} />

      {/* Header */}
      <header className="border-b border-csh-line bg-csh-parchment/95 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-4 flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <a
              href="https://www.capitolseniorshousing.com/"
              target="_blank"
              rel="noreferrer"
              className="block"
              aria-label="Capitol Seniors Housing"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/csh-logo.gif"
                alt="Capitol Seniors Housing"
                className="h-10 w-auto"
              />
            </a>
            <div className="hidden md:block h-8 w-px bg-csh-line" />
            <div className="hidden md:block">
              <div className="csh-eyebrow text-csh-gold">Internal Tool</div>
              <div className="text-csh-navy text-sm font-medium tracking-tight">
                Site Demographics Studio
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              data-tutorial="export"
              onClick={() => window.print()}
              className="hidden sm:inline-flex items-center gap-2 px-3 py-2 text-xs uppercase tracking-wider text-csh-navy hover:bg-csh-cream border border-transparent hover:border-csh-line transition-colors"
              style={{ letterSpacing: "0.08em" }}
            >
              <Printer className="w-3.5 h-3.5" strokeWidth={1.6} />
              Print Report
            </button>
            <button
              onClick={() => setTutorialOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs uppercase tracking-wider text-csh-cream bg-csh-navy hover:bg-csh-navy-deep transition-colors"
              style={{ letterSpacing: "0.08em" }}
            >
              <HelpCircle className="w-3.5 h-3.5" strokeWidth={1.6} />
              <span>Tutorial</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero / Search */}
      <section className="relative overflow-hidden border-b border-csh-line">
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.05] flex items-end justify-end"
          aria-hidden
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/csh-logo.gif"
            alt=""
            className="w-[520px] -mr-16 -mb-8 grayscale"
          />
        </div>
        <div className="relative max-w-[1400px] mx-auto px-6 lg:px-10 pt-12 pb-10">
          <div className="grid lg:grid-cols-[1fr_1.2fr] gap-10 items-end">
            <div>
              <div className="csh-eyebrow text-csh-gold mb-4">
                Senior Living Standard · Site Selection
              </div>
              <h1 className="csh-display text-csh-navy text-5xl lg:text-6xl leading-[0.95]">
                Where the right
                <br />
                residents <em className="not-italic text-csh-gold">already</em> live.
              </h1>
              <p className="mt-5 text-csh-ink-soft text-[15px] max-w-md leading-relaxed">
                Drop any U.S. address to read the catchment in three concentric rings —
                home value, household income, population, midlife decision-makers,
                and the 75+ cohort.
              </p>
            </div>
            <div>
              <SearchBar onSelect={setLocation} loading={loading} />
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-csh-ink-soft">
                <button
                  onClick={() =>
                    setLocation({
                      lat: 38.8895,
                      lon: -77.0353,
                      label: "United States Capitol, Washington DC",
                    })
                  }
                  className="hover:text-csh-navy underline-offset-4 hover:underline"
                >
                  Try: US Capitol, DC
                </button>
                <button
                  onClick={() =>
                    setLocation({
                      lat: 42.6583,
                      lon: -71.1369,
                      label: "Andover, MA (Stone Hill at Andover)",
                    })
                  }
                  className="hover:text-csh-navy underline-offset-4 hover:underline"
                >
                  Try: Andover, MA
                </button>
                <button
                  onClick={() =>
                    setLocation({
                      lat: 39.0639,
                      lon: -76.6829,
                      label: "Waugh Chapel, MD (Arbor Terrace)",
                    })
                  }
                  className="hover:text-csh-navy underline-offset-4 hover:underline"
                >
                  Try: Waugh Chapel, MD
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main grid */}
      <main className="flex-1">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-8">
          {error && (
            <div className="mb-6 px-4 py-3 border border-red-300 bg-red-50 text-red-800 text-sm">
              {error}
            </div>
          )}

          <div className="grid lg:grid-cols-5 gap-6">
            {/* Map */}
            <div className="lg:col-span-2 border border-csh-line bg-white overflow-hidden">
              <div className="px-5 py-3 border-b border-csh-line flex items-center justify-between bg-csh-cream/40">
                <div className="csh-eyebrow text-csh-ink">Catchment</div>
                {location && (
                  <div className="text-xs text-csh-ink-soft truncate max-w-[60%]">
                    {location.label}
                  </div>
                )}
              </div>
              <div className="h-[480px]">
                <MapView
                  center={location}
                  label={location?.label ?? null}
                  ringMiles={ringMiles}
                />
              </div>
              {/* Ring legend */}
              <div className="px-5 py-3 border-t border-csh-line flex items-center justify-between text-xs">
                <div className="flex items-center gap-4">
                  {[1, 3, 5].map((m, i) => (
                    <div key={m} className="flex items-center gap-1.5">
                      <span
                        className="inline-block w-3 h-3 rounded-full border"
                        style={{
                          borderColor: ["#0f2540", "#1a3a5c", "#b8924a"][i],
                          background: [
                            "rgba(15,37,64,0.12)",
                            "rgba(26,58,92,0.08)",
                            "rgba(184,146,74,0.08)",
                          ][i],
                        }}
                      />
                      <span className="text-csh-ink-soft">{m} mi</span>
                    </div>
                  ))}
                </div>
                <span className="text-csh-ink-soft">
                  © OpenStreetMap · CARTO
                </span>
              </div>
            </div>

            {/* Stats */}
            <div className="lg:col-span-3">
              <StatsPanel data={data} loading={loading} />
              {data && (
                <p className="mt-3 text-[11px] text-csh-ink-soft leading-relaxed">
                  {data.meta.note}
                </p>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-csh-line bg-csh-parchment">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-csh-ink-soft">
          <div>
            Demographic intelligence for Capitol Seniors Housing site selection.
          </div>
          <div className="flex items-center gap-4">
            <span>US Census ACS · OpenStreetMap · TIGERweb</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
