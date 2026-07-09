import { generateKemKeyPair, generateSigKeyPair, kemKeyPairToBase64, sigKeyPairToBase64, kemKeyPairFromBase64, sigKeyPairFromBase64, toBase64, fromBase64 } from './pqc';
import { generateSymmetricKey, encrypt, decrypt } from './symmetric';
import { deriveKeyFromPin, generateSalt, saltToBase64, saltFromBase64 } from './kdf';
import type { KeychainState, PQCKeyPairBase64 } from '../types';

const STORAGE_KEY = 'vw_keychain';
const WRAPPED_MASTER_KEY_KEY = 'vw_wrapped_master_key';
const SALT_KEY = 'vw_pin_salt';

export async function initKeychain(): Promise<{
    kemKeyPair: PQCKeyPairBase64;
    sigKeyPair: PQCKeyPairBase64;
    masterKey: Uint8Array;
}> {
    const kemKp = generateKemKeyPair();
    const sigKp = generateSigKeyPair();
    const masterKey = generateSymmetricKey();

    const state: KeychainState = {
        kemKeyPair: kemKeyPairToBase64(kemKp),
        sigKeyPair: sigKeyPairToBase64(sigKp),
        masterKey: null,
        deviceId: null,
    };

    await chrome.storage.local.set({ [STORAGE_KEY]: state });
    return {
        kemKeyPair: state.kemKeyPair!,
        sigKeyPair: state.sigKeyPair!,
        masterKey,
    };
}

export async function wrapAndStoreMasterKey(
    masterKey: Uint8Array,
    pin: string,
): Promise<void> {
    const salt = generateSalt();
    const derivedKey = deriveKeyFromPin(pin, salt);

    const { ciphertext, nonce } = encrypt(masterKey, derivedKey);

    await chrome.storage.local.set({
        [WRAPPED_MASTER_KEY_KEY]: {
            ciphertext: toBase64(ciphertext),
            nonce: toBase64(nonce),
        },
        [SALT_KEY]: saltToBase64(salt),
    });
}

export async function unwrapMasterKey(pin: string): Promise<Uint8Array | null> {
    const result = await chrome.storage.local.get([WRAPPED_MASTER_KEY_KEY, SALT_KEY]) as Record<string, any>;
    const wrapped = result[WRAPPED_MASTER_KEY_KEY] as { ciphertext: string; nonce: string } | undefined;
    const saltB64 = result[SALT_KEY] as string | undefined;

    if (!wrapped || !saltB64) return null;

    const salt = saltFromBase64(saltB64);
    const derivedKey = deriveKeyFromPin(pin, salt);

    const ciphertext = fromBase64(wrapped.ciphertext);
    const nonce = fromBase64(wrapped.nonce);

    try {
        return decrypt(ciphertext, nonce, derivedKey);
    } catch {
        return null;
    }
}

export async function getKeychain(): Promise<KeychainState | null> {
    const result = await chrome.storage.local.get(STORAGE_KEY) as Record<string, any>;
    return (result[STORAGE_KEY] as KeychainState) ?? null;
}

export async function setDeviceId(deviceId: string): Promise<void> {
    const state = await getKeychain();
    if (state) {
        state.deviceId = deviceId;
        await chrome.storage.local.set({ [STORAGE_KEY]: state });
    }
}

export async function getKemSecretKey(): Promise<Uint8Array | null> {
    const state = await getKeychain();
    if (!state?.kemKeyPair) return null;
    return kemKeyPairFromBase64(state.kemKeyPair).secretKey;
}

export async function getSigKeyPair(): Promise<{ publicKey: Uint8Array; secretKey: Uint8Array } | null> {
    const state = await getKeychain();
    if (!state?.sigKeyPair) return null;
    const kp = sigKeyPairFromBase64(state.sigKeyPair);
    return kp;
}

export async function getKemPublicKey(): Promise<Uint8Array | null> {
    const state = await getKeychain();
    if (!state?.kemKeyPair) return null;
    return kemKeyPairFromBase64(state.kemKeyPair).publicKey;
}

export async function clearKeychain(): Promise<void> {
    await chrome.storage.local.remove([STORAGE_KEY, WRAPPED_MASTER_KEY_KEY, SALT_KEY]);
}

export async function isInitialized(): Promise<boolean> {
    const state = await getKeychain();
    return state !== null;
}

let cachedMasterKey: Uint8Array | null = null;
const SESSION_KEY = 'vw_session_master_key';

export async function setCachedMasterKey(key: Uint8Array | null): Promise<void> {
    cachedMasterKey = key;
    if (key) {
        try {
            await chrome.storage.session.set({ [SESSION_KEY]: toBase64(key) });
        } catch {
            // chrome.storage.session may not be available in all contexts
        }
    } else {
        try {
            await chrome.storage.session.remove(SESSION_KEY);
        } catch {
            // ignore
        }
    }
}

export async function getCachedMasterKey(): Promise<Uint8Array | null> {
    if (cachedMasterKey) return cachedMasterKey;
    try {
        const result = await chrome.storage.session.get(SESSION_KEY) as Record<string, any>;
        const stored = result[SESSION_KEY] as string | undefined;
        if (stored) {
            cachedMasterKey = fromBase64(stored);
            return cachedMasterKey;
        }
    } catch {
        // ignore
    }
    return null;
}
