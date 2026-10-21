import type { Item } from "./types";

const DB = "ir-renamer";
const ITEMS = "items";
const META = "meta";

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore(ITEMS, { keyPath: "id" });
      r.result.createObjectStore(META);
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

const done = (tx: IDBTransaction) =>
  new Promise<void>((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = tx.onabort = () => rej(tx.error);
  });

/** Load the last session (items in their saved order). Returns [] if nothing is saved or storage is blocked. */
export async function loadSession(): Promise<Item[]> {
  try {
    const db = await open();
    const tx = db.transaction([ITEMS, META], "readonly");
    const all = tx.objectStore(ITEMS).getAll();
    const order = tx.objectStore(META).get("order");
    await done(tx);
    const byId = new Map((all.result as Item[]).map((i) => [i.id, i]));
    const ids: string[] = order.result ?? [];
    return ids.map((id) => byId.get(id)).filter((i): i is Item => !!i);
  } catch {
    return [];
  }
}

/** Save only what changed since `prev`, so edits stay cheap even with many large PDFs. */
export async function saveSession(items: Item[], prev: Map<string, Item>): Promise<Map<string, Item>> {
  try {
    const db = await open();
    const tx = db.transaction([ITEMS, META], "readwrite");
    const st = tx.objectStore(ITEMS);
    const next = new Map<string, Item>();
    for (const it of items) {
      next.set(it.id, it);
      if (prev.get(it.id) !== it) st.put(it);
    }
    for (const id of prev.keys()) if (!next.has(id)) st.delete(id);
    tx.objectStore(META).put(items.map((i) => i.id), "order");
    await done(tx);
    return next;
  } catch {
    return prev;
  }
}

export async function clearSession(): Promise<void> {
  try {
    const db = await open();
    const tx = db.transaction([ITEMS, META], "readwrite");
    tx.objectStore(ITEMS).clear();
    tx.objectStore(META).clear();
    await done(tx);
  } catch {
    /* ignore */
  }
}
