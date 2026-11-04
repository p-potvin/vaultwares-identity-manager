import React, { useState, useEffect, useCallback } from 'react';
import {
    Shield, Lock, Search, Plus, Key, CreditCard, MapPin, Clock, Fingerprint,
    Settings, RefreshCw, Trash2, X, Copy, Eye, EyeOff, Check, Loader2,
    Download, Monitor, ChevronRight, Star, AlertCircle, Users, User, Sparkles
} from 'lucide-react';
import type { VaultItem, ItemType, VaultSettings, LoginItem, AddressItem, CardItem, TotpItem, PasskeyItem, Identity, GeneratedIdentityData } from '../types';
import type { SyncStatus } from '../background';
import { DEFAULT_SETTINGS, loginIdentifier } from '../types';
import { generatePassword, generatePassphrase, generateToken, generateFromPreset, measurePasswordStrength, strengthLabel, strengthColor, PRESETS, type GeneratorPreset, type PasswordOptions, type PassphraseOptions } from '../utils/password-generator';
import { generateTotpCode, getTotpRemainingSeconds } from '../utils/totp';
import { normalizeDomain, getHost, getFaviconUrl, getInitials, normalizeStoredUrl } from '../utils/domain';
import { t } from '../i18n/strings';
import { useAutoUnlock } from '../utils/use-auto-unlock';
import { ImportPanel } from './ImportPanel';
import { EnrollPanel } from './EnrollPanel';
import { KitRestorePanel } from './KitRestorePanel';

/** A blank persona for the manual create path — no generation service involved. */
function emptyIdentityData(): GeneratedIdentityData {
    return {
        fullName: '',
        gender: 'other',
        birthDate: '',
        nationality: '',
        bio: '',
        email: '',
        phone: '',
        address: { fullName: '', street: '', city: '', state: '', zipCode: '', country: '', phone: '' },
    };
}

function identityToEditable(identity: Identity): GeneratedIdentityData {
    return {
        fullName: identity.fullName,
        gender: identity.gender,
        birthDate: identity.birthDate,
        nationality: identity.nationality,
        bio: identity.bio,
        email: identity.email,
        phone: identity.phone,
        address: { ...identity.address, phone: identity.address.phone ?? '' },
    };
}

type IdentityEditorMode = 'create' | 'edit' | 'review';

interface IdentityEditorState {
    mode: IdentityEditorMode;
    data: GeneratedIdentityData;
    /** Set when editing an identity that already exists. */
    identity: Identity | null;
}

function send<T>(msg: { type: string; payload?: any }): Promise<{ success: boolean; data?: T; error?: string; locked?: boolean }> {
    return chrome.runtime.sendMessage(msg);
}

type Tab = 'identities' | 'all' | 'logins' | 'addresses' | 'cards' | 'totp' | 'passkeys' | 'generator' | 'settings' | 'devices';

const ITEM_TYPE_CONFIG: Record<ItemType, { label: string; icon: React.ReactNode; color: string }> = {
    login: { label: t('typeLogin'), icon: <Key className="w-4 h-4" />, color: 'text-vw-gold' },
    address: { label: t('typeAddress'), icon: <MapPin className="w-4 h-4" />, color: 'text-vw-signal-relay' },
    card: { label: t('typeCard'), icon: <CreditCard className="w-4 h-4" />, color: 'text-vw-signal-online' },
    totp: { label: t('typeTotp'), icon: <Clock className="w-4 h-4" />, color: 'text-vw-signal-sync' },
    passkey: { label: t('typePasskey'), icon: <Fingerprint className="w-4 h-4" />, color: 'text-vw-violet' },
};

export default function App() {
    const [initialized, setInitialized] = useState<boolean | null>(null);
    const [unlocked, setUnlocked] = useState(false);
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [items, setItems] = useState<VaultItem[]>([]);
    const [identities, setIdentities] = useState<Identity[]>([]);
    // The all-items view is what people open the vault for; identities are a
    // secondary workflow.
    const [tab, setTab] = useState<Tab>('all');
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState<'recent' | 'name' | 'created'>('recent');
    const [editingItem, setEditingItem] = useState<VaultItem | null>(null);
    const [creatingType, setCreatingType] = useState<ItemType | null>(null);
    const [showTypeSelector, setShowTypeSelector] = useState(false);
    const [prefillUrl, setPrefillUrl] = useState('');
    const [settings, setSettings] = useState<VaultSettings | null>(null);
    const [loading, setLoading] = useState(false);
    const [dataLoading, setDataLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
    const [pendingItemId, setPendingItemId] = useState<string | null>(null);
    const [selectedIdentity, setSelectedIdentity] = useState<Identity | null>(null);
    const [generatingIdentity, setGeneratingIdentity] = useState(false);
    const [identityEditor, setIdentityEditor] = useState<IdentityEditorState | null>(null);
    const [identityError, setIdentityError] = useState('');
    const [showKitRestore, setShowKitRestore] = useState(false);

    const checkInit = useCallback(async () => {
        const resp = await send<{ initialized: boolean }>({ type: 'INIT_CHECK' });
        setInitialized(resp.data?.initialized ?? false);
    }, []);

    const checkUnlocked = useCallback(async () => {
        const resp = await send<{ unlocked: boolean }>({ type: 'GET_UNLOCKED' });
        setUnlocked(resp.data?.unlocked ?? false);
    }, []);

    /**
     * A locked vault decrypts nothing, so it answers with an empty list. Taking
     * that at face value paints the "no identities yet" empty state over a vault
     * that is merely locked, which reads as data loss. Bounce to the unlock
     * screen instead and leave the cached lists alone.
     */
    const loadItems = useCallback(async () => {
        const resp = await send<VaultItem[]>({ type: 'GET_ITEMS' });
        if (resp.locked) { setUnlocked(false); return; }
        if (resp.success && resp.data) setItems(resp.data);
    }, []);

    const loadIdentities = useCallback(async () => {
        const resp = await send<Identity[]>({ type: 'GET_IDENTITIES' });
        if (resp.locked) { setUnlocked(false); return; }
        if (resp.success && resp.data) setIdentities(resp.data);
    }, []);

    const loadSettings = useCallback(async () => {
        const resp = await send<VaultSettings>({ type: 'GET_SETTINGS' });
        if (resp.success && resp.data) setSettings(resp.data);
    }, []);

    useEffect(() => {
        checkInit();
        checkUnlocked();
    }, [checkInit, checkUnlocked]);

    useEffect(() => {
        if (!unlocked) return;

        // Decryption is not instant. Without this flag the lists render as []
        // first and the empty state flashes before the real data lands.
        setDataLoading(true);
        void Promise.all([loadItems(), loadIdentities(), loadSettings()])
            .finally(() => setDataLoading(false));
        void loadSyncStatus();

        const params = new URLSearchParams(window.location.search);
        if (params.get('action') === 'create') {
            const url = params.get('url') || '';
            if (url) {
                setCreatingType('login');
                setPrefillUrl(url);
            }
        }
        // Opened from the popup by clicking an item.
        setPendingItemId(params.get('item'));
        // Opened from the popup's "Open Vault": start filtered to that site.
        const preset = params.get('search');
        if (preset) {
            setTab('all');
            setSearch(preset);
        }
    }, [unlocked, loadItems, loadIdentities, loadSettings]);

    // The deep-linked item can only be opened once the list has decrypted.
    useEffect(() => {
        if (!pendingItemId || items.length === 0) return;
        const target = items.find(i => i.id === pendingItemId);
        if (target) setEditingItem(target);
        setPendingItemId(null);
    }, [pendingItemId, items]);

    /**
     * "New Item" from a type-specific list creates that type directly. Being
     * dropped into a type picker after clicking New Item on the Cards tab is a
     * reliable way to end up with a login you did not want.
     */
    const startNewItem = () => {
        const tabTypes: Partial<Record<Tab, ItemType>> = {
            logins: 'login', addresses: 'address', cards: 'card', totp: 'totp',
        };
        const type = tabTypes[tab];
        if (type) setCreatingType(type);
        else setShowTypeSelector(true);
    };

    const handleUnlocked = useCallback(() => {
        setUnlocked(true);
        setPin('');
        setError('');
    }, []);

    // Unlocks the moment the PIN is right, so no Enter press is needed.
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
            // Only an explicit submit reports failure; the background attempts
            // stay silent so a half-typed PIN does not read as an error.
            setError(resp.error ?? t('popupUnlockFailed'));
        }
    };

    const handleLock = async () => {
        await send({ type: 'LOCK' });
        setUnlocked(false);
        setItems([]);
        setIdentities([]);
    };

    const loadSyncStatus = useCallback(async () => {
        const resp = await send<SyncStatus>({ type: 'GET_SYNC_STATUS' });
        if (resp.success && resp.data) setSyncStatus(resp.data);
    }, []);

    const handleSync = async () => {
        setSyncing(true);
        const resp = await send<{ status: SyncStatus }>({ type: 'SYNC' });
        setSyncing(false);
        if (resp.data?.status) setSyncStatus(resp.data.status);
        else await loadSyncStatus();
        await loadItems();
        await loadIdentities();
    };

    const handleSaveItem = async (itemType: ItemType, data: any, metadata: any, id?: string) => {
        if (id) {
            await send({ type: 'UPDATE_ITEM', payload: { id, data, metadata } });
        } else {
            await send({ type: 'CREATE_ITEM', payload: { itemType, data, metadata } });
        }
        setEditingItem(null);
        setCreatingType(null);
        await loadItems();
    };

    const handleDeleteItem = async (id: string) => {
        await send({ type: 'DELETE_ITEM', payload: { id } });
        setEditingItem(null);
        await loadItems();
    };

    const handleCreateIdentityManually = () => {
        setIdentityError('');
        setIdentityEditor({ mode: 'create', data: emptyIdentityData(), identity: null });
    };

    const handleEditIdentity = (identity: Identity) => {
        setIdentityError('');
        setIdentityEditor({ mode: 'edit', data: identityToEditable(identity), identity });
    };

    /**
     * Optional convenience, not the way in: generation needs an endpoint
     * configured in settings, so a failure opens the blank editor rather than
     * leaving the user with nothing.
     */
    const handleGenerateIdentity = async () => {
        setGeneratingIdentity(true);
        setIdentityError('');
        const resp = await send<GeneratedIdentityData>({ type: 'GENERATE_IDENTITY' });
        setGeneratingIdentity(false);
        if (resp.success && resp.data) {
            setIdentityEditor({ mode: 'review', data: resp.data, identity: null });
        } else {
            setIdentityError(resp.error || t('vaultGenerationUnavailable'));
            setIdentityEditor({ mode: 'create', data: emptyIdentityData(), identity: null });
        }
    };

    const handleSaveIdentity = async (data: GeneratedIdentityData) => {
        const editor = identityEditor;
        if (!editor) return;

        const resp = editor.identity
            ? await send<Identity>({
                type: 'UPDATE_IDENTITY',
                payload: { identity: { ...editor.identity, ...data, address: { ...editor.identity.address, ...data.address } } },
            })
            : await send<Identity>({ type: 'CREATE_IDENTITY', payload: { data } });

        if (!resp.success) {
            setIdentityError(resp.error || t('vaultCouldNotSaveIdentity'));
            return;
        }

        setIdentityEditor(null);
        setIdentityError('');
        await loadIdentities();
        // Keep the detail view in step with what was just saved.
        if (editor.identity && resp.data) setSelectedIdentity(resp.data);
    };

    const handleDeleteIdentity = async (id: string) => {
        await send({ type: 'DELETE_IDENTITY', payload: { id } });
        setSelectedIdentity(null);
        await loadIdentities();
    };

    const handleAssignItem = async (itemId: string, identityId: string) => {
        await send({ type: 'ASSIGN_ITEM_TO_IDENTITY', payload: { itemId, identityId } });
        await loadItems();
    };

    const handleUnassignItem = async (itemId: string) => {
        await send({ type: 'UNASSIGN_ITEM_FROM_IDENTITY', payload: { itemId } });
        await loadItems();
    };

    if (initialized === null) {
        return (
            <div className="vw-console-shell min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-vw-gold animate-spin" />
            </div>
        );
    }

    if (!initialized) {
        return (
            <div className="vw-warm-shell min-h-screen flex items-center justify-center p-8">
                <div className="vw-warm-card p-10 max-w-md text-center">
                    <Shield className="w-12 h-12 text-vw-gold mx-auto mb-4" />
                    <h1 className="text-xl font-bold text-[#161320] mb-2">{t('vaultNotSetUp')}</h1>
                    <p className="text-sm text-[#161320]/70 mb-6">{t('vaultNotSetUpBody')}</p>
                    <button
                        onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') })}
                        className="w-full py-3 bg-[#D6A441] text-white rounded-lg font-medium hover:bg-[#C69431]"
                    >
                        {t('actionStartSetup')}
                    </button>
                </div>
            </div>
        );
    }

    if (!unlocked) {
        return (
            <div className="vw-console-shell min-h-screen flex items-center justify-center">
                <div className="vw-card p-10 max-w-sm w-full mx-4">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-lg bg-vw-gold/20 flex items-center justify-center">
                            <Lock className="w-5 h-5 text-vw-gold" />
                        </div>
                        <div>
                            <h1 className="text-lg font-semibold text-white">{t('vaultUnlockTitle')}</h1>
                            <p className="text-xs text-vw-console-text-secondary">{t('vaultUnlockSubtitle')}</p>
                        </div>
                    </div>
                    <div className="relative mb-3">
                        <input
                            type="password"
                            value={pin}
                            onChange={(e) => { setPin(e.target.value); setError(''); }}
                            onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                            placeholder="••••"
                            className="w-full px-4 py-3 pr-11 bg-vw-console-surface border border-vw-console-border rounded-lg text-white font-mono text-lg focus:outline-none focus:border-vw-gold"
                            autoFocus
                        />
                        {autoChecking && (
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center">
                                <Loader2 className="w-4 h-4 text-vw-gold animate-spin" />
                            </span>
                        )}
                    </div>
                    {error && <p className="text-sm text-vw-signal-alert mb-3">{error}</p>}
                    <button
                        onClick={handleUnlock}
                        disabled={loading || !pin}
                        className="w-full py-3 bg-vw-gold text-vw-console-bg rounded-lg font-medium hover:bg-[#C69431] disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                        {t('actionUnlock')}
                    </button>
                    <div className="mt-4 pt-4 border-t border-vw-console-border/50">
                        {!showKitRestore ? (
                            <button
                                onClick={() => setShowKitRestore(true)}
                                className="text-xs text-vw-console-text-secondary hover:text-white transition-colors"
                            >
                                {t('kitRestoreLink')}
                            </button>
                        ) : (
                            <KitRestorePanel onRestored={handleUnlocked} />
                        )}
                    </div>
                </div>
            </div>
        );
    }

    const filteredItems = items.filter(item => {
        if (tab !== 'all' && tab !== 'generator' && tab !== 'settings' && tab !== 'devices') {
            const typeMap: Record<string, ItemType> = { logins: 'login', addresses: 'address', cards: 'card', totp: 'totp', passkeys: 'passkey' };
            if (item.itemType !== typeMap[tab]) return false;
        }
        if (search) {
            const q = search.toLowerCase();
            // Username, email and URL too: "which logins use this address?" is
            // one of the most common reasons to search a vault.
            const login = item.itemType === 'login' ? item.data as LoginItem : null;
            return (
                item.metadata.label.toLowerCase().includes(q) ||
                !!item.metadata.domain?.toLowerCase().includes(q) ||
                item.metadata.tags.some(t => t.toLowerCase().includes(q)) ||
                !!login?.username?.toLowerCase().includes(q) ||
                !!login?.email?.toLowerCase().includes(q) ||
                !!login?.url?.toLowerCase().includes(q)
            );
        }
        return true;
    });

    // Favorites first, then the chosen order. Items used to appear in storage
    // order, i.e. oldest first, which buried whatever was just added or used.
    const recency = (item: VaultItem) => item.lastUsedAt ?? item.updatedAt ?? item.createdAt;
    filteredItems.sort((a, b) => {
        if (a.metadata.favorite !== b.metadata.favorite) return a.metadata.favorite ? -1 : 1;
        if (sortBy === 'name') return a.metadata.label.localeCompare(b.metadata.label, undefined, { sensitivity: 'base' });
        if (sortBy === 'created') return b.createdAt.localeCompare(a.createdAt);
        return recency(b).localeCompare(recency(a));
    });

    const navItems: { tab: Tab; label: string; icon: React.ReactNode }[] = [
        { tab: 'identities', label: t('vaultIdentitiesTitle'), icon: <Users className="w-4 h-4" /> },
        { tab: 'all', label: settings?.vaultSectionName ?? t('vaultNavVault'), icon: <Shield className="w-4 h-4" /> },
        { tab: 'logins', label: t('vaultNavLogins'), icon: <Key className="w-4 h-4" /> },
        { tab: 'addresses', label: t('vaultNavAddresses'), icon: <MapPin className="w-4 h-4" /> },
        { tab: 'cards', label: t('vaultNavCards'), icon: <CreditCard className="w-4 h-4" /> },
        { tab: 'totp', label: 'TOTP', icon: <Clock className="w-4 h-4" /> },
        { tab: 'passkeys', label: t('vaultNavPasskeys'), icon: <Fingerprint className="w-4 h-4" /> },
        { tab: 'generator', label: t('vaultNavGenerator'), icon: <RefreshCw className="w-4 h-4" /> },
        { tab: 'devices', label: t('vaultNavDevices'), icon: <Monitor className="w-4 h-4" /> },
        { tab: 'settings', label: t('vaultNavSettings'), icon: <Settings className="w-4 h-4" /> },
    ];

    return (
        <div className="flex h-screen overflow-hidden">
            {/* Warm-mode sidebar */}
            {/* Icon rail below md: a fixed 240px sidebar left 240px for content in a narrow window. */}
            <aside className="vw-warm-shell w-16 md:w-60 flex-shrink-0 flex flex-col border-r border-[#161320]/8">
                <div className="px-4 md:px-5 py-5 border-b border-[#161320]/8">
                    <div className="flex items-center gap-2.5">
                        <Shield className="w-7 h-7 text-[#D6A441] flex-shrink-0" />
                        <div className="hidden md:block">
                            <div className="text-sm font-bold text-[#161320]">VaultWares</div>
                            <div className="text-[10px] text-[#161320]/50 uppercase tracking-wider">{t('vaultIdentityVault')}</div>
                        </div>
                    </div>
                </div>
                <nav className="flex-1 px-2 md:px-3 py-3 space-y-0.5 overflow-y-auto">
                    {navItems.map(({ tab: t, label, icon }) => (
                        <button
                            key={t}
                            onClick={() => { setTab(t); setEditingItem(null); setCreatingType(null); }}
                            title={label}
                            aria-label={label}
                            className={`w-full flex items-center justify-center md:justify-start gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                                tab === t
                                    ? 'bg-[#D6A441]/15 text-[#D6A441] font-medium'
                                    : 'text-[#161320]/70 hover:bg-[#161320]/5'
                            }`}
                        >
                            {icon}
                            <span className="hidden md:inline">{label}</span>
                        </button>
                    ))}
                </nav>
                <div className="px-2 md:px-3 py-3 border-t border-[#161320]/8">
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        title={t('vaultSync')}
                        className="w-full flex items-center justify-center md:justify-start gap-2 px-3 py-2 rounded-lg text-sm text-[#161320]/70 hover:bg-[#161320]/5 transition-colors disabled:opacity-60"
                    >
                        <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                        <span className="hidden md:inline flex-1 text-left">{t('vaultSync')}</span>
                        {!syncing && syncStatus?.state === 'ok' && (
                            <Check className="w-3.5 h-3.5 text-vw-signal-online" />
                        )}
                        {!syncing && syncStatus?.state === 'error' && (
                            <AlertCircle className="w-3.5 h-3.5 text-vw-signal-alert" />
                        )}
                    </button>
                    <div className="hidden md:block"><SyncStatusLine status={syncStatus} syncing={syncing} /></div>
                    <button
                        onClick={handleLock}
                        title={t('vaultLockVault')}
                        className="w-full flex items-center justify-center md:justify-start gap-2 px-3 py-2 rounded-lg text-sm text-[#161320]/70 hover:bg-[#161320]/5 transition-colors"
                    >
                        <Lock className="w-4 h-4" />
                        <span className="hidden md:inline">{t('vaultLockVault')}</span>
                    </button>
                </div>
            </aside>

            {/* Console-mode content */}
            <main className="vw-console-shell flex-1 min-w-0 overflow-y-auto">
                <div className="p-4 sm:p-6 lg:p-8">
                    {/* Identities view */}
                    {tab === 'identities' && !selectedIdentity && (
                        <>
                            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                                <div>
                                    <h1 className="text-2xl font-bold text-white">{t('vaultIdentitiesTitle')}</h1>
                                    <p className="text-sm text-vw-console-text-secondary mt-1">
                                        {t(identities.length === 1 ? 'vaultOneIdentity' : 'vaultManyIdentities', { n: String(identities.length) })}
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                                    <div className="relative basis-full sm:basis-auto flex-1 sm:flex-none min-w-0">
                                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-vw-console-text-secondary" />
                                        <input
                                            type="search"
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            placeholder={t('vaultSearchIdentities')}
                                            className="pl-9 pr-4 py-2 bg-vw-console-surface border border-vw-console-border rounded-lg text-sm text-white focus:outline-none focus:border-vw-gold w-full sm:w-64"
                                        />
                                    </div>
                                    <button
                                        onClick={handleCreateIdentityManually}
                                        className="flex items-center gap-2 px-4 py-2 bg-vw-gold text-vw-console-bg rounded-lg text-sm font-medium hover:bg-[#C69431]"
                                    >
                                        <Plus className="w-4 h-4" />
                                        {t('identityCreateManual')}
                                    </button>
                                    <button
                                        onClick={handleGenerateIdentity}
                                        disabled={generatingIdentity}
                                        title={t('vaultRequiresEndpoint')}
                                        className="flex items-center gap-2 px-4 py-2 border border-vw-console-border text-vw-console-text-secondary rounded-lg text-sm font-medium hover:text-white hover:bg-vw-console-raised disabled:opacity-50"
                                    >
                                        {generatingIdentity ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                        {t('actionGenerate')}
                                    </button>
                                </div>
                            </div>

                            {identityError && (
                                <div className="flex items-start gap-2 mb-4 px-3 py-2 rounded-lg border border-vw-console-border bg-vw-console-surface text-xs text-vw-signal-warning">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-px" />
                                    <span>{identityError}</span>
                                </div>
                            )}

                            {dataLoading ? (
                                <div className="text-center py-20">
                                    <Loader2 className="w-8 h-8 text-vw-gold animate-spin mx-auto mb-3" />
                                    <p className="text-sm text-vw-console-text-secondary">{t('vaultDecrypting')}</p>
                                </div>
                            ) : identities.length === 0 && !generatingIdentity ? (
                                <div className="text-center py-20">
                                    <Users className="w-12 h-12 text-vw-console-text-secondary/30 mx-auto mb-3" />
                                    <p className="text-vw-console-text-secondary mb-4">{t('vaultNoIdentitiesYet')}</p>
                                    <div className="flex items-center justify-center gap-3">
                                        <button
                                            onClick={handleCreateIdentityManually}
                                            className="inline-flex items-center gap-2 px-4 py-2 bg-vw-gold text-vw-console-bg rounded-lg text-sm font-medium hover:bg-[#C69431]"
                                        >
                                            <Plus className="w-4 h-4" /> {t('identityCreateManual')}
                                        </button>
                                        <button
                                            onClick={handleGenerateIdentity}
                                            className="inline-flex items-center gap-2 px-4 py-2 border border-vw-console-border text-vw-console-text-secondary rounded-lg text-sm font-medium hover:text-white hover:bg-vw-console-raised"
                                        >
                                            <Sparkles className="w-4 h-4" /> {t('actionGenerate')}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {identities
                                        .filter(id => !search || id.fullName.toLowerCase().includes(search.toLowerCase()) || id.nationality.toLowerCase().includes(search.toLowerCase()) || id.email.toLowerCase().includes(search.toLowerCase()))
                                        .sort((a, b) => {
                                            if (a.metadata.favorite !== b.metadata.favorite) return b.metadata.favorite ? 1 : -1;
                                            return 0;
                                        })
                                        .map((identity) => (
                                            <IdentityCard
                                                key={identity.id}
                                                identity={identity}
                                                itemCount={items.filter(i => i.identityId === identity.id).length}
                                                onClick={() => setSelectedIdentity(identity)}
                                            />
                                        ))
                                    }
                                </div>
                            )}

                        </>
                    )}

                    {/* Identity detail view */}
                    {tab === 'identities' && selectedIdentity && (
                        <IdentityDetailView
                            identity={selectedIdentity}
                            items={items.filter(i => i.identityId === selectedIdentity.id)}
                            allItems={items}
                            onBack={() => setSelectedIdentity(null)}
                            onDelete={() => handleDeleteIdentity(selectedIdentity.id)}
                            onEdit={() => handleEditIdentity(selectedIdentity)}
                            onEditItem={(item) => setEditingItem(item)}
                            onAssignItem={(itemId) => handleAssignItem(itemId, selectedIdentity.id)}
                            onUnassignItem={handleUnassignItem}
                            onCreateItem={() => setShowTypeSelector(true)}
                        />
                    )}

                    {/* Rendered outside both branches so editing works from the
                        list and from an open identity alike. */}
                    {tab === 'identities' && identityEditor && (
                        <IdentityEditorModal
                            mode={identityEditor.mode}
                            data={identityEditor.data}
                            onSave={handleSaveIdentity}
                            onCancel={() => { setIdentityEditor(null); setIdentityError(''); }}
                        />
                    )}

                    {/* Existing item views (not identities, generator, settings, devices) */}
                    {tab !== 'identities' && tab !== 'generator' && tab !== 'settings' && tab !== 'devices' && (
                        <>
                            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                                <div>
                                    <h1 className="text-2xl font-bold text-white capitalize">
                                        {tab === 'all' ? t('vaultAllItems') : tab}
                                    </h1>
                                    <p className="text-sm text-vw-console-text-secondary mt-1">
                                        {t(filteredItems.length === 1 ? 'vaultOneItem' : 'vaultManyItems', { n: String(filteredItems.length) })}
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                                    <div className="relative basis-full sm:basis-auto flex-1 sm:flex-none min-w-0">
                                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-vw-console-text-secondary" />
                                        <input
                                            type="search"
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            placeholder={t('actionSearch')}
                                            className="pl-9 pr-4 py-2 bg-vw-console-surface border border-vw-console-border rounded-lg text-sm text-white focus:outline-none focus:border-vw-gold w-full sm:w-64"
                                        />
                                    </div>
                                    <select
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                                        aria-label={t('vaultSortItems')}
                                        className="px-3 py-2 bg-vw-console-surface border border-vw-console-border rounded-lg text-sm text-white focus:outline-none focus:border-vw-gold"
                                    >
                                        <option value="recent">{t('vaultSortRecent')}</option>
                                        <option value="name">{t('vaultSortName')}</option>
                                        <option value="created">{t('vaultSortNewest')}</option>
                                    </select>
                                    <button
                                        onClick={startNewItem}
                                        className="flex items-center gap-2 px-4 py-2 bg-vw-gold text-vw-console-bg rounded-lg text-sm font-medium hover:bg-[#C69431]"
                                    >
                                        <Plus className="w-4 h-4" />
                                        {t('vaultNewItem')}
                                    </button>
                                </div>
                            </div>

                            {dataLoading ? (
                                <div className="text-center py-20">
                                    <Loader2 className="w-8 h-8 text-vw-gold animate-spin mx-auto mb-3" />
                                    <p className="text-sm text-vw-console-text-secondary">{t('vaultDecrypting')}</p>
                                </div>
                            ) : filteredItems.length === 0 ? (
                                <div className="text-center py-20">
                                    <Shield className="w-12 h-12 text-vw-console-text-secondary/30 mx-auto mb-3" />
                                    <p className="text-vw-console-text-secondary">{t('vaultNoItemsYet')}</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filteredItems.map((item) => (
                                        <ItemCard key={item.id} item={item} onClick={() => setEditingItem(item)} />
                                    ))}
                                </div>
                            )}

                            {showTypeSelector && (
                                <ItemTypeSelector onSelect={(type) => { setCreatingType(type); setShowTypeSelector(false); }} onCancel={() => setShowTypeSelector(false)} />
                            )}

                            {creatingType && (
                                <ItemEditor
                                    itemType={creatingType}
                                    prefillUrl={prefillUrl}
                                    onSave={(data, metadata) => handleSaveItem(creatingType, data, metadata)}
                                    onCancel={() => { setCreatingType(null); setPrefillUrl(''); }}
                                />
                            )}

                            {editingItem && (
                                <ItemEditor
                                    item={editingItem}
                                    itemType={editingItem.itemType}
                                    onSave={(data, metadata) => handleSaveItem(editingItem.itemType, data, metadata, editingItem.id)}
                                    onCancel={() => setEditingItem(null)}
                                    onDelete={() => handleDeleteItem(editingItem.id)}
                                />
                            )}
                        </>
                    )}

                    {tab === 'generator' && <PasswordGeneratorPanel settings={settings} />}
                    {tab === 'settings' && (
                        <div className="space-y-6">
                            <SettingsPanel settings={settings} onSave={async (s) => { await send({ type: 'SAVE_SETTINGS', payload: s }); setSettings(s); }} />
                            <EnrollPanel unlocked={unlocked} />
                            <ImportPanel existingItems={items} onImported={loadItems} />
                        </div>
                    )}
                    {tab === 'devices' && <DevicesPanel />}
                </div>
            </main>
        </div>
    );
}

/**
 * Delete that needs a second click within a few seconds.
 *
 * Deletion is permanent — there is no trash — and it syncs, so a single
 * misclick next to Save used to erase an item everywhere.
 */
const ConfirmDeleteButton = ({ onConfirm, className }: { onConfirm: () => void; className: string }) => {
    const [armed, setArmed] = useState(false);
    useEffect(() => {
        if (!armed) return;
        const timer = setTimeout(() => setArmed(false), 4000);
        return () => clearTimeout(timer);
    }, [armed]);
    return (
        <button onClick={() => (armed ? onConfirm() : setArmed(true))} className={`${className} ${armed ? 'font-semibold' : ''}`}>
            <Trash2 className="w-4 h-4" /> {armed ? t('vaultDeleteConfirm') : t('actionDelete')}
        </button>
    );
};

function ItemCard({ item, onClick }: { item: VaultItem; onClick: () => void }) {
    const config = ITEM_TYPE_CONFIG[item.itemType];
    const [showTotp, setShowTotp] = useState(false);
    const [totpCode, setTotpCode] = useState('');
    const [totpSeconds, setTotpSeconds] = useState(30);

    useEffect(() => {
        if (item.itemType === 'totp' && showTotp) {
            const data = item.data as TotpItem;
            const update = () => {
                setTotpCode(generateTotpCode(data.secret, { digits: data.digits, period: data.period, algorithm: data.algorithm }));
                setTotpSeconds(getTotpRemainingSeconds(data.period));
            };
            update();
            const interval = setInterval(update, 1000);
            return () => clearInterval(interval);
        }
    }, [item, showTotp]);

    return (
        <div
            onClick={onClick}
            className="vw-card p-4 cursor-pointer hover:border-vw-gold/30 transition-colors group"
        >
            <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-vw-console-elevated flex items-center justify-center flex-shrink-0">
                    {item.metadata.iconRef ? (
                        <img src={item.metadata.iconRef} alt="" className="w-6 h-6 rounded" />
                    ) : (
                        <span className={`text-sm font-bold ${config.color}`}>{getInitials(item.metadata.label)}</span>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">{item.metadata.label}</span>
                        {item.metadata.favorite && <Star className="w-3 h-3 text-vw-gold fill-vw-gold flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-vw-console-text-secondary truncate mt-0.5">
                        {item.itemType === 'login' && loginIdentifier(item.data as LoginItem)}
                        {item.itemType === 'address' && `${(item.data as AddressItem).fullName}`}
                        {item.itemType === 'card' && `•••• ${(item.data as CardItem).cardNumber.slice(-4)}`}
                        {item.itemType === 'totp' && (item.data as TotpItem).issuer || (item.data as TotpItem).label}
                        {item.itemType === 'passkey' && ((item.data as PasskeyItem).userName || (item.data as PasskeyItem).rpId)}
                    </p>
                </div>
                <div className={`flex-shrink-0 ${config.color}`}>
                    {config.icon}
                </div>
            </div>

            {item.itemType === 'totp' && (
                <div className="mt-3 pt-3 border-t border-vw-console-border">
                    {showTotp ? (
                        <div className="flex items-center justify-between">
                            <span className="font-mono text-lg text-vw-signal-online tracking-wider">{totpCode}</span>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-vw-console-text-secondary">{totpSeconds}s</span>
                                <button onClick={(e) => { e.stopPropagation(); setShowTotp(false); }} className="text-vw-console-text-secondary hover:text-white">
                                    <EyeOff className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button onClick={(e) => { e.stopPropagation(); setShowTotp(true); }} className="text-xs text-vw-gold hover:underline flex items-center gap-1">
                            <Eye className="w-3.5 h-3.5" /> {t('vaultShowCode')}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

function ItemEditor({ item, itemType, onSave, onCancel, onDelete, prefillUrl }: {
    item?: VaultItem;
    itemType: ItemType;
    onSave: (data: any, metadata: any) => void;
    onCancel: () => void;
    onDelete?: () => void;
    prefillUrl?: string;
}) {
    const [label, setLabel] = useState(item?.metadata.label ?? (prefillUrl ? normalizeDomain(prefillUrl) : ''));
    const [favorite, setFavorite] = useState(item?.metadata.favorite ?? false);
    const [showPassword, setShowPassword] = useState(false);

    const [loginData, setLoginData] = useState<LoginItem>(
        item?.itemType === 'login'
            ? item.data as LoginItem
            : { url: normalizeStoredUrl(prefillUrl || ''), username: '', email: '', password: '', notes: '', totpSecret: '' },
    );
    // Most sites want an email, so the username box stays out of the way until
    // it is needed — and appears on its own once either field holds something.
    const [showUsernameField, setShowUsernameField] = useState(
        !!(item?.itemType === 'login' && (item.data as LoginItem).username),
    );
    const [addressData, setAddressData] = useState<AddressItem>(item?.itemType === 'address' ? item.data as AddressItem : { fullName: '', street: '', city: '', state: '', zipCode: '', country: '', phone: '' });
    const [cardData, setCardData] = useState<CardItem>(item?.itemType === 'card' ? item.data as CardItem : { holderName: '', cardNumber: '', expiryMonth: '', expiryYear: '', cvv: '', notes: '' });
    const [totpData, setTotpData] = useState<TotpItem>(item?.itemType === 'totp' ? item.data as TotpItem : { label: '', secret: '', issuer: '', digits: 6, period: 30, algorithm: 'SHA1' });
    const [passkeyData, setPasskeyData] = useState<PasskeyItem>(item?.itemType === 'passkey' ? item.data as PasskeyItem : { rpId: '', credentialId: '', privateKey: '', userHandle: '', notes: '' });

    const handleSave = () => {
        const metadata = { label: label || getDefaultLabel(), domain: getDomain(), iconRef: getIcon(), tags: [], favorite };
        let data: any;
        switch (itemType) {
            case 'login': data = loginData; break;
            case 'address': data = addressData; break;
            case 'card': data = cardData; break;
            case 'totp': data = totpData; break;
            case 'passkey': data = passkeyData; break;
        }
        onSave(data, metadata);
    };

    const getDefaultLabel = () => {
        switch (itemType) {
            case 'login': return getHost(loginData.url) || loginIdentifier(loginData) || 'Login';
            case 'address': return addressData.fullName || 'Address';
            case 'card': return cardData.holderName || 'Card';
            case 'totp': return totpData.label || totpData.issuer || 'TOTP';
            case 'passkey': return passkeyData.rpId || 'Passkey';
        }
    };

    const getDomain = () => {
        if (itemType === 'login') return getHost(loginData.url);
        if (itemType === 'passkey') return passkeyData.rpId;
        return undefined;
    };

    const getIcon = () => {
        if (itemType === 'login' && loginData.url) return getFaviconUrl(loginData.url);
        return undefined;
    };

    const inputClass = "w-full px-3 py-2 bg-vw-console-surface border border-vw-console-border rounded-lg text-sm text-white focus:outline-none focus:border-vw-gold";
    const labelClass = "block text-xs font-medium text-vw-console-text-secondary mb-1.5";

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onCancel}>
            <div className="vw-card p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                    <h2 className="text-lg font-semibold text-white">{t(item ? 'vaultEditItem' : 'vaultNewItemOfType', { type: ITEM_TYPE_CONFIG[itemType].label })}</h2>
                    <button onClick={onCancel} className="text-vw-console-text-secondary hover:text-white"><X className="w-5 h-5" /></button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className={labelClass}>{t('fieldLabel')}</label>
                        <input className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={getDefaultLabel()} />
                    </div>

                    {itemType === 'login' && (
                        <>
                            <div>
                                <label className={labelClass}>{t('fieldUrl')}</label>
                                <input
                                    className={inputClass}
                                    value={loginData.url}
                                    onChange={(e) => setLoginData({ ...loginData, url: e.target.value })}
                                    onBlur={(e) => setLoginData({ ...loginData, url: normalizeStoredUrl(e.target.value) })}
                                    placeholder="app.example.com"
                                />
                            </div>
                            <div>
                                <label className={labelClass}>{t('fieldEmail')}</label>
                                <input
                                    className={inputClass}
                                    type="email"
                                    value={loginData.email ?? ''}
                                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                                    placeholder="you@example.com"
                                />
                            </div>
                            {showUsernameField ? (
                                <div>
                                    <label className={labelClass}>{t('fieldUsername')}</label>
                                    <input
                                        className={inputClass}
                                        value={loginData.username}
                                        onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                                        autoFocus={!loginData.username}
                                    />
                                </div>
                            ) : (
                                <button
                                    onClick={() => setShowUsernameField(true)}
                                    className="text-xs text-vw-gold hover:underline"
                                >
                                    {t('addUsername')}
                                </button>
                            )}
                            <div>
                                <label className={labelClass}>{t('fieldPassword')}</label>
                                <div className="flex gap-2">
                                    <input className={inputClass} type={showPassword ? 'text' : 'password'} value={loginData.password} onChange={(e) => setLoginData({ ...loginData, password: e.target.value })} />
                                    <button onClick={() => setShowPassword(!showPassword)} className="px-3 bg-vw-console-surface border border-vw-console-border rounded-lg text-vw-console-text-secondary hover:text-white">
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}>{t('fieldTotpSecret')}</label>
                                <input className={inputClass} value={loginData.totpSecret ?? ''} onChange={(e) => setLoginData({ ...loginData, totpSecret: e.target.value })} placeholder={t('totpSecretPlaceholder')} />
                            </div>
                            <div>
                                <label className={labelClass}>{t('fieldNotes')}</label>
                                <textarea className={inputClass} rows={2} value={loginData.notes ?? ''} onChange={(e) => setLoginData({ ...loginData, notes: e.target.value })} />
                            </div>
                        </>
                    )}

                    {itemType === 'address' && (
                        <>
                            <div><label className={labelClass}>{t('fieldFullName')}</label><input className={inputClass} value={addressData.fullName} onChange={(e) => setAddressData({ ...addressData, fullName: e.target.value })} /></div>
                            <div><label className={labelClass}>{t('fieldStreet')}</label><input className={inputClass} value={addressData.street} onChange={(e) => setAddressData({ ...addressData, street: e.target.value })} /></div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className={labelClass}>{t('fieldCity')}</label><input className={inputClass} value={addressData.city} onChange={(e) => setAddressData({ ...addressData, city: e.target.value })} /></div>
                                <div><label className={labelClass}>{t('fieldStateProvince')}</label><input className={inputClass} value={addressData.state} onChange={(e) => setAddressData({ ...addressData, state: e.target.value })} /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className={labelClass}>{t('fieldZip')}</label><input className={inputClass} value={addressData.zipCode} onChange={(e) => setAddressData({ ...addressData, zipCode: e.target.value })} /></div>
                                <div><label className={labelClass}>{t('fieldCountry')}</label><input className={inputClass} value={addressData.country} onChange={(e) => setAddressData({ ...addressData, country: e.target.value })} /></div>
                            </div>
                            <div><label className={labelClass}>{t('fieldPhoneOptional')}</label><input className={inputClass} value={addressData.phone ?? ''} onChange={(e) => setAddressData({ ...addressData, phone: e.target.value })} /></div>
                        </>
                    )}

                    {itemType === 'card' && (
                        <>
                            <div><label className={labelClass}>{t('fieldCardholder')}</label><input className={inputClass} value={cardData.holderName} onChange={(e) => setCardData({ ...cardData, holderName: e.target.value })} /></div>
                            <div><label className={labelClass}>{t('fieldCardNumber')}</label><input className={`${inputClass} font-mono`} value={cardData.cardNumber} onChange={(e) => setCardData({ ...cardData, cardNumber: e.target.value })} placeholder="0000 0000 0000 0000" /></div>
                            <div className="grid grid-cols-3 gap-3">
                                <div><label className={labelClass}>{t('fieldMonth')}</label><input className={inputClass} value={cardData.expiryMonth} onChange={(e) => setCardData({ ...cardData, expiryMonth: e.target.value })} placeholder="MM" /></div>
                                <div><label className={labelClass}>{t('fieldYear')}</label><input className={inputClass} value={cardData.expiryYear} onChange={(e) => setCardData({ ...cardData, expiryYear: e.target.value })} placeholder="YY" /></div>
                                <div><label className={labelClass}>{t('fieldCvv')}</label><input className={inputClass} type={showPassword ? 'text' : 'password'} value={cardData.cvv} onChange={(e) => setCardData({ ...cardData, cvv: e.target.value })} /></div>
                            </div>
                            <div><label className={labelClass}>{t('fieldNotes')}</label><textarea className={inputClass} rows={2} value={cardData.notes ?? ''} onChange={(e) => setCardData({ ...cardData, notes: e.target.value })} /></div>
                        </>
                    )}

                    {itemType === 'totp' && (
                        <>
                            <div><label className={labelClass}>{t('fieldLabel')}</label><input className={inputClass} value={totpData.label} onChange={(e) => setTotpData({ ...totpData, label: e.target.value })} /></div>
                            <div><label className={labelClass}>{t('fieldIssuerOptional')}</label><input className={inputClass} value={totpData.issuer ?? ''} onChange={(e) => setTotpData({ ...totpData, issuer: e.target.value })} /></div>
                            <div><label className={labelClass}>{t('fieldSecretBase32')}</label><input className={`${inputClass} font-mono`} value={totpData.secret} onChange={(e) => setTotpData({ ...totpData, secret: e.target.value.toUpperCase() })} /></div>
                            <div className="grid grid-cols-3 gap-3">
                                <div><label className={labelClass}>{t('fieldDigits')}</label><select className={inputClass} value={totpData.digits} onChange={(e) => setTotpData({ ...totpData, digits: parseInt(e.target.value) })}><option value={6}>6</option><option value={8}>8</option></select></div>
                                <div><label className={labelClass}>{t('fieldPeriod')}</label><select className={inputClass} value={totpData.period} onChange={(e) => setTotpData({ ...totpData, period: parseInt(e.target.value) })}><option value={30}>30s</option><option value={60}>60s</option></select></div>
                                <div><label className={labelClass}>{t('fieldAlgorithm')}</label><select className={inputClass} value={totpData.algorithm} onChange={(e) => setTotpData({ ...totpData, algorithm: e.target.value as any })}><option value="SHA1">SHA1</option><option value="SHA256">SHA256</option><option value="SHA512">SHA512</option></select></div>
                            </div>
                        </>
                    )}

                    {/*
                        A passkey is key material, not a setting. There is no
                        repair you can perform on one by typing — a wrong byte
                        produces a signature the site rejects, with nothing to
                        tell you why. So it is a read-only record: look at it,
                        annotate it, or delete it and register again on the site.
                    */}
                    {itemType === 'passkey' && (
                        <>
                            <div className="flex items-start gap-2 px-3 py-2 rounded-lg border border-vw-console-border bg-vw-console-surface text-xs text-vw-console-text-secondary">
                                <Fingerprint className="w-4 h-4 text-vw-violet flex-shrink-0 mt-px" />
                                <span>
                                    {passkeyData.createdByAuthenticator
                                        ? t('vaultPasskeyCreatedBy') + (passkeyData.createdAt ? t('vaultPasskeyCreatedOn', { date: new Date(passkeyData.createdAt).toLocaleDateString() }) : '.')
                                        : t('vaultPasskeyImported')}
                                    {' '}{t('vaultPasskeyReadOnly')}
                                </span>
                            </div>
                            <div><label className={labelClass}>{t('fieldRelyingParty')}</label><input className={inputClass} value={passkeyData.rpName || passkeyData.rpId} readOnly /></div>
                            <div><label className={labelClass}>{t('fieldRelyingPartyId')}</label><input className={`${inputClass} font-mono`} value={passkeyData.rpId} readOnly /></div>
                            <div><label className={labelClass}>{t('passkeyAccountLabel')}</label><input className={inputClass} value={passkeyData.userDisplayName || passkeyData.userName || ''} readOnly /></div>
                            <div><label className={labelClass}>{t('fieldCredentialId')}</label><input className={`${inputClass} font-mono`} value={passkeyData.credentialId} readOnly /></div>
                            <div><label className={labelClass}>{t('fieldAlgorithm')}</label><input className={inputClass} value={passkeyData.algorithm === -7 ? 'ES256 (ECDSA P-256)' : String(passkeyData.algorithm ?? '')} readOnly /></div>
                            <div><label className={labelClass}>{t('fieldNotes')}</label><textarea className={inputClass} rows={2} value={passkeyData.notes ?? ''} onChange={(e) => setPasskeyData({ ...passkeyData, notes: e.target.value })} /></div>
                        </>
                    )}

                    <div className="flex items-center gap-2">
                        <button onClick={() => setFavorite(!favorite)} className={`flex items-center gap-1.5 text-xs ${favorite ? 'text-vw-gold' : 'text-vw-console-text-secondary'}`}>
                            <Star className={`w-4 h-4 ${favorite ? 'fill-vw-gold' : ''}`} /> {t('fieldFavorite')}
                        </button>
                    </div>
                </div>

                <div className="flex items-center justify-between mt-6 pt-4 border-t border-vw-console-border">
                    <div>
                        {onDelete && (
                            <ConfirmDeleteButton onConfirm={onDelete} className="flex items-center gap-1.5 px-3 py-2 text-sm text-vw-signal-alert hover:bg-vw-signal-alert/10 rounded-lg" />
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={onCancel} className="px-4 py-2 text-sm text-vw-console-text-secondary hover:text-white">{t('actionCancel')}</button>
                        <button onClick={handleSave} className="px-4 py-2 bg-vw-gold text-vw-console-bg rounded-lg text-sm font-medium hover:bg-[#C69431]">{t('actionSave')}</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function PasswordGeneratorPanel({ settings }: { settings: VaultSettings | null }) {
    const [password, setPassword] = useState('');
    const [activePresetId, setActivePresetId] = useState<string>(settings?.defaultGeneratorPreset ?? 'classic');
    const [copied, setCopied] = useState(false);

    const [pwOpts, setPwOpts] = useState<PasswordOptions>(PRESETS[0].passwordOpts ?? {
        length: 20, uppercase: true, lowercase: true, numbers: true, symbols: true, standardSymbolsOnly: true,
    });
    const [ppOpts, setPpOpts] = useState<PassphraseOptions>(PRESETS[1].passphraseOpts ?? {
        wordCount: 4, delimiter: '-', capitalize: true, suffixType: 'numeric', suffixLength: 3,
    });

    const activePreset = PRESETS.find(p => p.id === activePresetId) ?? PRESETS[0];

    const generate = async () => {
        if (activePreset.type === 'password') {
            setPassword(generatePassword(pwOpts));
        } else if (activePreset.type === 'passphrase') {
            setPassword(generatePassphrase(ppOpts));
        } else {
            setPassword(await generateToken());
        }
    };

    useEffect(() => { generate(); }, []);

    const score = measurePasswordStrength(password);
    const copy = () => { navigator.clipboard.writeText(password); setCopied(true); setTimeout(() => setCopied(false), 1500); };

    const inputClass = "w-full px-3 py-2 bg-vw-console-surface border border-vw-console-border rounded-lg text-sm text-white focus:outline-none focus:border-vw-gold";

    return (
        <div className="max-w-xl">
            <h1 className="text-2xl font-bold text-white mb-2">{t('vaultGeneratorTitle')}</h1>
            <p className="text-sm text-vw-console-text-secondary mb-6">{t('vaultGeneratorSubtitle')}</p>

            <div className="vw-card p-6 space-y-5">
                {/* Preset selector */}
                <div>
                    <label className="block text-xs font-medium text-vw-console-text-secondary mb-2">{t('fieldPreset')}</label>
                    <div className="flex gap-2">
                        {PRESETS.map(preset => (
                            <button
                                key={preset.id}
                                onClick={() => {
                                    setActivePresetId(preset.id);
                                    if (preset.passwordOpts) setPwOpts(preset.passwordOpts);
                                    if (preset.passphraseOpts) setPpOpts(preset.passphraseOpts);
                                }}
                                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                    activePresetId === preset.id
                                        ? 'bg-vw-gold text-vw-console-bg font-medium'
                                        : 'bg-vw-console-surface text-vw-console-text-secondary border border-vw-console-border hover:text-white'
                                }`}
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>
                    <p className="text-xs text-vw-console-text-secondary mt-1.5">{activePreset.description}</p>
                </div>

                {/* Generated output */}
                <div className="flex items-center gap-3">
                    <input
                        type="text"
                        readOnly
                        value={password}
                        className="flex-1 px-4 py-3 bg-vw-console-surface border border-vw-console-border rounded-lg text-white font-mono text-sm break-all"
                    />
                    <button onClick={copy} className="px-3 py-3 bg-vw-console-surface border border-vw-console-border rounded-lg text-vw-console-text-secondary hover:text-white">
                        {copied ? <Check className="w-4 h-4 text-vw-signal-online" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <button onClick={generate} className="px-3 py-3 bg-vw-console-surface border border-vw-console-border rounded-lg text-vw-console-text-secondary hover:text-white">
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>

                <div>
                    <div className="h-1.5 bg-vw-console-surface rounded-full overflow-hidden mb-1">
                        <div className="h-full rounded-full transition-all" style={{ width: `${((score + 1) / 5) * 100}%`, background: strengthColor(score) }} />
                    </div>
                    <p className="text-xs text-right text-vw-console-text-secondary">{strengthLabel(score)}</p>
                </div>

                {/* Password-type options */}
                {activePreset.type === 'password' && (
                    <>
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm text-vw-console-text-secondary">{t('genLength', { n: String(pwOpts.length) })}</label>
                            </div>
                            <input type="range" min="8" max="64" value={pwOpts.length} onChange={(e) => setPwOpts({ ...pwOpts, length: parseInt(e.target.value) })} className="w-full accent-vw-gold" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: t('genUppercase'), key: 'uppercase' as const },
                                { label: t('genLowercase'), key: 'lowercase' as const },
                                { label: t('genNumbers'), key: 'numbers' as const },
                                { label: t('genSymbols'), key: 'symbols' as const },
                            ].map(({ label, key }) => (
                                <label key={label} className="flex items-center gap-2 text-sm text-vw-console-text-secondary cursor-pointer">
                                    <input type="checkbox" checked={pwOpts[key]} onChange={(e) => setPwOpts({ ...pwOpts, [key]: e.target.checked })} className="accent-vw-gold" />
                                    {label}
                                </label>
                            ))}
                        </div>
                        {pwOpts.symbols && (
                            <label className="flex items-center gap-2 text-sm text-vw-console-text-secondary cursor-pointer">
                                <input type="checkbox" checked={pwOpts.standardSymbolsOnly} onChange={(e) => setPwOpts({ ...pwOpts, standardSymbolsOnly: e.target.checked })} className="accent-vw-gold" />
                                {t('genStandardOnly')}
                            </label>
                        )}
                    </>
                )}

                {/* Passphrase-type options */}
                {activePreset.type === 'passphrase' && (
                    <>
                        <div>
                            <label className="block text-xs font-medium text-vw-console-text-secondary mb-1.5">{t('genWordCount', { n: String(ppOpts.wordCount) })}</label>
                            <input type="range" min="2" max="8" value={ppOpts.wordCount} onChange={(e) => setPpOpts({ ...ppOpts, wordCount: parseInt(e.target.value) })} className="w-full accent-vw-gold" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-vw-console-text-secondary mb-1.5">{t('genDelimiter')}</label>
                            <input className={inputClass} value={ppOpts.delimiter} onChange={(e) => setPpOpts({ ...ppOpts, delimiter: e.target.value })} maxLength={3} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-vw-console-text-secondary mb-1.5">{t('genSuffixType')}</label>
                                <select className={inputClass} value={ppOpts.suffixType} onChange={(e) => setPpOpts({ ...ppOpts, suffixType: e.target.value as any })}>
                                    <option value="none">{t('genSuffixNone')}</option>
                                    <option value="numeric">{t('genSuffixNumeric')}</option>
                                    <option value="alphanumeric">{t('genSuffixAlphanumeric')}</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-vw-console-text-secondary mb-1.5">{t('genSuffixLength', { n: String(ppOpts.suffixLength) })}</label>
                                <input type="range" min="0" max="8" value={ppOpts.suffixLength} onChange={(e) => setPpOpts({ ...ppOpts, suffixLength: parseInt(e.target.value) })} className="w-full accent-vw-gold" />
                            </div>
                        </div>
                        <label className="flex items-center gap-2 text-sm text-vw-console-text-secondary cursor-pointer">
                            <input type="checkbox" checked={ppOpts.capitalize} onChange={(e) => setPpOpts({ ...ppOpts, capitalize: e.target.checked })} className="accent-vw-gold" />
                            {t('genCapitalize')}
                        </label>
                    </>
                )}

                {/* Token type info */}
                {activePreset.type === 'token' && (
                    <p className="text-xs text-vw-console-text-secondary">
                        {t('genTokenInfo')}
                    </p>
                )}

                <button onClick={generate} className="w-full py-2.5 bg-vw-gold text-vw-console-bg rounded-lg font-medium hover:bg-[#C69431] flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4" /> {t('actionGenerate')}
                </button>
            </div>
        </div>
    );
}

function ItemTypeSelector({ onSelect, onCancel }: {
    onSelect: (type: ItemType) => void;
    onCancel: () => void;
}) {
    const types: { type: ItemType; label: string; icon: React.ReactNode; desc: string }[] = [
        { type: 'login', label: t('typeLogin'), icon: <Key className="w-6 h-6" />, desc: t('typeLoginDesc') },
        { type: 'address', label: t('typeAddress'), icon: <MapPin className="w-6 h-6" />, desc: t('typeAddressDesc') },
        { type: 'card', label: t('typeCard'), icon: <CreditCard className="w-6 h-6" />, desc: t('typeCardDesc') },
        { type: 'totp', label: t('typeTotp'), icon: <Clock className="w-6 h-6" />, desc: t('typeTotpDesc') },
        // Passkeys are deliberately absent: they are created by the
        // authenticator during a real ceremony on the site, and a hand-typed
        // credential cannot produce a signature any relying party accepts.
    ];

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onCancel}>
            <div className="vw-card p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                    <h2 className="text-lg font-semibold text-white">{t('vaultNewItemType')}</h2>
                    <button onClick={onCancel} className="text-vw-console-text-secondary hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                <div className="space-y-2">
                    {types.map(({ type, label, icon, desc }) => (
                        <button
                            key={type}
                            onClick={() => onSelect(type)}
                            className="w-full flex items-center gap-4 p-4 bg-vw-console-surface border border-vw-console-border rounded-lg hover:border-vw-gold/30 transition-colors text-left"
                        >
                            <div className="w-12 h-12 rounded-lg bg-vw-console-elevated flex items-center justify-center text-vw-gold flex-shrink-0">
                                {icon}
                            </div>
                            <div>
                                <div className="text-sm font-medium text-white">{label}</div>
                                <div className="text-xs text-vw-console-text-secondary">{desc}</div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-vw-console-text-secondary ml-auto" />
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

function SettingsPanel({ settings, onSave }: { settings: VaultSettings | null; onSave: (s: VaultSettings) => Promise<void> }) {
    const [local, setLocal] = useState<VaultSettings>(settings ?? DEFAULT_SETTINGS);
    const [saved, setSaved] = useState(false);

    const handleSave = async () => {
        await onSave(local);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
    };

    const inputClass = "px-3 py-2 bg-vw-console-surface border border-vw-console-border rounded-lg text-sm text-white focus:outline-none focus:border-vw-gold";

    return (
        <div className="max-w-xl">
            <h1 className="text-2xl font-bold text-white mb-6">{t('vaultNavSettings')}</h1>
            <div className="vw-card p-6 space-y-5">
                <div>
                    <label className="block text-xs font-medium text-vw-console-text-secondary mb-1.5">{t('fieldAutoLock')}</label>
                    <input type="number" min="0" max="120" className={inputClass} value={local.autoLockMinutes} onChange={(e) => setLocal({ ...local, autoLockMinutes: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                    <label className="block text-xs font-medium text-vw-console-text-secondary mb-1.5">{t('fieldDefaultPwLength')}</label>
                    <input type="number" min="8" max="64" className={inputClass} value={local.defaultPasswordLength} onChange={(e) => setLocal({ ...local, defaultPasswordLength: parseInt(e.target.value) || 20 })} />
                </div>
                <div>
                    <label className="block text-xs font-medium text-vw-console-text-secondary mb-1.5">{t('fieldDefaultComplexity')}</label>
                    <select className={inputClass} value={local.defaultPasswordComplexity} onChange={(e) => setLocal({ ...local, defaultPasswordComplexity: e.target.value as any })}>
                        <option value="medium">{t('complexityMedium')}</option>
                        <option value="high">{t('complexityHigh')}</option>
                        <option value="maximum">{t('complexityMaximum')}</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-vw-console-text-secondary mb-1.5">{t('fieldDefaultPreset')}</label>
                    <select className={inputClass} value={local.defaultGeneratorPreset} onChange={(e) => setLocal({ ...local, defaultGeneratorPreset: e.target.value })}>
                        {PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                </div>
                <label className="flex items-center gap-2 text-sm text-vw-console-text-secondary cursor-pointer">
                    <input type="checkbox" checked={local.autoFillEnabled} onChange={(e) => setLocal({ ...local, autoFillEnabled: e.target.checked })} className="accent-vw-gold" />
                    {t('settingAutoFill')}
                </label>
                <label className="flex items-center gap-2 text-sm text-vw-console-text-secondary cursor-pointer">
                    <input type="checkbox" checked={local.autoDetectEnabled} onChange={(e) => setLocal({ ...local, autoDetectEnabled: e.target.checked })} className="accent-vw-gold" />
                    {t('settingAutoDetect')}
                </label>
                <label className="flex items-center gap-2 text-sm text-vw-console-text-secondary cursor-pointer">
                    <input type="checkbox" checked={local.savePromptEnabled} onChange={(e) => setLocal({ ...local, savePromptEnabled: e.target.checked })} className="accent-vw-gold" />
                    {t('settingSavePrompt')}
                </label>
                <div>
                    <label className="flex items-center gap-2 text-sm text-vw-console-text-secondary cursor-pointer">
                        <input type="checkbox" checked={local.passkeysEnabled} onChange={(e) => setLocal({ ...local, passkeysEnabled: e.target.checked })} className="accent-vw-gold" />
                        {t('settingPasskeys')}
                    </label>
                    <p className="text-[11px] text-vw-console-text-secondary/60 mt-1 ml-6">
                        {t('settingPasskeysHint')}
                    </p>
                </div>
                <button onClick={handleSave} className="w-full py-2.5 bg-vw-gold text-vw-console-bg rounded-lg font-medium hover:bg-[#C69431] flex items-center justify-center gap-2">
                    {saved ? <><Check className="w-4 h-4" /> {t('actionSaved')}</> : t('vaultSaveSettings')}
                </button>
            </div>

            <KitRestoreCard />
            <ResetDevicePanel />
        </div>
    );
}

/**
 * The settings-surface mount for the kit restore. A successful restore rewrote
 * the keychain out from under this component tree, so the page reloads and the
 * app re-initializes against the restored keys — the same full-reset approach
 * ResetDevicePanel takes with onboarding.
 */
function KitRestoreCard() {
    return (
        <div className="vw-card p-6 mt-6">
            <h2 className="text-sm font-semibold text-white">{t('kitRestoreTitle')}</h2>
            <p className="text-[13px] text-vw-console-text-secondary mt-1.5">
                {t('kitRestoreBody')}
            </p>
            <div className="mt-4">
                <KitRestorePanel onRestored={() => window.location.reload()} />
            </div>
        </div>
    );
}

/**
 * Rotating the account keys, which is otherwise impossible.
 *
 * The KEM and signing keypairs are generated once during onboarding and nothing
 * replaces them, so a leaked recovery kit — which carries both secret keys and
 * the master key under a four-character PIN — has no answer except starting
 * over. Every item is sealed to that KEM public key, so "rotate" and "wipe this
 * device" are the same operation.
 *
 * Typing the word is the guard. A confirm() dialog is dismissible by muscle
 * memory and this is not a recoverable action.
 */
function ResetDevicePanel() {
    const [open, setOpen] = useState(false);
    const [typed, setTyped] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reset = async () => {
        setBusy(true);
        setError(null);
        const resp = await chrome.runtime.sendMessage({ type: 'RESET_DEVICE', payload: { confirm: 'RESET' } });
        if (!resp?.success) {
            setError(resp?.error ?? t('vaultResetFailed'));
            setBusy(false);
            return;
        }
        // Straight to onboarding rather than a success message: there is no
        // vault left to return to, and every other view would render its empty
        // state, which looks like a bug.
        window.location.href = chrome.runtime.getURL('onboarding.html');
    };

    return (
        <div className="vw-card p-6 mt-6 border-red-900/40">
            <h2 className="text-sm font-semibold text-red-400">{t('vaultResetTitle')}</h2>
            <p className="text-[13px] text-vw-console-text-secondary mt-1.5">
                {t('vaultResetBody')}
            </p>
            <p className="text-[11px] text-vw-console-text-secondary/60 mt-1.5">
                {t('vaultResetServerNote')}
            </p>

            {!open ? (
                <button
                    onClick={() => setOpen(true)}
                    className="mt-4 px-4 py-2 text-sm border border-red-900/60 text-red-400 rounded-lg hover:bg-red-950/30"
                >
                    {t('vaultResetTitle')}
                </button>
            ) : (
                <div className="mt-4 space-y-2">
                    <label className="block text-xs text-vw-console-text-secondary">
                        {t('vaultResetTypeConfirm', { word: 'RESET' })}
                    </label>
                    <input
                        value={typed}
                        onChange={e => setTyped(e.target.value)}
                        autoCapitalize="characters"
                        spellCheck={false}
                        className="px-3 py-2 bg-vw-console-surface border border-vw-console-border rounded-lg text-sm text-white focus:outline-none focus:border-red-500"
                    />
                    {error && <p className="text-xs text-red-400">{error}</p>}
                    <div className="flex gap-2">
                        <button
                            disabled={typed !== 'RESET' || busy}
                            onClick={reset}
                            className="px-4 py-2 text-sm bg-red-900/60 text-red-100 rounded-lg disabled:opacity-40 hover:bg-red-900"
                        >
                            {busy ? t('vaultResetting') : t('vaultEraseAndStartOver')}
                        </button>
                        <button
                            onClick={() => { setOpen(false); setTyped(''); setError(null); }}
                            className="px-4 py-2 text-sm text-vw-console-text-secondary hover:text-white"
                        >
                            {t('actionCancel')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function DevicesPanel() {
    const [devices, setDevices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        import('../api/devices').then(({ listDevices }) => {
            listDevices().then((resp) => {
                setDevices(resp.devices);
                setLoading(false);
            }).catch(() => setLoading(false));
        });
    }, []);

    return (
        <div className="max-w-xl">
            <h1 className="text-2xl font-bold text-white mb-6">{t('vaultNavDevices')}</h1>
            {loading ? (
                <div className="flex items-center gap-2 text-vw-console-text-secondary"><Loader2 className="w-4 h-4 animate-spin" /> {t('vaultLoadingDevices')}</div>
            ) : devices.length === 0 ? (
                <div className="vw-card p-6 text-center">
                    <Monitor className="w-10 h-10 text-vw-console-text-secondary/30 mx-auto mb-2" />
                    <p className="text-sm text-vw-console-text-secondary">{t('vaultNoDevices')}</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {devices.map((dev) => (
                        <div key={dev.id} className="vw-card p-4 flex items-center gap-4">
                            <Monitor className="w-5 h-5 text-vw-console-text-secondary" />
                            <div className="flex-1">
                                <div className="text-sm font-medium text-white">{dev.deviceName}</div>
                                <div className="text-xs text-vw-console-text-secondary">{dev.platform} · {dev.deviceClass}</div>
                            </div>
                            <div className="flex items-center gap-2">
                                {dev.deviceRole === 'master' && (
                                    <span className="px-2 py-0.5 text-xs bg-vw-gold/20 text-vw-gold rounded-full font-medium">{t('deviceMaster')}</span>
                                )}
                                <span className={`w-2 h-2 rounded-full vw-led ${dev.approvalState === 'approved' ? 'bg-vw-signal-online' : dev.approvalState === 'pending' ? 'bg-vw-signal-warning' : 'bg-vw-signal-alert'}`} />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function relativeTime(iso: string): string {
    const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (seconds < 60) return t('vaultJustNow');
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return t('vaultMinutesAgo', { n: String(minutes) });
    const hours = Math.round(minutes / 60);
    if (hours < 24) return t('vaultHoursAgo', { n: String(hours) });
    return t('vaultDaysAgo', { n: String(Math.round(hours / 24)) });
}

function SyncStatusLine({ status, syncing }: { status: SyncStatus | null; syncing: boolean }) {
    let text: string;
    let tone = 'text-[#161320]/45';

    if (syncing) {
        text = t('vaultSyncing');
    } else if (status?.state === 'error') {
        text = status.error ?? t('vaultSyncFailed');
        tone = 'text-vw-signal-alert';
    } else if (status?.lastSuccessAt) {
        text = t('vaultSyncedAt', { time: relativeTime(status.lastSuccessAt) });
    } else {
        text = t('vaultNotSyncedYet');
    }

    return (
        <div className="px-3 pb-1">
            <p className={`text-[10px] ${tone}`}>{text}</p>
            {/* Identities ride the same sync batch as items now; the old
                "identities stay local" caveat is gone. */}
            <p className="text-[10px] text-[#161320]/35">{t('vaultItemsAndIdentities')}</p>
        </div>
    );
}

function IdentityCard({ identity, itemCount, onClick }: { identity: Identity; itemCount: number; onClick: () => void }) {
    return (
        <div onClick={onClick} className="vw-card p-5 cursor-pointer hover:border-vw-gold/30 transition-colors group">
            <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-vw-console-surface flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {identity.facePhoto ? (
                        <img src={identity.facePhoto} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <User className="w-6 h-6 text-vw-gold" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-white truncate">{identity.fullName}</h3>
                        {identity.metadata.favorite && <Star className="w-3 h-3 text-vw-gold fill-vw-gold flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-vw-console-text-secondary truncate">{identity.nationality} · {identity.email}</p>
                    <p className="text-[10px] text-vw-console-text-secondary/60 mt-1 line-clamp-2">{identity.bio}</p>
                    <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] px-2 py-0.5 bg-vw-console-surface rounded-full text-vw-console-text-secondary">
                            {t(itemCount === 1 ? 'vaultOneItem' : 'vaultManyItems', { n: String(itemCount) })}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function IdentityEditorModal({ mode, data, onSave, onCancel }: {
    mode: IdentityEditorMode;
    data: GeneratedIdentityData;
    onSave: (data: GeneratedIdentityData) => void;
    onCancel: () => void;
}) {
    const [local, setLocal] = useState<GeneratedIdentityData>(data);
    const [validationError, setValidationError] = useState('');

    const inputClass = "w-full px-3 py-2 bg-vw-console-surface border border-vw-console-border rounded-lg text-sm text-white focus:outline-none focus:border-vw-gold";
    const labelClass = "block text-xs font-medium text-vw-console-text-secondary mb-1.5";

    const title = mode === 'review'
        ? t('identityReviewTitle')
        : mode === 'edit' ? t('identityEditTitle') : t('identityNewTitle');

    const submit = () => {
        if (!local.fullName.trim()) {
            setValidationError(t('identityNameRequired'));
            return;
        }
        setValidationError('');
        // A record written by an older version — or returned by a generation
        // endpoint that omitted the block — may have no address at all, so it
        // is defaulted rather than destructured blind.
        const address = local.address ?? emptyIdentityData().address;
        // The address carries its own name field; keep it in step with the
        // persona so autofill does not put two different names on one form.
        onSave({
            ...local,
            address: {
                ...address,
                fullName: (address.fullName ?? '').trim() || local.fullName,
                phone: address.phone || local.phone,
            },
        });
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onCancel}>
            <div className="vw-card p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                    <div className="flex items-center gap-2">
                        {mode === 'review' ? <Sparkles className="w-5 h-5 text-vw-gold" /> : <User className="w-5 h-5 text-vw-gold" />}
                        <h2 className="text-lg font-semibold text-white">{title}</h2>
                    </div>
                    <button onClick={onCancel} className="text-vw-console-text-secondary hover:text-white"><X className="w-5 h-5" /></button>
                </div>

                {validationError && (
                    <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg border border-vw-signal-alert/40 bg-vw-signal-alert/10 text-xs text-vw-signal-alert">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{validationError}</span>
                    </div>
                )}

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass}>{t('fieldFullName')}</label>
                            <input
                                className={inputClass}
                                value={local.fullName}
                                autoFocus
                                placeholder="Jean Tremblay"
                                onChange={(e) => setLocal({ ...local, fullName: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>{t('fieldGender')}</label>
                            <select className={inputClass} value={local.gender} onChange={(e) => setLocal({ ...local, gender: e.target.value as any })}>
                                <option value="male">{t('genderMale')}</option>
                                <option value="female">{t('genderFemale')}</option>
                                <option value="non-binary">{t('genderNonBinary')}</option>
                                <option value="other">{t('genderOther')}</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass}>{t('fieldBirthDate')}</label>
                            <input type="date" className={inputClass} value={local.birthDate} onChange={(e) => setLocal({ ...local, birthDate: e.target.value })} />
                        </div>
                        <div>
                            <label className={labelClass}>{t('fieldNationality')}</label>
                            <input className={inputClass} placeholder="Canada" value={local.nationality} onChange={(e) => setLocal({ ...local, nationality: e.target.value })} />
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>{t('fieldBio')}</label>
                        <textarea className={inputClass} rows={2} value={local.bio} onChange={(e) => setLocal({ ...local, bio: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass}>{t('fieldEmail')}</label>
                            <input className={inputClass} value={local.email} onChange={(e) => setLocal({ ...local, email: e.target.value })} />
                        </div>
                        <div>
                            <label className={labelClass}>{t('fieldPhone')}</label>
                            <input className={inputClass} value={local.phone} onChange={(e) => setLocal({ ...local, phone: e.target.value })} />
                        </div>
                    </div>
                    <div className="border-t border-vw-console-border pt-4">
                        <p className="text-xs font-medium text-vw-console-text-secondary mb-3">{t('sectionAddress')}</p>
                        <div className="space-y-3">
                            <input className={inputClass} placeholder={t('fieldStreet')} value={local.address.street} onChange={(e) => setLocal({ ...local, address: { ...local.address, street: e.target.value } })} />
                            <div className="grid grid-cols-2 gap-3">
                                <input className={inputClass} placeholder={t('fieldCity')} value={local.address.city} onChange={(e) => setLocal({ ...local, address: { ...local.address, city: e.target.value } })} />
                                <input className={inputClass} placeholder={t('fieldStateProvince')} value={local.address.state} onChange={(e) => setLocal({ ...local, address: { ...local.address, state: e.target.value } })} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <input className={inputClass} placeholder={t('fieldZip')} value={local.address.zipCode} onChange={(e) => setLocal({ ...local, address: { ...local.address, zipCode: e.target.value } })} />
                                <input className={inputClass} placeholder={t('fieldCountry')} value={local.address.country} onChange={(e) => setLocal({ ...local, address: { ...local.address, country: e.target.value } })} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 mt-6">
                    <button onClick={onCancel} className="px-4 py-2 text-sm text-vw-console-text-secondary hover:text-white">{t('actionDiscard')}</button>
                    <button onClick={submit} className="px-4 py-2 bg-vw-gold text-vw-console-bg rounded-lg text-sm font-medium hover:bg-[#C69431]">
                        {t('identitySave')}
                    </button>
                </div>
            </div>
        </div>
    );
}

function IdentityDetailView({ identity, items, allItems, onBack, onDelete, onEdit, onEditItem, onAssignItem, onUnassignItem, onCreateItem }: {
    identity: Identity;
    items: VaultItem[];
    allItems: VaultItem[];
    onBack: () => void;
    onDelete: () => void;
    onEdit: () => void;
    onEditItem: (item: VaultItem) => void;
    onAssignItem: (itemId: string) => void;
    onUnassignItem: (itemId: string) => void;
    onCreateItem: () => void;
}) {
    const [showAssignList, setShowAssignList] = useState(false);
    const unassignedItems = allItems.filter(i => !i.identityId && !i.deletedAt);

    return (
        <div>
            <div className="flex items-center gap-3 mb-6">
                <button onClick={onBack} className="text-vw-console-text-secondary hover:text-white flex items-center gap-1 text-sm">
                    <ChevronRight className="w-4 h-4 rotate-180" /> {t('actionBack')}
                </button>
            </div>

            <div className="flex items-start gap-6 mb-8">
                <div className="w-20 h-20 rounded-2xl bg-vw-console-surface flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {identity.facePhoto ? (
                        <img src={identity.facePhoto} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <User className="w-8 h-8 text-vw-gold" />
                    )}
                </div>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-white">{identity.fullName}</h1>
                    <p className="text-sm text-vw-console-text-secondary mt-1">{identity.gender} · {identity.birthDate} · {identity.nationality}</p>
                    <p className="text-sm text-vw-console-text-secondary/80 mt-2">{identity.bio}</p>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={onEdit} className="text-vw-console-text-secondary hover:text-white text-sm flex items-center gap-1">
                        <Settings className="w-4 h-4" /> {t('actionEdit')}
                    </button>
                    <ConfirmDeleteButton onConfirm={onDelete} className="text-vw-signal-alert/60 hover:text-vw-signal-alert text-sm flex items-center gap-1" />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="vw-card p-4">
                    <p className="text-xs font-medium text-vw-console-text-secondary uppercase tracking-wider mb-2">{t('vaultContact')}</p>
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-sm text-white">
                            <span className="text-vw-console-text-secondary text-xs w-16">{t('fieldEmail')}</span> {identity.email}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-white">
                            <span className="text-vw-console-text-secondary text-xs w-16">{t('fieldPhone')}</span> {identity.phone}
                        </div>
                    </div>
                </div>
                <div className="vw-card p-4">
                    <p className="text-xs font-medium text-vw-console-text-secondary uppercase tracking-wider mb-2">{t('sectionAddress')}</p>
                    <div className="text-sm text-white space-y-0.5">
                        <p>{identity.address.street}</p>
                        <p>{identity.address.city}, {identity.address.state} {identity.address.zipCode}</p>
                        <p>{identity.address.country}</p>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">{t('vaultLinkedItems', { n: String(items.length) })}</h2>
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowAssignList(!showAssignList)} className="text-xs text-vw-gold hover:underline">
                        {showAssignList ? t('actionCancel') : t('vaultAssignExisting')}
                    </button>
                    <button onClick={onCreateItem} className="flex items-center gap-1 text-xs text-vw-gold hover:underline">
                        <Plus className="w-3 h-3" /> {t('vaultNewItem')}
                    </button>
                </div>
            </div>

            {showAssignList && unassignedItems.length > 0 && (
                <div className="vw-card p-3 mb-4 space-y-1">
                    {unassignedItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-2 hover:bg-vw-console-surface rounded-lg cursor-pointer" onClick={() => { onAssignItem(item.id); setShowAssignList(false); }}>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-vw-console-text-secondary uppercase">{item.itemType}</span>
                                <span className="text-sm text-white">{item.metadata.label}</span>
                            </div>
                            <Plus className="w-3 h-3 text-vw-gold" />
                        </div>
                    ))}
                </div>
            )}

            {items.length === 0 ? (
                <p className="text-sm text-vw-console-text-secondary py-8 text-center">{t('vaultNoLinkedItems')}</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map((item) => (
                        <div key={item.id} className="vw-card p-4 group">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => onEditItem(item)}>
                                    <div className="w-9 h-9 rounded-lg bg-vw-console-surface flex items-center justify-center flex-shrink-0">
                                        {ITEM_TYPE_CONFIG[item.itemType]?.icon}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium text-white truncate">{item.metadata.label}</div>
                                        <div className="text-xs text-vw-console-text-secondary capitalize">{item.itemType}</div>
                                    </div>
                                </div>
                                <button onClick={() => onUnassignItem(item.id)} className="text-vw-console-text-secondary hover:text-vw-signal-alert opacity-0 group-hover:opacity-100 transition-opacity text-xs" title={t('vaultUnassign')}>
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
