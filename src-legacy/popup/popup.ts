import './popup.css';
import type { Identity, Message, MessageResponse, VaultData, VaultSettings, VaultSkin } from '../types';
import { generatePassword, measurePasswordStrength, strengthLabel } from '../utils/password-generator';

const send = <T>(msg: Message): Promise<MessageResponse & { data?: T }> =>
    chrome.runtime.sendMessage(msg);

const $ = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T | null;

const STRENGTH_COLORS = ['#e05555', '#e07b30', '#d9b830', '#7ec86e', '#21b8cc'];

let currentPassword = '';

const renderStrength = (password: string): void => {
    const bar = $<HTMLDivElement>('strength-bar');
    const label = $<HTMLSpanElement>('strength-label');

    if (!bar || !label) return;

    const score = measurePasswordStrength(password);
    const pct = ((score + 1) / 5) * 100;

    bar.style.width = `${pct}%`;
    bar.style.background = STRENGTH_COLORS[score] ?? '#ccc';
    label.textContent = strengthLabel(score);
};

const refreshPassword = (): void => {
    currentPassword = generatePassword({ length: 16, uppercase: true, lowercase: true, numbers: true, symbols: true });
    const display = $<HTMLInputElement>('password-display');
    if (display) display.value = currentPassword;
    renderStrength(currentPassword);
};

const copyPassword = (): void => {
    if (!currentPassword) return;
    void navigator.clipboard.writeText(currentPassword);
    const btn = $<HTMLButtonElement>('btn-copy-pw');
    if (!btn) return;

    btn.style.color = '#21b8cc';
    setTimeout(() => (btn.style.color = ''), 1200);
};

const openVault = (): void => {
    void chrome.tabs.create({ url: chrome.runtime.getURL('vault.html') });
    window.close();
};

const applySkin = (skin: VaultSkin): void => {
    document.documentElement.setAttribute('data-skin', skin);
};

const loadVaultStats = async (): Promise<void> => {
    const resp = await send<VaultData>({ type: 'GET_VAULT' });
    const vault = resp.data;

    const si = $<HTMLSpanElement>('stat-identities');
    const sc = $<HTMLSpanElement>('stat-credentials');

    if (si) si.textContent = String(vault?.identities.length ?? 0);
    if (sc) sc.textContent = String(vault?.credentials.length ?? 0);

    if (vault?.settings.skin) applySkin(vault.settings.skin);
};

const checkCurrentPage = async (): Promise<void> => {
    const banner = $<HTMLElement>('detection-banner');
    const textEl = $<HTMLSpanElement>('detection-text');
    const fillBtn = $<HTMLButtonElement>('btn-fill');

    if (!banner || !textEl) return;

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab?.id) {
            showBanner('none', 'No active tab');
            return;
        }

        const results = await chrome.scripting.executeScript<[], boolean>({
            target: { tabId: tab.id },
            func: () => {
                const inputs = document.querySelectorAll('input[type=password]');
                return inputs.length >= 2;
            },
        });

        const hasDoublePassword = results[0]?.result === true;

        if (hasDoublePassword) {
            showBanner('detected', 'Sign-up form detected on this page');
            if (fillBtn) fillBtn.disabled = false;
        } else {
            showBanner('none', 'No sign-up form detected');
            if (fillBtn) fillBtn.disabled = true;
        }
    } catch {
        banner.classList.add('banner-hidden');
    }
};

const showBanner = (type: 'detected' | 'none', text: string): void => {
    const banner = $<HTMLElement>('detection-banner');
    const textEl = $<HTMLSpanElement>('detection-text');

    if (!banner || !textEl) return;

    banner.className = `banner banner-${type}`;
    textEl.textContent = text;
};

const handleFillClick = async (): Promise<void> => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    const vaultResp = await send<VaultData>({ type: 'GET_VAULT' });
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

    if (!identity) return;

    const password = generatePassword({
        length: settings?.passwordLength ?? 16,
        uppercase: true,
        lowercase: true,
        numbers: true,
        symbols: true,
    });

    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (identityJson: string, pw: string) => {
            const identity = JSON.parse(identityJson) as Record<string, unknown>;
            const inputs = Array.from(
                document.querySelectorAll<HTMLInputElement>(
                    'input:not([type=hidden]):not([type=submit]):not([type=button])',
                ),
            );

            const nativeSet = (el: HTMLInputElement, val: string) => {
                const setter = Object.getOwnPropertyDescriptor(
                    window.HTMLInputElement.prototype, 'value',
                )?.set;
                setter?.call(el, val);
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            };

            for (const inp of inputs) {
                const hint = [inp.name, inp.id, inp.getAttribute('autocomplete') ?? '', inp.getAttribute('placeholder') ?? ''].join(' ').toLowerCase();
                if (/first/.test(hint)) nativeSet(inp, identity['firstName'] as string);
                else if (/last/.test(hint)) nativeSet(inp, identity['lastName'] as string);
                else if (/full.?name|^name$/.test(hint)) nativeSet(inp, `${identity['firstName']} ${identity['lastName']}`);
                else if (/email|e-mail/.test(hint)) nativeSet(inp, identity['email'] as string);
                else if (/user|handle|login/.test(hint)) nativeSet(inp, identity['username'] as string);
                else if (/confirm.*pass|pass.*confirm|repeat.*pass/.test(hint)) nativeSet(inp, pw);
                else if (/pass|pwd/.test(hint) || inp.type === 'password') nativeSet(inp, pw);
                else if (/phone|tel|mobile/.test(hint)) nativeSet(inp, identity['phone'] as string);
                else if (/birth|dob/.test(hint)) nativeSet(inp, identity['birthDate'] as string);
                else if (/street|address/.test(hint)) nativeSet(inp, (identity['address'] as Record<string, string>)['street']);
                else if (/city/.test(hint)) nativeSet(inp, (identity['address'] as Record<string, string>)['city']);
                else if (/state|province/.test(hint)) nativeSet(inp, (identity['address'] as Record<string, string>)['state']);
                else if (/zip|postal/.test(hint)) nativeSet(inp, (identity['address'] as Record<string, string>)['zipCode']);
            }
        },
        args: [JSON.stringify(identity), password],
    });

    window.close();
};

const handleGenerateClick = async (): Promise<void> => {
    await send<Identity>({ type: 'GENERATE_IDENTITY' });
    await loadVaultStats();
};

document.addEventListener('DOMContentLoaded', () => {
    refreshPassword();
    void loadVaultStats();
    void checkCurrentPage();

    $('btn-open-vault')?.addEventListener('click', openVault);
    $('btn-copy-pw')?.addEventListener('click', copyPassword);
    $('btn-refresh-pw')?.addEventListener('click', refreshPassword);
    $('btn-fill')?.addEventListener('click', () => void handleFillClick());
    $('btn-generate')?.addEventListener('click', () => void handleGenerateClick());
});
