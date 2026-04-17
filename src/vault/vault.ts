import './vault.css';
import type {
    Identity,
    Credential,
    VaultData,
    VaultSettings,
    VaultSkin,
    Message,
    MessageResponse,
} from '../types';
import {
    generatePassword,
    measurePasswordStrength,
    strengthLabel,
} from '../utils/password-generator';
import { generateIdentity } from '../utils/identity-generator';

/* ====================================================================
   Helpers
   ==================================================================== */

const send = <T>(msg: Message): Promise<MessageResponse & { data?: T }> =>
    chrome.runtime.sendMessage(msg);

const $ = <T extends HTMLElement>(id: string): T | null =>
    document.getElementById(id) as T | null;

const STRENGTH_COLORS = ['#e05555', '#e07b30', '#d9b830', '#7ec86e', '#21b8cc'];

/* ====================================================================
   State
   ==================================================================== */

let vault: VaultData = {
    identities: [],
    credentials: [],
    settings: {
        skin: 'slate',
        autoDetect: true,
        autoFill: false,
        passwordLength: 16,
        passwordComplexity: 'maximum',
    },
};
let activeTab = 'identities';
let identitySearchQuery = '';
let credentialSearchQuery = '';
let selectedIdentityId: string | null = null;

/* ====================================================================
   Tab Navigation
   ==================================================================== */

const switchTab = (tab: string): void => {
    activeTab = tab;
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
    });
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === `tab-${tab}`);
    });
};

/* ====================================================================
   Identities
   ==================================================================== */

const renderIdentities = (): void => {
    const list = $<HTMLDivElement>('identities-list');
    if (!list) return;

    const filtered = vault.identities.filter(i => {
        const q = identitySearchQuery.toLowerCase();
        return (
            !q ||
            i.label.toLowerCase().includes(q) ||
            i.email.toLowerCase().includes(q) ||
            i.username.toLowerCase().includes(q)
        );
    });

    if (filtered.length === 0) {
        list.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
        <div class="empty-state-title">No identities yet</div>
        <div class="empty-state-sub">Click "New Identity" to generate one</div>
      </div>`;

        return;
    }

    list.innerHTML = filtered.map(identity => `
    <div class="identity-card" data-id="${identity.id}" tabindex="0" role="button" aria-label="View ${identity.label}">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div class="identity-card-avatar">${identity.firstName[0] ?? '?'}${identity.lastName[0] ?? '?'}</div>
        <div>
          <div class="identity-card-name">${escHtml(identity.label)}</div>
          <div class="identity-card-email">${escHtml(identity.email)}</div>
        </div>
      </div>
      <div class="identity-card-meta">
        <span class="meta-pill">@${escHtml(identity.username)}</span>
        <span class="meta-pill">${escHtml(identity.address.city)}, ${escHtml(identity.address.country)}</span>
      </div>
      <button class="btn-icon-sm identity-card-delete" data-id="${identity.id}" title="Delete identity" aria-label="Delete identity" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6"/><path d="M14 11v6"/>
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
      </button>
    </div>
  `).join('');

    list.querySelectorAll<HTMLElement>('.identity-card').forEach(card => {
        card.addEventListener('click', e => {
            if ((e.target as HTMLElement).closest('[data-id].btn-icon-sm')) return;
            const id = card.getAttribute('data-id') ?? '';
            openIdentityModal(id);
        });
        card.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                const id = card.getAttribute('data-id') ?? '';
                openIdentityModal(id);
            }
        });
    });

    list.querySelectorAll<HTMLButtonElement>('.identity-card-delete').forEach(btn => {
        btn.addEventListener('click', async e => {
            e.stopPropagation();
            const id = btn.getAttribute('data-id') ?? '';
            await send({ type: 'DELETE_IDENTITY', payload: id });
            vault.identities = vault.identities.filter(i => i.id !== id);
            renderIdentities();
        });
    });
};

/* ====================================================================
   Credentials
   ==================================================================== */

const renderCredentials = (): void => {
    const list = $<HTMLDivElement>('credentials-list');
    if (!list) return;

    const filtered = vault.credentials.filter(c => {
        const q = credentialSearchQuery.toLowerCase();
        return (
            !q ||
            c.siteName.toLowerCase().includes(q) ||
            c.siteUrl.toLowerCase().includes(q) ||
            c.username.toLowerCase().includes(q) ||
            c.email.toLowerCase().includes(q)
        );
    });

    if (filtered.length === 0) {
        list.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <div class="empty-state-title">No saved credentials</div>
        <div class="empty-state-sub">Credentials are saved automatically when you use Auto-fill</div>
      </div>`;

        return;
    }

    list.innerHTML = filtered.map(cred => `
    <div class="credential-row" data-id="${cred.id}">
      <div class="cred-favicon">${(cred.siteName[0] ?? cred.siteUrl[0] ?? '?').toUpperCase()}</div>
      <div class="cred-info">
        <div class="cred-site">${escHtml(cred.siteName || cred.siteUrl)}</div>
        <div class="cred-user">${escHtml(cred.username || cred.email)}</div>
      </div>
      <div class="cred-actions">
        <span class="pw-mask">••••••••</span>
        <button class="btn-icon-sm cred-copy-pw" data-pw="${escHtml(cred.password)}" title="Copy password" aria-label="Copy password" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </button>
        <button class="btn-icon-sm cred-delete" data-id="${cred.id}" title="Delete credential" aria-label="Delete credential" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          </svg>
        </button>
      </div>
    </div>
  `).join('');

    list.querySelectorAll<HTMLButtonElement>('.cred-copy-pw').forEach(btn => {
        btn.addEventListener('click', () => {
            void navigator.clipboard.writeText(btn.getAttribute('data-pw') ?? '');
            btn.style.color = '#21b8cc';
            setTimeout(() => (btn.style.color = ''), 1200);
        });
    });

    list.querySelectorAll<HTMLButtonElement>('.cred-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id') ?? '';
            await send({ type: 'DELETE_CREDENTIAL', payload: id });
            vault.credentials = vault.credentials.filter(c => c.id !== id);
            renderCredentials();
        });
    });
};

/* ====================================================================
   Generator Tab
   ==================================================================== */

let genPassword = '';

const renderGenStrength = (pw: string): void => {
    const bar = $<HTMLDivElement>('gen-strength-bar');
    const label = $<HTMLSpanElement>('gen-strength-label');
    if (!bar || !label) return;

    const score = measurePasswordStrength(pw);
    bar.style.width = `${((score + 1) / 5) * 100}%`;
    bar.style.background = STRENGTH_COLORS[score] ?? '#ccc';
    label.textContent = strengthLabel(score);
};

const refreshGenPassword = (): void => {
    const lengthEl = $<HTMLInputElement>('pw-length');
    const upperEl = $<HTMLInputElement>('pw-upper');
    const lowerEl = $<HTMLInputElement>('pw-lower');
    const numsEl = $<HTMLInputElement>('pw-numbers');
    const symEl = $<HTMLInputElement>('pw-symbols');
    const display = $<HTMLInputElement>('gen-password');

    genPassword = generatePassword({
        length: parseInt(lengthEl?.value ?? '16', 10),
        uppercase: upperEl?.checked ?? true,
        lowercase: lowerEl?.checked ?? true,
        numbers: numsEl?.checked ?? true,
        symbols: symEl?.checked ?? true,
    });

    if (display) display.value = genPassword;
    renderGenStrength(genPassword);
};

const renderIdentityPreview = (identity: Identity): void => {
    const preview = $<HTMLDivElement>('identity-preview');
    if (!preview) return;

    const rows: Array<[string, string]> = [
        ['Name', `${identity.firstName} ${identity.lastName}`],
        ['Email', identity.email],
        ['Username', identity.username],
        ['Phone', identity.phone],
        ['Birthday', identity.birthDate],
        ['Address', `${identity.address.street}, ${identity.address.city}`],
        ['Country', `${identity.address.state}, ${identity.address.country}`],
    ];

    preview.innerHTML = rows.map(([key, val]) => `
    <div class="preview-row">
      <span class="preview-key">${escHtml(key)}</span>
      <span class="preview-val">${escHtml(val)}</span>
    </div>
  `).join('');
};

/* ====================================================================
   Identity Modal
   ==================================================================== */

const openIdentityModal = (id: string): void => {
    const identity = vault.identities.find(i => i.id === id);
    if (!identity) return;

    selectedIdentityId = id;

    const body = $<HTMLDivElement>('modal-body');
    if (!body) return;

    const fields: Array<[string, string]> = [
        ['Label', identity.label],
        ['First Name', identity.firstName],
        ['Last Name', identity.lastName],
        ['Email', identity.email],
        ['Username', identity.username],
        ['Phone', identity.phone],
        ['Birthday', identity.birthDate],
        ['Street', identity.address.street],
        ['City', identity.address.city],
        ['State', identity.address.state],
        ['Country', identity.address.country],
        ['ZIP', identity.address.zipCode],
        ['Created', new Date(identity.createdAt).toLocaleDateString()],
    ];

    body.innerHTML = fields.map(([key, val]) => `
    <div class="modal-field">
      <span class="modal-field-key">${escHtml(key)}</span>
      <span class="modal-field-val">${escHtml(val)}</span>
    </div>
  `).join('');

    const backdrop = $('modal-backdrop');
    if (backdrop) {
        backdrop.classList.remove('hidden');
        backdrop.setAttribute('aria-hidden', 'false');
    }
};

const closeModal = (): void => {
    const backdrop = $('modal-backdrop');
    if (backdrop) {
        backdrop.classList.add('hidden');
        backdrop.setAttribute('aria-hidden', 'true');
    }
    selectedIdentityId = null;
};

/* ====================================================================
   Settings
   ==================================================================== */

const loadSettings = (): void => {
    const s = vault.settings;

    const skinEl = $<HTMLSelectElement>('setting-skin');
    const autoDetEl = $<HTMLInputElement>('setting-autodetect');
    const autoFillEl = $<HTMLInputElement>('setting-autofill');
    const pwLenEl = $<HTMLInputElement>('setting-pw-length');
    const pwLenValEl = $<HTMLSpanElement>('setting-pw-length-val');
    const complexEl = $<HTMLSelectElement>('setting-complexity');

    if (skinEl) skinEl.value = s.skin;
    if (autoDetEl) autoDetEl.checked = s.autoDetect;
    if (autoFillEl) autoFillEl.checked = s.autoFill;
    if (pwLenEl) pwLenEl.value = String(s.passwordLength);
    if (pwLenValEl) pwLenValEl.textContent = String(s.passwordLength);
    if (complexEl) complexEl.value = s.passwordComplexity;

    applySkin(s.skin);
};

const applySkin = (skin: VaultSkin): void => {
    document.documentElement.setAttribute('data-skin', skin);
};

const saveSettings = async (): Promise<void> => {
    const skin = ($<HTMLSelectElement>('setting-skin')?.value ?? 'slate') as VaultSkin;
    const autoDetect = $<HTMLInputElement>('setting-autodetect')?.checked ?? true;
    const autoFill = $<HTMLInputElement>('setting-autofill')?.checked ?? false;
    const passwordLength = parseInt($<HTMLInputElement>('setting-pw-length')?.value ?? '16', 10);
    const passwordComplexity = ($<HTMLSelectElement>('setting-complexity')?.value ?? 'maximum') as VaultSettings['passwordComplexity'];

    const updated: Partial<VaultSettings> = { skin, autoDetect, autoFill, passwordLength, passwordComplexity };
    await send({ type: 'UPDATE_SETTINGS', payload: updated });
    vault.settings = { ...vault.settings, ...updated };
    applySkin(skin);
};

/* ====================================================================
   Bootstrap
   ==================================================================== */

const escHtml = (str: string): string =>
    str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const init = async (): Promise<void> => {
    const resp = await send<VaultData>({ type: 'GET_VAULT' });
    if (resp.data) vault = resp.data;

    applySkin(vault.settings.skin);
    renderIdentities();
    renderCredentials();
    loadSettings();
    refreshGenPassword();

    /* Tab navigation */
    document.querySelectorAll<HTMLButtonElement>('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab') ?? 'identities'));
    });

    /* Identities */
    $('btn-new-identity')?.addEventListener('click', async () => {
        const identity = generateIdentity();
        await send({ type: 'SAVE_IDENTITY', payload: identity });
        vault.identities.unshift(identity);
        renderIdentities();
    });

    $<HTMLInputElement>('search-identities')?.addEventListener('input', e => {
        identitySearchQuery = (e.target as HTMLInputElement).value;
        renderIdentities();
    });

    /* Credentials */
    $<HTMLInputElement>('search-credentials')?.addEventListener('input', e => {
        credentialSearchQuery = (e.target as HTMLInputElement).value;
        renderCredentials();
    });

    /* Generator — password */
    $('gen-refresh-pw')?.addEventListener('click', refreshGenPassword);

    $('gen-copy-pw')?.addEventListener('click', () => {
        void navigator.clipboard.writeText(genPassword);
        const btn = $<HTMLButtonElement>('gen-copy-pw');
        if (!btn) return;
        btn.style.color = '#21b8cc';
        setTimeout(() => (btn.style.color = ''), 1200);
    });

    $<HTMLInputElement>('pw-length')?.addEventListener('input', e => {
        const val = (e.target as HTMLInputElement).value;
        const el = $<HTMLSpanElement>('pw-length-val');
        if (el) el.textContent = val;
        refreshGenPassword();
    });

    (['pw-upper', 'pw-lower', 'pw-numbers', 'pw-symbols'] as const).forEach(id => {
        $<HTMLInputElement>(id)?.addEventListener('change', refreshGenPassword);
    });

    /* Generator — identity */
    $('gen-identity')?.addEventListener('click', async () => {
        const identity = generateIdentity();
        await send({ type: 'SAVE_IDENTITY', payload: identity });
        vault.identities.unshift(identity);
        renderIdentityPreview(identity);
        renderIdentities();
    });

    /* Modal */
    $('modal-close')?.addEventListener('click', closeModal);
    $('modal-close-btn')?.addEventListener('click', closeModal);
    $('modal-backdrop')?.addEventListener('click', e => {
        if (e.target === $('modal-backdrop')) closeModal();
    });

    $('modal-delete')?.addEventListener('click', async () => {
        if (!selectedIdentityId) return;
        await send({ type: 'DELETE_IDENTITY', payload: selectedIdentityId });
        vault.identities = vault.identities.filter(i => i.id !== selectedIdentityId);
        renderIdentities();
        closeModal();
    });

    /* Settings */
    $<HTMLInputElement>('setting-pw-length')?.addEventListener('input', e => {
        const val = (e.target as HTMLInputElement).value;
        const el = $<HTMLSpanElement>('setting-pw-length-val');
        if (el) el.textContent = val;
    });

    $('btn-save-settings')?.addEventListener('click', () => void saveSettings());

    /* Keyboard: Escape closes modal */
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeModal();
    });
};

document.addEventListener('DOMContentLoaded', () => void init());
