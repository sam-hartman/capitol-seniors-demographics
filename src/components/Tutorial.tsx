"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
      "The site is plotted with concentric rings. Pan and zoom to inspect the surrounding catchment.",
    position: "right",
  },
  {
    selector: '[data-tutorial="stats"]',
    title: "03 — Demographic Profile",
    body:
      "Five indicators per ring from US Census ACS 5-year data. Click any column header (1 MILE / 3 MILE / 5 MILE) to change that ring's radius — the map and values refresh automatically.",
    position: "top",
  },
  {
    selector: '[data-tutorial="export"]',
    title: "04 — Export & Share",
    body:
      "Download the active profile as CSV, print to PDF, or copy the URL — it preserves the address and ring sizes for sharing.",
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

const PADDING = 8;
const GAP = 8;
const CARD_W_DEFAULT = 320;
const CARD_W_MIN = 280;
const VIEWPORT_MARGIN = 12;

function isInputLike(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

export function Tutorial({ open, onClose }: Props) {
  const [stepIdx, setStepIdx] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [viewport, setViewport] = useState({
    w: typeof window === "undefined" ? 1440 : window.innerWidth,
    h: typeof window === "undefined" ? 900 : window.innerHeight,
  });
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(180);

  const next = useCallback(() => {
    setStepIdx((i) => {
      if (i >= STEPS.length - 1) {
        onClose();
        return 0;
      }
      return i + 1;
    });
  }, [onClose]);

  const prev = useCallback(() => {
    setStepIdx((i) => Math.max(0, i - 1));
  }, []);

  useEffect(() => {
    if (!open) {
      setStepIdx(0);
      setBox(null);
      return;
    }

    let cancelled = false;
    function measure() {
      if (cancelled) return;
      setViewport({ w: window.innerWidth, h: window.innerHeight });
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
    }

    function ensureVisible() {
      const step = STEPS[stepIdx];
      const el = document.querySelector(step.selector);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const out =
        rect.top < 60 ||
        rect.bottom > window.innerHeight - 60 ||
        rect.left < 0 ||
        rect.right > window.innerWidth;
      if (out) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }

    measure();
    ensureVisible();
    // remeasure after smooth scroll settles
    const timers = [
      window.setTimeout(measure, 200),
      window.setTimeout(measure, 500),
    ];

    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, stepIdx]);

  // Track the actual card height so positioning math is correct.
  useEffect(() => {
    if (!open || !cardRef.current) return;
    setCardH(cardRef.current.offsetHeight);
  }, [open, stepIdx, viewport.w, box]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      // Don't hijack arrows/Enter while user is typing in the search box.
      if (isInputLike(e.target)) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      }
      if (e.key === "Enter") {
        e.preventDefault();
        next();
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, next, prev, onClose]);

  if (!open) return null;

  const step = STEPS[stepIdx];

  // Width adapts to small viewports.
  const cardW = Math.max(
    CARD_W_MIN,
    Math.min(CARD_W_DEFAULT, viewport.w - VIEWPORT_MARGIN * 2)
  );

  const cardStyle: React.CSSProperties = {
    position: "fixed",
    width: cardW,
    zIndex: 70,
  };

  if (box) {
    const pos = step.position ?? "bottom";
    const clampLeft = (left: number) =>
      Math.min(
        Math.max(VIEWPORT_MARGIN, left),
        viewport.w - cardW - VIEWPORT_MARGIN
      );
    const clampTop = (top: number) =>
      Math.min(
        Math.max(VIEWPORT_MARGIN, top),
        viewport.h - cardH - VIEWPORT_MARGIN
      );

    let preferred: { top: number; left: number };
    const belowTop = box.top + box.height + PADDING + GAP;
    const aboveTop = box.top - PADDING - GAP - cardH;

    if (pos === "bottom") {
      preferred =
        belowTop + cardH + VIEWPORT_MARGIN > viewport.h
          ? { top: aboveTop, left: box.left }
          : { top: belowTop, left: box.left };
    } else if (pos === "top") {
      preferred =
        aboveTop < VIEWPORT_MARGIN
          ? { top: belowTop, left: box.left }
          : { top: aboveTop, left: box.left };
    } else {
      // right
      const rightLeft = box.left + box.width + PADDING + GAP;
      preferred =
        rightLeft + cardW + VIEWPORT_MARGIN > viewport.w
          ? { top: belowTop, left: box.left }
          : { top: box.top, left: rightLeft };
    }
    cardStyle.top = clampTop(preferred.top);
    cardStyle.left = clampLeft(preferred.left);
  } else {
    cardStyle.top = "50%";
    cardStyle.left = "50%";
    cardStyle.transform = "translate(-50%, -50%)";
  }

  // Clamp the spotlight cutout to the viewport so we never draw negative
  // dimensions if the target is partially off-screen.
  const cutout = box
    ? {
        x: Math.max(0, box.left - PADDING),
        y: Math.max(0, box.top - PADDING),
        w: Math.max(
          0,
          Math.min(viewport.w, box.left + box.width + PADDING) -
            Math.max(0, box.left - PADDING)
        ),
        h: Math.max(
          0,
          Math.min(viewport.h, box.top + box.height + PADDING) -
            Math.max(0, box.top - PADDING)
        ),
      }
    : null;

  return (
    <>
      <svg
        className="csh-spotlight-mask"
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        onClick={onClose}
      >
        <defs>
          <mask id="csh-cutout">
            <rect width="100%" height="100%" fill="white" />
            {cutout && cutout.w > 0 && cutout.h > 0 && (
              <rect
                x={cutout.x}
                y={cutout.y}
                width={cutout.w}
                height={cutout.h}
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
        {cutout && cutout.w > 0 && cutout.h > 0 && (
          <rect
            x={cutout.x}
            y={cutout.y}
            width={cutout.w}
            height={cutout.h}
            rx={6}
            fill="none"
            stroke="#b8924a"
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
        )}
      </svg>

      <div
        ref={cardRef}
        style={cardStyle}
        role="dialog"
        aria-label={step.title}
        className="bg-white border border-csh-line shadow-[0_20px_50px_-15px_rgba(15,37,64,0.5)] pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3">
          <div className="csh-eyebrow text-csh-gold">{step.title}</div>
          <p className="text-csh-ink leading-relaxed text-[14px] mt-2">
            {step.body}
          </p>
          {!box && (
            <p className="text-[11px] text-csh-ink-soft mt-3 italic">
              The element for this step isn&apos;t visible yet — try selecting an
              address first.
            </p>
          )}
        </div>
        <div className="csh-rule" />
        <div className="px-5 py-3 flex items-center justify-between gap-3">
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
