"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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

type StoredSpecimen = {
  id: number;
  assets: Trait[];
  blob: Blob;
  width: number;
  height: number;
};

type TraitSummary = {
  layer: string;
  name: string;
  count: number;
};

const STORAGE_KEY = "cryogenic-room-approved-collection";
const DB_NAME = "cryogenic-room-db";
const DB_VERSION = 1;

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

function openCryogenicDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readPhaseThreeSpecimens() {
  return new Promise<StoredSpecimen[]>((resolve, reject) => {
    openCryogenicDatabase().then((db) => {
      const transaction = db.transaction("specimens", "readonly");
      const store = transaction.objectStore("specimens");
      const request = store.openCursor();
      const records: StoredSpecimen[] = [];

      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          db.close();
          resolve(records);
          return;
        }

        records.push(cursor.value as StoredSpecimen);
        cursor.continue();
      };

      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    }).catch(reject);
  });
}

export default function FactoryPage() {
  const [collection, setCollection] = useState<CollectionItem[]>([]);
  const [approved, setApproved] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<CollectionItem | null>(null);
  const [status, setStatus] = useState("FACTORY STANDBY");
  const [traitSummary, setTraitSummary] = useState<TraitSummary[]>([]);
  const [traitsOpen, setTraitsOpen] = useState(false);
  const objectUrls = useRef<string[]>([]);

  const approvedItems = useMemo(
    () => collection.filter((item) => approved.has(String(item.id))),
    [collection, approved]
  );

  const revokeImportedUrls = () => {
    objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrls.current = [];
  };

  useEffect(() => {
    return () => revokeImportedUrls();
  }, []);

  const importCollection = (items: CollectionItem[]) => {
    revokeImportedUrls();
    const normalized = items.map(normalizeItem);
    setCollection(normalized);
    setApproved(new Set());
    setSelected(null);
    setTraitSummary([]);
    setTraitsOpen(false);
    setStatus(`${normalized.length} SPECIMENS LOADED`);
  };

  const importPreview = async () => {
    try {
      setStatus("READING PHASE 03 PREVIEW...");

      const records = await readPhaseThreeSpecimens();

      if (!records.length) {
        setStatus("NO PHASE 03 SPECIMENS FOUND");
        return;
      }

      revokeImportedUrls();

      const items = records.map((record) => {
        const imageUrl = URL.createObjectURL(record.blob);
        objectUrls.current.push(imageUrl);

        return {
          id: record.id,
          name: `SPECIMEN #${String(record.id).padStart(3, "0")}`,
          image: imageUrl,
          dataUrl: imageUrl,
          traits: record.assets,
          assets: record.assets,
        };
      });

      setCollection(items);
      setApproved(new Set());
      setSelected(null);
      setTraitSummary([]);
      setTraitsOpen(false);
      setStatus(`PHASE 03 PREVIEW IMPORTED // ${items.length.toLocaleString()} SPECIMENS`);
    } catch (error) {
      console.error("Unable to import Phase 03 preview.", error);
      setStatus("ERROR: PHASE 03 PREVIEW UNAVAILABLE");
    }
  };

  const readTraits = () => {
    if (!collection.length) {
      setStatus("NO IMPORTED SPECIMENS TO ANALYZE");
      return;
    }

    const counts = new Map<string, TraitSummary>();

    collection.forEach((item) => {
      (item.traits ?? item.assets ?? []).forEach((trait) => {
        const layer = trait.layer ?? "TRAIT";
        const name = trait.name.replace(/\.png$/i, "");
        const key = `${layer}::${name}`;
        const current = counts.get(key);

        if (current) {
          current.count += 1;
        } else {
          counts.set(key, { layer, name, count: 1 });
        }
      });
    });

    const summary = Array.from(counts.values()).sort((a, b) =>
      a.layer.localeCompare(b.layer) || a.name.localeCompare(b.name)
    );

    setTraitSummary(summary);
    setTraitsOpen(true);
    setStatus(`TRAITS READ // ${summary.length} UNIQUE TRAITS`);
  };

  const clearImportedPreview = () => {
    revokeImportedUrls();
    setCollection([]);
    setApproved(new Set());
    setSelected(null);
    setTraitSummary([]);
    setTraitsOpen(false);
    setStatus("IMPORTED PREVIEW CLEARED");
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
          <Link className="factory-return-button" href="/">
            ← CRYOGENIC ROOM
          </Link>
          <ConnectWalletButton />
          <div className="factory-status">
            <span>FACTORY STATUS</span>
            <b>UNDER CONSTRUCTION</b>
            <small>{status}</small>
          </div>
        </div>
      </header>

      <section className="factory-console">
        <div className="factory-construction">
          <span>PHASE 04</span>
          <strong>UNDER CONSTRUCTION</strong>
        </div>

        <div className="factory-toolbar">
          <button className="factory-button" onClick={() => void importPreview()}>
            IMPORT PREVIEW
          </button>
          <button className="factory-button" onClick={readTraits} disabled={!collection.length}>
            READ TRAITS
          </button>
          <button className="factory-button" onClick={clearImportedPreview} disabled={!collection.length}>
            CLEAR
          </button>
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
            <h2>NO PHASE 03 PREVIEW LOADED</h2>
            <p>
              Import the recovered specimens from Cryogenic Room Phase 3 to
              continue working in the Factory.
            </p>
            <button className="factory-import-large" onClick={() => void importPreview()}>
              IMPORT PHASE 03 PREVIEW
            </button>
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
        <span>PHASE 04 // UNDER CONSTRUCTION</span>
        <span>WALLET READY // MINT NOT ACTIVE</span>
      </footer>

      {traitsOpen && (
        <div className="factory-modal-backdrop" onClick={() => setTraitsOpen(false)}>
          <div className="factory-modal factory-traits-modal" onClick={(event) => event.stopPropagation()}>
            <button className="factory-close" onClick={() => setTraitsOpen(false)}>×</button>
            <div className="factory-modal-info factory-traits-panel">
              <span>FACTORY ANALYSIS</span>
              <h2>TRAIT INVENTORY</h2>
              <p>TRAIT OCCURRENCES ACROSS IMPORTED PHASE 03 SPECIMENS</p>

              <div className="factory-trait-summary">
                {traitSummary.map((trait) => (
                  <div className="factory-trait-summary-row" key={`${trait.layer}::${trait.name}`}>
                    <div>
                      <span>{trait.name}</span>
                      <small>{trait.layer}</small>
                    </div>
                    <b>{trait.count.toLocaleString()}</b>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

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
