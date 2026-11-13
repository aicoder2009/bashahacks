"use client";
import { useEffect, useRef, useState } from "react";

export function Logo({ size = "base" }: { size?: "base" | "lg" }) {
  return (
    <span className={`mono inline-flex items-center gap-2 font-semibold ${size === "lg" ? "text-2xl" : "text-[0.95rem]"}`}>
      <span className="text-accent" aria-hidden>
        &gt;
      </span>
      <span>
        basha<span className="text-accent">hacks</span>
      </span>
    </span>
  );
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    setTheme(document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");
  }, []);
  const flip = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("bh_theme", next);
    } catch {}
  };
  return (
    <button className="btn btn-ghost btn-sm !px-2" onClick={flip} aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} title="Light or dark">
      {theme === "dark" ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
  dismissable = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
  dismissable?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissable) onClose();
    };
    window.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, dismissable]);
  if (!open) return null;
  return (
    <div
      className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && dismissable) onClose();
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`card max-h-[90vh] w-full overflow-auto p-6 shadow-2xl outline-none ${wide ? "max-w-3xl" : "max-w-md"}`}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-xl font-semibold">{title}</h2>
          {dismissable ? (
            <button className="btn btn-ghost btn-sm !px-2" onClick={onClose} aria-label="Close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-lg border border-red/40 bg-red-soft px-3 py-2 text-sm text-red">
      {children}
    </p>
  );
}

const CONFETTI_COLORS = ["#7fbf7a", "#f4cf52", "#74ade3", "#f097b8", "#f5a25a", "#ad92e0"];

/** A short confetti burst. Change `burst` to a new number to fire it again. */
export function Confetti({ burst, big = false }: { burst: number; big?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!burst) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = (canvas.width = window.innerWidth);
    const h = (canvas.height = window.innerHeight);
    const count = big ? 260 : 110;
    const parts = Array.from({ length: count }).map(() => ({
      x: w / 2 + (Math.random() - 0.5) * w * (big ? 0.9 : 0.3),
      y: big ? -20 - Math.random() * h * 0.3 : h * 0.35,
      vx: (Math.random() - 0.5) * (big ? 6 : 12),
      vy: big ? 2 + Math.random() * 4 : -6 - Math.random() * 9,
      size: 5 + Math.random() * 7,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    }));
    let frame = 0;
    let raf = 0;
    const max = big ? 320 : 150;
    const draw = () => {
      frame++;
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.vy += 0.22;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.99;
        p.rot += p.vr;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - frame / max);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.6);
        ctx.restore();
      }
      if (frame < max) raf = requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [burst, big]);
  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-[60]" aria-hidden />;
}

/** Follows the light or dark choice so components like the code editor can match it. */
export function useTheme(): "dark" | "light" {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    const read = () => setTheme(document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return theme;
}
