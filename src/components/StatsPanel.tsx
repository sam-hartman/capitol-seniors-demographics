"use client";

import { Home, Wallet, Users, UsersRound, Accessibility } from "lucide-react";
import type { DemographicsResult } from "@/lib/census";

interface Props {
  data: DemographicsResult | null;
  loading: boolean;
}

const RING_LABELS = ["1 Mile", "3 Mile", "5 Mile"];
const RING_TICK_COLORS = ["#0f2540", "#1a3a5c", "#b8924a"];

const METRICS = [
  {
    key: "medianHomeValue" as const,
    label: "Median Home Value",
    eyebrow: "Owner-Occupied",
    icon: Home,
    format: (v: number | null) =>
      v == null ? "—" : `$${Math.round(v).toLocaleString()}`,
  },
  {
    key: "medianHouseholdIncome" as const,
    label: "Median Household Income",
    eyebrow: "Annual",
    icon: Wallet,
    format: (v: number | null) =>
      v == null ? "—" : `$${Math.round(v).toLocaleString()}`,
  },
  {
    key: "totalPopulation" as const,
    label: "Total Population",
    eyebrow: "All Ages",
    icon: Users,
    format: (v: number) => v.toLocaleString(),
  },
  {
    key: "totalHouseholds45to64" as const,
    label: "Households Age 45–64",
    eyebrow: "Adult-Child Decision Set",
    icon: UsersRound,
    format: (v: number) => v.toLocaleString(),
  },
  {
    key: "totalSeniors75plus" as const,
    label: "Seniors Age 75+",
    eyebrow: "Primary Demand Cohort",
    icon: Accessibility,
    format: (v: number) => v.toLocaleString(),
  },
];

function SkeletonRow() {
  return (
    <div className="grid grid-cols-[auto_1fr_repeat(3,minmax(0,1fr))] gap-4 px-6 py-5 items-center">
      <div className="w-9 h-9 rounded-full bg-csh-stone/60 animate-pulse" />
      <div className="space-y-2">
        <div className="h-3 w-20 bg-csh-stone/60 animate-pulse rounded" />
        <div className="h-4 w-40 bg-csh-stone/40 animate-pulse rounded" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-6 w-24 bg-csh-stone/50 animate-pulse rounded justify-self-end" />
      ))}
    </div>
  );
}

export function StatsPanel({ data, loading }: Props) {
  if (!data && !loading) {
    return (
      <div className="border border-csh-line bg-white px-8 py-12 text-center">
        <div className="csh-eyebrow mb-3">Awaiting Address</div>
        <p className="csh-display text-2xl text-csh-navy max-w-sm mx-auto leading-snug">
          Enter a candidate site address to generate a 1, 3, and 5 mile demographic profile.
        </p>
      </div>
    );
  }

  return (
    <div data-tutorial="stats" className="border border-csh-line bg-white">
      {/* Header row with ring badges */}
      <div className="grid grid-cols-[auto_1fr_repeat(3,minmax(0,1fr))] gap-4 px-6 py-4 border-b border-csh-line bg-csh-cream/40 items-center">
        <div className="w-9" />
        <div className="csh-eyebrow">Indicator</div>
        {RING_LABELS.map((label, i) => (
          <div key={label} className="flex items-center justify-end gap-2">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: RING_TICK_COLORS[i] }}
            />
            <span className="csh-eyebrow text-csh-ink">{label}</span>
          </div>
        ))}
      </div>

      {/* Metric rows */}
      <div className="divide-y divide-csh-line/70">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
          : METRICS.map((m, mi) => {
              const Icon = m.icon;
              return (
                <div
                  key={m.key}
                  className="grid grid-cols-[auto_1fr_repeat(3,minmax(0,1fr))] gap-4 px-6 py-5 items-center group hover:bg-csh-cream/40 transition-colors csh-fade-up"
                  style={{ animationDelay: `${mi * 60}ms` }}
                >
                  <div className="w-9 h-9 flex items-center justify-center rounded-full bg-csh-cream/70 text-csh-navy group-hover:bg-csh-navy group-hover:text-csh-cream transition-colors">
                    <Icon className="w-4.5 h-4.5" strokeWidth={1.6} size={18} />
                  </div>
                  <div>
                    <div className="csh-eyebrow text-csh-ink-soft">{m.eyebrow}</div>
                    <div className="text-csh-ink font-medium leading-tight mt-0.5">
                      {m.label}
                    </div>
                  </div>
                  {data!.rings.map((r) => {
                    const v = r[m.key];
                    return (
                      <div key={r.radiusMiles} className="text-right">
                        <span className="csh-display text-xl text-csh-navy tabular-nums">
                          {(m.format as (x: typeof v) => string)(v)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
      </div>

      {/* Footer */}
      {data && !loading && (
        <div className="px-6 py-4 border-t border-csh-line bg-csh-parchment text-xs text-csh-ink-soft flex items-center justify-between gap-4">
          <span>
            Source: U.S. Census Bureau, ACS {data.meta.acsYear} 5-Year Estimates
          </span>
          <span>{data.meta.tractsConsidered} tracts evaluated</span>
        </div>
      )}
    </div>
  );
}
