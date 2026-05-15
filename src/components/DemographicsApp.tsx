"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Download, HelpCircle, Printer } from "lucide-react";
import { SearchBar, type GeocodeResult } from "./SearchBar";
import { StatsPanel } from "./StatsPanel";
import { Tutorial } from "./Tutorial";
import { buildCsv, csvFilenameFor, downloadCsv } from "@/lib/csv";
import type { DemographicsResult } from "@/lib/census";

const RING_OPTIONS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 5, 7, 10, 15, 20, 25];

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-csh-stone/40 animate-pulse" />,
});

// Three visually distinct hues — navy / gold / slate — each with a matching fill.
export const RING_TICK_COLORS = ["#0f2540", "#b8924a", "#5a7a82"];
export const RING_FILL_COLORS = [
  "rgba(15,37,64,0.14)",
  "rgba(184,146,74,0.10)",
  "rgba(90,122,130,0.10)",
];

const PRESETS: Array<GeocodeResult & { tag: string }> = [
  {
    tag: "US Capitol, DC",
    lat: 38.8895,
    lon: -77.0353,
    label: "United States Capitol, Washington, DC",
  },
  {
    tag: "Andover, MA",
    lat: 42.6583,
    lon: -71.1369,
    label: "Stone Hill at Andover · Andover, MA",
  },
  {
    tag: "Waugh Chapel, MD",
    lat: 39.0639,
    lon: -76.6829,
    label: "Arbor Terrace · Waugh Chapel, MD",
  },
];

interface Props {
  initialAddress?: string;
  initialLat?: number;
  initialLon?: number;
  initialRings?: number[];
}

const DEFAULT_RINGS = [1, 3, 5];

export function DemographicsApp({
  initialAddress,
  initialLat,
  initialLon,
  initialRings,
}: Props) {
  const [location, setLocation] = useState<GeocodeResult | null>(
    initialAddress && initialLat != null && initialLon != null
      ? { lat: initialLat, lon: initialLon, label: initialAddress }
      : null
  );
  const [rings, setRings] = useState<number[]>(
    initialRings && initialRings.length === 3 ? initialRings : DEFAULT_RINGS
  );
  const [data, setData] = useState<DemographicsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingCaption, setLoadingCaption] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Fetch demographics whenever address or rings change.
  useEffect(() => {
    if (!location) return;
    let cancelled = false;
    setLoading(true);
    setLoadingCaption("Locating tracts within ring radius…");
    setError(null);
    const ringsParam = rings.join(",");
    // Soft caption progression so the user knows it's working.
    const t1 = window.setTimeout(() => {
      if (!cancelled) setLoadingCaption("Pulling Census ACS data…");
    }, 700);
    const t2 = window.setTimeout(() => {
      if (!cancelled)
        setLoadingCaption(
          "Aggregating tract-level estimates across each ring…"
        );
    }, 2200);
    fetch(
      `/api/demographics?lat=${location.lat}&lon=${location.lon}&rings=${ringsParam}`
    )
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json.success) {
          setData(json.data);
        } else {
          setError(json.error ?? "Failed to load demographics");
          setData(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? "Network error");
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setLoadingCaption(null);
        }
      });
    return () => {
      cancelled = true;
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [location, rings]);

  // Sync URL with selection.
  useEffect(() => {
    if (!location) return;
    const params = new URLSearchParams({
      addr: location.label,
      lat: String(location.lat),
      lon: String(location.lon),
      rings: rings.join(","),
    });
    window.history.replaceState({}, "", `?${params.toString()}`);
  }, [location, rings]);

  // Auto-dismiss toast.
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const hasLocation = !!location;

  function onCsvDownload() {
    if (!data || !location) return;
    const csv = buildCsv(data, {
      address: location.label,
      lat: location.lat,
      lon: location.lon,
    });
    downloadCsv(csvFilenameFor(location.label), csv);
    setToast("CSV downloaded");
  }

  function onCopyShareLink() {
    if (!location) return;
    try {
      navigator.clipboard.writeText(window.location.href);
      setToast("Link copied to clipboard");
    } catch {
      setToast("Copy not supported in this browser");
    }
  }

  const ringsChanged = useMemo(
    () =>
      rings[0] !== DEFAULT_RINGS[0] ||
      rings[1] !== DEFAULT_RINGS[1] ||
      rings[2] !== DEFAULT_RINGS[2],
    [rings]
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Tutorial open={tutorialOpen} onClose={() => setTutorialOpen(false)} />

      {/* Toast */}
      {toast && (
        <div
          aria-live="polite"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-csh-navy text-csh-cream px-5 py-2.5 text-sm shadow-lg csh-fade-up"
        >
          {toast}
        </div>
      )}

      {/* Header */}
      <header className="border-b border-csh-line bg-csh-parchment/95 backdrop-blur-sm sticky top-0 z-20 print:hidden">
        <div className="max-w-[1400px] mx-auto px-5 lg:px-10 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <a
              href="https://www.capitolseniorshousing.com/"
              target="_blank"
              rel="noreferrer"
              className="block flex-shrink-0"
              aria-label="Capitol Seniors Housing"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/csh-logo.gif"
                alt="Capitol Seniors Housing"
                className="h-11 w-auto"
              />
            </a>
            <div className="hidden md:block h-9 w-px bg-csh-line" />
            <div className="hidden md:block">
              <div className="csh-eyebrow text-csh-gold">Internal Tool</div>
              <div className="text-csh-navy text-base font-semibold tracking-tight">
                Site Demographics Studio
              </div>
            </div>
            {hasLocation && (
              <div className="hidden lg:flex items-center gap-3 ml-2 pl-4 border-l border-csh-line min-w-0">
                <span className="csh-eyebrow text-csh-ink-soft flex-shrink-0">
                  Active site
                </span>
                <span className="text-csh-navy text-sm font-medium truncate">
                  {location?.label}
                </span>
              </div>
            )}
          </div>
          <div data-tutorial="export" className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={onCsvDownload}
              disabled={!hasLocation || !data}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs uppercase tracking-wider text-csh-navy hover:bg-csh-cream border border-transparent hover:border-csh-line transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ letterSpacing: "0.08em" }}
              title={!hasLocation ? "Select an address first" : "Download CSV"}
            >
              <Download className="w-4 h-4" strokeWidth={1.6} />
              CSV
            </button>
            <button
              onClick={() => window.print()}
              disabled={!hasLocation || !data}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs uppercase tracking-wider text-csh-navy hover:bg-csh-cream border border-transparent hover:border-csh-line transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ letterSpacing: "0.08em" }}
            >
              <Printer className="w-4 h-4" strokeWidth={1.6} />
              Print
            </button>
            <button
              onClick={() => setTutorialOpen(true)}
              aria-label="Open tutorial"
              className="inline-flex items-center justify-center w-9 h-9 text-csh-cream bg-csh-navy hover:bg-csh-navy-deep transition-colors"
              title="Tutorial"
            >
              <HelpCircle className="w-4 h-4" strokeWidth={1.7} />
            </button>
          </div>
        </div>
      </header>

      {/* Hero / Search — collapses after a site is selected */}
      <section
        className={`relative overflow-hidden border-b border-csh-line print:hidden transition-all duration-500 ${
          hasLocation ? "py-4" : "py-12"
        }`}
      >
        {!hasLocation && (
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
        )}
        <div className="relative max-w-[1400px] mx-auto px-5 lg:px-10">
          {hasLocation ? (
            // Compact bar after selection.
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
              <div className="flex-1 max-w-xl">
                <SearchBar
                  onSelect={setLocation}
                  loading={loading}
                  size="md"
                  initialValue=""
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap text-[13px] text-csh-ink-soft">
                <span className="csh-eyebrow">Try</span>
                {PRESETS.map((p) => (
                  <button
                    key={p.tag}
                    onClick={() =>
                      setLocation({ lat: p.lat, lon: p.lon, label: p.label })
                    }
                    className="px-2 py-1 hover:text-csh-navy underline underline-offset-4 hover:bg-csh-cream/60 transition-colors"
                  >
                    {p.tag}
                  </button>
                ))}
                {hasLocation && (
                  <button
                    onClick={onCopyShareLink}
                    className="px-2 py-1 hover:text-csh-navy underline underline-offset-4 hover:bg-csh-cream/60 transition-colors ml-2"
                    title="Copy URL with active site + rings"
                  >
                    Copy share link
                  </button>
                )}
              </div>
            </div>
          ) : (
            // Full hero on first visit.
            <div className="grid lg:grid-cols-[1fr_1.2fr] gap-10 items-end pb-2">
              <div>
                <div className="csh-eyebrow text-csh-gold mb-4">
                  Senior Living Standard · Site Selection
                </div>
                <h1 className="csh-display text-csh-navy text-5xl lg:text-6xl leading-[0.95]">
                  Where the right
                  <br />
                  residents <em className="not-italic text-csh-gold">already</em> live.
                </h1>
                <p className="mt-5 text-csh-ink-soft text-[16px] max-w-md leading-relaxed">
                  Drop any U.S. address to read the catchment in three concentric rings —
                  home value, household income, population, midlife decision-makers,
                  and the 75+ cohort.
                </p>
              </div>
              <div>
                <SearchBar onSelect={setLocation} loading={loading} autoFocus />
                <div className="mt-4 flex flex-wrap gap-x-2 gap-y-1 text-[13px] text-csh-ink-soft items-center">
                  <span className="csh-eyebrow mr-1">Or try</span>
                  {PRESETS.map((p) => (
                    <button
                      key={p.tag}
                      onClick={() =>
                        setLocation({ lat: p.lat, lon: p.lon, label: p.label })
                      }
                      className="px-2.5 py-1.5 border border-csh-line bg-white hover:border-csh-navy hover:text-csh-navy transition-colors"
                    >
                      {p.tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Main grid */}
      <main className="flex-1">
        <div className="max-w-[1400px] mx-auto px-5 lg:px-10 py-6">
          {error && (
            <div className="mb-6 px-4 py-3 border border-red-300 bg-red-50 text-red-800 text-sm">
              {error}
            </div>
          )}

          <div className="grid lg:grid-cols-5 gap-6">
            {/* Map */}
            <div className="lg:col-span-2 border border-csh-line bg-white overflow-hidden">
              <div className="px-5 py-3 border-b border-csh-line flex items-center justify-between bg-csh-cream/40">
                <div className="csh-eyebrow text-csh-ink">Map</div>
                {location && (
                  <div className="text-[12px] text-csh-ink-soft truncate max-w-[60%]">
                    {location.label}
                  </div>
                )}
              </div>
              <div className="h-[420px] lg:h-[520px] print:h-[400px]">
                <MapView
                  center={location}
                  label={location?.label ?? null}
                  ringMiles={rings}
                  ringColors={RING_TICK_COLORS}
                  ringFills={RING_FILL_COLORS}
                  onRelocate={
                    hasLocation
                      ? async ({ lat, lon }) => {
                          // Optimistically place the pin; refine label asynchronously.
                          setLocation({
                            lat,
                            lon,
                            label: `Locating… ${lat.toFixed(4)}, ${lon.toFixed(4)}`,
                          });
                          try {
                            const res = await fetch(
                              `/api/reverse-geocode?lat=${lat}&lon=${lon}`
                            );
                            const json = await res.json();
                            if (json.success && json.data?.label) {
                              setLocation({
                                lat,
                                lon,
                                label: json.data.label,
                              });
                            }
                          } catch {
                            // keep the optimistic label
                          }
                        }
                      : undefined
                  }
                />
              </div>
              {/* Ring legend */}
              <div className="px-5 py-3 border-t border-csh-line flex items-center justify-between text-[12px] flex-wrap gap-y-2">
                <div className="flex items-center gap-4">
                  {rings.map((m, i) => (
                    <div key={`${m}-${i}`} className="flex items-center gap-1.5">
                      <span
                        className="inline-block w-3 h-3 rounded-full border"
                        style={{
                          borderColor: RING_TICK_COLORS[i % 3],
                          background: RING_FILL_COLORS[i % 3],
                        }}
                      />
                      <span className="text-csh-ink-soft tabular-nums">{m} mi</span>
                    </div>
                  ))}
                </div>
                <span className="text-csh-ink-soft">© OpenStreetMap · CARTO</span>
              </div>
            </div>

            {/* Stats */}
            <div className="lg:col-span-3">
              <StatsPanel
                data={data}
                loading={loading}
                rings={rings}
                ringOptions={RING_OPTIONS}
                onRingChange={(index, value) =>
                  setRings(rings.map((r, i) => (i === index ? value : r)))
                }
                loadingCaption={loadingCaption}
              />
              {data && (
                <div className="mt-3 flex items-start justify-between gap-4">
                  <p className="text-[12px] text-csh-ink-soft leading-relaxed flex-1">
                    {data.meta.note}
                  </p>
                  {ringsChanged && (
                    <button
                      onClick={() => setRings(DEFAULT_RINGS)}
                      className="text-[12px] text-csh-ink-soft hover:text-csh-navy underline underline-offset-4 whitespace-nowrap"
                    >
                      Reset to 1 / 3 / 5
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-csh-line bg-csh-parchment print:hidden">
        <div className="max-w-[1400px] mx-auto px-5 lg:px-10 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[12px] text-csh-ink-soft">
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
