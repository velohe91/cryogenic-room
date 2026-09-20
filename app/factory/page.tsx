"use client";

import { ChangeEvent, useMemo, useState } from "react";
import "./factory.css";
import { ConnectWalletButton } from "../../components/web3/ConnectWalletButton";

type Trait = {
  id?: string;
  name: string;
  layer?: string;
  width?: number;
  height?: number;
  url?: string;
};

type CollectionItem = {
  id: number | string;
  name?: string;
  image?: string;
  dataUrl?: string;
  traits?: Trait[];
  assets?: Trait[];
};

const STORAGE_KEY = "cryogenic-room-approved-collection";

function normalizeItem(item: any, index: number): CollectionItem {
  return {
    id: item?.id ?? index + 1,
    name: item?.name ?? `SPECIMEN #${String(item?.id ?? index + 1).padStart(3, "0")}`,
    image: item?.image ?? item?.dataUrl,
    dataUrl: item?.dataUrl ?? item?.image,
    traits: item?.traits ?? item?.assets ?? [],
    assets: item?.assets ?? item?.traits ?? [],
  };
}

export default function FactoryPage() {
  const [collection, setCollection] = useState<CollectionItem[]>([]);
  const [approved, setApproved] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<CollectionItem | null>(null);
  const [status, setStatus] = useState("FACTORY STANDBY");
  const [reviewing, setReviewing] = useState(false);

  const approvedItems = useMemo(
    () => collection.filter((item) => approved.has(String(item.id))),
    [collection, approved]
  );

  const importCollection = (items: CollectionItem[]) => {
    const normalized = items.map(normalizeItem);
    setCollection(normalized);
    setApproved(new Set());
    setSelected(null);
    setStatus(`${normalized.length} SPECIMENS LOADED`);
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text());
      const items = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.items)
          ? parsed.items
          : Array.isArray(parsed?.collection)
            ? parsed.collection
            : [];

      if (!items.length) {
        setStatus("ERROR: NO COLLECTION ITEMS FOUND");
        return;
      }

      importCollection(items);
    } catch {
      setStatus("ERROR: INVALID COLLECTION JSON");
    } finally {
      event.target.value = "";
    }
  };

  const loadSaved = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setStatus("NO SAVED APPROVED COLLECTION FOUND");
        return;
      }
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : parsed.items ?? [];
      importCollection(items);
      setApproved(new Set(items.map((item: any, index: number) => String(item?.id ?? index + 1))));
      setStatus("APPROVED COLLECTION RESTORED");
    } catch {
      setStatus("ERROR: SAVED COLLECTION IS INVALID");
    }
  };

  const toggleApproval = (id: string | number) => {
    setApproved((current) => {
      const next = new Set(current);
      const key = String(id);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const approveAll = () => {
    setApproved(new Set(collection.map((item) => String(item.id))));
    setStatus("ALL SPECIMENS APPROVED FOR FACTORY");
  };

  const clearApproval = () => {
    setApproved(new Set());
    setStatus("APPROVAL QUEUE CLEARED");
  };

  const randomReview = () => {
    if (!collection.length) return;
    setReviewing(true);
    let ticks = 0;
    const timer = window.setInterval(() => {
      const item = collection[Math.floor(Math.random() * collection.length)];
      setSelected(item);
      ticks += 1;
      if (ticks >= 12) {
        window.clearInterval(timer);
        setReviewing(false);
        setStatus("RANDOM REVIEW COMPLETE");
      }
    }, 80);
  };

  const exportApproved = () => {
    const payload = {
      format: "cryogenic-room-approved-collection/v1",
      phase: 4,
      standard: "ERC-721",
      supply: approvedItems.length,
      items: approvedItems,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "cryogenic-approved-collection.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus(`${approvedItems.length} APPROVED ITEMS EXPORTED`);
  };

  return (
    <main className="factory-shell">
      <div className="factory-scanlines" />

      <header className="factory-header">
        <div>
          <span className="factory-eyebrow">VΣLOHE SYSTEM // PHASE 04</span>
          <h1>CRYOGENIC FACTORY</h1>
          <p>APPROVED COLLECTION CONTROL // BLOCKCHAIN PREPARATION</p>
        </div>
        <div className="factory-header-actions">
          <ConnectWalletButton />
          <div className="factory-status">
            <span>FACTORY STATUS</span>
            <b>LOCAL</b>
            <small>{status}</small>
          </div>
        </div>
      </header>

      <section className="factory-console">
        <div className="factory-toolbar">
          <label className="factory-button">
            IMPORT APPROVED JSON
            <input type="file" accept="application/json,.json" onChange={handleFile} />
          </label>
          <button className="factory-button" onClick={loadSaved}>LOAD SAVED</button>
          <button className="factory-button" onClick={randomReview} disabled={!collection.length || reviewing}>
            {reviewing ? "REVIEWING..." : "RANDOM REVIEW"}
          </button>
          <button className="factory-button" onClick={approveAll} disabled={!collection.length}>APPROVE ALL</button>
          <button className="factory-button" onClick={clearApproval} disabled={!approved.size}>CLEAR</button>
          <button className="factory-button primary" onClick={exportApproved} disabled={!approved.size}>
            EXPORT APPROVED
          </button>
        </div>

        <div className="factory-readout">
          <div><span>LOADED</span><strong>{collection.length}</strong></div>
          <div><span>APPROVED</span><strong>{approvedItems.length}</strong></div>
          <div><span>STANDARD</span><strong>ERC-721</strong></div>
          <div><span>BLOCKCHAIN</span><strong>NOT CONNECTED</strong></div>
        </div>

        {!collection.length ? (
          <section className="factory-empty">
            <div className="factory-core">FACTORY</div>
            <h2>NO APPROVED COLLECTION LOADED</h2>
            <p>
              Phase 4 is isolated from Phases 1–3. Import the collection produced
              by the generator when the approval bridge is ready.
            </p>
            <label className="factory-import-large">
              SELECT COLLECTION JSON
              <input type="file" accept="application/json,.json" onChange={handleFile} />
            </label>
          </section>
        ) : (
          <section className="factory-grid">
            {collection.map((item) => {
              const isApproved = approved.has(String(item.id));
              const image = item.image ?? item.dataUrl;

              return (
                <article
                  className={`factory-card ${isApproved ? "approved" : ""}`}
                  key={String(item.id)}
                  onClick={() => setSelected(item)}
                >
                  <div className="factory-image">
                    {image ? <img src={image} alt={item.name ?? String(item.id)} /> : <span>NO PREVIEW</span>}
                  </div>
                  <div className="factory-card-footer">
                    <b>{item.name}</b>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleApproval(item.id);
                      }}
                    >
                      {isApproved ? "APPROVED" : "SELECT"}
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </section>

      <footer className="factory-footer">
        <span>PHASE 01–03 // UNCHANGED</span>
        <span>PHASE 04 // LOCAL FACTORY</span>
        <span>WALLET READY // MINT NOT ACTIVE</span>
      </footer>

      {selected && (
        <div className="factory-modal-backdrop" onClick={() => setSelected(null)}>
          <div className="factory-modal" onClick={(event) => event.stopPropagation()}>
            <button className="factory-close" onClick={() => setSelected(null)}>×</button>
            <div className="factory-modal-image">
              {selected.image || selected.dataUrl ? (
                <img src={selected.image ?? selected.dataUrl} alt="" />
              ) : (
                <span>NO PREVIEW</span>
              )}
            </div>
            <div className="factory-modal-info">
              <span>FACTORY REVIEW</span>
              <h2>{selected.name}</h2>
              <p>IDENTIFIER // {String(selected.id)}</p>
              <h3>TRAITS</h3>
              {(selected.traits ?? selected.assets ?? []).map((trait, index) => (
                <div className="factory-trait" key={`${trait.name}-${index}`}>
                  <span>{trait.name}</span>
                  <small>{trait.layer ?? "TRAIT"}</small>
                </div>
              ))}
              <button
                className="factory-button primary"
                onClick={() => toggleApproval(selected.id)}
              >
                {approved.has(String(selected.id)) ? "REMOVE APPROVAL" : "APPROVE SPECIMEN"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
