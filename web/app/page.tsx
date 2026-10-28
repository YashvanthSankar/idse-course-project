import { Rain } from "@/components/fx/Rain";

export default function TitlePage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden">
      <Rain lightning />
      <h1 className="font-display text-6xl italic text-red animate-neon">The Auditor</h1>
    </main>
  );
}
