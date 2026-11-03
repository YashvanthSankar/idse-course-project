export function FilmGrain() {
  return (
    <div
      data-fx="grain"
      aria-hidden
      className="pointer-events-none fixed inset-[-10%] z-[90] grain animate-grain opacity-[0.06] mix-blend-overlay"
    />
  );
}
