"use client";

import { useEffect, useState } from "react";

interface Step {
  selector: string;
  title: string;
  body: string;
  position?: "bottom" | "top" | "right";
}

const STEPS: Step[] = [
  {
    selector: '[data-tutorial="search"]',
    title: "01 — Address Lookup",
    body:
      "Type any U.S. address, ZIP code, or city. Pick a result from the dropdown to drop a pin and generate ring analysis.",
    position: "bottom",
  },
  {
    selector: '[data-tutorial="map"]',
    title: "02 — Ring Visualization",
    body:
      "The site is plotted with concentric 1, 3, and 5 mile rings. Pan and zoom to inspect the surrounding catchment.",
    position: "right",
  },
  {
    selector: '[data-tutorial="stats"]',
    title: "03 — Demographic Profile",
    body:
      "Five indicators are aggregated for each ring from US Census ACS tract data: home value, income, population, midlife households, and seniors 75+.",
    position: "top",
  },
  {
    selector: '[data-tutorial="export"]',
    title: "04 — Export & Share",
    body:
      "Print the page or capture as PDF for inclusion in site selection memos. The URL preserves the active address.",
    position: "bottom",
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function Tutorial({ open, onClose }: Props) {
  const [stepIdx, setStepIdx] = useState(0);
  const [box, setBox] = useState<Box | null>(null);

  useEffect(() => {
    if (!open) {
      setStepIdx(0);
      return;
    }
    function measure() {
      const step = STEPS[stepIdx];
      const el = document.querySelector(step.selector);
      if (!el) {
        setBox(null);
        return;
      }
      const rect = el.getBoundingClientRect();
      setBox({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, stepIdx]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === "Enter") next();
      if (e.key === "ArrowLeft") prev();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stepIdx]);

  function next() {
    if (stepIdx >= STEPS.length - 1) onClose();
    else setStepIdx((i) => i + 1);
  }
  function prev() {
    if (stepIdx > 0) setStepIdx((i) => i - 1);
  }

  if (!open) return null;

  const step = STEPS[stepIdx];
  const padding = 8;
  const cardW = 320;

  let cardStyle: React.CSSProperties = {
    position: "fixed",
    width: cardW,
    zIndex: 70,
  };
  if (box) {
    const pos = step.position ?? "bottom";
    if (pos === "bottom") {
      cardStyle.top = box.top + box.height + padding + 8;
      cardStyle.left = Math.min(
        Math.max(8, box.left),
        window.innerWidth - cardW - 8
      );
    } else if (pos === "top") {
      cardStyle.top = Math.max(8, box.top - 200);
      cardStyle.left = Math.min(
        Math.max(8, box.left),
        window.innerWidth - cardW - 8
      );
    } else if (pos === "right") {
      cardStyle.top = box.top;
      cardStyle.left = Math.min(
        box.left + box.width + padding + 8,
        window.innerWidth - cardW - 8
      );
    }
  } else {
    cardStyle.top = "50%";
    cardStyle.left = "50%";
    cardStyle.transform = "translate(-50%, -50%)";
  }

  return (
    <>
      {/* Dimmed backdrop with cutout */}
      <svg
        className="csh-spotlight-mask"
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <mask id="csh-cutout">
            <rect width="100%" height="100%" fill="white" />
            {box && (
              <rect
                x={box.left - padding}
                y={box.top - padding}
                width={box.width + padding * 2}
                height={box.height + padding * 2}
                rx={6}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(15, 37, 64, 0.55)"
          mask="url(#csh-cutout)"
        />
        {box && (
          <rect
            x={box.left - padding}
            y={box.top - padding}
            width={box.width + padding * 2}
            height={box.height + padding * 2}
            rx={6}
            fill="none"
            stroke="#b8924a"
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
        )}
      </svg>

      {/* Card */}
      <div
        style={cardStyle}
        className="bg-white border border-csh-line shadow-[0_20px_50px_-15px_rgba(15,37,64,0.5)] pointer-events-auto"
      >
        <div className="px-5 pt-5 pb-3">
          <div className="csh-eyebrow text-csh-gold">{step.title}</div>
          <p className="text-csh-ink leading-relaxed text-[14px] mt-2">
            {step.body}
          </p>
        </div>
        <div className="csh-rule" />
        <div className="px-5 py-3 flex items-center justify-between">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`w-6 h-0.5 transition-colors ${
                  i === stepIdx ? "bg-csh-navy" : "bg-csh-line"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-xs text-csh-ink-soft hover:text-csh-navy transition-colors px-2 py-1"
            >
              Skip
            </button>
            {stepIdx > 0 && (
              <button
                onClick={prev}
                className="text-xs text-csh-navy hover:text-csh-navy-deep transition-colors px-3 py-1.5 border border-csh-line"
              >
                Back
              </button>
            )}
            <button
              onClick={next}
              className="text-xs text-csh-cream bg-csh-navy hover:bg-csh-navy-deep transition-colors px-3 py-1.5 uppercase tracking-wider font-medium"
              style={{ letterSpacing: "0.08em" }}
            >
              {stepIdx === STEPS.length - 1 ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
