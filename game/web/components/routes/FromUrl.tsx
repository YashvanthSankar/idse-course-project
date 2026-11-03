"use client";
import { useParams } from "next/navigation";
import { AutopsyDeck } from "@/components/autopsy/AutopsyDeck";
import { InvestigationScreen } from "@/components/case/InvestigationScreen";
import { HostScreen } from "@/components/host/HostScreen";
import { PlayScreen } from "@/components/play/PlayScreen";
import { DetectiveCardPage } from "@/components/profile/DetectiveCard";
import { VerdictRouter } from "@/components/verdict/VerdictRouter";

// The id is read from the URL in the browser (useParams resolves at once during a client
// navigation). Awaiting the server's params instead left the page on its loading shell until a
// server round trip came back, which on a slow network kept "THE JURY IS OUT…" up after the
// accusation had already gone through.
const param = (p: Record<string, string | string[]>, key: string) => String(p[key] ?? "");

export function CaseFromUrl() {
  return <InvestigationScreen caseId={param(useParams(), "caseId")} />;
}

export function VerdictFromUrl() {
  return <VerdictRouter caseId={param(useParams(), "caseId")} />;
}

export function HostFromUrl() {
  return <HostScreen code={param(useParams(), "code").toUpperCase()} />;
}

export function AutopsyFromUrl() {
  return <AutopsyDeck code={param(useParams(), "code").toUpperCase()} />;
}

export function PlayFromUrl() {
  return <PlayScreen code={param(useParams(), "code").toUpperCase()} />;
}

export function ProfileFromUrl() {
  return <DetectiveCardPage playerId={decodeURIComponent(param(useParams(), "playerId"))} />;
}
