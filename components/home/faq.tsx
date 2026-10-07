import { FAQ } from "@/lib/content";

export function Faq({ limit }: { limit?: number }) {
  const items = limit ? FAQ.slice(0, limit) : FAQ;
  return (
    <div className="faq border-t border-line">
      {items.map((f, i) => (
        <details key={f.q} open={i === 0}>
          <summary>
            <span>{f.q}</span>
            <span className="plus" aria-hidden>+</span>
          </summary>
          <p className="answer">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
