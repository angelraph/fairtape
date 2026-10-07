// Shown the instant a link is tapped, while the next page streams in.
export default function Loading() {
  return (
    <>
      <div className="route-bar" aria-hidden />
      <div className="mx-auto max-w-6xl px-4 pt-14 pb-24" aria-busy="true" aria-label="Loading">
        <div className="skeleton h-6 w-40" />
        <div className="skeleton h-16 w-full max-w-2xl mt-6" />
        <div className="skeleton h-5 w-full max-w-xl mt-5" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-10">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-32" />
          ))}
        </div>
        <div className="skeleton h-80 mt-6" />
      </div>
    </>
  );
}
