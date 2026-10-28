import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Bodoni_Moda, Inter, JetBrains_Mono, Playfair_Display, Special_Elite } from "next/font/google";
import { FilmGrain } from "@/components/fx/FilmGrain";
import { Vignette } from "@/components/fx/Vignette";
import { Providers } from "@/components/providers/Providers";
import "./globals.css";

const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"], style: ["normal", "italic"] });
const specialElite = Special_Elite({ variable: "--font-special-elite", subsets: ["latin"], weight: "400" });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const bodoni = Bodoni_Moda({ variable: "--font-bodoni", subsets: ["latin"], weight: ["700", "900"] });
const bebas = Bebas_Neue({ variable: "--font-bebas", subsets: ["latin"], weight: "400" });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Outlier",
  description: "A noir detective game where you catch fraudsters with real Python data analysis.",
};

export const viewport: Viewport = { themeColor: "#07080b", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${specialElite.variable} ${inter.variable} ${jetbrains.variable} ${bebas.variable} ${bodoni.variable} antialiased`}
    >
      <body className="min-h-dvh bg-ink-950 text-text">
        <Providers>{children}</Providers>
        <Vignette />
        <FilmGrain />
      </body>
    </html>
  );
}
