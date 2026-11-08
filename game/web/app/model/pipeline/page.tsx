import type { Metadata } from "next";
import { Pipeline } from "@/components/model/Pipeline";

export const metadata: Metadata = {
  title: "The pipeline · How the court case duration model was built",
  description: "The whole project, step by step: 81 million raw eCourts records cleaned, labelled, explored and turned into a tested model of whether a Tamil Nadu case is disposed of within a year.",
};

export default function PipelinePage() {
  return <Pipeline />;
}
