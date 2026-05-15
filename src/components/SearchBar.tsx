"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

export interface GeocodeResult {
  lat: number;
  lon: number;
  label: string;
}

interface Props {
  onSelect: (result: GeocodeResult) => void;
  loading?: boolean;
  initialValue?: string;
  size?: "lg" | "md";
  autoFocus?: boolean;
}

// Simplify Nominatim's verbose labels for display.
// Input: "United States Capitol, 1st Street North East, Capitol Hill,
//   Capitol Hill Historic District, Washington, District of Columbia, 20004,
//   United States"
// Output: "United States Capitol · Washington, DC"
const STATE_ABBR: Record<string, string> = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA",
  Colorado: "CO", Connecticut: "CT", Delaware: "DE", Florida: "FL", Georgia: "GA",
  Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA",
  Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD",
  Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS",
  Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV",
  "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
  "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK",
  Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT",
  Virginia: "VA", Washington: "WA", "West Virginia": "WV", Wisconsin: "WI",
  Wyoming: "WY", "District of Columbia": "DC",
};

function simplifyLabel(label: string): string {
  const parts = label.split(",").map((p) => p.trim());
  if (parts.length < 3) return label;
  const head = parts[0];
  // Drop "United States" tail.
  const trimmed = parts[parts.length - 1] === "United States" ? parts.slice(0, -1) : parts;
  // Find the state (last segment that matches a known state name).
  let stateIdx = -1;
  for (let i = trimmed.length - 1; i >= 0; i--) {
    if (STATE_ABBR[trimmed[i]]) {
      stateIdx = i;
      break;
    }
  }
  // City is usually the segment immediately before the state.
  const stateAbbr = stateIdx >= 0 ? STATE_ABBR[trimmed[stateIdx]] : "";
  const city = stateIdx > 0 ? trimmed[stateIdx - 1] : trimmed[trimmed.length - 2];
  if (city && stateAbbr) return `${head} · ${city}, ${stateAbbr}`;
  return head;
}

export function SearchBar({
  onSelect,
  loading,
  initialValue = "",
  size = "lg",
  autoFocus = false,
}: Props) {
  const [query, setQuery] = useState(initialValue);
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // "/" focuses the search box from anywhere (unless already typing).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/") return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function runSearch(q: string) {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, {
        signal: ac.signal,
      });
      const json = await res.json();
      if (json.success) {
        setResults(json.data);
        setOpen(true);
      } else {
        setResults([]);
        setError(json.error ?? "No results");
        setOpen(true);
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError("Search failed");
    } finally {
      setSearching(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length >= 3) runSearch(query.trim());
  }

  function pick(r: GeocodeResult) {
    setQuery(simplifyLabel(r.label));
    setOpen(false);
    onSelect(r);
  }

  const padY = size === "lg" ? "py-4" : "py-3";
  const fontSize = size === "lg" ? "text-[17px]" : "text-[15px]";

  return (
    <div ref={wrapRef} className="relative w-full">
      <form
        onSubmit={handleSubmit}
        className="group flex items-stretch border border-csh-line bg-white shadow-[0_1px_0_rgba(26,58,92,0.04),0_8px_24px_-12px_rgba(26,58,92,0.18)] focus-within:border-csh-navy transition-colors"
      >
        <div className="flex items-center pl-4 text-csh-navy/70">
          <Search className={size === "lg" ? "w-5 h-5" : "w-4 h-4"} strokeWidth={1.6} />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Enter an address, city, or ZIP — press / to focus"
          className={`flex-1 px-4 ${padY} bg-transparent text-csh-ink placeholder:text-csh-ink-soft/60 focus:outline-none ${fontSize}`}
          data-tutorial="search"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="submit"
          disabled={loading || searching || query.trim().length < 3}
          className="px-6 bg-csh-navy text-csh-cream text-sm font-medium tracking-wide uppercase hover:bg-csh-navy-deep transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ letterSpacing: "0.08em" }}
        >
          {loading || searching ? "…" : "Analyze"}
        </button>
      </form>

      {open && (results.length > 0 || error) && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-csh-line shadow-[0_12px_32px_-12px_rgba(26,58,92,0.25)]">
          {error && results.length === 0 && (
            <div className="px-4 py-3 text-sm text-csh-ink-soft">{error}</div>
          )}
          <ul className="divide-y divide-csh-line/60">
            {results.map((r, i) => (
              <li key={`${r.lat},${r.lon},${i}`}>
                <button
                  type="button"
                  onClick={() => pick(r)}
                  className="w-full text-left px-4 py-3 hover:bg-csh-cream/60 transition-colors text-csh-ink flex items-start gap-3"
                >
                  <span className="text-csh-gold mt-0.5 font-serif text-xs tabular-nums">
                    0{i + 1}
                  </span>
                  <span className="flex-1 text-[15px]">{simplifyLabel(r.label)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
