import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Shield, Lock, Key, RefreshCw, Copy, Check, Loader2, ExternalLink,
    Clock, Search, ChevronRight, ChevronLeft, Wand2, Plus, User, Eye, EyeOff, Pencil, X, Globe, Mail, StickyNote,
} from 'lucide-react';
import {
    generateFromPreset, PRESETS, measurePasswordStrength, strengthLabel, strengthColor,
} from '../utils/password-generator';
import { generateTotpCode, getTotpRemainingSeconds } from '../utils/totp';
import { normalizeDomain, getHost, getFaviconUrl, normalizeStoredUrl } from '../utils/domain';
import { loginIdentifier } from '../types';
import type { VaultItem, LoginItem, TotpItem, CardItem, PasskeyItem, VaultItemMetadata, Identity, VaultSettings } from '../types';
import { t } from '../i18n/strings';

import { useAutoUnlock } from '../utils/use-auto-unlock';

type Response<T> = { success: boolean; data?: T; error?: string; locked?: boolean };

function send<T>(msg: { type: string; payload?: any }): Promise<Response<T>> {
    return chrome.runtime.sendMessage(msg);
}

function safeTotp(secret: string | undefined): string {
    if (!secret) return '';
    try {
        return generateTotpCode(secret);
    } catch {
        return '';
    }
}

/**
 * The web tab the popup was opened over. Asks the background first (it tracks
 * the last focused web tab), then falls back to querying directly, skipping
 * extension and about: pages so the vault tab itself is never "the site".
 */
async function resolveActiveTab(): Promise<chrome.tabs.Tab | null> {
    const resp = await send<{ id?: number; url?: string }>({ type: 'GET_ACTIVE_TAB' });
    let tab = resp.data as chrome.tabs.Tab | undefined;
    if (!tab?.url || tab.url.startsWith('chrome-extension://')) {
        try {
            const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
            const valid = tabs.find(c => c.url && !c.url.startsWith('chrome-extension://') && !c.url.startsWith('about:'));
            if (valid) tab = valid;
        } catch {
            // No tabs access in this context; the background answer stands.
        }
    }
    return tab?.url ? tab : null;
}

function passkeyUser(pk: VaultItem): string {
    return ((pk.data as PasskeyItem).userName || '').trim().toLowerCase();
}

function loginUser(item: VaultItem): string {
    if (item.itemType !== 'login') return '';
    const login = item.data as LoginItem;
    return (login.username || login.email || '').trim().toLowerCase();
}

function lastUsedTime(item: VaultItem): number {
    return item.lastUsedAt ? new Date(item.lastUsedAt).getTime() : 0;
}

/** Fields a popup search looks at; the vault search uses the same set. */
function itemMatchesQuery(item: VaultItem, query: string): boolean {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const haystack = [item.metadata.label, item.metadata.domain ?? '', ...item.metadata.tags];
    if (item.itemType === 'login') {
        const login = item.data as LoginItem;
        haystack.push(login.username ?? '', login.email ?? '', login.url ?? '');
    } else if (item.itemType === 'totp') {
        haystack.push((item.data as TotpItem).issuer ?? '');
    }
    return haystack.some(value => value.toLowerCase().includes(q));
}

export default function App() {
    const [initialized, setInitialized] = useState<boolean | null>(null);
    const [unlocked, setUnlocked] = useState(false);
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [dataLoading, setDataLoading] = useState(false);
    const [password, setPassword] = useState('');
    const [copied, setCopied] = useState(false);
    const [matches, setMatches] = useState<VaultItem[]>([]);
    const [identities, setIdentities] = useState<Identity[]>([]);
    const [currentTab, setCurrentTab] = useState<chrome.tabs.Tab | null>(null);
    const [itemCount, setItemCount] = useState(0);
    const [settings, setSettings] = useState<VaultSettings | null>(null);

    // Search over the whole vault; the list is fetched on the first keystroke
    // so opening the popup never pays for decrypting everything.
    const [query, setQuery] = useState('');
    const [allItems, setAllItems] = useState<VaultItem[] | null>(null);
    const [searchLoading, setSearchLoading] = useState(false);

    // Item detail / edit, without leaving the popup.
    const [selected, setSelected] = useState<VaultItem | null>(null);
    const [editing, setEditing] = useState(false);
    // A login being created from the popup. Nothing is stored until Save, so
    // cancelling leaves no half-finished entry behind to sync.
    const [isDraft, setIsDraft] = useState(false);

    useEffect(() => {
        // Both answers are local storage reads; asking in parallel halves the
        // time the spinner is visible.
        void Promise.all([
            send<{ initialized: boolean }>({ type: 'INIT_CHECK' }),
            send<{ unlocked: boolean }>({ type: 'GET_UNLOCKED' }),
        ]).then(([init, state]) => {
            setUnlocked(state.data?.unlocked ?? false);
            setInitialized(init.data?.initialized ?? false);
        });
        void resolveActiveTab().then(setCurrentTab);
    }, []);

    const loadMatches = useCallback(async () => {
        const tab = await resolveActiveTab();
        if (!tab?.url) return;
        setCurrentTab(tab);
        const resp = await send<VaultItem[]>({ type: 'GET_PAGE_MATCHES', payload: { url: tab.url } });
        if (resp.locked) { setUnlocked(false); return; }
        if (resp.success && resp.data) setMatches(resp.data);
    }, []);

    const loadIdentities = useCallback(async () => {
        const resp = await send<Identity[]>({ type: 'GET_IDENTITIES' });
        if (resp.locked) { setUnlocked(false); return; }
        if (resp.success && resp.data) setIdentities(resp.data);
    }, []);

    // A count needs no decryption. This used to be GET_ITEMS — every password
    // decrypted and copied over runtime messaging just to read `.length`.
    const loadItemCount = useCallback(async () => {
        const resp = await send<{ count: number }>({ type: 'GET_ITEM_SUMMARY' });
        if (resp.locked) { setUnlocked(false); return; }
        if (resp.success && resp.data) setItemCount(resp.data.count);
    }, []);

    useEffect(() => {
        if (!unlocked) return;
        setDataLoading(true);
        void Promise.all([loadMatches(), loadItemCount(), loadIdentities()])
            .finally(() => setDataLoading(false));
        void send<VaultSettings>({ type: 'GET_SETTINGS' }).then(r => setSettings(r.data ?? null));
    }, [unlocked, loadMatches, loadItemCount, loadIdentities]);

    useEffect(() => {
        if (!unlocked || !query.trim() || allItems !== null || searchLoading) return;
        setSearchLoading(true);
        void send<VaultItem[]>({ type: 'GET_ITEMS' }).then(resp => {
            if (resp.locked) { setUnlocked(false); return; }
            setAllItems(resp.data ?? []);
        }).finally(() => setSearchLoading(false));
    }, [unlocked, query, allItems, searchLoading]);

    const [showQuickGen, setShowQuickGen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [created, setCreated] = useState(false);

    const presetPassword = useCallback(async (): Promise<string> => {
        // Honour the configured default so the popup agrees with the vault
        // generator and the in-page menu.
        const preset = PRESETS.find(p => p.id === settings?.defaultGeneratorPreset) ?? PRESETS[0];
        return generateFromPreset(preset);
    }, [settings]);

    const generateNewPassword = async () => setPassword(await presetPassword());

    const copyPassword = () => {
        void navigator.clipboard.writeText(password);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
    };

    const handleUnlocked = useCallback(() => {
        setUnlocked(true);
        setPin('');
        setError('');
    }, []);

    // Unlocks as soon as the PIN is right, with no Enter press.
    const { checking: autoChecking } = useAutoUnlock({
        enabled: initialized === true && !unlocked,
        pin,
        onUnlocked: handleUnlocked,
    });

    const handleUnlock = async () => {
        setLoading(true);
        const resp = await send({ type: 'UNLOCK', payload: { pin } });
        setLoading(false);
        if (resp.success) {
            handleUnlocked();
        } else {
            setError(resp.error ?? t('popupUnlockFailed'));
        }
    };

    const tabHost = currentTab?.url ? getHost(currentTab.url) : '';
    const isWebPage = !!currentTab?.url && /^https?:/i.test(currentTab.url);

    const openItemInVault = (item: VaultItem) => {
        void send({ type: 'OPEN_VAULT', payload: { query: `?item=${encodeURIComponent(item.id)}` } });
        window.close();
    };

    /**
     * Opens the vault pre-searched for the current site, so the list is what
     * the user was looking at in the popup rather than the whole vault.
     */
    const openVault = () => {
        const search = isWebPage ? normalizeDomain(currentTab!.url!) : '';
        void send({ type: 'OPEN_VAULT', payload: { query: search ? `?search=${encodeURIComponent(search)}` : '' } });
        window.close();
    };

    const openOnboarding = () => {
        void chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') });
        window.close();
    };

    const handleCreateItemFromTab = async () => {
        if (!currentTab?.url) return;
        setCreating(true);
        const tabUrl = currentTab.url;
        const data: LoginItem = {
            url: normalizeStoredUrl(tabUrl),
            username: '',
            email: '',
            password: password || await presetPassword(),
            notes: '',
            totpSecret: '',
        };
        const metadata: VaultItemMetadata = {
            label: tabHost || t('popupNewLogin'),
            domain: tabHost,
            iconRef: getFaviconUrl(tabUrl),
            tags: [],
            favorite: false,
        };
        setCreating(false);
        const now = new Date().toISOString();
        setSelected({
            id: '',
            itemType: 'login',
            data,
            metadata,
            identityId: null,
            createdAt: now,
            updatedAt: now,
            authorDeviceId: '',
            deletedAt: null,
            lastUsedAt: null,
        });
        setIsDraft(true);
        setEditing(true);
    };

    const handleAutofill = async (item: VaultItem) => {
        if (item.itemType !== 'login') return;
        const login = item.data as LoginItem;
        if (!currentTab?.id) return;
        chrome.tabs.sendMessage(currentTab.id, {
            type: 'AUTOFILL',
            payload: {
                username: login.username || login.email || '',
                email: login.email || login.username || '',
                password: login.password,
                // A malformed optional secret must not stop the password filling.
                totp: safeTotp(login.totpSecret),
            },
        });
        void send({ type: 'UPDATE_ITEM_LAST_USED', payload: { itemId: item.id } });
        window.close();
    };

    const handleSaveEdit = async (data: LoginItem, metadata: VaultItemMetadata): Promise<string | null> => {
        if (!selected) return t('popupNothingSelected');
        const resp = isDraft
            ? await send<VaultItem>({ type: 'CREATE_ITEM', payload: { itemType: 'login', data, metadata } })
            : await send<VaultItem>({ type: 'UPDATE_ITEM', payload: { id: selected.id, data, metadata } });
        if (!resp.success || !resp.data) return resp.error ?? t('popupCouldNotSave');
        if (isDraft) {
            setIsDraft(false);
            setCreated(true);
            setTimeout(() => setCreated(false), 2000);
            void loadItemCount();
        }
        setSelected(resp.data);
        setEditing(false);
        setAllItems(null);
        void loadMatches();
        return null;
    };

    const handleCancelEdit = () => {
        setEditing(false);
        if (isDraft) {
            setIsDraft(false);
            setSelected(null);
        }
    };

    const searchResults = useMemo(() => {
        if (!query.trim() || !allItems) return [];
        return allItems
            .filter(item => itemMatchesQuery(item, query))
            .sort((a, b) => lastUsedTime(b) - lastUsedTime(a))
            .slice(0, 30);
    }, [allItems, query]);

    if (initialized === null) {
        return (
            <div className="vw-console-shell w-[360px] min-h-[480px] flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-vw-gold animate-spin" />
            </div>
        );
    }

    if (!initialized) {
        return (
            <div className="vw-console-shell w-[360px] min-h-[480px] flex items-center justify-center p-6">
                <div className="text-center">
                    <Shield className="w-10 h-10 text-vw-gold mx-auto mb-3" />
                    <h1 className="text-base font-semibold text-white mb-1">{t('popupWelcomeTitle')}</h1>
                    <p className="text-xs text-vw-console-text-secondary mb-4">{t('popupWelcomeBody')}</p>
                    <button onClick={openOnboarding} className="px-4 py-2 bg-vw-gold text-vw-console-bg rounded-lg text-sm font-medium hover:bg-[#C69431]">
                        {t('popupStartSetup')}
                    </button>
                </div>
            </div>
        );
    }

    if (!unlocked) {
        return (
            <div className="vw-console-shell w-[360px] min-h-[480px] flex items-center justify-center p-6">
                <div className="w-full">
                    <div className="flex items-center gap-2.5 mb-6">
                        <div className="w-9 h-9 rounded-lg bg-vw-gold/20 flex items-center justify-center">
                            <Lock className="w-4.5 h-4.5 text-vw-gold" />
                        </div>
                        <div>
                            <h1 className="text-base font-semibold text-white">{t('popupUnlockTitle')}</h1>
                            <p className="text-[11px] text-vw-console-text-secondary">{t('popupUnlockSubtitle')}</p>
                        </div>
                    </div>
                    <div className="relative mb-2">
                        <input
                            type="password"
                            value={pin}
                            onChange={(e) => { setPin(e.target.value); setError(''); }}
                            onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                            placeholder="••••"
                            aria-label="PIN"
                            className="w-full px-4 py-2.5 pr-10 bg-vw-console-surface border border-vw-console-border rounded-lg text-white font-mono text-base focus:outline-none focus:border-vw-gold"
                            autoFocus
                        />
                        {autoChecking && (
                            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center">
                                <Loader2 className="w-4 h-4 text-vw-gold animate-spin" />
                            </span>
                        )}
                    </div>
                    {error && <p className="text-xs text-vw-signal-alert mb-2">{error}</p>}
                    {(autoChecking || loading) && (
                        <p className="text-xs text-vw-console-text-secondary mb-2 flex items-center gap-1.5">
                            <Loader2 className="w-3 h-3 animate-spin" /> {t('popupDeriving')}
                        </p>
                    )}
                    <button
                        onClick={handleUnlock}
                        disabled={loading || autoChecking || !pin}
                        className="w-full py-2.5 bg-vw-gold text-vw-console-bg rounded-lg text-sm font-medium hover:bg-[#C69431] disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                        {t('popupUnlockAction')}
                    </button>
                </div>
            </div>
        );
    }

    if (selected) {
        return (
            <div className="vw-console-shell w-[360px] min-h-[480px] max-h-[580px] flex flex-col">
                {editing && selected.itemType === 'login' ? (
                    <PopupLoginEditor
                        item={selected}
                        generate={presetPassword}
                        title={isDraft ? t('popupNewLogin') : t('popupEditLogin')}
                        onCancel={handleCancelEdit}
                        onSave={handleSaveEdit}
                    />
                ) : (
                    <PopupItemDetail
                        item={selected}
                        identity={identities.find(i => i.id === selected.identityId) ?? null}
                        canAutofill={isWebPage}
                        onBack={() => { setSelected(null); setEditing(false); }}
                        onEdit={() => setEditing(true)}
                        onAutofill={() => handleAutofill(selected)}
                        onOpenInVault={() => openItemInVault(selected)}
                    />
                )}
            </div>
        );
    }

    const score = measurePasswordStrength(password);
    const domain = isWebPage ? normalizeDomain(currentTab!.url!) : '';

    return (
        <div className="vw-console-shell w-[360px] min-h-[480px] max-h-[580px] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-vw-console-border">
                <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-vw-gold" />
                    <span className="text-sm font-semibold text-white">VaultWares</span>
                </div>
                <button
                    onClick={openVault}
                    className="flex items-center gap-1.5 text-vw-console-text-secondary hover:text-white text-xs"
                    title={domain ? t('popupOpenVaultFiltered', { domain }) : t('popupOpenVaultTitle')}
                >
                    <ExternalLink className="w-4 h-4" /> {t('popupOpenVault')}
                </button>
            </div>

            <div className="px-4 pt-3">
                <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-vw-console-text-secondary" />
                    <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={t('popupSearchPlaceholder')}
                        aria-label={t('popupSearchPlaceholder')}
                        className="w-full pl-8 pr-3 py-2 bg-vw-console-surface border border-vw-console-border rounded-lg text-xs text-white focus:outline-none focus:border-vw-gold"
                    />
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
                {query.trim() ? (
                    <div>
                        <SectionLabel icon={<Search className="w-3 h-3" />} text={t('popupResultsFor', { query: query.trim() })} />
                        {searchLoading || allItems === null ? (
                            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 text-vw-gold animate-spin" /></div>
                        ) : searchResults.length === 0 ? (
                            <p className="text-xs text-vw-console-text-secondary/60 px-1">{t('popupNothingMatches')}</p>
                        ) : (
                            <div className="space-y-2">
                                {searchResults.map(item => (
                                    <PopupItemRow key={item.id} item={item} hasPasskey={item.itemType === 'passkey'} canAutofill={isWebPage} onAutofill={handleAutofill} onOpen={setSelected} />
                                ))}
                            </div>
                        )}
                    </div>
                ) : domain && (() => {
                    // A passkey for the same account as a login shows as a
                    // badge on that login rather than as a second row.
                    const passkeys = matches.filter(m => m.itemType === 'passkey');
                    const others = matches.filter(m => m.itemType !== 'passkey');
                    const standalonePasskeys = passkeys.filter(pk => {
                        const pkUser = passkeyUser(pk);
                        return !others.some(lg => { const u = loginUser(lg); return pkUser && u && pkUser === u; });
                    });
                    const hasPasskey = (item: VaultItem) => item.itemType === 'passkey' || (item.itemType === 'login' && passkeys.some(pk => {
                        const pkUser = passkeyUser(pk);
                        const u = loginUser(item);
                        return !pkUser || !u || pkUser === u;
                    }));

                    // Most recently used first; never-used items keep the
                    // background's host-match ranking (the sort is stable).
                    const sorted = [...others, ...standalonePasskeys].sort((a, b) => lastUsedTime(b) - lastUsedTime(a));
                    const identityNames = new Map(identities.map(i => [i.id, i]));

                    return (
                        <div>
                            <SectionLabel icon={<Search className="w-3 h-3" />} text={t('popupMatchesFor', { domain })} />
                            {dataLoading && matches.length === 0 ? (
                                <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 text-vw-gold animate-spin" /></div>
                            ) : sorted.length === 0 ? (
                                <p className="text-xs text-vw-console-text-secondary/60 px-1">{t('popupNoItemsForSite')}</p>
                            ) : (
                                <div className="space-y-2">
                                    {sorted.slice(0, 8).map((item) => (
                                        <PopupItemRow
                                            key={item.id}
                                            item={item}
                                            identity={item.identityId ? identityNames.get(item.identityId) : undefined}
                                            hasPasskey={hasPasskey(item)}
                                            canAutofill={isWebPage}
                                            onAutofill={handleAutofill}
                                            onOpen={setSelected}
                                        />
                                    ))}
                                    {sorted.length > 8 && (
                                        <button onClick={openVault} className="w-full text-[11px] text-vw-console-text-secondary hover:text-white py-1">
                                            {t('popupMoreInVault', { count: String(sorted.length - 8) })}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })()}

                {/* Quick password - hidden behind button */}
                {showQuickGen ? (
                    <div className="vw-card p-3.5">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-medium text-vw-console-text-secondary uppercase tracking-wider">{t('popupQuickPassword')}</span>
                            <div className="flex items-center gap-1.5">
                                <button onClick={generateNewPassword} className="text-vw-console-text-secondary hover:text-white" title={t('popupRegenerate')} aria-label={t('popupRegenerate')}>
                                    <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => setShowQuickGen(false)} className="text-vw-console-text-secondary hover:text-white">
                                    <span className="text-[10px]">{t('popupHide')}</span>
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                            <input
                                type="text"
                                readOnly
                                value={password}
                                aria-label={t('popupGeneratedPassword')}
                                className="flex-1 min-w-0 px-2.5 py-1.5 bg-vw-console-surface border border-vw-console-border rounded text-white font-mono text-xs"
                            />
                            <button onClick={copyPassword} title={t('popupCopyPassword')} aria-label={t('popupCopyPassword')} className="px-2 py-1.5 bg-vw-console-surface border border-vw-console-border rounded text-vw-console-text-secondary hover:text-white">
                                {copied ? <Check className="w-3.5 h-3.5 text-vw-signal-online" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                        </div>
                        <div className="h-1 bg-vw-console-surface rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${((score + 1) / 5) * 100}%`, background: strengthColor(score) }} />
                        </div>
                        <p className="text-[10px] text-right text-vw-console-text-secondary mt-0.5">{strengthLabel(score)}</p>
                    </div>
                ) : (
                    <button
                        onClick={() => { setShowQuickGen(true); void generateNewPassword(); }}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-vw-console-surface border border-vw-console-border rounded-lg text-xs text-vw-console-text-secondary hover:text-white hover:border-vw-gold/30 transition-colors"
                    >
                        <Wand2 className="w-3.5 h-3.5" /> {t('popupGenerateQuickPassword')}
                    </button>
                )}

                {/* Stats */}
                <div className="flex gap-2">
                    <div className="vw-card flex-1 p-3 text-center">
                        <div className="text-lg font-bold text-vw-gold">{itemCount}</div>
                        <div className="text-[10px] text-vw-console-text-secondary uppercase tracking-wider">{t('popupItemsStat')}</div>
                    </div>
                    <div className="vw-card flex-1 p-3 text-center">
                        <div className="text-lg font-bold text-vw-signal-online">{matches.length}</div>
                        <div className="text-[10px] text-vw-console-text-secondary uppercase tracking-wider">{t('popupMatchesStat')}</div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-vw-console-border flex items-center justify-between">
                <button
                    onClick={async () => { await send({ type: 'LOCK' }); setUnlocked(false); }}
                    className="flex items-center gap-1.5 text-xs text-vw-console-text-secondary hover:text-white"
                >
                    <Lock className="w-3.5 h-3.5" /> {t('popupLock')}
                </button>
                <button
                    onClick={handleCreateItemFromTab}
                    disabled={creating || !isWebPage}
                    className="flex items-center gap-1.5 text-xs text-vw-gold hover:underline disabled:opacity-50"
                >
                    {created ? <><Check className="w-3 h-3" /> {t('popupSaved')}</> : creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Plus className="w-3 h-3" /> {t('popupNewItemForSite')}</>}
                </button>
            </div>
        </div>
    );
}

const SectionLabel = ({ icon, text }: { icon: React.ReactNode; text: string }) => {
    return (
        <div className="flex items-center gap-1.5 mb-2 text-vw-console-text-secondary min-w-0">
            {icon}
            <span className="text-[11px] font-medium uppercase tracking-wider truncate">{text}</span>
        </div>
    );
};

function useCopy(): [string, (value: string, field: string) => void] {
    const [copiedField, setCopiedField] = useState('');
    const copy = (value: string, field: string) => {
        void navigator.clipboard.writeText(value);
        setCopiedField(field);
        setTimeout(() => setCopiedField(''), 1200);
    };
    return [copiedField, copy];
}

function useTotp(secret: string | undefined, opts?: Pick<TotpItem, 'digits' | 'period' | 'algorithm'>): { code: string; seconds: number } | null {
    const [state, setState] = useState<{ code: string; seconds: number } | null>(null);
    useEffect(() => {
        if (!secret) { setState(null); return; }
        const update = () => {
            try {
                setState({
                    code: generateTotpCode(secret, { digits: opts?.digits, period: opts?.period, algorithm: opts?.algorithm }),
                    seconds: getTotpRemainingSeconds(opts?.period),
                });
            } catch {
                setState(null);
            }
        };
        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [secret, opts?.digits, opts?.period, opts?.algorithm]);
    return state;
}

function PopupItemRow({ item, identity, hasPasskey, canAutofill, onAutofill, onOpen }: {
    item: VaultItem;
    identity?: Identity;
    hasPasskey?: boolean;
    canAutofill: boolean;
    onAutofill: (item: VaultItem) => void;
    onOpen: (item: VaultItem) => void;
}) {
    const [copiedField, copy] = useCopy();
    const loginData = item.itemType === 'login' ? item.data as LoginItem : null;
    const totpData = item.itemType === 'totp' ? item.data as TotpItem : null;
    // A live code on every row that has one, logins with a 2FA secret included.
    const totp = useTotp(totpData?.secret || loginData?.totpSecret || undefined, totpData ?? undefined);

    const stop = (e: React.MouseEvent, fn: () => void) => { e.stopPropagation(); fn(); };
    // Visible on hover and on keyboard focus; hover-only actions could not be
    // reached without a mouse.
    const reveal = 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100';

    const subtitle = (loginData && loginIdentifier(loginData))
        || totpData?.issuer
        || (item.itemType === 'card' ? `•••• ${(item.data as CardItem).cardNumber.slice(-4)}` : item.itemType);

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => onOpen(item)}
            onKeyDown={(e) => { if (e.key === 'Enter') onOpen(item); }}
            title={t('popupShowDetails')}
            className="flex items-center gap-2.5 p-2 bg-vw-console-surface rounded-lg hover:bg-vw-console-raised focus:outline-none focus-visible:ring-1 focus-visible:ring-vw-gold transition-colors cursor-pointer group"
        >
            <div className="w-7 h-7 rounded bg-vw-console-elevated flex items-center justify-center flex-shrink-0">
                {item.metadata.iconRef ? (
                    <img src={item.metadata.iconRef} alt="" className="w-4 h-4 rounded" />
                ) : (
                    <Key className="w-3.5 h-3.5 text-vw-gold" />
                )}
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-white truncate">{item.metadata.label}</div>
                <div className="text-[10px] text-vw-console-text-secondary truncate flex items-center gap-1">
                    {identity && <User className="w-2.5 h-2.5 flex-shrink-0 text-vw-gold" />}
                    <span className="truncate">{identity ? `${identity.fullName} · ` : ''}{subtitle}</span>
                </div>
            </div>
            {totp && (
                <button
                    onClick={(e) => stop(e, () => copy(totp.code, 'totp'))}
                    className="font-mono text-[11px] text-vw-signal-online flex items-center gap-1"
                    title={t('popupCopyCode')}
                >
                    {copiedField === 'totp' ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    {totp.code} <span className="text-vw-console-text-secondary text-[9px]">{totp.seconds}s</span>
                </button>
            )}
            {hasPasskey && (
                <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-vw-console-surface border border-vw-console-border text-vw-gold uppercase flex-shrink-0" title={t('popupPasskeyBadge')}>
                    PK
                </span>
            )}
            {loginData && loginIdentifier(loginData) && (
                <button onClick={(e) => stop(e, () => copy(loginIdentifier(loginData), 'username'))} className={`text-vw-console-text-secondary hover:text-white transition-opacity ${reveal}`} title={t('popupCopyUsername')} aria-label={t('popupCopyUsername')}>
                    {copiedField === 'username' ? <Check className="w-3.5 h-3.5 text-vw-signal-online" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
            )}
            {loginData?.password && (
                <button onClick={(e) => stop(e, () => copy(loginData.password, 'password'))} className={`text-vw-console-text-secondary hover:text-white transition-opacity ${reveal}`} title={t('popupCopyPassword')} aria-label={t('popupCopyPassword')}>
                    {copiedField === 'password' ? <Check className="w-3.5 h-3.5 text-vw-signal-online" /> : <Key className="w-3.5 h-3.5" />}
                </button>
            )}
            {loginData && canAutofill && (
                <button onClick={(e) => stop(e, () => onAutofill(item))} className={`text-vw-gold hover:scale-110 transition ${reveal}`} title={t('popupAutofill')} aria-label={t('popupAutofill')}>
                    <ChevronRight className="w-3.5 h-3.5" />
                </button>
            )}
        </div>
    );
}

const DetailRow = ({ icon, label, value, display, mono, copied, onCopy, trailing }: {
    icon: React.ReactNode;
    label: string;
    value: string;
    display?: string;
    mono?: boolean;
    copied: boolean;
    onCopy: () => void;
    trailing?: React.ReactNode;
}) => {
    if (!value) return null;
    return (
        <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-vw-console-border last:border-b-0">
            <span className="text-vw-console-text-secondary flex-shrink-0">{icon}</span>
            <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-vw-console-text-secondary">{label}</div>
                <div className={`text-xs text-white break-all ${mono ? 'font-mono' : ''}`}>{display ?? value}</div>
            </div>
            {trailing}
            <button onClick={onCopy} className="text-vw-console-text-secondary hover:text-white p-1" title={t('popupCopyField', { field: label.toLowerCase() })} aria-label={t('popupCopyField', { field: label.toLowerCase() })}>
                {copied ? <Check className="w-3.5 h-3.5 text-vw-signal-online" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
        </div>
    );
};

const PopupItemDetail = ({ item, identity, canAutofill, onBack, onEdit, onAutofill, onOpenInVault }: {
    item: VaultItem;
    identity: Identity | null;
    canAutofill: boolean;
    onBack: () => void;
    onEdit: () => void;
    onAutofill: () => void;
    onOpenInVault: () => void;
}) => {
    const [copiedField, copy] = useCopy();
    const [showPassword, setShowPassword] = useState(false);
    const login = item.itemType === 'login' ? item.data as LoginItem : null;
    const totpItem = item.itemType === 'totp' ? item.data as TotpItem : null;
    const totp = useTotp(login?.totpSecret || totpItem?.secret, totpItem ?? undefined);

    return (
        <>
            <div className="flex items-center gap-2 px-3 py-3 border-b border-vw-console-border">
                <button onClick={onBack} className="text-vw-console-text-secondary hover:text-white p-1" title={t('actionBack')} aria-label={t('actionBack')}>
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="w-7 h-7 rounded bg-vw-console-elevated flex items-center justify-center flex-shrink-0">
                    {item.metadata.iconRef ? <img src={item.metadata.iconRef} alt="" className="w-4 h-4 rounded" /> : <Key className="w-3.5 h-3.5 text-vw-gold" />}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{item.metadata.label}</div>
                    <div className="text-[10px] text-vw-console-text-secondary truncate">
                        {identity ? `${identity.fullName} · ` : ''}{item.lastUsedAt ? t('popupLastUsed', { date: new Date(item.lastUsedAt).toLocaleDateString() }) : t('popupNeverUsed')}
                    </div>
                </div>
                {login && (
                    <button onClick={onEdit} className="text-vw-console-text-secondary hover:text-white p-1" title={t('actionEdit')} aria-label={t('actionEdit')}>
                        <Pencil className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
                <div className="vw-card !rounded-xl overflow-hidden">
                    {login && (
                        <>
                            <DetailRow icon={<Mail className="w-3.5 h-3.5" />} label={t('fieldEmail')} value={login.email ?? ''} copied={copiedField === 'email'} onCopy={() => copy(login.email ?? '', 'email')} />
                            {login.username && login.username !== login.email && (
                                <DetailRow icon={<User className="w-3.5 h-3.5" />} label={t('fieldUsername')} value={login.username} copied={copiedField === 'username'} onCopy={() => copy(login.username, 'username')} />
                            )}
                            <DetailRow
                                icon={<Key className="w-3.5 h-3.5" />}
                                label={t('fieldPassword')}
                                value={login.password}
                                display={showPassword ? login.password : '•'.repeat(Math.min(login.password.length, 16))}
                                mono
                                copied={copiedField === 'password'}
                                onCopy={() => copy(login.password, 'password')}
                                trailing={(
                                    <button onClick={() => setShowPassword(!showPassword)} className="text-vw-console-text-secondary hover:text-white p-1" title={showPassword ? t('popupHidePassword') : t('popupShowPassword')} aria-label={showPassword ? t('popupHidePassword') : t('popupShowPassword')}>
                                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                    </button>
                                )}
                            />
                        </>
                    )}
                    {totp && (
                        <DetailRow
                            icon={<Clock className="w-3.5 h-3.5" />}
                            label={t('popupTotpCode', { seconds: String(totp.seconds) })}
                            value={totp.code}
                            mono
                            copied={copiedField === 'totp'}
                            onCopy={() => copy(totp.code, 'totp')}
                        />
                    )}
                    {login && <DetailRow icon={<Globe className="w-3.5 h-3.5" />} label={t('popupWebsiteField')} value={login.url} copied={copiedField === 'url'} onCopy={() => copy(login.url, 'url')} />}
                    {login?.notes && <DetailRow icon={<StickyNote className="w-3.5 h-3.5" />} label={t('fieldNotes')} value={login.notes} copied={copiedField === 'notes'} onCopy={() => copy(login.notes ?? '', 'notes')} />}
                    {!login && !totp && (
                        <p className="p-3 text-xs text-vw-console-text-secondary">{t('popupEditedInVault')}</p>
                    )}
                </div>
            </div>

            <div className="px-4 py-2.5 border-t border-vw-console-border flex items-center justify-between gap-2">
                <button onClick={onOpenInVault} className="flex items-center gap-1.5 text-xs text-vw-console-text-secondary hover:text-white">
                    <ExternalLink className="w-3.5 h-3.5" /> {t('popupOpenInVault')}
                </button>
                {login && canAutofill && (
                    <button onClick={onAutofill} className="flex items-center gap-1.5 px-3 py-1.5 bg-vw-gold text-vw-console-bg rounded-lg text-xs font-medium hover:bg-[#C69431]">
                        {t('popupAutofill')} <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>
        </>
    );
};

const PopupLoginEditor = ({ item, generate, title, onCancel, onSave }: {
    item: VaultItem;
    generate: () => Promise<string>;
    title: string;
    onCancel: () => void;
    onSave: (data: LoginItem, metadata: VaultItemMetadata) => Promise<string | null>;
}) => {
    const original = item.data as LoginItem;
    const [label, setLabel] = useState(item.metadata.label);
    // Every field defined, so no input flips from uncontrolled to controlled
    // on records written before a field existed.
    const [data, setData] = useState<LoginItem>({
        ...original,
        url: original.url ?? '',
        username: original.username ?? '',
        password: original.password ?? '',
        email: original.email ?? '',
        notes: original.notes ?? '',
        totpSecret: original.totpSecret ?? '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const set = (patch: Partial<LoginItem>) => setData(prev => ({ ...prev, ...patch }));

    const save = async () => {
        setSaving(true);
        const url = normalizeStoredUrl(data.url);
        const err = await onSave(
            { ...data, url },
            { ...item.metadata, label: label.trim() || getHost(url) || item.metadata.label, domain: getHost(url) || item.metadata.domain },
        );
        setSaving(false);
        if (err) setError(err);
    };

    const input = 'w-full px-2.5 py-1.5 bg-vw-console-surface border border-vw-console-border rounded text-white text-xs focus:outline-none focus:border-vw-gold';
    const field = (labelText: string, el: React.ReactNode) => (
        <label className="block">
            <span className="block text-[10px] uppercase tracking-wider text-vw-console-text-secondary mb-1">{labelText}</span>
            {el}
        </label>
    );

    return (
        <>
            <div className="flex items-center gap-2 px-3 py-3 border-b border-vw-console-border">
                <button onClick={onCancel} className="text-vw-console-text-secondary hover:text-white p-1" title={t('actionCancel')} aria-label={t('actionCancel')}>
                    <X className="w-4 h-4" />
                </button>
                <span className="flex-1 text-sm font-semibold text-white">{title}</span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
                {field(t('popupTitleField'), <input className={input} value={label} onChange={e => setLabel(e.target.value)} />)}
                {field(t('fieldEmail'), <input className={input} type="email" value={data.email} onChange={e => set({ email: e.target.value })} autoFocus={!original.email && !original.username} />)}
                {field(t('fieldUsername'), <input className={input} value={data.username} onChange={e => set({ username: e.target.value })} />)}
                {field(t('fieldPassword'), (
                    <div className="flex items-center gap-1.5">
                        <input className={`${input} font-mono flex-1 min-w-0`} type={showPassword ? 'text' : 'password'} value={data.password} onChange={e => set({ password: e.target.value })} />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="p-1.5 text-vw-console-text-secondary hover:text-white" title={showPassword ? t('popupHidePassword') : t('popupShowPassword')} aria-label={showPassword ? t('popupHidePassword') : t('popupShowPassword')}>
                            {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button type="button" onClick={async () => { set({ password: await generate() }); setShowPassword(true); }} className="p-1.5 text-vw-console-text-secondary hover:text-white" title={t('actionGenerate')} aria-label={t('actionGenerate')}>
                            <Wand2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                ))}
                {field(t('popupWebsiteField'), <input className={input} value={data.url} onChange={e => set({ url: e.target.value })} />)}
                {field(t('popupTotpField'), <input className={`${input} font-mono`} value={data.totpSecret} onChange={e => set({ totpSecret: e.target.value.replace(/\s+/g, '') })} placeholder={t('popupTotpPlaceholder')} />)}
                {field(t('fieldNotes'), <textarea className={`${input} min-h-[56px] resize-y`} value={data.notes} onChange={e => set({ notes: e.target.value })} />)}
                {error && <p className="text-xs text-vw-signal-alert">{error}</p>}
            </div>
            <div className="px-4 py-2.5 border-t border-vw-console-border flex items-center justify-end gap-2">
                <button onClick={onCancel} className="px-3 py-1.5 text-xs text-vw-console-text-secondary hover:text-white">{t('actionCancel')}</button>
                <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 bg-vw-gold text-vw-console-bg rounded-lg text-xs font-medium hover:bg-[#C69431] disabled:opacity-50">
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} {t('actionSave')}
                </button>
            </div>
        </>
    );
};
