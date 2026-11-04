import { deriveKeyFromPin } from '../crypto/kdf';

/**
 * Argon2id off the main thread.
 *
 * A derivation is seconds of pure-JS hashing. Run inline in the background
 * document, it blocks that document's event loop — and every message the
 * popup, vault, or badge sends during those seconds queues behind it, which
 * reads as "the extension is broken". Here the event page stays responsive
 * and answers immediately; only the derivation itself waits.
 */

interface DeriveRequest { id: number; pin: string; salt: Uint8Array }
interface DeriveOk { id: number; key: Uint8Array }
interface DeriveErr { id: number; error: string }

const scope = self as unknown as {
    onmessage: ((e: MessageEvent<DeriveRequest>) => void) | null;
    postMessage: (msg: DeriveOk | DeriveErr) => void;
};

scope.onmessage = (e) => {
    const { id, pin, salt } = e.data;
    try {
        scope.postMessage({ id, key: deriveKeyFromPin(pin, salt) });
    } catch (err) {
        scope.postMessage({ id, error: (err as Error).message });
    }
};
