import { generateKemKeyPair, generateSigKeyPair, toBase64, fromBase64 } from './pqc';
import { generateSymmetricKey, encrypt, decrypt } from './symmetric';
import { deriveKeyFromPin, generateSalt, saltToBase64, saltFromBase64 } from './kdf';
import type { KeychainState, EncBlob } from '../types';
import { localStore, sessionStore } from '../platform/store';

/**
 * Key hierarchy:
 *
 *     PIN --Argon2id(salt)--> pin key --unwraps--> master key
 *     master key --decrypts--> account KEM + signing secret keys
 *     account KEM secret --opens--> vault item envelopes
 *
 * Only public keys and ciphertext are ever written to local storage, so reading
 * it — extension storage or the PWA's IndexedDB — does not disclose the vault.
 * Secret keys exist in cleartext only in memory, and only while unlocked.
 */

const STORAGE_KEY = 'vw_keychain';
const WRAPPED_MASTER_KEY_KEY = 'vw_wrapped_master_key';
const SALT_KEY = 'vw_pin_salt';

function toEncBlob(res: { ciphertext: Uint8Array; nonce: Uint8Array }): EncBlob {
    return { ciphertext: toBase64(res.ciphertext), nonce: toBase64(res.nonce) };
}

function openEncBlob(blob: EncBlob, key: Uint8Array): Uint8Array {
    return decrypt(fromBase64(blob.ciphertext), fromBase64(blob.nonce), key);
}

export async function initKeychain(): Promise<{
    kemPublicKey: string;
    sigPublicKey: string;
    masterKey: Uint8Array;
}> {
    const kemKp = generateKemKeyPair();
    const sigKp = generateSigKeyPair();
    const masterKey = generateSymmetricKey();

    const state: KeychainState = {
        kemPublicKey: toBase64(kemKp.publicKey),
        sigPublicKey: toBase64(sigKp.publicKey),
        kemSecretKeyEnc: toEncBlob(encrypt(kemKp.secretKey, masterKey)),
        sigSecretKeyEnc: toEncBlob(encrypt(sigKp.secretKey, masterKey)),
        deviceId: null,
    };

    await localStore.set({ [STORAGE_KEY]: state });
    return {
        kemPublicKey: state.kemPublicKey!,
        sigPublicKey: state.sigPublicKey!,
        masterKey,
    };
}

export async function wrapAndStoreMasterKey(masterKey: Uint8Array, pin: string): Promise<void> {
    const salt = generateSalt();
    const derivedKey = deriveKeyFromPin(pin, salt);
    const { ciphertext, nonce } = encrypt(masterKey, derivedKey);

    await localStore.set({
        [WRAPPED_MASTER_KEY_KEY]: { ciphertext: toBase64(ciphertext), nonce: toBase64(nonce) },
        [SALT_KEY]: saltToBase64(salt),
    });
}

export async function unwrapMasterKey(pin: string): Promise<Uint8Array | null> {
    const result = await localStore.get([WRAPPED_MASTER_KEY_KEY, SALT_KEY]) as Record<string, any>;
    const wrapped = result[WRAPPED_MASTER_KEY_KEY] as EncBlob | undefined;
    const saltB64 = result[SALT_KEY] as string | undefined;
    if (!wrapped || !saltB64) return null;

    const derivedKey = deriveKeyFromPin(pin, saltFromBase64(saltB64));
    try {
        return openEncBlob(wrapped, derivedKey);
    } catch {
        return null; // wrong PIN
    }
}

export async function getKeychain(): Promise<KeychainState | null> {
    const result = await localStore.get(STORAGE_KEY) as Record<string, any>;
    return (result[STORAGE_KEY] as KeychainState) ?? null;
}

export async function setDeviceId(deviceId: string): Promise<void> {
    const state = await getKeychain();
    if (state) {
        state.deviceId = deviceId;
        await localStore.set({ [STORAGE_KEY]: state });
    }
}

/** Requires an unlocked vault: the secret key is encrypted under the master key. */
export async function getKemSecretKey(): Promise<Uint8Array | null> {
    const state = await getKeychain();
    if (!state?.kemSecretKeyEnc) return null;
    const masterKey = await getCachedMasterKey();
    if (!masterKey) return null; // locked
    try {
        return openEncBlob(state.kemSecretKeyEnc, masterKey);
    } catch {
        return null;
    }
}

/** Requires an unlocked vault (the secret half is encrypted under the master key). */
export async function getSigKeyPair(): Promise<{ publicKey: Uint8Array; secretKey: Uint8Array } | null> {
    const state = await getKeychain();
    if (!state?.sigSecretKeyEnc || !state.sigPublicKey) return null;
    const masterKey = await getCachedMasterKey();
    if (!masterKey) return null; // locked
    try {
        return {
            publicKey: fromBase64(state.sigPublicKey),
            secretKey: openEncBlob(state.sigSecretKeyEnc, masterKey),
        };
    } catch {
        return null;
    }
}

/** Public key — available while locked. */
export async function getKemPublicKey(): Promise<Uint8Array | null> {
    const state = await getKeychain();
    if (!state?.kemPublicKey) return null;
    return fromBase64(state.kemPublicKey);
}

export async function clearKeychain(): Promise<void> {
    await localStore.remove([STORAGE_KEY, WRAPPED_MASTER_KEY_KEY, SALT_KEY]);
    await setCachedMasterKey(null);
}

export async function isInitialized(): Promise<boolean> {
    const state = await getKeychain();
    return state !== null;
}

let cachedMasterKey: Uint8Array | null = null;
const SESSION_KEY = 'vw_session_master_key';
const LOCK_AT_KEY = 'vw_session_lock_at';

/** Epoch ms after which the cached key is discarded; null means no auto-lock. */
let lockAt: number | null = null;
const lockListeners: Array<() => void> = [];

/** Called whenever the cached key is dropped, by an explicit lock or a deadline. */
export function onMasterKeyCleared(listener: () => void): void {
    lockListeners.push(listener);
}

/**
 * Sets when the vault auto-locks.
 *
 * A deadline, not a timer. The extension's background is an MV3 service worker
 * that the browser evicts after ~30s idle, taking any `setTimeout` with it —
 * while the master key survives in `chrome.storage.session`. A timer-based
 * auto-lock therefore never fired once the worker had slept, and the vault
 * stayed open until the browser closed. The deadline is persisted next to the
 * key and checked on every read, so it holds across evictions.
 */
export async function setLockDeadline(at: number | null): Promise<void> {
    lockAt = at;
    try {
        if (at === null) await sessionStore.remove(LOCK_AT_KEY);
        else await sessionStore.set({ [LOCK_AT_KEY]: at });
    } catch {
        // the session area may not be available in every context
    }
}

function clearCachedKeyState(): void {
    const wasUnlocked = cachedMasterKey !== null;
    cachedMasterKey = null;
    lockAt = null;
    if (wasUnlocked) for (const listener of lockListeners) listener();
}

export async function setCachedMasterKey(key: Uint8Array | null): Promise<void> {
    if (key) cachedMasterKey = key;
    else clearCachedKeyState();
    if (key) {
        try {
            // The session area is in-memory on both platforms: chrome.storage.session
            // in the extension, a plain Map in the PWA. Never disk.
            await sessionStore.set({ [SESSION_KEY]: toBase64(key) });
        } catch {
            // the session area may not be available in every context
        }
    } else {
        try {
            await sessionStore.remove([SESSION_KEY, LOCK_AT_KEY]);
        } catch {
            // ignore
        }
    }
}

export async function getCachedMasterKey(): Promise<Uint8Array | null> {
    if (cachedMasterKey) {
        if (lockAt !== null && Date.now() >= lockAt) {
            await setCachedMasterKey(null);
            return null;
        }
        return cachedMasterKey;
    }
    try {
        const result = await sessionStore.get([SESSION_KEY, LOCK_AT_KEY]) as Record<string, any>;
        const stored = result[SESSION_KEY] as string | undefined;
        const storedLockAt = result[LOCK_AT_KEY] as number | undefined;
        if (stored) {
            // Woken after an eviction: honour the deadline set before it.
            if (typeof storedLockAt === 'number' && Date.now() >= storedLockAt) {
                await setCachedMasterKey(null);
                return null;
            }
            cachedMasterKey = fromBase64(stored);
            lockAt = typeof storedLockAt === 'number' ? storedLockAt : null;
            return cachedMasterKey;
        }
    } catch {
        // ignore
    }
    return null;
}
