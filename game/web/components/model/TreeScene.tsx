"use client";
import { ElementsCollection } from "@designcodeio/threeui/components/ElementsCollection";
import { useEffect, useState } from "react";

export function TreeScene() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return <div className="tree-scene"><ElementsCollection variant="generative-tree" speed={reduced ? 0 : 1.6} size={1} particleAmount={1} style={{position: "absolute", inset: 0}} /></div>;
}

