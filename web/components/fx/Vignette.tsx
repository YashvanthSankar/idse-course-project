export function Vignette({ strength = 0.75 }: { strength?: number }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[80]"
      style={{
        background: `radial-gradient(ellipse at center, transparent 45%, rgb(0 0 0 / ${strength}) 100%)`,
      }}
    />
  );
}
