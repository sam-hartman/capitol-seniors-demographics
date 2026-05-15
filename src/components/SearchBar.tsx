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
}

export function SearchBar({ onSelect, loading, initialValue = "" }: Props) {
  const [query, setQuery] = useState(initialValue);
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
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
    setQuery(r.label);
    setOpen(false);
    onSelect(r);
  }

  return (
    <div ref={wrapRef} className="relative w-full">
      <form
        onSubmit={handleSubmit}
        className="group flex items-stretch border border-csh-line bg-white shadow-[0_1px_0_rgba(26,58,92,0.04),0_8px_24px_-12px_rgba(26,58,92,0.18)] focus-within:border-csh-navy transition-colors"
      >
        <div className="flex items-center pl-4 text-csh-navy/70">
          <Search className="w-5 h-5" strokeWidth={1.6} />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Enter a property address, city, or ZIP"
          className="flex-1 px-4 py-4 bg-transparent text-csh-ink placeholder:text-csh-ink-soft/60 focus:outline-none text-[15px]"
          data-tutorial="search"
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
                  className="w-full text-left px-4 py-3 hover:bg-csh-cream/60 transition-colors text-sm text-csh-ink flex items-start gap-3"
                >
                  <span className="text-csh-gold mt-0.5 font-serif text-xs">
                    0{i + 1}
                  </span>
                  <span className="flex-1">{r.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
