"use client";

import Link from "next/link";
import JSZip from "jszip";
import { ChangeEvent, useEffect, useMemo, useState } from "react";

type Asset = {
  id: string;
  name: string;
  url: string;
  width: number;
  height: number;
  blob?: Blob;
};
type Layer = { id: string; name: string; assets: Asset[] };
type SpecimenAsset = { id: string; name: string; width: number; height: number; layerName: string };
type Specimen = {
  id: number;
  assets: SpecimenAsset[];
  blob: Blob;
  url: string;
  width: number;
  height: number;
};

type PersistedAssetMeta = {
  id: string;
  name: string;
  width: number;
  height: number;
};
type PersistedLayer = { id: string; name: string; assets: PersistedAssetMeta[] };
type PersistedState = {
  version: 2 | 3;
  layers: PersistedLayer[];
  specimenCount: number;
  dnaFingerprints?: string[];
};

type StoredAsset = PersistedAssetMeta & { blob: Blob };
type StoredSpecimen = {
  id: number;
  assets: SpecimenAsset[];
  blob: Blob;
  width: number;
  height: number;
};

const STORAGE_KEY = "cryogenic-room-state-v3";
const PREVIOUS_STORAGE_KEY = "cryogenic-room-state-v2";
const LEGACY_STORAGE_KEY = "cryogenic-room-state-v1";
const DB_NAME = "cryogenic-room-db";
const DB_VERSION = 1;
const PAGE_SIZE_OPTIONS = [25, 50, 100, 250, 500, 1000];
const GENERATION_BATCH_SIZE = 100;

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("assets")) db.createObjectStore("assets", { keyPath: "id" });
      if (!db.objectStoreNames.contains("specimens")) db.createObjectStore("specimens", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putAssetRecord(asset: StoredAsset) {
  const db = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("assets", "readwrite");
    tx.objectStore("assets").put(asset);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function deleteAssetRecord(id: string) {
  const db = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("assets", "readwrite");
    tx.objectStore("assets").delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function getAssetRecord(id: string) {
  const db = await openDatabase();
  return new Promise<StoredAsset | undefined>((resolve, reject) => {
    const request = db.transaction("assets", "readonly").objectStore("assets").get(id);
    request.onsuccess = () => { db.close(); resolve(request.result); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

async function putSpecimenRecord(specimen: StoredSpecimen) {
  const db = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("specimens", "readwrite");
    tx.objectStore("specimens").put(specimen);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function clearSpecimenRecords() {
  const db = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("specimens", "readwrite");
    tx.objectStore("specimens").clear();
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function countSpecimenRecords() {
  const db = await openDatabase();
  return new Promise<number>((resolve, reject) => {
    const request = db.transaction("specimens", "readonly").objectStore("specimens").count();
    request.onsuccess = () => { db.close(); resolve(request.result); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

async function getSpecimenCombinationStats(layers: Layer[]) {
  const db = await openDatabase();
  return new Promise<{ allKeys: Set<string>; currentKeys: Set<string> }>((resolve, reject) => {
    const store = db.transaction("specimens", "readonly").objectStore("specimens");
    const request = store.openCursor();
    const allKeys = new Set<string>();
    const currentKeys = new Set<string>();
    const layerAssetIds = layers.map((layer) => new Set(layer.assets.map((asset) => asset.id)));

    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        db.close();
        resolve({ allKeys, currentKeys });
        return;
      }

      const record = cursor.value as StoredSpecimen;
      const key = record.assets.map((asset) => asset.id).join("|");
      allKeys.add(key);

      const matchesCurrentDna =
        record.assets.length === layers.length &&
        record.assets.every((asset, index) => layerAssetIds[index]?.has(asset.id));

      if (matchesCurrentDna) currentKeys.add(key);
      cursor.continue();
    };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

async function getSpecimenPage(page: number, pageSize: number) {
  const db = await openDatabase();
  return new Promise<StoredSpecimen[]>((resolve, reject) => {
    const store = db.transaction("specimens", "readonly").objectStore("specimens");
    const request = store.openCursor();
    const result: StoredSpecimen[] = [];
    const start = (page - 1) * pageSize;
    let index = 0;

    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || result.length >= pageSize) {
        db.close();
        resolve(result);
        return;
      }
      if (index >= start) result.push(cursor.value as StoredSpecimen);
      index += 1;
      cursor.continue();
    };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

async function getAllSpecimenRecords() {
  const db = await openDatabase();
  return new Promise<StoredSpecimen[]>((resolve, reject) => {
    const store = db.transaction("specimens", "readonly").objectStore("specimens");
    const request = store.openCursor();
    const result: StoredSpecimen[] = [];

    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        db.close();
        resolve(result);
        return;
      }
      result.push(cursor.value as StoredSpecimen);
      cursor.continue();
    };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

async function deleteSelectedSpecimenRecords(ids: number[]) {
  if (!ids.length) return;
  const selectedIds = new Set(ids);
  const db = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("specimens", "readwrite");
    const store = tx.objectStore("specimens");
    const request = store.openCursor();
    const remaining: StoredSpecimen[] = [];
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        store.clear();
        remaining.forEach((record, index) => store.put({ ...record, id: index + 1 }));
        return;
      }
      const record = cursor.value as StoredSpecimen;
      if (!selectedIds.has(record.id)) remaining.push(record);
      cursor.continue();
    };
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

async function deleteSpecimenRecord(id: number) {
  const db = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("specimens", "readwrite");
    tx.objectStore("specimens").delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function renumberSpecimensAfter(deletedId: number) {
  const db = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("specimens", "readwrite");
    const store = tx.objectStore("specimens");

    // "id" is the IndexedDB keyPath, so changing record.id with cursor.update()
    // cannot move the record to a new key. Move affected records through temporary
    // negative keys first, then write their final sequential ids.
    const moveToTemporaryKeys = store.openCursor();
    moveToTemporaryKeys.onsuccess = () => {
      const cursor = moveToTemporaryKeys.result;
      if (!cursor) {
        const restoreFinalKeys = store.openCursor();
        restoreFinalKeys.onsuccess = () => {
          const finalCursor = restoreFinalKeys.result;
          if (!finalCursor) return;

          const record = finalCursor.value as StoredSpecimen;
          if (record.id < 0) {
            const finalRecord = { ...record, id: Math.abs(record.id) - 1 };
            cursorSafeReplace(store, finalCursor, finalRecord);
          }
          finalCursor.continue();
        };
        return;
      }

      const record = cursor.value as StoredSpecimen;
      if (record.id > deletedId) {
        const temporaryRecord = { ...record, id: -record.id };
        cursorSafeReplace(store, cursor, temporaryRecord);
      }
      cursor.continue();
    };

    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

function cursorSafeReplace(store: IDBObjectStore, cursor: IDBCursorWithValue, record: StoredSpecimen) {
  cursor.delete();
  store.put(record);
}

function dataUrlToBlob(dataUrl: string) {
  const [header, base64] = dataUrl.split(",");
  if (!header || !base64) throw new Error("Invalid image data");
  const mime = header.match(/^data:(.*?);base64$/)?.[1] || "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mime });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function compose(assets: Asset[]) {
  return Promise.all(assets.map((asset) => loadImage(asset.url))).then((images) => {
    const width = images[0]?.naturalWidth || 1;
    const height = images[0]?.naturalHeight || 1;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    images.forEach((image) => ctx.drawImage(image, 0, 0, width, height));
    return new Promise<{ blob: Blob; width: number; height: number }>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve({ blob, width, height }) : reject(new Error("PNG encoding failed")), "image/png");
    });
  });
}

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function specimenName(specimen: Specimen) {
  return `Specimen #${String(specimen.id).padStart(3, "0")}`;
}

function traitValue(name: string) {
  return name.replace(/\.png$/i, "");
}

function assetMeta(asset: Asset, layerName: string): SpecimenAsset {
  return { id: asset.id, name: asset.name, width: asset.width, height: asset.height, layerName };
}

function revokeSpecimenUrls(items: Specimen[]) {
  items.forEach((item) => URL.revokeObjectURL(item.url));
}

function buildDnaFingerprint(sourceLayers: Array<{ id: string; name: string; assets: Array<{ id: string; name: string }> }>) {
  return JSON.stringify(
    sourceLayers.map((layer) => ({
      id: layer.id,
      name: layer.name,
      assets: layer.assets.map((asset) => ({ id: asset.id, name: asset.name })),
    })),
  );
}

function assetsFromCombinationIndex(layers: Layer[], index: number) {
  let remainder = index;
  const picked = new Array<Asset>(layers.length);
  for (let layerIndex = layers.length - 1; layerIndex >= 0; layerIndex -= 1) {
    const assets = layers[layerIndex].assets;
    const assetIndex = remainder % assets.length;
    remainder = Math.floor(remainder / assets.length);
    picked[layerIndex] = assets[assetIndex];
  }
  return picked;
}

function greatestCommonDivisor(a: number, b: number) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const remainder = x % y;
    x = y;
    y = remainder;
  }
  return x;
}

function createRandomTraversal(total: number) {
  if (total <= 1) return { start: 0, step: 1 };

  const start = Math.floor(Math.random() * total);
  let step = 1;

  if (total > 2) {
    do {
      step = Math.floor(Math.random() * (total - 1)) + 1;
    } while (greatestCommonDivisor(step, total) !== 1);
  }

  return { start, step };
}

export default function Home() {
  const [layers, setLayers] = useState<Layer[]>([1, 2, 3].map((index) => ({ id: crypto.randomUUID(), name: `Layer ${index}`, assets: [] })));
  const [stage, setStage] = useState(1);
  const [amount, setAmount] = useState(5);
  const [specimens, setSpecimens] = useState<Specimen[]>([]);
  const [totalSpecimens, setTotalSpecimens] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(500);
  const [selected, setSelected] = useState<Specimen | null>(null);
  const [selectedSpecimenIds, setSelectedSpecimenIds] = useState<Set<number>>(new Set());
  const [deletingSpecimenId, setDeletingSpecimenId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("SYSTEM READY");
  const [hydrated, setHydrated] = useState(false);
  const [specimenRevision, setSpecimenRevision] = useState(0);
  const [dnaFingerprints, setDnaFingerprints] = useState<string[]>([]);
  const [pendingSpecimens, setPendingSpecimens] = useState(0);
  const [pendingStatsLoading, setPendingStatsLoading] = useState(false);
  const [clearPreviewOpen, setClearPreviewOpen] = useState(false);

  const activeDnaFingerprint = useMemo(
    () => buildDnaFingerprint(layers),
    [layers],
  );
  const dnaChanged = totalSpecimens > 0 && dnaFingerprints.length > 0 && !dnaFingerprints.includes(activeDnaFingerprint);

  const totalPages = Math.max(1, Math.ceil(totalSpecimens / pageSize));

  const returnToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const navigateFromBottom = (nextStage: number) => {
    setSelected(null);
    setStage(nextStage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      try {
        const db = await openDatabase();
        db.close();
        let raw = localStorage.getItem(STORAGE_KEY);

        if (!raw) {
          const previous = localStorage.getItem(PREVIOUS_STORAGE_KEY);
          if (previous) {
            raw = previous;
            localStorage.removeItem(PREVIOUS_STORAGE_KEY);
          }
        }

        if (!raw) {
          const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
          if (legacy) {
            const saved = JSON.parse(legacy);
            for (const layer of saved.layers ?? []) {
              for (const asset of layer.assets ?? []) {
                await putAssetRecord({ ...asset, blob: dataUrlToBlob(asset.dataUrl) });
              }
            }
            await clearSpecimenRecords();
            for (const specimen of saved.specimens ?? []) {
              await putSpecimenRecord({
                id: specimen.id,
                assets: (specimen.assets ?? []).map((asset: any) => ({
                  id: asset.id, name: asset.name, width: asset.width, height: asset.height, layerName: "DNA Layer",
                })),
                blob: dataUrlToBlob(specimen.dataUrl),
                width: specimen.width,
                height: specimen.height,
              });
            }
            raw = JSON.stringify({
              version: 3,
              layers: (saved.layers ?? []).map((layer: any) => ({
                id: layer.id,
                name: layer.name,
                assets: (layer.assets ?? []).map((asset: any) => ({
                  id: asset.id, name: asset.name, width: asset.width, height: asset.height,
                })),
              })),
              specimenCount: saved.specimens?.length ?? 0,
              dnaFingerprints: saved.specimens?.length ? [buildDnaFingerprint((saved.layers ?? []).map((layer: any) => ({
                id: layer.id,
                name: layer.name,
                assets: (layer.assets ?? []).map((asset: any) => ({ id: asset.id, name: asset.name })),
              })))] : [],
            } satisfies PersistedState);
            localStorage.removeItem(LEGACY_STORAGE_KEY);
            setStatus("LEGACY STATE MIGRATED TO INDEXEDDB");
          }
        }

        if (raw) {
          const saved = JSON.parse(raw) as PersistedState;
          if ((saved.version === 2 || saved.version === 3) && !cancelled) {
            const restoredLayers: Layer[] = [];
            for (const layer of saved.layers) {
              const restoredAssets: Asset[] = [];
              for (const meta of layer.assets) {
                const stored = await getAssetRecord(meta.id);
                if (stored) restoredAssets.push({ ...meta, url: URL.createObjectURL(stored.blob), blob: stored.blob });
              }
              restoredLayers.push({ ...layer, assets: restoredAssets });
            }
            setLayers(restoredLayers);
            setTotalSpecimens(saved.specimenCount);
            const restoredFingerprint = buildDnaFingerprint(restoredLayers);
            const restoredHistory = saved.version === 3 && Array.isArray(saved.dnaFingerprints) && saved.dnaFingerprints.length
              ? saved.dnaFingerprints
              : saved.specimenCount
                ? [restoredFingerprint]
                : [];
            setDnaFingerprints(restoredHistory);
            if (saved.specimenCount) setStatus("LOCAL STATE RESTORED // INDEXEDDB");
          }
        }
      } catch (error) {
        console.error("Unable to restore Cryogenic Room state.", error);
        setStatus("LOCAL STATE RECOVERY FAILED");
      } finally {
        if (!cancelled) setHydrated(true);
      }
    };

    hydrate();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const saved: PersistedState = {
      version: 3,
      layers: layers.map((layer) => ({
        id: layer.id,
        name: layer.name,
        assets: layer.assets.map(({ id, name, width, height }) => ({ id, name, width, height })),
      })),
      specimenCount: totalSpecimens,
      dnaFingerprints,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch (error) {
      console.error("Unable to persist Cryogenic Room metadata.", error);
      setStatus("LOCAL METADATA STORAGE FAILED");
    }
  }, [hydrated, layers, totalSpecimens, dnaFingerprints]);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    const loadPage = async () => {
      try {
        const stored = await getSpecimenPage(page, pageSize);
        const next = stored.map((item) => ({
          id: item.id,
          assets: item.assets,
          blob: item.blob,
          url: URL.createObjectURL(item.blob),
          width: item.width,
          height: item.height,
        }));
        if (!cancelled) {
          setSpecimens((current) => { revokeSpecimenUrls(current); return next; });
        } else {
          revokeSpecimenUrls(next);
        }
      } catch (error) {
        console.error("Unable to load specimen page.", error);
        if (!cancelled) setStatus("PREVIEW PAGE LOAD FAILED");
      }
    };
    loadPage();
    return () => { cancelled = true; };
  }, [hydrated, page, pageSize, specimenRevision]);

  const usableLayers = useMemo(() => layers.filter((layer) => layer.assets.length > 0), [layers]);
  const possible = useMemo(
    () => usableLayers.reduce((total, layer) => total * layer.assets.length, usableLayers.length ? 1 : 0),
    [usableLayers],
  );

  useEffect(() => {
    if (!hydrated || stage !== 2 || !totalSpecimens || !usableLayers.length || usableLayers.some((layer) => !layer.assets.length)) {
      setPendingSpecimens(totalSpecimens ? Math.max(0, possible - totalSpecimens) : possible);
      setPendingStatsLoading(false);
      return;
    }

    let cancelled = false;
    setPendingStatsLoading(true);

    getSpecimenCombinationStats(usableLayers)
      .then(({ currentKeys }) => {
        if (!cancelled) setPendingSpecimens(Math.max(0, possible - currentKeys.size));
      })
      .catch((error) => {
        console.error("Unable to calculate pending synthesis combinations.", error);
        if (!cancelled) {
          setPendingSpecimens(0);
          setStatus("PENDING SYNTHESIS CALCULATION FAILED");
        }
      })
      .finally(() => {
        if (!cancelled) setPendingStatsLoading(false);
      });

    return () => { cancelled = true; };
  }, [hydrated, stage, totalSpecimens, possible, activeDnaFingerprint, usableLayers]);

  const addLayer = () => setLayers((current) => [...current, { id: crypto.randomUUID(), name: `Layer ${current.length + 1}`, assets: [] }]);

  const removeLayer = (layerId: string) => {
    setLayers((current) => {
      const layer = current.find((item) => item.id === layerId);
      layer?.assets.forEach((asset) => { URL.revokeObjectURL(asset.url); void deleteAssetRecord(asset.id); });
      return current.filter((item) => item.id !== layerId);
    });
  };

  const uploadAssets = async (event: ChangeEvent<HTMLInputElement>, layerId: string) => {
    const files = Array.from(event.target.files || []).filter((file) => file.type === "image/png");
    if (!files.length) return;

    try {
      const assets = await Promise.all(files.map(async (file) => {
        const url = URL.createObjectURL(file);
        const image = await loadImage(url);
        const asset = { id: crypto.randomUUID(), name: file.name, url, width: image.naturalWidth, height: image.naturalHeight, blob: file };
        await putAssetRecord(asset);
        return asset;
      }));
      setLayers((current) => current.map((layer) => layer.id === layerId ? { ...layer, assets: [...layer.assets, ...assets] } : layer));
      event.target.value = "";
    } catch (error) {
      console.error("Unable to store PNG assets.", error);
      setStatus("PNG STORAGE FAILED");
    }
  };

  const removeAsset = (layerId: string, assetId: string) => {
    setLayers((current) => current.map((layer) => {
      if (layer.id !== layerId) return layer;
      const asset = layer.assets.find((item) => item.id === assetId);
      if (asset) {
        URL.revokeObjectURL(asset.url);
        void deleteAssetRecord(asset.id);
      }
      return { ...layer, assets: layer.assets.filter((item) => item.id !== assetId) };
    }));
  };

  const generate = async (mode: "new" | "integrate") => {
    if (!usableLayers.length || usableLayers.some((layer) => !layer.assets.length)) {
      setStatus("ERROR: EVERY LAYER NEEDS PNG ASSETS");
      setStage(1);
      return;
    }

    const available = mode === "integrate" ? pendingSpecimens : possible;
    if (!available) {
      setStatus(mode === "integrate" ? "NO UNIQUE SPECIMENS REMAINING" : "NO VALID DNA COMBINATIONS");
      return;
    }

    setBusy(true);
    setStatus(mode === "integrate" ? "INTEGRATING CRYOGENIC SYNTHESIS..." : "CRYOGENIC SYNTHESIS IN PROGRESS...");
    const target = Math.min(Math.max(amount, 1), available);
    const existingStats = mode === "integrate" ? await getSpecimenCombinationStats(usableLayers) : { allKeys: new Set<string>(), currentKeys: new Set<string>() };
    const seen = existingStats.allKeys;
    let generated = 0;
    let scanned = 0;
    const traversal = createRandomTraversal(possible);
    const nextIdStart = mode === "integrate" ? totalSpecimens + 1 : 1;

    try {
      if (mode === "new") {
        await clearSpecimenRecords();
        setTotalSpecimens(0);
        setPage(1);
      }

      while (generated < target && scanned < possible) {
        const combinationIndex = (traversal.start + (scanned * traversal.step)) % possible;
        scanned += 1;
        const picked = assetsFromCombinationIndex(usableLayers, combinationIndex);
        const key = picked.map((asset) => asset.id).join("|");
        if (seen.has(key)) continue;
        seen.add(key);

        const composed = await compose(picked);
        await putSpecimenRecord({
          id: nextIdStart + generated,
          assets: picked.map((asset, index) => assetMeta(asset, usableLayers[index]?.name || "DNA Layer")),
          blob: composed.blob,
          width: composed.width,
          height: composed.height,
        });
        generated += 1;

        if (generated % GENERATION_BATCH_SIZE === 0 || generated === target) {
          setTotalSpecimens(mode === "new" ? generated : totalSpecimens + generated);
          setStatus(mode === "integrate"
            ? `INTEGRATING // ${generated.toLocaleString()} / ${target.toLocaleString()}`
            : `SYNTHESIZING // ${generated.toLocaleString()} / ${target.toLocaleString()}`);
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      const finalTotal = mode === "integrate" ? totalSpecimens + generated : generated;
      setTotalSpecimens(finalTotal);
      setDnaFingerprints((current) => mode === "new"
        ? [activeDnaFingerprint]
        : Array.from(new Set([...current, activeDnaFingerprint])));
      setPendingSpecimens(Math.max(0, possible - (mode === "integrate" ? pendingSpecimens - generated : generated)));
      setStatus(mode === "integrate"
        ? `INTEGRATION COMPLETE // ${generated} SPECIMENS ADDED // ${finalTotal} TOTAL RECOVERED`
        : `SYNTHESIS COMPLETE // ${generated} SPECIMENS RECOVERED`);
      setPage(1);
      // Force Phase 3 to reload the freshly integrated IndexedDB records immediately.
      setSpecimenRevision((current) => current + 1);
      setStage(3);
    } catch (error) {
      console.error("Cryogenic synthesis failed.", error);
      setStatus("SYNTHESIS FAILED");
    } finally {
      setBusy(false);
    }
  };

  const toggleSpecimenSelection = (id: number) => {
    setSelectedSpecimenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearCurrentPageSelection = () => {
    setSelectedSpecimenIds((current) => {
      const next = new Set(current);
      specimens.forEach((specimen) => next.delete(specimen.id));
      return next;
    });
  };

  const selectAllCurrentPage = () => {
    setSelectedSpecimenIds((current) => {
      const next = new Set(current);
      specimens.forEach((specimen) => next.add(specimen.id));
      return next;
    });
  };

  const clearPreview = async () => {
    if (busy || deletingSpecimenId !== null || totalSpecimens === 0) return;

    setBusy(true);
    setStatus("CLEARING PREVIEW // PURGING RECOVERED SPECIMENS...");

    try {
      await clearSpecimenRecords();
      revokeSpecimenUrls(specimens);
      setSpecimens([]);
      setSelected(null);
      setSelectedSpecimenIds(new Set());
      setTotalSpecimens(0);
      setPage(1);
      setSpecimenRevision((current) => current + 1);
      setDnaFingerprints([]);
      setPendingSpecimens(possible);
      setClearPreviewOpen(false);
      setStage(2);
      setStatus("PREVIEW CLEARED // DNA LAYERS PRESERVED");
    } catch (error) {
      console.error("Unable to clear Cryogenic Room preview.", error);
      setStatus("PREVIEW CLEAR FAILED");
    } finally {
      setBusy(false);
    }
  };

  const deleteSpecimen = async (id: number) => {
    if (deletingSpecimenId !== null) return;

    const removedIndex = specimens.findIndex((item) => item.id === id);
    setDeletingSpecimenId(id);
    setSelected(null);
    setSelectedSpecimenIds((current) => { const next = new Set(current); next.delete(id); return next; });
    setStatus(`DELETING SPECIMEN #${String(id).padStart(3, "0")} // UPDATING SEQUENCE...`);

    // Optimistically update the visible page so the sequence visibly closes the gap immediately.
    setSpecimens((current) =>
      current
        .filter((item) => item.id !== id)
        .map((item) => item.id > id ? { ...item, id: item.id - 1 } : item),
    );

    try {
      await deleteSpecimenRecord(id);
      await renumberSpecimensAfter(id);
      const nextTotal = Math.max(0, totalSpecimens - 1);
      setTotalSpecimens(nextTotal);
      if (page > Math.max(1, Math.ceil(nextTotal / pageSize)) && removedIndex >= 0) {
        setPage(Math.max(1, page - 1));
      }
      setSpecimenRevision((current) => current + 1);
      setStatus("SPECIMEN DELETED // SEQUENCE UPDATED");
    } catch (error) {
      console.error("Unable to delete specimen.", error);
      setStatus("SPECIMEN DELETE FAILED");
      setSpecimenRevision((current) => current + 1);
    } finally {
      setDeletingSpecimenId(null);
    }
  };

  const download = (specimen: Specimen) => {
    const url = URL.createObjectURL(specimen.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cryogenic-specimen-${String(specimen.id).padStart(3, "0")}.png`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const downloadSelectedZip = async () => {
    if (!selectedSpecimenIds.size) return;
    const allSpecimens = await getAllSpecimenRecords();
    const selectedRecords = allSpecimens.filter((specimen) => selectedSpecimenIds.has(specimen.id));
    if (!selectedRecords.length) return;
    const zip = new JSZip();
    const folder = zip.folder("Selected");
    if (!folder) return;
    const header = ["specimen", "canvas_width", "canvas_height", "dna_components"];
    const rows = selectedRecords.map((specimen) => [specimenName({ ...specimen, url: "" }), specimen.width, specimen.height, specimen.assets.map((asset) => `${asset.layerName}: ${asset.name}`).join(" | ")]);
    folder.file("selection-report.csv", [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n"));
    selectedRecords.forEach((specimen) => folder.file(`${specimen.id}.png`, specimen.blob));
    const blob = await zip.generateAsync({ type: "blob" });
    downloadZipBlob(blob, "Cryogenic-Room-Selected.zip");
  };

  const deleteSelected = async () => {
    if (!selectedSpecimenIds.size || deletingSpecimenId !== null || busy) return;
    const ids = Array.from(selectedSpecimenIds).sort((a, b) => a - b);
    setBusy(true);
    setStatus(`DELETING ${ids.length} SELECTED SPECIMENS // UPDATING SEQUENCE...`);
    try {
      await deleteSelectedSpecimenRecords(ids);
      const nextTotal = Math.max(0, totalSpecimens - ids.length);
      setSelectedSpecimenIds(new Set());
      setSelected(null);
      setTotalSpecimens(nextTotal);
      if (page > Math.max(1, Math.ceil(nextTotal / pageSize))) setPage(Math.max(1, Math.ceil(nextTotal / pageSize)));
      setSpecimenRevision((current) => current + 1);
      setStatus(`${ids.length} SPECIMENS DELETED // SEQUENCE UPDATED`);
    } catch (error) {
      console.error("Unable to delete selected specimens.", error);
      setStatus("SELECTED SPECIMEN DELETE FAILED");
      setSpecimenRevision((current) => current + 1);
    } finally {
      setBusy(false);
    }
  };

  const downloadZipBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const currentRangeStart = totalSpecimens ? (page - 1) * pageSize + 1 : 0;
  const currentRangeEnd = Math.min(page * pageSize, totalSpecimens);

  const downloadPreviewZip = async () => {
    if (!totalSpecimens) return;

    const allSpecimens = await getAllSpecimenRecords();
    if (!allSpecimens.length) return;

    const zip = new JSZip();
    const previewFolder = zip.folder("Preview");
    if (!previewFolder) return;

    const reportHeader = ["specimen", "canvas_width", "canvas_height", "dna_components"];
    const reportRows = allSpecimens.map((specimen) => [
      specimenName({ ...specimen, url: "" }),
      specimen.width,
      specimen.height,
      specimen.assets.map((asset) => `${asset.layerName}: ${asset.name}`).join(" | "),
    ]);

    previewFolder.file("preview-report.csv", [reportHeader, ...reportRows].map((row) => row.map(csvCell).join(",")).join("\n"));
    allSpecimens.forEach((specimen) => previewFolder.file(`${specimen.id}.png`, specimen.blob));

    const blob = await zip.generateAsync({ type: "blob" });
    downloadZipBlob(blob, "Cryogenic-Room-Preview.zip");
  };

  const downloadOpenSeaZip = async () => {
    if (!totalSpecimens) return;

    const allSpecimens = await getAllSpecimenRecords();
    if (!allSpecimens.length) return;

    const zip = new JSZip();
    const mediaFolder = zip.folder("Media");
    if (!mediaFolder) return;

    const traitNames = Array.from(new Set(allSpecimens.flatMap((specimen) => specimen.assets.map((asset) => asset.layerName))));
    const metadataHeader = ["tokenID", "name", "description", "file_name", "external_url", ...traitNames.map((name) => `attributes[${name}]`)];
    const metadataRows = allSpecimens.map((specimen) => {
      const traits = new Map<string, string>();
      specimen.assets.forEach((asset) => traits.set(asset.layerName, traitValue(asset.name)));
      const description = [
        "Cryogenic Room recovered specimen.",
        `Canvas // ${specimen.width} x ${specimen.height}px.`,
        `DNA Components // ${specimen.assets.map((asset) => asset.name).join(" | ")}.`,
      ].join(" ");
      return [specimen.id, specimenName({ ...specimen, url: "" }), description, `${specimen.id}.png`, "", ...traitNames.map((name) => traits.get(name) || "")];
    });

    zip.file("metadata-file.csv", [metadataHeader, ...metadataRows].map((row) => row.map(csvCell).join(",")).join("\n"));
    zip.file("README.txt", [
      "CRYOGENIC ROOM // OPENSEA METADATA PACKAGE",
      "",
      `Items: ${allSpecimens.length}`,
      "",
      "Media/ contains the PNG files referenced by metadata-file.csv.",
      "metadata-file.csv contains token IDs, names, descriptions, file names, and traits derived from the Phase 1 DNA layers.",
      "",
      "Upload this package through OpenSea's metadata upload flow after your collection contract is ready.",
    ].join("\n"));
    allSpecimens.forEach((specimen) => mediaFolder.file(`${specimen.id}.png`, specimen.blob));

    const blob = await zip.generateAsync({ type: "blob" });
    downloadZipBlob(blob, "Cryogenic-Room-OpenSea-Drop.zip");
  };

  return (
    <main className="lab-shell">
      <div className="scanlines" />
      <header className="lab-header">
        <div className="brand-block"><span className="eyebrow">VΣLOHE SYSTEM // GENERATION BAY</span><h1>CRYOGENIC ROOM</h1><p>PIXEL-ARCADE NFT SPECIMEN GENERATOR</p><nav aria-label="Lab destinations" style={{ display: "flex", gap: 16, marginTop: 6, lineHeight: 1 }}><a href="https://www.cyborgpunks.club/cryogenic-room" target="_top" style={{ color: "#94FDFF", fontSize: 15, letterSpacing: 2, textDecoration: "underline", textUnderlineOffset: 3 }}>VAULT</a><a href="https://opensea.io/CyborgPunky/created" target="_top" style={{ color: "#F389F5", fontSize: 15, letterSpacing: 2, textDecoration: "underline", textUnderlineOffset: 3 }}>OPEN MARKET</a></nav></div>
        <div className="system-panel"><span>CORE SYNC</span><b>ONLINE</b><small>{status}</small><Link className="factory-entry" href="/factory">ENTER THE FACTORY →</Link></div>
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

          {stage === 2 && (
            <section className="module generate-module">
              <div className="module-title">
                <div>
                  <span>LAB MODULE 02</span>
                  <h2>GENERATE</h2>
                  <p>Initiate cryogenic synthesis.</p>
                </div>
              </div>

              <div className="synthesis-core">
                <div className="core-ring"><span>DNA</span></div>
                <div className="readouts">
                  <div><span>ACTIVE LAYERS</span><b>{usableLayers.length}</b></div>
                  <div><span>POSSIBLE COMBINATIONS</span><b>{possible.toLocaleString()}</b></div>
                  {totalSpecimens > 0 && (
                    <div><span>RECOVERED</span><b>{totalSpecimens.toLocaleString()}</b></div>
                  )}
                  {totalSpecimens > 0 && (
                    <div>
                      <span>REMAINING PENDING TO REVIEW</span>
                      <b>{pendingStatsLoading ? "CALCULATING..." : pendingSpecimens.toLocaleString()}</b>
                    </div>
                  )}
                  <div>
                    <span>{totalSpecimens > 0 ? "INTEGRATION COUNT" : "OUTPUT COUNT"}</span>
                    <input
                      type="number"
                      min="1"
                      max={Math.max(1, totalSpecimens > 0 ? pendingSpecimens : possible)}
                      value={amount}
                      onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))}
                      disabled={pendingStatsLoading || !possible || (totalSpecimens > 0 && !pendingSpecimens)}
                    />
                  </div>
                </div>
              </div>

              <div className="synthesis-actions">
                {totalSpecimens === 0 && (
                  <button
                    className="synthesize"
                    disabled={busy || !possible}
                    onClick={() => void generate("new")}
                  >
                    {busy ? "SYNTHESIZING..." : "▶ INITIATE CRYOGENIC SYNTHESIS"}
                  </button>
                )}

                {totalSpecimens > 0 && dnaChanged && (
                  <div className="dna-change-notice">
                    <strong>DNA CONFIGURATION CHANGED</strong>
                    <span>Choose how the active DNA should affect the current preview.</span>
                  </div>
                )}

                {totalSpecimens > 0 && !dnaChanged && (
                  <>
                    <button
                      className="synthesize"
                      disabled={busy || !possible || pendingStatsLoading || !pendingSpecimens}
                      onClick={() => void generate("integrate")}
                    >
                      {busy ? "INTEGRATING..." : "＋ INTEGRATE CRYOGENIC SYNTHESIS"}
                    </button>
                    <button
                      className="ghost wide"
                      disabled={busy || !possible}
                      onClick={() => void generate("new")}
                    >
                      ▶ INITIATE NEW CRYOGENIC SYNTHESIS
                    </button>
                  </>
                )}
              </div>
            </section>
          )}

          {stage === 3 && <section className="module">
            <div className="module-title">
              <div><span>LAB MODULE 03</span><h2>PREVIEW</h2><p>Inspect recovered Cyborg units.</p></div>
              <div className="counter">
                {totalSpecimens}<small>RECOVERED</small>
                {totalSpecimens > 0 && <div className="bulk-downloads"><button onClick={downloadPreviewZip}>↓ PREVIEW .ZIP</button><button onClick={downloadOpenSeaZip}>↓ OPENSEA .ZIP</button></div>}
              </div>
            </div>
            {totalSpecimens === 0 ? <div className="empty">NO SPECIMENS RECOVERED.<br />RUN CRYOGENIC SYNTHESIS.</div> : <>
              <div className="preview-toolbar">
                <button className="danger clear-preview-button" disabled={busy || deletingSpecimenId !== null} onClick={() => setClearPreviewOpen(true)}>× CLEAR PREVIEW</button>
                {selectedSpecimenIds.size > 0 && <div className="selection-actions"><span>{selectedSpecimenIds.size} SELECTED</span><button onClick={selectAllCurrentPage} disabled={busy || deletingSpecimenId !== null}>＋ SELECT ALL</button><button className="ghost" onClick={clearCurrentPageSelection}>CLEAR SELECTION</button><button onClick={() => void downloadSelectedZip()}>↓ DOWNLOAD SELECTED</button><button className="danger" disabled={busy || deletingSpecimenId !== null} onClick={() => void deleteSelected()}>× DELETE SELECTED</button></div>}
                <div><span>DISPLAYING</span><b>{currentRangeStart} — {currentRangeEnd} / {totalSpecimens.toLocaleString()}</b></div>
                <label><span>PER PAGE</span><select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} disabled={busy}>{PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
                <div><span>PREVIEW PAGE</span><b>{page} / {totalPages}</b></div>
              </div>
              <div className="pagination pagination-top"><button className="ghost" disabled={page <= 1} onClick={() => { setSelected(null); setPage((current) => current - 1); }}>← PREVIOUS</button><span>PAGE {page} / {totalPages}</span><button className="ghost" disabled={page >= totalPages} onClick={() => { setSelected(null); setPage((current) => current + 1); }}>NEXT →</button></div>
              <div className="specimen-grid">{specimens.map((specimen) => <article className={`specimen ${deletingSpecimenId === specimen.id ? "specimen-deleting" : ""} ${selectedSpecimenIds.has(specimen.id) ? "specimen-selected" : ""}`} key={specimen.id} onClick={() => { if (deletingSpecimenId === null) setSelected(specimen); }}><button className={`specimen-select ${selectedSpecimenIds.has(specimen.id) ? "active" : ""}`} aria-label={selectedSpecimenIds.has(specimen.id) ? `Deselect specimen ${specimen.id}` : `Select specimen ${specimen.id}`} disabled={deletingSpecimenId !== null} onClick={(e) => { e.stopPropagation(); toggleSpecimenSelection(specimen.id); }}>{selectedSpecimenIds.has(specimen.id) ? "✓" : "+"}</button><div className="specimen-image"><img src={specimen.url} alt={specimenName(specimen)} /></div><div className="specimen-footer"><b>SPECIMEN #{String(specimen.id).padStart(3, "0")}</b><span>{specimen.width} × {specimen.height}px</span></div><button disabled={deletingSpecimenId !== null} onClick={(e) => { e.stopPropagation(); download(specimen); }}>↓ PNG</button><button className="danger specimen-delete-button" disabled={deletingSpecimenId !== null} onClick={(e) => { e.stopPropagation(); void deleteSpecimen(specimen.id); }}>{deletingSpecimenId === specimen.id ? "× DELETING..." : "× DELETE SPECIMEN"}</button></article>)}</div>
              <div className="pagination"><button className="ghost" disabled={page <= 1} onClick={() => { setSelected(null); setPage((current) => current - 1); }}>← PREVIOUS</button><span>PAGE {page} / {totalPages}</span><button className="ghost" disabled={page >= totalPages} onClick={() => { setSelected(null); setPage((current) => current + 1); }}>NEXT →</button></div>
              <nav className="stage-nav stage-nav-bottom" aria-label="Phase navigation">
                <button onClick={() => navigateFromBottom(1)}>01 — BUILD THE DNA</button>
                <button onClick={() => navigateFromBottom(2)}>02 — GENERATE</button>
                <button className="active" onClick={returnToTop}>03 — PREVIEW ↑</button>
              </nav>
            </>}
          </section>}
        </div>
        <aside className="capsule capsule-right"><div className="capsule-glow" /><span>CR-05</span><i>SUBJECT // SYNTHESIS</i></aside>
      </section>

      <footer className="lab-footer"><span>CRYOGENIC ROOM // LOCAL GENERATOR</span><span>PNG ONLY // NO EXTERNAL ASSETS</span><span>VΣLOHE SYSTEM</span></footer>

      {dnaChanged && stage === 2 && <div className="modal-backdrop" onClick={() => {}}><div className="synthesis-choice-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={() => setStage(1)}>×</button>
        <div className="choice-eyebrow">CRYOGENIC SYSTEM // DNA ALTERATION</div>
        <h2>DNA CONFIGURATION CHANGED</h2>
        <p>The active DNA no longer matches the DNA configurations used in the current preview.</p>
        <div className="choice-stats"><span>CURRENT PREVIEW</span><b>{totalSpecimens.toLocaleString()} RECOVERED</b><span>ACTIVE DNA</span><b>{usableLayers.length} LAYERS // {possible.toLocaleString()} POSSIBLE</b></div>
        <p>Would you like to integrate the active DNA into the current preview or initiate a new cryogenic synthesis?</p>
        <div className="choice-actions">
          <button className="synthesize" disabled={busy || pendingStatsLoading || !pendingSpecimens} onClick={() => { setAmount(Math.min(Math.max(amount, 1), pendingSpecimens)); void generate("integrate"); }}>＋ INTEGRATE ACTIVE DNA</button>
          <button className="danger wide" disabled={busy} onClick={() => void generate("new")}>▶ INITIATE NEW SYNTHESIS</button>
        </div>
      </div></div>}

      {clearPreviewOpen && <div className="modal-backdrop" onClick={() => { if (!busy) setClearPreviewOpen(false); }}><div className="synthesis-choice-modal clear-preview-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" disabled={busy} onClick={() => setClearPreviewOpen(false)}>×</button>
        <div className="choice-eyebrow">CRYOGENIC SYSTEM // PREVIEW RESET</div>
        <h2>CLEAR CRYOGENIC PREVIEW?</h2>
        <p>This will permanently remove all recovered specimens from the current workspace and reset the synthesis history.</p>
        <div className="choice-stats">
          <span>RECOVERED SPECIMENS</span><b>{totalSpecimens.toLocaleString()}</b>
          <span>DNA LAYERS</span><b>{layers.length} ACTIVE // PRESERVED</b>
        </div>
        <p>Your uploaded PNG assets and active DNA layers will remain intact. The workspace will return to Phase 2 ready for a new synthesis.</p>
        <div className="choice-actions">
          <button className="ghost wide" disabled={busy} onClick={() => setClearPreviewOpen(false)}>CANCEL</button>
          <button className="danger wide" disabled={busy} onClick={() => void clearPreview()}>{busy ? "CLEARING..." : "× CLEAR PREVIEW"}</button>
        </div>
      </div></div>}

      {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><div className="specimen-modal" onClick={(e) => e.stopPropagation()}><button className="modal-close" onClick={() => setSelected(null)}>×</button><div className="modal-image"><img src={selected.url} alt="" /></div><div className="modal-info"><span>RECOVERY REPORT</span><h2>SPECIMEN #{String(selected.id).padStart(3, "0")}</h2><p>CANVAS // {selected.width} × {selected.height}px</p><h3>DNA COMPONENTS</h3>{selected.assets.map((asset) => <div className="trait" key={asset.id}><span>{asset.name}</span><small>{asset.width} × {asset.height}px</small></div>)}</div></div></div>}
    </main>
  );
}
