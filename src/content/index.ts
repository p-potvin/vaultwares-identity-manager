/**
 * Page agent: detects credential forms, offers vault entries, fills them, and
 * offers to save what the user submits.
 *
 * Runs at document_idle in the isolated world. The passkey authenticator is a
 * separate pair of scripts (`webauthn-inject` / `webauthn-bridge`) because it
 * has to be in place at document_start.
 */

import {
    detectForms,
    formForElement,
    fillForm,
    fillField,
    isVisible,
    isSearchOrNonAuthField,
    type DetectedForm,
    type DetectedField,
    type FieldRole,
} from './detect';
import { showMenu, closeMenu, isMenuOpen, isAnchorAlive } from './menu';
import { showSavePrompt } from './save-prompt';
import { showTotpSlidePrompt, dismissTotpSlidePrompt } from './totp-prompt';
import { t } from '../i18n/strings';
// Static: a dynamic import() from a content script loads its chunk with a
// <script> tag, which runs in the page's world rather than this one.
import { generateFromPreset, PRESETS } from '../utils/password-generator';
import { generateTotpCode } from '../utils/totp';

function currentTotp(secret: string, options?: Parameters<typeof generateTotpCode>[1]): string {
    try {
        return generateTotpCode(secret, options);
    } catch {
        return '';
    }
}
import { loginIdentifier } from '../types';
import type { VaultItem, LoginItem, CardItem, AddressItem, TotpItem, PasskeyItem, VaultSettings, Identity } from '../types';

interface IdentifierSuggestion {
    value: string;
    kind: 'email' | 'username';
    uses: number;
    lastUsedAt: string | null;
}

interface PageIdentity {
    identity: Identity;
    linkedToDomain: boolean;
}

const RESCAN_DEBOUNCE_MS = 300;
const PROACTIVE_DELAY_MS = 700;

/** Roles worth opening the menu for when focused. */
const TRIGGER_ROLES: ReadonlySet<FieldRole> = new Set<FieldRole>([
    'username', 'email', 'password', 'newPassword', 'totp', 'cardNumber',
]);

interface PendingSaveDecision {
    status: 'new' | 'existing' | 'locked';
    itemId?: string;
    samePassword?: boolean;
}

function send<T>(type: string, payload?: unknown): Promise<{ success: boolean; data?: T; error?: string; locked?: boolean }> {
    return new Promise(resolve => {
        chrome.runtime.sendMessage({ type, payload }, response => {
            if (chrome.runtime.lastError) {
                resolve({ success: false, error: chrome.runtime.lastError.message });
                return;
            }
            resolve(response ?? { success: false, error: 'No response' });
        });
    });
}

/* ------------------------------------------------------------------ state */

let settings: VaultSettings | null = null;
let forms: DetectedForm[] = [];
const wiredFields = new WeakSet<HTMLInputElement>();
let proactiveShown = false;

/* ---------------------------------------------------------------- filling */

function fillDataForItem(item: VaultItem): Partial<Record<FieldRole, string>> {
    switch (item.itemType) {
        case 'login': {
            const login = item.data as LoginItem;
            // A site may label its single identifier field either way, so each
            // role falls back to whichever value exists.
            const email = login.email || (login.username?.includes('@') ? login.username : '');
            const username = login.username || login.email || '';
            return {
                username,
                email: email || username,
                password: login.password || '',
                newPassword: login.password || '',
                // The current code, never the secret: the secret used to be
                // typed into the site's one-time-code box, handing the page the
                // seed for every future code.
                totp: login.totpSecret ? currentTotp(login.totpSecret) : '',
            };
        }
        case 'totp': {
            const totp = item.data as TotpItem;
            return {
                totp: currentTotp(totp.secret, { digits: totp.digits, period: totp.period, algorithm: totp.algorithm }),
            };
        }
        case 'card': {
            const card = item.data as CardItem;
            return {
                cardNumber: card.cardNumber || '',
                cardHolder: card.holderName || '',
                cvv: card.cvv || '',
                expiry: card.expiryMonth && card.expiryYear
                    ? `${card.expiryMonth}/${card.expiryYear}`
                    : '',
            };
        }
        case 'address': {
            const address = item.data as AddressItem;
            return {
                fullName: address.fullName || '',
                street: address.street || '',
                city: address.city || '',
                state: address.state || '',
                zipCode: address.zipCode || '',
                country: address.country || '',
                phone: address.phone || '',
            };
        }
        default:
            return {};
    }
}

/**
 * Fills a verification-code input, handling both a single field and the
 * split 4-8 box pattern many sites use for 2FA.
 */
function fillTotpIntoField(field: DetectedField, code: string): void {
    const element = field.element;
    const parent = element.parentElement;
    const siblings = parent
        ? Array.from(parent.querySelectorAll<HTMLInputElement>('input')).filter(
            i => i.maxLength === 1 || i.size === 1,
        )
        : [];

    if (siblings.length >= 4 && siblings.includes(element)) {
        for (let i = 0; i < Math.min(siblings.length, code.length); i++) {
            fillField(siblings[i], code[i]);
        }
        siblings[Math.min(siblings.length - 1, code.length - 1)]?.focus();
    } else {
        fillField(element, code);
        element.focus();
    }
}

/**
 * A persona fills the who-are-you fields: name, contact, address. It carries no
 * password, so a login form still needs a login item — but the email is offered
 * as the identifier, which is what a persona is normally signed up with.
 */
function fillDataForIdentity(identity: Identity): Partial<Record<FieldRole, string>> {
    const [firstName = '', ...rest] = identity.fullName.trim().split(/\s+/);
    const address = identity.address ?? ({} as AddressItem);

    return {
        fullName: identity.fullName,
        firstName,
        lastName: rest.join(' '),
        email: identity.email || '',
        username: identity.email || '',
        phone: identity.phone || address.phone || '',
        birthDate: identity.birthDate || '',
        street: address.street || '',
        city: address.city || '',
        state: address.state || '',
        zipCode: address.zipCode || '',
        country: address.country || '',
    };
}

function subtitleFor(item: VaultItem): string {
    switch (item.itemType) {
        case 'login': return loginIdentifier(item.data as LoginItem);
        case 'card': return `•••• ${(item.data as CardItem).cardNumber.slice(-4)}`;
        case 'address': return (item.data as AddressItem).city || '';
        case 'passkey': return (item.data as PasskeyItem).userName || (item.data as PasskeyItem).rpId;
        default: return '';
    }
}

/* ------------------------------------------------------------------- menu */

/** Roles a persona can fill; used to decide whether to offer identities. */
const IDENTITY_ROLES: ReadonlySet<FieldRole> = new Set<FieldRole>([
    'fullName', 'firstName', 'lastName', 'phone', 'birthDate',
    'street', 'city', 'state', 'zipCode', 'country',
]);

async function openMenuFor(field: DetectedField): Promise<void> {
    if (isSearchOrNonAuthField(field.element)) return;

    // If forms cache is empty, rescan once before giving up
    if (forms.length === 0) {
        forms = detectForms();
    }

    const form = formForElement(forms, field.element);
    if (!form || form.kind === 'none') return;

    // Sign-up forms get the addresses the user already uses elsewhere: there is
    // no saved login to fill yet, but people reuse a handful of identifiers.
    const wantsIdentifierSuggestions = form.kind === 'signup'
        && (field.role === 'email' || field.role === 'username');

    const [response, identityResponse, suggestionResponse] = await Promise.all([
        send<VaultItem[]>('GET_PAGE_MATCHES', { url: window.location.href }),
        send<PageIdentity[]>('GET_PAGE_IDENTITIES', { url: window.location.href }),
        wantsIdentifierSuggestions
            ? send<IdentifierSuggestion[]>('GET_IDENTIFIER_SUGGESTIONS')
            : Promise.resolve({ success: true, data: [] as IdentifierSuggestion[] }),
    ]);
    const matches = response.data ?? [];

    // If this field is a TOTP field, check if we have matching logins with TOTP or standalone TOTP items
    if (field.role === 'totp') {
        const itemWithTotp = matches.find(item =>
            (item.itemType === 'login' && Boolean((item.data as LoginItem).totpSecret)) ||
            item.itemType === 'totp'
        );
        if (itemWithTotp) {
            const secret = itemWithTotp.itemType === 'totp'
                ? (itemWithTotp.data as TotpItem).secret
                : (itemWithTotp.data as LoginItem).totpSecret!;
            const totpData = itemWithTotp.itemType === 'totp' ? (itemWithTotp.data as TotpItem) : null;
            const accountLabel = itemWithTotp.metadata.label + (itemWithTotp.itemType === 'login' && (itemWithTotp.data as LoginItem).username ? ` (${(itemWithTotp.data as LoginItem).username})` : '');

            showTotpSlidePrompt({
                accountLabel,
                secret,
                digits: totpData?.digits ?? 6,
                period: totpData?.period ?? 30,
                algorithm: totpData?.algorithm ?? 'SHA1',
                onFill: (code) => {
                    fillTotpIntoField(field, code);
                    void send('UPDATE_ITEM_LAST_USED', { itemId: itemWithTotp.id });
                },
            });
            return;
        }
    }

    // Offer personas where the form actually has fields for one — a sign-up or
    // checkout form — rather than on a bare username/password pair.
    const formWantsIdentity = form.fields.some(f => IDENTITY_ROLES.has(f.role));
    const identities = formWantsIdentity ? (identityResponse.data ?? []) : [];

    const passkeys = matches.filter(item => item.itemType === 'passkey');
    const logins = matches.filter(item => item.itemType === 'login');

    // Standalone passkeys that don't correspond to any login item
    const standalonePasskeys = passkeys.filter(pk => {
        const pkData = pk.data as PasskeyItem;
        const pkUser = (pkData.userName || '').trim().toLowerCase();
        return !logins.some(lg => {
            const lgData = lg.data as LoginItem;
            const lgUser = (lgData.username || lgData.email || '').trim().toLowerCase();
            return pkUser && lgUser && pkUser === lgUser;
        });
    });

    const fillable = [...logins, ...matches.filter(item => item.itemType !== 'login' && item.itemType !== 'passkey'), ...standalonePasskeys];

    // Most recently used first. The background returns matches ranked by how
    // closely the host matches, and the sort is stable, so never-used items
    // keep that order. Grouping by identity first used to break the recency
    // order, and its group header was the item label's first word rather than
    // the identity's name.
    const ordered = [...fillable].sort((a, b) =>
        (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? ''));
    const identityNames = new Map(
        (identityResponse.data ?? []).map(({ identity }) => [identity.id, identity.fullName || identity.email]),
    );

    const identityEntries = identities.map(({ identity, linkedToDomain }) => ({
        id: `identity:${identity.id}`,
        label: identity.fullName || identity.email,
        sublabel: [identity.email, identity.address?.city].filter(Boolean).join(' · '),
        badge: linkedToDomain ? t('menuLinkedBadge') : undefined,
        group: t('menuIdentitiesGroup'),
        onChoose: () => {
            fillForm(form, fillDataForIdentity(identity));
            void send('TOUCH_IDENTITY', { id: identity.id });
        },
    }));

    const itemEntries = ordered.map(item => {
        const hasTotp = (item.itemType === 'login' && Boolean((item.data as LoginItem).totpSecret)) || item.itemType === 'totp';
        const hasPasskey = item.itemType === 'passkey' || passkeys.some(pk => {
            const pkData = pk.data as PasskeyItem;
            const loginData = item.itemType === 'login' ? (item.data as LoginItem) : null;
            const user = (loginData?.username || loginData?.email || '').trim().toLowerCase();
            const pkUser = (pkData.userName || '').trim().toLowerCase();
            return !pkUser || !user || pkUser === user;
        });

        // Identity name first (the item belongs to a persona), then the
        // capability badges.
        const badges: string[] = [];
        if (item.identityId) badges.push(identityNames.get(item.identityId) || t('menuIdentityFallback'));
        if (hasTotp) badges.push('TOTP');
        if (hasPasskey) badges.push('PK');

        const itemUrl = item.itemType === 'login'
            ? ((item.data as LoginItem).url || item.metadata.url || item.metadata.domain || '')
            : (item.metadata.url || item.metadata.domain || '');

        return {
            id: item.id,
            label: item.metadata.label,
            sublabel: subtitleFor(item),
            url: itemUrl || undefined,
            badge: badges.length > 0 ? badges.join(' · ') : undefined,
            onChoose: () => {
                if (item.itemType === 'totp') {
                    const totp = item.data as TotpItem;
                    const code = currentTotp(totp.secret, { digits: totp.digits, period: totp.period, algorithm: totp.algorithm });
                    if (code) fillTotpIntoField(field, code);
                } else {
                    fillForm(form, fillDataForItem(item));
                }
                void send('UPDATE_ITEM_LAST_USED', { itemId: item.id });

                // If the filled login has a TOTP secret, look for a TOTP field on the page or listen for one to appear
                const totpSecret = item.itemType === 'totp'
                    ? (item.data as TotpItem).secret
                    : (item.itemType === 'login' ? (item.data as LoginItem).totpSecret : undefined);

                if (totpSecret) {
                    const accountLabel = item.metadata.label + (item.itemType === 'login' && (item.data as LoginItem).username ? ` (${(item.data as LoginItem).username})` : '');
                    const totpData = item.itemType === 'totp' ? (item.data as TotpItem) : null;

                    const tryTriggerTotpPrompt = () => {
                        const totpField = forms.flatMap(f => f.fields).find(f => f.role === 'totp' && isVisible(f.element));
                        if (totpField) {
                            showTotpSlidePrompt({
                                accountLabel,
                                secret: totpSecret,
                                digits: totpData?.digits ?? 6,
                                period: totpData?.period ?? 30,
                                algorithm: totpData?.algorithm ?? 'SHA1',
                                onFill: (code) => fillTotpIntoField(totpField, code),
                            });
                            return true;
                        }
                        return false;
                    };

                    if (!tryTriggerTotpPrompt()) {
                        // Check after brief delays for SPAs that transition to a 2FA screen
                        setTimeout(tryTriggerTotpPrompt, 500);
                        setTimeout(tryTriggerTotpPrompt, 1500);
                        setTimeout(tryTriggerTotpPrompt, 3000);
                    }
                }
            },
        };
    });

    const locked = response.locked || identityResponse.locked;

    /*
     * A generated password, offered where a new one is actually being set.
     * Without this the only way to get one was to open the popup, generate,
     * copy, and paste back — at which point most people just type something
     * they already use.
     */
    const wantsNewPassword = form.fields.some(f => f.role === 'newPassword' || f.role === 'passwordConfirm')
        || form.kind === 'signup'
        || form.kind === 'changePassword';

    const suggestionRole = field.role as 'email' | 'username';
    const suggestionEntries = (suggestionResponse.data ?? [])
        // An email fits a username box, but a bare username does not fit an
        // email box.
        .filter(s => suggestionRole === 'username' || s.kind === 'email')
        .slice(0, 6)
        .map(s => ({
            id: `suggest:${s.value}`,
            label: s.value,
            sublabel: s.uses === 1 ? t('menuSuggestUsedOnce') : t('menuSuggestUsedCount', { count: String(s.uses) }),
            group: s.kind === 'email' ? t('menuSuggestEmailsGroup') : t('menuSuggestUsernamesGroup'),
            onChoose: () => {
                // Only the focused box: the rest of a sign-up form is the
                // user's to fill, or a persona's.
                fillForm({ ...form, fields: [field] }, { [field.role]: s.value });
            },
        }));

    const generateEntry = wantsNewPassword && !locked
        ? [{
            id: 'generate-password',
            pinned: true,
            label: t('menuGeneratePassword'),
            sublabel: t('menuGeneratePasswordHint'),
            badge: t('menuGenerateBadge'),
            onChoose: () => { void fillGeneratedPassword(form); },
        }]
        : [];

    // Personas first on a sign-up form: filling the persona is the step that
    // comes before choosing a login there. Identifiers already used across the
    // vault come right after the generator.
    const entries = form.kind === 'signup'
        ? [...generateEntry, ...suggestionEntries, ...identityEntries, ...itemEntries]
        : [...itemEntries, ...identityEntries, ...generateEntry];

    // If unlocked and there are no suggestions, do not open an empty popup
    if (!locked && entries.length === 0) {
        return;
    }

    showMenu({
        anchor: field.element,
        header: form.kind === 'signup' ? t('menuSignupHeader') : t('menuLoginsHeader'),
        emptyMessage: locked ? t('menuLocked') : t('menuNoMatches'),
        entries,
        // Typing a username narrows the list; typing a password is not a search.
        filterOnInput: field.element.type !== 'password',
        noFilterMatchesMessage: t('menuNoFilterMatches'),
        footerLabel: t('menuCreateForSite'),
        onFooter: () => {
            void send('OPEN_POPUP_CREATE', { url: window.location.href });
        },
    });
}

/**
 * Fills every password box in the form with one freshly generated value, using
 * the preset configured in settings so the page agrees with the popup and the
 * vault generator.
 *
 * Confirm boxes get the same value — a mismatched confirmation is the most
 * common way a generated password fails to take.
 */
async function fillGeneratedPassword(form: DetectedForm): Promise<void> {
    const preset = PRESETS.find(p => p.id === settings?.defaultGeneratorPreset) ?? PRESETS[0];
    const password = await generateFromPreset(preset);

    fillForm(form, {
        password,
        newPassword: password,
        passwordConfirm: password,
    });

    // The site may reject it and the user will want to try again by hand, so
    // put it on the clipboard rather than making them re-generate.
    try {
        await navigator.clipboard.writeText(password);
    } catch {
        // Clipboard needs a user gesture on some sites; the fill already
        // happened, so this is not worth surfacing.
    }
}

/* ------------------------------------------------------------ save prompt */

function readCredentials(form: DetectedForm): { username: string; password: string } | null {
    const password = form.fields.find(f => f.role === 'password' || f.role === 'newPassword');
    if (!password?.element.value) return null;

    const identifier = form.fields.find(f => f.role === 'email')
        ?? form.fields.find(f => f.role === 'username');
    return {
        username: identifier?.element.value ?? '',
        password: password.element.value,
    };
}

/**
 * Credentials already handed to the background this page-load, so a submit that
 * fires both a `submit` event and a button click does not queue twice.
 */
let lastQueued = '';

/**
 * Reads the fields and posts to the background *synchronously*.
 *
 * The read cannot be deferred. A submit that navigates starts tearing down this
 * document immediately; anything waiting on a timer or an await never sees the
 * field values. So the values are pulled out and the message dispatched in the
 * same task as the event, and only the prompt — which needs the background's
 * answer — is asynchronous. If the page survives, the prompt shows here; if it
 * navigates, the background is already holding the pending save for the next
 * load.
 */
function offerToSave(form: DetectedForm): void {
    if (!settings?.savePromptEnabled) return;
    if (form.kind === 'payment') return;

    const credentials = readCredentials(form);
    if (!credentials) return;

    const fingerprint = `${credentials.username}\0${credentials.password}`;
    if (fingerprint === lastQueued) return;
    lastQueued = fingerprint;

    void queueAndPrompt(credentials);
}

async function queueAndPrompt(credentials: { username: string; password: string }): Promise<void> {
    const response = await send<PendingSaveDecision>('QUEUE_SAVE_PROMPT', {
        url: window.location.href,
        ...credentials,
    });

    const decision = response.data;
    if (!decision || decision.status === 'locked') return;
    if (decision.status === 'existing' && decision.samePassword) return;

    showSavePrompt({
        mode: decision.status === 'existing' ? 'update' : 'save',
        domain: window.location.hostname,
        username: credentials.username,
        onConfirm: () => {
            void send('SAVE_LOGIN_FROM_PAGE', {
                url: window.location.href,
                ...credentials,
                itemId: decision.itemId,
            });
            void send('CLEAR_PENDING_SAVE');
        },
        onDismiss: () => { void send('CLEAR_PENDING_SAVE'); },
    });
}

/**
 * A submit that navigates kills this script before the prompt can be answered,
 * so the background holds the pending save and the next page load picks it up.
 */
async function showPendingSaveFromPreviousPage(): Promise<void> {
    if (!settings?.savePromptEnabled) return;

    const response = await send<{
        url: string;
        username: string;
        password: string;
        decision: PendingSaveDecision;
    } | null>('GET_PENDING_SAVE');

    const pending = response.data;
    if (!pending) return;

    showSavePrompt({
        mode: pending.decision.status === 'existing' ? 'update' : 'save',
        domain: new URL(pending.url).hostname,
        username: pending.username,
        onConfirm: () => {
            void send('SAVE_LOGIN_FROM_PAGE', {
                url: pending.url,
                username: pending.username,
                password: pending.password,
                itemId: pending.decision.itemId,
            });
            void send('CLEAR_PENDING_SAVE');
        },
        onDismiss: () => { void send('CLEAR_PENDING_SAVE'); },
    });
}

/* ----------------------------------------------------------------- wiring */

function wireForm(form: DetectedForm): void {
    if (form.kind === 'none') return;
    for (const field of form.fields) {
        if (isSearchOrNonAuthField(field.element)) continue;
        if (wiredFields.has(field.element)) continue;
        if (!TRIGGER_ROLES.has(field.role)) continue;
        wiredFields.add(field.element);

        field.element.addEventListener('focus', () => {
            if (!settings?.autoFillEnabled) return;
            void openMenuFor(field);
        });
    }

    if (form.scope instanceof HTMLFormElement && !form.scope.dataset.vwSubmitWired) {
        form.scope.dataset.vwSubmitWired = '1';
        form.scope.addEventListener('submit', () => offerToSave(form), true);
    }
}

/**
 * Sites that never fire a real `submit` (most SPA login pages post via fetch)
 * still have a button the user presses. Capturing at the document level catches
 * both without needing per-site rules.
 */
function wireGlobalSubmitFallback(): void {
    document.addEventListener('click', event => {
        const target = event.target as HTMLElement | null;
        const button = target?.closest('button, input[type=submit], [role=button]');
        if (!button) return;

        const form = forms.find(f => f.scope.contains(button) || f.scope === button);
        if (form) offerToSave(form);
    }, true);

    document.addEventListener('keydown', event => {
        if (event.key !== 'Enter') return;
        const active = document.activeElement;
        if (!(active instanceof HTMLInputElement)) return;
        const form = formForElement(forms, active);
        if (form) offerToSave(form);
    }, true);

    /*
     * Last line of defence. Some flows never produce a submit or a recognisable
     * button press — a script calls location.assign, or the user hits a custom
     * control we did not classify. `pagehide` is the final point at which the
     * field values still exist, so a filled password that was never queued gets
     * queued here.
     */
    window.addEventListener('pagehide', () => {
        if (!settings?.savePromptEnabled) return;
        for (const form of forms) {
            if (form.kind === 'payment') continue;
            offerToSave(form);
        }
    }, { capture: true });
}

/* ------------------------------------------------------------------ scan */

function rescan(): void {
    if (!settings?.autoDetectEnabled) return;

    forms = detectForms();
    for (const form of forms) wireForm(form);

    // Close only when the field the menu belongs to is genuinely gone. Keying
    // this off document.activeElement closed the menu whenever a re-render
    // briefly moved focus, which on a framework-driven page is immediately.
    if (isMenuOpen() && !isAnchorAlive()) closeMenu();
}

function scheduleRescan(): void {
    if (scheduleRescan.handle) clearTimeout(scheduleRescan.handle);
    scheduleRescan.handle = setTimeout(rescan, RESCAN_DEBOUNCE_MS);
}
scheduleRescan.handle = undefined as ReturnType<typeof setTimeout> | undefined;

function observeDom(): void {
    // Debounced because SPA pages mutate constantly; a scan per mutation would
    // blow the 16.7ms frame budget on any busy page.
    const observer = new MutationObserver(mutations => {
        for (const mutation of mutations) {
            if (mutation.type !== 'childList') continue;
            // Removals matter too: a view swap tears the old form out, and
            // without a rescan `forms` keeps pointing at detached elements and
            // an open menu stays anchored to a field that no longer exists.
            if (mutation.addedNodes.length === 0 && mutation.removedNodes.length === 0) continue;
            scheduleRescan();
            return;
        }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
}

/* ------------------------------------------------------------------- init */

async function init(): Promise<void> {
    const response = await send<VaultSettings>('GET_SETTINGS');
    settings = response.data ?? null;
    if (!settings) return;

    rescan();
    observeDom();
    wireGlobalSubmitFallback();
    void showPendingSaveFromPreviousPage();

    // A login page the user landed on directly: offer matches without making
    // them click into the field first.
    if (settings.autoFillEnabled) {
        setTimeout(() => {
            if (proactiveShown || isMenuOpen()) return;
            const loginForm = forms.find(f => f.kind === 'login' && f.score >= 65);
            const field = loginForm?.fields.find(f => TRIGGER_ROLES.has(f.role));
            if (!field || !isVisible(field.element)) return;
            proactiveShown = true;
            void openMenuFor(field);
        }, PROACTIVE_DELAY_MS);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => void init());
} else {
    void init();
}

/* ------------------------------------------------- popup-triggered autofill */

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type !== 'AUTOFILL') return false;

    if (forms.length === 0) rescan();
    const target = forms.find(f => f.kind !== 'payment') ?? forms[0];
    if (!target) {
        sendResponse({ success: false, error: 'No form detected on this page' });
        return true;
    }

    const filled = fillForm(target, message.payload ?? {});
    sendResponse({ success: filled > 0, error: filled > 0 ? undefined : 'No matching fields on this page' });
    return true;
});
