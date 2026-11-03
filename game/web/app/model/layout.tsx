import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ModelShell } from "@/components/model/Shell";

export const metadata: Metadata = {
  title: "TAREEKH · How long does a court case take?",
  description: "A model of how long Tamil Nadu district-court cases take, built from 81 million real eCourts records. An IDSE course project.",
};

export default function ModelLayout({ children }: { children: ReactNode }) {
  return <ModelShell>{children}</ModelShell>;
}
