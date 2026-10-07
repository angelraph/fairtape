import Link from "next/link";
import { Roadmap } from "@/components/home/roadmap";

export const metadata = { title: "Roadmap | Fairtape" };

export default function RoadmapPage() {
  return (
    <div className="relative overflow-x-clip">
      <div className="aurora" aria-hidden />
      <div className="relative z-10 mx-auto max-w-6xl px-4 pt-14 pb-24">
        <div className="eyebrow rise">Roadmap</div>
        <h1 className="display text-[52px] sm:text-[80px] mt-3 rise" style={{ ["--d" as string]: "80ms" }}>
          Where Fairtape <em className="grad-text">goes next.</em>
        </h1>
        <p className="muted text-lg mt-4 max-w-2xl rise" style={{ ["--d" as string]: "160ms" }}>
          What shipped for the Crypto World&apos;s Fair, and the path from a working product to the checkout for tokenized stocks.
        </p>
        <div className="mt-14">
          <Roadmap />
        </div>
        <div className="mt-14 flex flex-wrap gap-3">
          <Link href="/docs#business" className="btn btn-ghost">Business model →</Link>
          <Link href="/faq" className="btn btn-ghost">FAQ →</Link>
        </div>
      </div>
    </div>
  );
}
