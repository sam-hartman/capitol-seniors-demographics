import type { DemographicsResult } from "./census";

function escape(field: string | number | null | undefined): string {
  if (field == null) return "";
  const s = String(field);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toRow(values: Array<string | number | null | undefined>): string {
  return values.map(escape).join(",");
}

export function buildCsv(
  data: DemographicsResult,
  context: { address: string; lat: number; lon: number }
): string {
  const lines: string[] = [];
  lines.push(
    toRow([
      "Capitol Seniors Housing — Site Demographics",
    ])
  );
  lines.push(toRow(["Address", context.address]));
  lines.push(toRow(["Latitude", context.lat]));
  lines.push(toRow(["Longitude", context.lon]));
  lines.push(toRow(["Source", `U.S. Census Bureau, ${data.meta.acsRelease}`]));
  if (data.meta.acsYears) lines.push(toRow(["Period", data.meta.acsYears]));
  lines.push(toRow(["Tracts evaluated", data.meta.tractsConsidered]));
  lines.push(toRow(["Generated", new Date().toISOString()]));
  lines.push("");

  const ringHeaders = data.rings.map((r) => `${r.radiusMiles} mile`);
  lines.push(toRow(["Indicator", ...ringHeaders]));

  const metricRows: Array<{
    label: string;
    pick: (r: DemographicsResult["rings"][number]) => string | number | null;
  }> = [
    {
      label: "Median Home Value (USD, owner-occupied)",
      pick: (r) => r.medianHomeValue,
    },
    {
      label: "Median Household Income (USD, annual)",
      pick: (r) => r.medianHouseholdIncome,
    },
    {
      label: "Total Population",
      pick: (r) => r.totalPopulation,
    },
    {
      label: "Households Age 45–64",
      pick: (r) => r.totalHouseholds45to64,
    },
    {
      label: "Seniors Age 75+",
      pick: (r) => r.totalSeniors75plus,
    },
    {
      label: "Tract count (centroid in ring)",
      pick: (r) => r.tractCount,
    },
  ];

  for (const m of metricRows) {
    lines.push(toRow([m.label, ...data.rings.map((r) => m.pick(r))]));
  }

  lines.push("");
  lines.push(toRow(["Note", data.meta.note]));

  return lines.join("\r\n");
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function csvFilenameFor(address: string): string {
  const slug =
    address
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "site";
  const date = new Date().toISOString().slice(0, 10);
  return `csh-demographics_${slug}_${date}.csv`;
}
