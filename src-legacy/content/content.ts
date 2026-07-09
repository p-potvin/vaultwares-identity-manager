import './content.css';
import type { Identity, Message, MessageResponse, VaultSettings } from '../types';
import { detectSignupForm } from '../utils/form-detector';
import { fillForm } from '../utils/form-filler';
import { generatePassword } from '../utils/password-generator';
import { normalizeDomain } from '../utils/domain';

const TOAST_ID = 'vw-autosignup-toast';
const FILL_BTN_ID = 'vw-autosignup-fill-btn';
const DISMISS_BTN_ID = 'vw-autosignup-dismiss-btn';

let detectionResult = detectSignupForm();
let toastVisible = false;

const send = <T>(msg: Message): Promise<MessageResponse & { data?: T }> =>
    chrome.runtime.sendMessage(msg);

const removeToast = (): void => {
    document.getElementById(TOAST_ID)?.remove();
    toastVisible = false;
};

const escText = (s: string): string =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const showToast = (): void => {
    if (toastVisible || document.getElementById(TOAST_ID)) return;

    toastVisible = true;

    const domain = escText(normalizeDomain(location.href));

    const toast = document.createElement('div');
    toast.id = TOAST_ID;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.innerHTML = `
    <div class="vw-toast-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    </div>
    <div class="vw-toast-content">
      <span class="vw-toast-title">Sign-up form detected</span>
      <span class="vw-toast-subtitle">Generate a fictional identity for ${domain}</span>
    </div>
    <button id="${FILL_BTN_ID}" class="vw-toast-btn vw-toast-btn-primary" type="button">Auto-fill</button>
    <button id="${DISMISS_BTN_ID}" class="vw-toast-btn vw-toast-btn-ghost" type="button" aria-label="Dismiss">✕</button>
  `;

    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('vw-toast-visible'));

    document.getElementById(FILL_BTN_ID)?.addEventListener('click', handleFill);
    document.getElementById(DISMISS_BTN_ID)?.addEventListener('click', removeToast);

    setTimeout(removeToast, 15000);
};

const handleFill = async (): Promise<void> => {
    const fillBtn = document.getElementById(FILL_BTN_ID) as HTMLButtonElement | null;

    if (fillBtn) {
        fillBtn.textContent = 'Filling…';
        fillBtn.disabled = true;
    }

    try {
        const vaultResp = await send<{ identities: Identity[] }>({ type: 'GET_VAULT' });
        const settingsResp = await send<VaultSettings>({ type: 'GET_SETTINGS' });

        const vault = vaultResp.data;
        const settings = settingsResp.data;

        let identity: Identity | undefined;

        if (vault && vault.identities.length > 0) {
            const defaultId = settings?.defaultIdentityId;
            identity = defaultId
                ? vault.identities.find(i => i.id === defaultId) ?? vault.identities[0]
                : vault.identities[0];
        } else {
            const genResp = await send<Identity>({ type: 'GENERATE_IDENTITY' });
            identity = genResp.data;
        }

        if (!identity) {
            removeToast();
            return;
        }

        const password = generatePassword({
            length: settings?.passwordLength ?? 16,
            uppercase: true,
            lowercase: true,
            numbers: true,
            symbols: true,
        });

        detectionResult = detectSignupForm();
        const filled = fillForm(detectionResult.fields, identity, password);

        if (filled > 0) {
            showSuccessToast(identity, password);
        }
    } catch {
        removeToast();
    }
};

const showSuccessToast = (identity: Identity, password: string): void => {
    removeToast();

    const toast = document.createElement('div');
    toast.id = TOAST_ID;
    toast.setAttribute('role', 'status');
    toast.innerHTML = `
    <div class="vw-toast-icon vw-toast-icon-success">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    </div>
    <div class="vw-toast-content">
      <span class="vw-toast-title">Form filled!</span>
      <span class="vw-toast-subtitle">${identity.firstName} ${identity.lastName} · Password saved to vault</span>
    </div>
    <button id="${DISMISS_BTN_ID}" class="vw-toast-btn vw-toast-btn-ghost" type="button" aria-label="Dismiss">✕</button>
  `;

    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('vw-toast-visible'));

    document.getElementById(DISMISS_BTN_ID)?.addEventListener('click', removeToast);

    const credential = {
        id: crypto.randomUUID(),
        siteUrl: normalizeDomain(location.href),
        siteName: document.title || normalizeDomain(location.href),
        username: identity.username,
        email: identity.email,
        password,
        identityId: identity.id,
        notes: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };

    void send({ type: 'SAVE_CREDENTIAL', payload: credential });

    setTimeout(removeToast, 6000);
};

const init = (): void => {
    send<VaultSettings>({ type: 'GET_SETTINGS' })
        .then(resp => {
            const settings = resp.data;

            if (!settings?.autoDetect) return;

            if (detectionResult.detected) {
                showToast();
            }
        })
        .catch(() => {
            if (detectionResult.detected) showToast();
        });
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
