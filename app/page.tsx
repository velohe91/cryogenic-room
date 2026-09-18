"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";

type Asset = {
  id: string;
  name: string;
  url: string;
  width: number;
  height: number;
  dataUrl: string;
};
type Layer = { id: string; name: string; assets: Asset[] };
type Specimen = { id: number; assets: Asset[]; dataUrl: string; width: number; height: number };

type PersistedAsset = {
  id: string;
  name: string;
  width: number;
  height: number;
  dataUrl: string;
};
type PersistedLayer = { id: string; name: string; assets: PersistedAsset[] };
type PersistedSpecimen = {
  id: number;
  assets: PersistedAsset[];
  dataUrl: string;
  width: number;
  height: number;
};
type PersistedState = {
  version: 1;
  layers: PersistedLayer[];
  specimens: PersistedSpecimen[];
};

const STORAGE_KEY = "cryogenic-room-state-v1";

const emptyLayer = (index: number): Layer => ({
  id: crypto.randomUUID(),
  name: `Layer ${index}`,
  assets: [],
});

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function dataUrlToObjectUrl(dataUrl: string) {
  const [header, base64] = dataUrl.split(",");
  if (!header || !base64) throw new Error("Invalid persisted image data");

  const mime = header.match(/^data:(.*?);base64$/)?.[1] || "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}

function toPersistedAsset(asset: Asset): PersistedAsset {
  return {
    id: asset.id,
    name: asset.name,
    width: asset.width,
    height: asset.height,
    dataUrl: asset.dataUrl,
  };
}

function restoreAsset(asset: PersistedAsset): Asset {
  return {
    ...asset,
    url: dataUrlToObjectUrl(asset.dataUrl),
  };
}

async function compose(assets: Asset[]) {
  const images = await Promise.all(assets.map((asset) => loadImage(asset.url)));
  const width = images[0]?.naturalWidth || 1;
  const height = images[0]?.naturalHeight || 1;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  images.forEach((image) => ctx.drawImage(image, 0, 0, width, height));
  return { dataUrl: canvas.toDataURL("image/png"), width, height };
}

export default function Home() {
  const [layers, setLayers] = useState<Layer[]>([emptyLayer(1), emptyLayer(2), emptyLayer(3)]);
  const [stage, setStage] = useState(1);
  const [amount, setAmount] = useState(5);
  const [specimens, setSpecimens] = useState<Specimen[]>([]);
  const [selected, setSelected] = useState<Specimen | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("SYSTEM READY");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (raw) {
        const saved = JSON.parse(raw) as PersistedState;

        if (saved.version === 1) {
          setLayers(
            saved.layers.map((layer) => ({
              ...layer,
              assets: layer.assets.map(restoreAsset),
            })),
          );

          setSpecimens(
            saved.specimens.map((specimen) => ({
              ...specimen,
              assets: specimen.assets.map(restoreAsset),
            })),
          );

          setStatus("LOCAL STATE RESTORED");
        }
      }
    } catch (error) {
      console.error("Unable to restore Cryogenic Room state.", error);
      setStatus("LOCAL STATE RECOVERY FAILED");
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    const saved: PersistedState = {
      version: 1,
      layers: layers.map((layer) => ({
        id: layer.id,
        name: layer.name,
        assets: layer.assets.map(toPersistedAsset),
      })),
      specimens: specimens.map((specimen) => ({
        id: specimen.id,
        assets: specimen.assets.map(toPersistedAsset),
        dataUrl: specimen.dataUrl,
        width: specimen.width,
        height: specimen.height,
      })),
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch (error) {
      console.error("Unable to persist Cryogenic Room state.", error);
      setStatus("LOCAL STORAGE LIMIT REACHED");
    }
  }, [hydrated, layers, specimens]);

  const usableLayers = useMemo(() => layers.filter((layer) => layer.assets.length > 0), [layers]);
  const possible = useMemo(
    () => usableLayers.reduce((total, layer) => total * layer.assets.length, usableLayers.length ? 1 : 0),
    [usableLayers],
  );

  const addLayer = () => setLayers((current) => [...current, emptyLayer(current.length + 1)]);

  const removeLayer = (layerId: string) =>
    setLayers((current) => {
      const layer = current.find((item) => item.id === layerId);
      layer?.assets.forEach((asset) => URL.revokeObjectURL(asset.url));
      return current.filter((item) => item.id !== layerId);
    });

  const uploadAssets = async (event: ChangeEvent<HTMLInputElement>, layerId: string) => {
    const files = Array.from(event.target.files || []).filter((file) => file.type === "image/png");
    if (!files.length) return;

    const assets = await Promise.all(
      files.map(async (file) => {
        const dataUrl = await fileToDataUrl(file);
        const url = URL.createObjectURL(file);
        const image = await loadImage(url);

        return {
          id: crypto.randomUUID(),
          name: file.name,
          url,
          width: image.naturalWidth,
          height: image.naturalHeight,
          dataUrl,
        };
      }),
    );

    setLayers((current) =>
      current.map((layer) =>
        layer.id === layerId ? { ...layer, assets: [...layer.assets, ...assets] } : layer,
      ),
    );
    event.target.value = "";
  };

  const removeAsset = (layerId: string, assetId: string) => {
    setLayers((current) =>
      current.map((layer) => {
        if (layer.id !== layerId) return layer;
        const asset = layer.assets.find((item) => item.id === assetId);
        if (asset) URL.revokeObjectURL(asset.url);
        return { ...layer, assets: layer.assets.filter((item) => item.id !== assetId) };
      }),
    );
  };

  const generate = async () => {
    if (!usableLayers.length || usableLayers.some((layer) => !layer.assets.length)) {
      setStatus("ERROR: EVERY LAYER NEEDS PNG ASSETS");
      setStage(1);
      return;
    }

    setBusy(true);
    setStatus("CRYOGENIC SYNTHESIS IN PROGRESS...");
    const target = Math.min(Math.max(amount, 1), possible);
    const seen = new Set<string>();
    const next: Specimen[] = [];
    let attempts = 0;

    while (next.length < target && attempts < target * 20) {
      attempts += 1;
      const picked = usableLayers.map(
        (layer) => layer.assets[Math.floor(Math.random() * layer.assets.length)],
      );
      const key = picked.map((asset) => asset.id).join("|");
      if (seen.has(key)) continue;
      seen.add(key);

      const composed = await compose(picked);
      next.push({ id: next.length + 1, assets: picked, ...composed });
    }

    setSpecimens(next);
    setBusy(false);
    setStatus(`SYNTHESIS COMPLETE // ${next.length} SPECIMENS RECOVERED`);
    setStage(3);
  };

  const deleteSpecimen = (id: number) => {
    setSpecimens((current) =>
      current.filter((item) => item.id !== id).map((item, index) => ({ ...item, id: index + 1 })),
    );
    setSelected(null);
  };

  const download = (specimen: Specimen) => {
    const anchor = document.createElement("a");
    anchor.href = specimen.dataUrl;
    anchor.download = `cryogenic-specimen-${String(specimen.id).padStart(3, "0")}.png`;
    anchor.click();
  };

  return (
    <main className="lab-shell">
      <div className="scanlines" />
      <header className="lab-header">
        <div className="brand-block"><span className="eyebrow">VΣLOHE SYSTEM // GENERATION BAY</span><h1>CRYOGENIC ROOM</h1><p>PIXEL-ARCADE NFT SPECIMEN GENERATOR</p></div>
        <div className="system-panel"><span>CORE SYNC</span><b>ONLINE</b><small>{status}</small></div>
      </header>

      <section className="lab-stage">
        <aside className="capsule capsule-left"><div className="capsule-glow" /><span>CR-01</span><i>SUBJECT // STANDBY</i></aside>
        <div className="console">
          <nav className="stage-nav">
            {["01 — BUILD THE DNA", "02 — GENERATE", "03 — PREVIEW"].map((label, index) => <button key={label} className={stage === index + 1 ? "active" : ""} onClick={() => setStage(index + 1)}>{label}</button>)}
          </nav>

          {stage === 1 && <section className="module"><div className="module-title"><div><span>LAB MODULE 01</span><h2>BUILD THE DNA</h2><p>Assemble the visual layers of the specimen.</p></div><div className="counter">{layers.length}<small>LAYERS</small></div></div>
            <div className="layers-grid">{layers.map((layer, index) => <article className="layer-card" key={layer.id}><div className="layer-head"><div><span>DNA SECTOR {String(index + 1).padStart(2, "0")}</span><input value={layer.name} onChange={(e) => setLayers((current) => current.map((item) => item.id === layer.id ? { ...item, name: e.target.value } : item))} /></div><button className="danger tiny" onClick={() => removeLayer(layer.id)}>×</button></div><label className="upload-zone"><strong>＋ INSERT PNG</strong><small>TRANSPARENT TRAIT ASSET</small><input type="file" accept="image/png" multiple onChange={(e) => uploadAssets(e, layer.id)} /></label><div className="asset-list">{layer.assets.map((asset) => <div className="asset-row" key={asset.id}><img src={asset.url} alt="" /><span title={asset.name}>{asset.name}</span><button className="danger" onClick={() => removeAsset(layer.id, asset.id)}>×</button></div>)}</div></article>)}</div>
            <button className="ghost wide" onClick={addLayer}>＋ ADD DNA LAYER</button>
          </section>}

          {stage === 2 && <section className="module generate-module"><div className="module-title"><div><span>LAB MODULE 02</span><h2>GENERATE</h2><p>Initiate cryogenic synthesis.</p></div></div><div className="synthesis-core"><div className="core-ring"><span>DNA</span></div><div className="readouts"><div><span>ACTIVE LAYERS</span><b>{usableLayers.length}</b></div><div><span>POSSIBLE COMBINATIONS</span><b>{possible.toLocaleString()}</b></div><div><span>OUTPUT COUNT</span><input type="number" min="1" max={Math.max(1, possible)} value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></div></div></div><button className="synthesize" disabled={busy || !possible} onClick={generate}>{busy ? "SYNTHESIZING..." : "▶ INITIATE CRYOGENIC SYNTHESIS"}</button></section>}

          {stage === 3 && <section className="module"><div className="module-title"><div><span>LAB MODULE 03</span><h2>PREVIEW</h2><p>Inspect recovered Cyborg units.</p></div><div className="counter">{specimens.length}<small>RECOVERED</small></div></div>{specimens.length === 0 ? <div className="empty">NO SPECIMENS RECOVERED.<br />RUN CRYOGENIC SYNTHESIS.</div> : <div className="specimen-grid">{specimens.map((specimen) => <article className="specimen" key={specimen.id} onClick={() => setSelected(specimen)}><div className="specimen-image"><img src={specimen.dataUrl} alt={`Specimen ${specimen.id}`} /></div><div className="specimen-footer"><b>SPECIMEN #{String(specimen.id).padStart(3, "0")}</b><span>{specimen.width} × {specimen.height}px</span></div><button onClick={(e) => { e.stopPropagation(); download(specimen); }}>↓ PNG</button></article>)}</div>}</section>}
        </div>
        <aside className="capsule capsule-right"><div className="capsule-glow" /><span>CR-05</span><i>SUBJECT // SYNTHESIS</i></aside>
      </section>

      <footer className="lab-footer"><span>CRYOGENIC ROOM // LOCAL GENERATOR</span><span>PNG ONLY // NO EXTERNAL ASSETS</span><span>VΣLOHE SYSTEM</span></footer>

      {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><div className="specimen-modal" onClick={(e) => e.stopPropagation()}><button className="modal-close" onClick={() => setSelected(null)}>×</button><div className="modal-image"><img src={selected.dataUrl} alt="" /></div><div className="modal-info"><span>RECOVERY REPORT</span><h2>SPECIMEN #{String(selected.id).padStart(3, "0")}</h2><p>CANVAS // {selected.width} × {selected.height}px</p><h3>DNA COMPONENTS</h3>{selected.assets.map((asset) => <div className="trait" key={asset.id}><span>{asset.name}</span><small>{asset.width} × {asset.height}px</small></div>)}<div className="modal-actions"><button className="synthesize" onClick={() => download(selected)}>↓ DOWNLOAD PNG</button><button className="danger wide" onClick={() => deleteSpecimen(selected.id)}>DELETE SPECIMEN</button></div></div></div></div>}
    </main>
  );
}
