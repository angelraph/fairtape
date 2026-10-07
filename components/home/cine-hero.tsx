"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { RibbonField } from "./ribbon-field";

/** Full-bleed hero: living ribbons behind, content that eases away as you scroll (sets --p from 0 to 1). */
export function CineHero({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const p = Math.min(1, Math.max(0, window.scrollY / (el.offsetHeight * 0.8)));
      el.style.setProperty("--p", p.toFixed(3));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <section ref={ref} className="cine">
      <RibbonField />
      <div className="cine-content relative z-10 w-full">{children}</div>
    </section>
  );
}
