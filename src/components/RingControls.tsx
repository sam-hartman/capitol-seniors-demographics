"use client";

const RING_OPTIONS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 5, 7, 10, 15, 20, 25];
const RING_TICK_COLORS = ["#0f2540", "#1a3a5c", "#b8924a"];

interface Props {
  rings: number[];
  onChange: (rings: number[]) => void;
  disabled?: boolean;
}

function fmt(v: number) {
  return v < 1 ? `${v} mi` : `${v} mi`;
}

export function RingControls({ rings, onChange, disabled }: Props) {
  function update(index: number, value: number) {
    const next = rings.map((r, i) => (i === index ? value : r));
    onChange(next);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="csh-eyebrow text-csh-ink-soft">Rings</span>
      {rings.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: RING_TICK_COLORS[i % 3] }}
          />
          <div className="relative">
            <select
              value={r}
              disabled={disabled}
              onChange={(e) => update(i, Number(e.target.value))}
              className="appearance-none bg-white border border-csh-line text-csh-ink text-sm py-1.5 pl-2.5 pr-7 hover:border-csh-navy focus:outline-none focus:border-csh-navy transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer tabular-nums"
            >
              {RING_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {fmt(opt)}
                </option>
              ))}
            </select>
            <svg
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-csh-ink-soft pointer-events-none"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M3 4.5 L6 7.5 L9 4.5" />
            </svg>
          </div>
        </div>
      ))}
    </div>
  );
}
