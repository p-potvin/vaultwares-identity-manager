import { deriveKeyFromPin } from './kdf';

/**
 * Client side of the KDF worker: derive a PIN key without blocking the
 * background document's event loop.
 *
 * A dedicated worker exists in the Firefox event page and in current Chrome
 * extension service workers; anywhere else — the PWA, tests, an engine that
 * refuses to spawn one — the derivation falls back to running inline, exactly
 * as it did before this module existed. A worker that fails to load rejects
 * its pending jobs rather than hanging them, and the next caller goes inline.
 */

interface DeriveOk { id: number; key: Uint8Array }
interface DeriveErr { id: number; error: string }

let worker: Worker | null | undefined;
const jobs = new Map<number, { resolve: (key: Uint8Array) => void; reject: (e: Error) => void }>();
let seq = 0;

function failAll(message: string): void {
    for (const job of jobs.values()) job.reject(new Error(message));
    jobs.clear();
}

function getWorker(): Worker | null {
    if (worker !== undefined) return worker;
    try {
        if (typeof Worker === 'undefined' || typeof chrome === 'undefined' || !chrome.runtime?.getURL) {
            worker = null;
            return worker;
        }
        const w = new Worker(chrome.runtime.getURL('kdf-worker.js'));
        w.onmessage = (e: MessageEvent<DeriveOk | DeriveErr>) => {
            const job = jobs.get(e.data.id);
            if (!job) return;
            jobs.delete(e.data.id);
            if ('error' in e.data) job.reject(new Error(e.data.error));
            else job.resolve(e.data.key);
        };
        w.onerror = (e) => {
            failAll(e.message || 'KDF worker failed to load');
            try { w.terminate(); } catch { /* already gone */ }
            worker = null;
        };
        worker = w;
        return worker;
    } catch {
        worker = null;
        return worker;
    }
}

export function deriveKeyFromPinAsync(pin: string, salt: Uint8Array): Promise<Uint8Array> {
    const w = getWorker();
    if (!w) return Promise.resolve(deriveKeyFromPin(pin, salt));
    const id = ++seq;
    return new Promise((resolve, reject) => {
        jobs.set(id, { resolve, reject });
        w.postMessage({ id, pin, salt });
    });
}
