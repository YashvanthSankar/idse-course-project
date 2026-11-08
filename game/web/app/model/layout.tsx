import type { Metadata } from "next";
import { Geist, Old_Standard_TT } from "next/font/google";
import type { ReactNode } from "react";
import { ModelShell } from "@/components/model/Shell";
import "./model.css";

const display = Old_Standard_TT({ variable: "--font-m-display", subsets: ["latin"], weight: ["400", "700"] });
const body = Geist({ variable: "--font-m-body", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Which court cases get stuck?",
  description: "A model of how long Tamil Nadu district-court cases take, built from 81 million real eCourts records. An IDSE course project.",
};

export default function ModelLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${display.variable} ${body.variable}`}>
      <ModelShell>{children}</ModelShell>
    </div>
  );
}
