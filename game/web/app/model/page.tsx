import Link from "next/link";
import { TreeScene } from "@/components/model/TreeScene";

export default function ModelPage() {
  return (
    <div className="model-landing">
      <section className="tree-hero">
        <div className="tree-hero-copy">
          <p className="model-eyebrow"><span /> AN EXPLORATION OF JUSTICE &amp; TIME</p>
          <h1>How long will a court case take?</h1>
          <p>Every case has a story. Explore the patterns behind millions of court records and see what the data can tell us.</p>
          <div className="model-hero-actions">
            <Link href="/model/explore" className="model-primary">Explore case types <span aria-hidden>→</span></Link>
            <Link href="/model/analytics" className="model-secondary">See the data <span aria-hidden>→</span></Link>
          </div>
          <div className="tree-hero-note"><span>01 — 03</span> A DATA STORY FROM TAMIL NADU</div>
        </div>
        <TreeScene />
      </section>
      <div className="model-stats"><div><strong>3.6M</strong><span>Tamil Nadu cases</span></div><div><strong>33</strong><span>Districts explored</span></div><div><strong>2010–18</strong><span>Historical records</span></div></div>
      <section className="landing-paths" aria-label="Explore TAREEKH">
        <div><p className="model-eyebrow">CHOOSE YOUR PATH</p><h2>There&apos;s more to every number.</h2><p>Follow the data from individual case types to the bigger picture.</p></div>
        <Link href="/model/explore"><span>01 / INTERACTIVE MODEL</span><strong>Explore case types <i>↗</i></strong><p>Choose a case and district, compare outcomes, and try the model on real cases.</p></Link>
        <Link href="/model/analytics"><span>02 / DATA STORIES</span><strong>Explore the data <i>↗</i></strong><p>Discover the patterns across districts, case types, and years.</p></Link>
        <Link href="/model/about"><span>03 / THE METHOD</span><strong>How it works <i>↗</i></strong><p>See how the data was cleaned, modelled, and tested.</p></Link>
      </section>
    </div>
  );
}
