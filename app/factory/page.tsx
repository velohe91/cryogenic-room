"use client";

import Link from "next/link";
import "./factory.css";

const OPENSEA_ARC_URL = "https://opensea.io/collection/arc-cyborgpunks";

export default function FactoryPage() {
  return (
    <main className="factory-shell">
      <div className="factory-scanlines" />

      <header className="factory-header">
        <div>
          <span className="factory-eyebrow">VΣLOHE SYSTEM // PHASE 04</span>
          <h1>CRYOGENIC FACTORY</h1>
          <p>ARC MINTING INFRASTRUCTURE // CURRENTLY BUILDING</p>
        </div>

        <div className="factory-header-actions">
          <Link className="factory-return-button" href="/">
            ← RETURN TO CRYOGENIC ROOM
          </Link>
        </div>
      </header>

      <section className="factory-console">
        <div className="factory-status-banner">
          <span className="factory-status-dot" />
          <div>
            <b>CURRENTLY BUILDING</b>
            <small>PHASE 04 IS UNDER ACTIVE DEVELOPMENT</small>
          </div>
        </div>

        <section className="factory-hero">
          <div className="factory-core">
            <span>PHASE</span>
            <strong>04</strong>
          </div>

          <span className="factory-eyebrow">CRYOGENIC SYSTEM // FACTORY</span>
          <h2>THE FACTORY IS BEING CONSTRUCTED</h2>
          <p>
            The Cryogenic Factory will become the blockchain stage of the
            generator: the place where approved specimens move from local
            production into the ARC minting ecosystem.
          </p>
          <p>
            Phase 4 is intentionally separated from Phases 1–3 so the
            generation pipeline can remain stable while the on-chain factory
            is being built.
          </p>
        </section>

        <section className="factory-roadmap">
          <div className="roadmap-heading">
            <span>PHASE 04 // BUILD SCHEMA</span>
            <h3>FACTORY SYSTEM</h3>
          </div>

          <div className="roadmap-grid">
            <article className="roadmap-card">
              <span>01</span>
              <b>APPROVED COLLECTION</b>
              <p>
                Receive the final collection produced and approved through the
                Cryogenic Room pipeline.
              </p>
            </article>

            <article className="roadmap-card">
              <span>02</span>
              <b>WALLET CONNECTION</b>
              <p>
                Connect the user's wallet before any blockchain action is
                enabled.
              </p>
            </article>

            <article className="roadmap-card">
              <span>03</span>
              <b>ARC CHAIN</b>
              <p>
                ARC is the designated blockchain environment for the Phase 4
                factory and minting flow.
              </p>
            </article>

            <article className="roadmap-card">
              <span>04</span>
              <b>ERC-721 FACTORY</b>
              <p>
                Configure the collection and prepare the ERC-721 contract
                workflow without changing the generator stages.
              </p>
            </article>

            <article className="roadmap-card">
              <span>05</span>
              <b>METADATA & TRAITS</b>
              <p>
                Carry the approved specimen data into the collection metadata,
                using layer names and PNG filenames as the trait source.
              </p>
            </article>

            <article className="roadmap-card">
              <span>06</span>
              <b>MINTING STAGE</b>
              <p>
                Enable the final ARC minting flow once the Factory is ready for
                production.
              </p>
            </article>
          </div>
        </section>

        <section className="factory-live-stage">
          <div>
            <span className="factory-eyebrow">CURRENTLY AVAILABLE</span>
            <h3>ARC MINTING STAGE</h3>
            <p>
              While the Cryogenic Factory is under construction, the current
              ARC minting stage is available through OpenSea.
            </p>
          </div>

          <a
            className="factory-opensea-button"
            href={OPENSEA_ARC_URL}
            target="_blank"
            rel="noreferrer"
          >
            VIEW ARC MINTING ON OPENSEA ↗
          </a>
        </section>

        <div className="factory-bottom-actions">
          <Link className="factory-return-button large" href="/">
            ← RETURN TO CRYOGENIC ROOM
          </Link>
        </div>
      </section>

      <footer className="factory-footer">
        <span>PHASE 01–03 // COMPLETE</span>
        <span>PHASE 04 // CURRENTLY BUILDING</span>
        <span>ARC // MINTING STAGE AVAILABLE</span>
      </footer>
    </main>
  );
}
