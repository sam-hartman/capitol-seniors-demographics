"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface Step {
  selector: string;
  title: string;
  body: string;
  position?: "bottom" | "top" | "right" | "left";
}

const STEPS: Step[] = [
  {
    selector: '[data-tutorial="search"]',
    title: "01 — Address Lookup",
    body:
      "Start typing any U.S. address, ZIP code, or city. Suggestions appear automatically — pick one to drop a pin and generate ring analysis.",
    position: "bottom",
  },
  {
    selector: '[data-tutorial="map"]',
    title: "02 — Map & Rings",
    body:
      "Three concentric rings show the catchment around your site. Click anywhere on the map to move the site; hover to see the live distance from your pin.",
    position: "right",
  },
  {
    selector: '[data-tutorial="stats"]',
    title: "03 — Demographic Profile",
    body:
      "Five indicators per ring, sourced from US Census ACS 5-year data. Click the 1 / 3 / 5 MILE column headers to change a ring's radius — the map and values refresh instantly.",
    position: "left",
  },
  {
    selector: '[data-tutorial="export"]',
    title: "04 — Export & Share",
    body:
      "Download the active profile as CSV, print to PDF for IC packets, or copy the URL — it preserves the address and ring sizes for sharing.",
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

const PADDING = 10;
const GAP = 14;
const CARD_W_DEFAULT = 360;
const CARD_W_MIN = 300;
const VIEWPORT_MARGIN = 16;

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
  const [cardH, setCardH] = useState(200);

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

  // Measure target element + remeasure on resize/scroll. Triple-tap timers to
  // catch elements that animate/scroll into place.
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
      // Skip degenerate measurements (element not laid out yet).
      if (rect.width === 0 && rect.height === 0) {
        setBox(null);
        return;
      }
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
      const needsScroll =
        rect.top < 80 ||
        rect.bottom > window.innerHeight - 80 ||
        rect.left < 0 ||
        rect.right > window.innerWidth;
      if (needsScroll) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }

    measure();
    ensureVisible();
    const timers = [
      window.setTimeout(measure, 250),
      window.setTimeout(measure, 600),
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

  // Track actual card height for accurate position math.
  useEffect(() => {
    if (!open || !cardRef.current) return;
    setCardH(cardRef.current.offsetHeight);
  }, [open, stepIdx, viewport.w, box]);

  // Keyboard nav (arrows / enter / escape) — but not while typing in inputs.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (isInputLike(e.target)) return;
      if (e.key === "ArrowRight" || e.key === "Enter") {
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

  // Build positioning for the card.
  const cardStyle: React.CSSProperties = {
    position: "fixed",
    width: cardW,
    zIndex: 9999,
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

    const belowTop = box.top + box.height + PADDING + GAP;
    const aboveTop = box.top - PADDING - GAP - cardH;
    const rightLeft = box.left + box.width + PADDING + GAP;
    const leftLeft = box.left - PADDING - GAP - cardW;

    let preferred: { top: number; left: number };
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
    } else if (pos === "right") {
      preferred =
        rightLeft + cardW + VIEWPORT_MARGIN > viewport.w
          ? { top: belowTop, left: box.left }
          : { top: box.top, left: rightLeft };
    } else {
      // left
      preferred =
        leftLeft < VIEWPORT_MARGIN
          ? { top: belowTop, left: box.left }
          : { top: box.top, left: leftLeft };
    }
    cardStyle.top = clampTop(preferred.top);
    cardStyle.left = clampLeft(preferred.left);
  } else {
    cardStyle.top = "50%";
    cardStyle.left = "50%";
    cardStyle.transform = "translate(-50%, -50%)";
  }

  // Compute the spotlight rect, clamped to viewport.
  const spot = box
    ? {
        x: Math.max(0, box.left - PADDING),
        y: Math.max(0, box.top - PADDING),
        w: Math.min(
          viewport.w,
          Math.min(viewport.w, box.left + box.width + PADDING) -
            Math.max(0, box.left - PADDING)
        ),
        h: Math.min(
          viewport.h,
          Math.min(viewport.h, box.top + box.height + PADDING) -
            Math.max(0, box.top - PADDING)
        ),
      }
    : null;

  // Build four backdrop panels (top, bottom, left, right of the spotlight).
  // This gives a hard, opaque dim everywhere except the highlighted element.
  const dimStyle: React.CSSProperties = {
    position: "fixed",
    background: "rgba(8, 22, 38, 0.78)",
    zIndex: 9990,
  };

  return (
    <>
      {!spot ? (
        // No target: full-screen dim.
        <div
          style={{ ...dimStyle, inset: 0 }}
          onClick={onClose}
          aria-label="Close tutorial"
        />
      ) : (
        <>
          {/* Top */}
          <div
            style={{
              ...dimStyle,
              top: 0,
              left: 0,
              width: "100%",
              height: spot.y,
            }}
            onClick={onClose}
          />
          {/* Bottom */}
          <div
            style={{
              ...dimStyle,
              top: spot.y + spot.h,
              left: 0,
              width: "100%",
              height: Math.max(0, viewport.h - (spot.y + spot.h)),
            }}
            onClick={onClose}
          />
          {/* Left */}
          <div
            style={{
              ...dimStyle,
              top: spot.y,
              left: 0,
              width: spot.x,
              height: spot.h,
            }}
            onClick={onClose}
          />
          {/* Right */}
          <div
            style={{
              ...dimStyle,
              top: spot.y,
              left: spot.x + spot.w,
              width: Math.max(0, viewport.w - (spot.x + spot.w)),
              height: spot.h,
            }}
            onClick={onClose}
          />
          {/* Highlight border around the spotlight */}
          <div
            style={{
              position: "fixed",
              top: spot.y,
              left: spot.x,
              width: spot.w,
              height: spot.h,
              border: "3px solid #d4a847",
              borderRadius: 6,
              boxShadow:
                "0 0 0 1px rgba(184,146,74,0.4), 0 0 24px rgba(184,146,74,0.55)",
              pointerEvents: "none",
              zIndex: 9991,
            }}
          />
        </>
      )}

      {/* Card */}
      <div
        ref={cardRef}
        style={cardStyle}
        role="dialog"
        aria-modal="true"
        aria-label={step.title}
        className="bg-white border border-csh-line shadow-[0_24px_60px_-15px_rgba(8,22,38,0.65)]"
      >
        <div className="px-5 pt-5 pb-3 relative">
          <button
            onClick={onClose}
            aria-label="Close tutorial"
            className="absolute top-3 right-3 text-csh-ink-soft hover:text-csh-navy transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={1.8} />
          </button>
          <div className="csh-eyebrow text-csh-gold pr-6">{step.title}</div>
          <p className="text-csh-ink leading-relaxed text-[14.5px] mt-2 pr-2">
            {step.body}
          </p>
          {!box && (
            <p className="text-[12px] text-csh-ink-soft mt-3 italic">
              The element for this step isn&apos;t visible yet — that&apos;s OK,
              you can still continue.
            </p>
          )}
        </div>
        <div className="csh-rule" />
        <div className="px-5 py-3 flex items-center justify-between gap-3">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`w-7 h-1 rounded-sm transition-colors ${
                  i === stepIdx ? "bg-csh-navy" : "bg-csh-line"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {stepIdx > 0 && (
              <button
                onClick={prev}
                aria-label="Previous step"
                className="inline-flex items-center gap-1 text-xs text-csh-navy hover:bg-csh-cream transition-colors px-3 py-1.5 border border-csh-line"
              >
                <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.8} />
                Back
              </button>
            )}
            <button
              onClick={next}
              autoFocus
              className="inline-flex items-center gap-1.5 text-xs text-csh-cream bg-csh-navy hover:bg-csh-navy-deep transition-colors px-4 py-1.5 uppercase tracking-wider font-semibold"
              style={{ letterSpacing: "0.08em" }}
            >
              {stepIdx === STEPS.length - 1 ? "Finish" : "Next"}
              {stepIdx < STEPS.length - 1 && (
                <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.8} />
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
