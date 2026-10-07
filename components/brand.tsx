/* eslint-disable @next/next/no-img-element */

// The Fairtape logo, cut out of the official artwork (public/brand). The mark carries a slow light sheen.
export function BrandMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  const w = Math.round((size * 258) / 290);
  return (
    <span className={`sheen ${className}`} style={{ ["--mask" as string]: "url(/brand/fairtape-mark.png)", width: w, height: size }}>
      <img src="/brand/fairtape-mark.png" alt="" width={w} height={size} className="block" draggable={false} />
    </span>
  );
}

export function Wordmark({ height = 22 }: { height?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <BrandMark size={height + 6} />
      <span className="font-semibold tracking-tight" style={{ fontSize: height * 0.95 }}>
        Fairtape
      </span>
    </span>
  );
}

export function FullLogo({ width = 420 }: { width?: number }) {
  return <img src="/brand/fairtape-logo.png" alt="Fairtape — Pay anyone. In public markets." width={width} height={Math.round((width * 304) / 960)} draggable={false} />;
}
