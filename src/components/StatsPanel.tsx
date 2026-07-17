"use client";

import { Home, Wallet, Users, UsersRound, Accessibility } from "lucide-react";
import { RING_STROKES } from "@/lib/ring-colors";
import type { DemographicsResult } from "@/lib/census";

interface Props {
  data: DemographicsResult | null;
  loading: boolean;
  rings: number[];
  onRingChange: (index: number, value: number) => void;
  ringOptions: number[];
  loadingCaption?: string | null;
}

const METRICS = [
  {
    key: "medianHomeValue" as const,
    label: "Median Home Value",
    sub: "Owner-occupied households",
    icon: Home,
    format: (v: number | null) =>
      v == null ? "—" : `$${Math.round(v).toLocaleString()}`,
  },
  {
    key: "medianHouseholdIncome" as const,
    label: "Median Household Income",
    sub: "Annual, all households",
    icon: Wallet,
    format: (v: number | null) =>
      v == null ? "—" : `$${Math.round(v).toLocaleString()}`,
  },
  {
    key: "totalPopulation" as const,
    label: "Total Population",
    sub: "All ages",
    icon: Users,
    format: (v: number) => v.toLocaleString(),
  },
  {
    key: "totalHouseholds45to64" as const,
    label: "All Households Age 45–64",
    sub: "Adult-child caregivers (all income levels)",
    icon: UsersRound,
    format: (v: number) => v.toLocaleString(),
  },
  {
    key: "totalSeniors75plus" as const,
    label: "All Seniors Age 75+",
    sub: "Target residents (all income levels)",
    icon: Accessibility,
    format: (v: number) => v.toLocaleString(),
  },
];

function SkeletonRow({ ringCount }: { ringCount: number }) {
  return (
    <div
      className="grid gap-4 px-6 py-5 items-center"
      style={{
        gridTemplateColumns: `auto 1fr repeat(${ringCount}, minmax(0,1fr))`,
      }}
    >
      <div className="w-10 h-10 rounded-full bg-csh-stone/60 animate-pulse" />
      <div className="space-y-2">
        <div className="h-4 w-44 bg-csh-stone/50 animate-pulse rounded" />
        <div className="h-3 w-32 bg-csh-stone/40 animate-pulse rounded" />
      </div>
      {Array.from({ length: ringCount }).map((_, i) => (
        <div
          key={i}
          className="h-7 w-28 bg-csh-stone/50 animate-pulse rounded justify-self-end"
        />
      ))}
    </div>
  );
}

interface RingHeaderSelectProps {
  value: number;
  index: number;
  onChange: (index: number, value: number) => void;
  disabled?: boolean;
  ringOptions: number[];
}

function RingHeaderSelect({
  value,
  index,
  onChange,
  disabled,
  ringOptions,
}: RingHeaderSelectProps) {
  return (
    <div className="flex items-center justify-end gap-2">
      <span
        className="inline-block w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-white"
        style={{ backgroundColor: RING_STROKES[index % RING_STROKES.length] }}
      />
      <div className="relative">
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(index, Number(e.target.value))}
          aria-label={`Ring ${index + 1} radius`}
          className="appearance-none bg-transparent border-0 text-csh-ink text-sm font-semibold uppercase tabular-nums py-1 pl-2 pr-6 hover:text-csh-navy focus:outline-none focus:text-csh-navy cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          style={{ letterSpacing: "0.10em" }}
        >
          {ringOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt} MILE
            </option>
          ))}
        </select>
        <svg
          className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-csh-ink-soft pointer-events-none"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <path d="M3 4.5 L6 7.5 L9 4.5" />
        </svg>
      </div>
    </div>
  );
}

export function StatsPanel({
  data,
  loading,
  rings,
  onRingChange,
  ringOptions,
  loadingCaption,
}: Props) {
  if (!data && !loading) {
    return (
      <div
        data-tutorial="stats"
        className="border border-csh-line bg-white px-8 py-14 text-center"
      >
        <div className="csh-eyebrow mb-3">Awaiting Address</div>
        <p className="csh-display text-2xl text-csh-navy max-w-md mx-auto leading-snug">
          Enter a candidate site address to generate a demographic profile across each ring.
        </p>
      </div>
    );
  }

  const ringCount = rings.length;
  const gridStyle = {
    gridTemplateColumns: `auto 1fr repeat(${ringCount}, minmax(0,1fr))`,
  };

  return (
    <div data-tutorial="stats" className="border border-csh-line bg-white">
      {/* Header row with editable ring badges */}
      <div
        className="grid gap-4 px-6 py-3 border-b border-csh-line bg-csh-cream/40 items-center"
        style={gridStyle}
      >
        <div className="w-10" />
        <div className="csh-eyebrow">Metric</div>
        {rings.map((mile, i) => (
          <RingHeaderSelect
            key={i}
            value={mile}
            index={i}
            onChange={onRingChange}
            disabled={loading}
            ringOptions={ringOptions}
          />
        ))}
      </div>

      {/* Loading caption */}
      {loading && loadingCaption && (
        <div
          aria-live="polite"
          className="px-6 py-2 text-[13px] text-csh-ink-soft border-b border-csh-line/60 bg-csh-parchment/50 italic"
        >
          {loadingCaption}
        </div>
      )}

      {/* Metric rows */}
      <div className="divide-y divide-csh-line/70">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} ringCount={ringCount} />
            ))
          : METRICS.map((m, mi) => {
              const Icon = m.icon;
              return (
                <div
                  key={m.key}
                  className="grid gap-4 px-6 py-5 items-center group hover:bg-csh-cream/40 transition-colors csh-fade-up"
                  style={{ ...gridStyle, animationDelay: `${mi * 60}ms` }}
                >
                  <div className="w-10 h-10 flex items-center justify-center rounded-full bg-csh-cream/70 text-csh-navy group-hover:bg-csh-navy group-hover:text-csh-cream transition-colors">
                    <Icon strokeWidth={1.6} size={20} />
                  </div>
                  <div>
                    <div className="text-csh-ink font-semibold leading-tight text-[15px]">
                      {m.label}
                    </div>
                    <div className="text-csh-ink-soft text-[13px] mt-0.5">
                      {m.sub}
                    </div>
                  </div>
                  {data!.rings.map((r) => {
                    const v = r[m.key];
                    return (
                      <div key={r.radiusMiles} className="text-right">
                        <span className="csh-display text-2xl text-csh-navy tabular-nums">
                          {(m.format as (x: typeof v) => string)(v)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
      </div>

      {/* Esri-only extra rows (forecasts, qualified counts, Tapestry).
          Rendered seamlessly inline after the 5 core metrics — no section
          divider, since all data comes from the same source. */}
      {data && data.esriExtras && !loading && (
        <>
          {/* 2031 projected population */}
          <div className="grid gap-4 px-6 py-4 items-center border-t border-csh-line/50" style={gridStyle}>
            <div className="w-10 h-10 flex items-center justify-center rounded-full bg-csh-gold/15 text-csh-gold">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 17l6-6 4 4 8-8M14 7h7v7"/></svg>
            </div>
            <div>
              <div className="text-csh-ink font-semibold leading-tight text-[15px]">
                2031 Population
              </div>
              <div className="text-csh-ink-soft text-[13px] mt-0.5">
                Esri 5-year forecast
              </div>
            </div>
            {data.esriExtras.map((x, i) => (
              <div key={`pop2030-${i}`} className="text-right">
                <div className="csh-display text-2xl text-csh-navy tabular-nums">
                  {x.population2030 != null ? x.population2030.toLocaleString() : "—"}
                </div>
                {x.popGrowthPct != null && (
                  <div
                    className={`text-[11px] tabular-nums ${
                      x.popGrowthPct >= 0 ? "text-emerald-700" : "text-red-700"
                    }`}
                  >
                    {x.popGrowthPct >= 0 ? "+" : ""}
                    {x.popGrowthPct.toFixed(1)}%/yr
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Income growth */}
          {data.esriExtras.some((x) => x.incomeGrowthPct != null) && (
            <div className="grid gap-4 px-6 py-4 items-center border-t border-csh-line/50" style={gridStyle}>
              <div className="w-10 h-10 flex items-center justify-center rounded-full bg-csh-gold/15 text-csh-gold">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 2v20M5 9l7-7 7 7M5 15l7 7 7-7"/></svg>
              </div>
              <div>
                <div className="text-csh-ink font-semibold leading-tight text-[15px]">
                  Income Growth (2026–2031)
                </div>
                <div className="text-csh-ink-soft text-[13px] mt-0.5">
                  Median HH income, annualized
                </div>
              </div>
              {data.esriExtras.map((x, i) => (
                <div key={`inc-${i}`} className="text-right">
                  <span
                    className={`csh-display text-xl tabular-nums ${
                      x.incomeGrowthPct != null && x.incomeGrowthPct >= 0
                        ? "text-emerald-700"
                        : "text-red-700"
                    }`}
                  >
                    {x.incomeGrowthPct != null
                      ? `${x.incomeGrowthPct >= 0 ? "+" : ""}${x.incomeGrowthPct.toFixed(1)}%`
                      : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Income-qualified caregivers (45-64, HH income ≥ $75K) */}
          {data.esriExtras.some((x) => x.qualifiedCaregivers45to64 != null) && (
            <div className="grid gap-4 px-6 py-4 items-center border-t border-csh-line/50" style={gridStyle}>
              <div className="w-10 h-10 flex items-center justify-center rounded-full bg-csh-gold/15 text-csh-gold">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="9" cy="9" r="3"/><path d="M3 19c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M14 18c0-2.5 1.5-4 3-4s4 1.5 4 4"/></svg>
              </div>
              <div>
                <div className="text-csh-ink font-semibold leading-tight text-[15px]">
                  Qualified Caregivers Age 45–64
                </div>
                <div className="text-csh-ink-soft text-[13px] mt-0.5">
                  HH income ≥ $75K (AL payor threshold)
                </div>
              </div>
              {data.esriExtras.map((x, i) => {
                const total = data.rings[i]?.totalHouseholds45to64 ?? 0;
                const pct =
                  total > 0 && x.qualifiedCaregivers45to64 != null
                    ? (x.qualifiedCaregivers45to64 / total) * 100
                    : null;
                return (
                  <div key={`qcg-${i}`} className="text-right">
                    <div className="csh-display text-2xl text-csh-navy tabular-nums">
                      {x.qualifiedCaregivers45to64?.toLocaleString() ?? "—"}
                    </div>
                    {pct != null && (
                      <div className="text-[11px] text-csh-ink-soft tabular-nums">
                        {pct.toFixed(0)}% of all
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Income-qualified senior households 75+ (HH income ≥ $50K) */}
          {data.esriExtras.some((x) => x.qualifiedSeniorHH75plus != null) && (
            <div className="grid gap-4 px-6 py-4 items-center border-t border-csh-line/50" style={gridStyle}>
              <div className="w-10 h-10 flex items-center justify-center rounded-full bg-csh-gold/15 text-csh-gold">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 2v20M5 9h14M5 9l3 13M19 9l-3 13"/></svg>
              </div>
              <div>
                <div className="text-csh-ink font-semibold leading-tight text-[15px]">
                  Qualified Senior Households 75+
                </div>
                <div className="text-csh-ink-soft text-[13px] mt-0.5">
                  HH income ≥ $50K (IL payor threshold)
                </div>
              </div>
              {data.esriExtras.map((x, i) => (
                <div key={`qsr-${i}`} className="text-right">
                  <div className="csh-display text-2xl text-csh-navy tabular-nums">
                    {x.qualifiedSeniorHH75plus?.toLocaleString() ?? "—"}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Income-qualified senior households 75+, projected to 2031 (Esri 5-yr forecast) */}
          {data.esriExtras.some((x) => x.qualifiedSeniorHH75plusForecast != null) && (
            <div className="grid gap-4 px-6 py-4 items-center border-t border-csh-line/50" style={gridStyle}>
              <div className="w-10 h-10 flex items-center justify-center rounded-full bg-csh-gold/15 text-csh-gold">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 21h18M7 21v-6M12 21V9m5 12V6"/><path d="M14 6l3-3 3 3"/></svg>
              </div>
              <div>
                <div className="text-csh-ink font-semibold leading-tight text-[15px]">
                  Qualified Seniors 75+ (2031)
                </div>
                <div className="text-csh-ink-soft text-[13px] mt-0.5">
                  HH income ≥ $50K · Esri 5-year projection
                </div>
              </div>
              {data.esriExtras.map((x, i) => {
                const base = x.qualifiedSeniorHH75plus;
                const fc = x.qualifiedSeniorHH75plusForecast;
                const pct =
                  base != null && base > 0 && fc != null
                    ? ((fc - base) / base) * 100
                    : null;
                return (
                  <div key={`qsr-fc-${i}`} className="text-right">
                    <div className="csh-display text-2xl text-csh-navy tabular-nums">
                      {fc != null ? fc.toLocaleString() : "—"}
                    </div>
                    {pct != null && (
                      <div
                        className={`text-[11px] tabular-nums ${
                          pct >= 0 ? "text-emerald-700" : "text-red-700"
                        }`}
                      >
                        {pct >= 0 ? "+" : ""}
                        {pct.toFixed(1)}% vs 2026
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Dominant Tapestry segment */}
          {data.esriExtras.some((x) => x.tapestrySegmentName) && (
            <div className="grid gap-4 px-6 py-4 items-center border-t border-csh-line/50" style={gridStyle}>
              <div className="w-10 h-10 flex items-center justify-center rounded-full bg-csh-gold/15 text-csh-gold">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9"/><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/></svg>
              </div>
              <div>
                <div className="text-csh-ink font-semibold leading-tight text-[15px]">
                  Dominant Tapestry Segment
                </div>
                <div className="text-csh-ink-soft text-[13px] mt-0.5">
                  Esri psychographic profile
                </div>
              </div>
              {data.esriExtras.map((x, i) => (
                <div key={`tap-${i}`} className="text-right">
                  {x.tapestrySegmentName ? (
                    <>
                      <div className="text-csh-navy font-semibold text-[14px] leading-tight">
                        {x.tapestrySegmentName}
                      </div>
                      {x.tapestrySegmentCode && (
                        <div className="text-csh-ink-soft text-[11px] tabular-nums">
                          Seg {x.tapestrySegmentCode}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-csh-ink-soft">—</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Footer */}
      {data && !loading && (
        <div className="px-6 py-3 border-t border-csh-line bg-csh-parchment text-[12px] text-csh-ink-soft flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <span>
            Source: {data.esriExtras ? "Esri" : "U.S. Census Bureau"} ·{" "}
            {data.meta.acsRelease}
            {data.meta.acsYears && !data.esriExtras
              ? ` (${data.meta.acsYears})`
              : ""}
          </span>
          {!data.esriExtras && (
            <span>{data.meta.tractsConsidered} tracts evaluated</span>
          )}
        </div>
      )}
    </div>
  );
}
