"use client";

import { useEffect, useRef } from "react";

// Full-bleed animated backdrop: slow, flowing ribbons in the colors of the Fairtape mark, with a faint
// stream of "prints" travelling along them like a tape. Pauses off-screen and when the tab is hidden.
const STOPS = ["#129d7e", "#19cb9e", "#4fe592", "#8cee8f"];

type Ribbon = { y: number; amp: number; amp2: number; freq: number; freq2: number; speed: number; phase: number; width: number; alpha: number };

export function RibbonField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mobile = window.matchMedia("(max-width: 640px)").matches;
    let w = 0;
    let h = 0;
    let raf = 0;
    let running = true;
    const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);

    const ribbons: Ribbon[] = Array.from({ length: mobile ? 5 : 7 }, (_, i) => ({
      y: 0.3 + i * 0.075,
      amp: 0.05 + (i % 3) * 0.025,
      amp2: 0.02 + (i % 2) * 0.015,
      freq: 1.4 + i * 0.22,
      freq2: 3.1 + i * 0.4,
      speed: 0.12 + i * 0.025,
      phase: i * 1.7,
      width: 0.018 + (i % 4) * 0.012,
      alpha: 0.14 + (i % 3) * 0.07,
    }));
    const prints = Array.from({ length: mobile ? 14 : 28 }, (_, i) => ({ r: i % ribbons.length, x: Math.random(), v: 0.015 + Math.random() * 0.03 }));

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const center = (r: Ribbon, u: number, t: number) =>
      h * (r.y + r.amp * Math.sin(u * r.freq * Math.PI + t * r.speed + r.phase) + r.amp2 * Math.sin(u * r.freq2 * Math.PI - t * r.speed * 1.6));

    function frame(ms: number) {
      const t = ms / 1000;
      ctx!.clearRect(0, 0, w, h);
      ctx!.globalCompositeOperation = "lighter";
      const steps = mobile ? 60 : 110;
      for (const r of ribbons) {
        const grad = ctx!.createLinearGradient(0, 0, w, 0);
        STOPS.forEach((c, i) => grad.addColorStop(i / (STOPS.length - 1), c));
        ctx!.fillStyle = grad;
        ctx!.globalAlpha = r.alpha;
        ctx!.beginPath();
        for (let s = 0; s <= steps; s++) {
          const u = s / steps;
          const thick = h * r.width * (0.55 + 0.45 * Math.sin(u * 2.3 * Math.PI + t * 0.4 + r.phase));
          const y = center(r, u, t) - thick;
          if (s === 0) ctx!.moveTo(u * w, y);
          else ctx!.lineTo(u * w, y);
        }
        for (let s = steps; s >= 0; s--) {
          const u = s / steps;
          const thick = h * r.width * (0.55 + 0.45 * Math.sin(u * 2.3 * Math.PI + t * 0.4 + r.phase));
          ctx!.lineTo(u * w, center(r, u, t) + thick);
        }
        ctx!.closePath();
        ctx!.fill();
      }
      // prints riding the ribbons
      ctx!.globalAlpha = 0.9;
      for (const p of prints) {
        p.x = (p.x + p.v * 0.016) % 1;
        const y = center(ribbons[p.r], p.x, t);
        const g = ctx!.createRadialGradient(p.x * w, y, 0, p.x * w, y, 10);
        g.addColorStop(0, "rgba(220,255,225,0.9)");
        g.addColorStop(1, "rgba(79,229,146,0)");
        ctx!.fillStyle = g;
        ctx!.beginPath();
        ctx!.arc(p.x * w, y, 10, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;
      ctx!.globalCompositeOperation = "source-over";
      if (running) raf = requestAnimationFrame(frame);
    }

    let onScreen = true;
    // Run only while the hero is on screen and the tab is visible; always paint at least one frame.
    const sync = () => {
      const shouldRun = onScreen && !document.hidden && !reduced;
      if (shouldRun && !running) {
        running = true;
        raf = requestAnimationFrame(frame);
      } else if (!shouldRun && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    };
    resize();
    running = false;
    frame(performance.now());
    sync();
    const ro = new ResizeObserver(() => {
      resize(); // resizing clears the canvas; repaint now unless the loop will on its next frame
      if (!running) frame(performance.now());
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      sync();
    });
    io.observe(canvas);
    document.addEventListener("visibilitychange", sync);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  return <canvas ref={ref} aria-hidden />;
}
