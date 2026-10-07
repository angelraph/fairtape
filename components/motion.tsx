"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

/** Fades and lifts its children into view the first time they scroll on screen. */
export function Reveal({ children, delay = 0, as: Tag = "div", className = "" }: { children: ReactNode; delay?: number; as?: ElementType; className?: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.classList.add("in");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref} className={`reveal ${className}`} style={{ ["--d" as string]: `${delay}ms` }}>
      {children}
    </Tag>
  );
}

/** Odometer-style number: each digit rolls into place when it scrolls into view and whenever the value changes. */
export function RollingNumber({ value, className = "" }: { value: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setVisible(true));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <span ref={ref} className={`inline-flex items-baseline ${className}`} aria-label={value}>
      {value.split("").map((ch, i) => {
        if (!/\d/.test(ch)) return <span key={i} aria-hidden style={{ whiteSpace: "pre" }}>{ch}</span>;
        const d = Number(ch);
        return (
          <span key={i} className="roll" aria-hidden>
            <span className="roll-col" style={{ transform: `translateY(-${visible ? d : 0}em)`, ["--d" as string]: `${i * 70}ms` }}>
              {Array.from({ length: 10 }, (_, n) => (
                <span key={n}>{n}</span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}
