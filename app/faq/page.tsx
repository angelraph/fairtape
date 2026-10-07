import Link from "next/link";
import { Faq } from "@/components/home/faq";

export const metadata = { title: "FAQ | Fairtape" };

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-14 pb-24 grid lg:grid-cols-[0.8fr_1.2fr] gap-12">
      <div>
        <div className="eyebrow rise">FAQ</div>
        <h1 className="display text-[52px] sm:text-[76px] mt-3 rise" style={{ ["--d" as string]: "80ms" }}>Questions, answered.</h1>
        <p className="muted mt-4 max-w-sm rise" style={{ ["--d" as string]: "160ms" }}>
          Architecture, contracts, the API and the testnet guide are in the{" "}
          <Link href="/docs" className="underline hover:text-text">documentation</Link>.
        </p>
      </div>
      <div className="rise" style={{ ["--d" as string]: "200ms" }}>
        <Faq />
      </div>
    </div>
  );
}
