import React, { useState, useEffect, useCallback } from 'react';
import {
    Shield, Lock, Search, Plus, Key, CreditCard, MapPin, Clock, Fingerprint,
    Settings, RefreshCw, Trash2, X, Copy, Eye, EyeOff, Check, Loader2,
    Download, Monitor, ChevronRight, Star, AlertCircle
} from 'lucide-react';
import type { VaultItem, ItemType, VaultSettings, LoginItem, AddressItem, CardItem, TotpItem, PasskeyItem } from '../types';
import { generatePassword, measurePasswordStrength, strengthLabel, strengthColor } from '../utils/password-generator';
import { generateTotpCode, getTotpRemainingSeconds } from '../utils/totp';
import { normalizeDomain, getFaviconUrl, getInitials } from '../utils/domain';

function send<T>(msg: { type: string; payload?: any }): Promise<{ success: boolean; data?: T; error?: string }> {
    return chrome.runtime.sendMessage(msg);
}

type Tab = 'all' | 'logins' | 'addresses' | 'cards' | 'totp' | 'passkeys' | 'generator' | 'settings' | 'devices';

const ITEM_TYPE_CONFIG: Record<ItemType, { label: string; icon: React.ReactNode; color: string }> = {
    login: { label: 'Login', icon: <Key className="w-4 h-4" />, color: 'text-vw-gold' },
    address: { label: 'Address', icon: <MapPin className="w-4 h-4" />, color: 'text-vw-signal-relay' },
    card: { label: 'Card', icon: <CreditCard className="w-4 h-4" />, color: 'text-vw-signal-online' },
    totp: { label: 'TOTP', icon: <Clock className="w-4 h-4" />, color: 'text-vw-signal-sync' },
    passkey: { label: 'Passkey', icon: <Fingerprint className="w-4 h-4" />, color: 'text-vw-violet' },
};

export default function App() {
    const [initialized, setInitialized] = useState<boolean | null>(null);
    const [unlocked, setUnlocked] = useState(false);
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [items, setItems] = useState<VaultItem[]>([]);
    const [tab, setTab] = useState<Tab>('all');
    const [search, setSearch] = useState('');
    const [editingItem, setEditingItem] = useState<VaultItem | null>(null);
    const [creatingType, setCreatingType] = useState<ItemType | null>(null);
    const [settings, setSettings] = useState<VaultSettings | null>(null);
    const [loading, setLoading] = useState(false);

    const checkInit = useCallback(async () => {
        const resp = await send<{ initialized: boolean }>({ type: 'INIT_CHECK' });
        setInitialized(resp.data?.initialized ?? false);
    }, []);

    const checkUnlocked = useCallback(async () => {
        const resp = await send<{ unlocked: boolean }>({ type: 'GET_UNLOCKED' });
        setUnlocked(resp.data?.unlocked ?? false);
    }, []);

    const loadItems = useCallback(async () => {
        const resp = await send<VaultItem[]>({ type: 'GET_ITEMS' });
        if (resp.success && resp.data) setItems(resp.data);
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
        if (unlocked) {
            loadItems();
            loadSettings();
        }
    }, [unlocked, loadItems, loadSettings]);

    const handleUnlock = async () => {
        setLoading(true);
        const resp = await send({ type: 'UNLOCK', payload: { pin } });
        setLoading(false);
        if (resp.success) {
            setUnlocked(true);
            setPin('');
            setError('');
        } else {
            setError(resp.error ?? 'Unlock failed');
        }
    };

    const handleLock = async () => {
        await send({ type: 'LOCK' });
        setUnlocked(false);
        setItems([]);
    };

    const handleSync = async () => {
        setLoading(true);
        await send({ type: 'SYNC' });
        setLoading(false);
        await loadItems();
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
                    <h1 className="text-xl font-bold text-[#161320] mb-2">Vault Not Set Up</h1>
                    <p className="text-sm text-[#161320]/70 mb-6">Complete the onboarding to create your encrypted vault.</p>
                    <button
                        onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('onboarding.html') })}
                        className="w-full py-3 bg-[#D6A441] text-white rounded-lg font-medium hover:bg-[#C69431]"
                    >
                        Start Setup
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
                            <h1 className="text-lg font-semibold text-white">Unlock Vault</h1>
                            <p className="text-xs text-vw-console-text-secondary">Enter your PIN to decrypt locally</p>
                        </div>
                    </div>
                    <input
                        type="password"
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                        placeholder="••••"
                        className="w-full px-4 py-3 bg-vw-console-surface border border-vw-console-border rounded-lg text-white font-mono text-lg focus:outline-none focus:border-vw-gold mb-3"
                        autoFocus
                    />
                    {error && <p className="text-sm text-vw-signal-alert mb-3">{error}</p>}
                    <button
                        onClick={handleUnlock}
                        disabled={loading || !pin}
                        className="w-full py-3 bg-vw-gold text-vw-console-bg rounded-lg font-medium hover:bg-[#C69431] disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                        Unlock
                    </button>
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
            return (
                item.metadata.label.toLowerCase().includes(q) ||
                item.metadata.domain?.toLowerCase().includes(q) ||
                item.metadata.tags.some(t => t.toLowerCase().includes(q))
            );
        }
        return true;
    });

    const navItems: { tab: Tab; label: string; icon: React.ReactNode }[] = [
        { tab: 'all', label: 'All Items', icon: <Shield className="w-4 h-4" /> },
        { tab: 'logins', label: 'Logins', icon: <Key className="w-4 h-4" /> },
        { tab: 'addresses', label: 'Addresses', icon: <MapPin className="w-4 h-4" /> },
        { tab: 'cards', label: 'Cards', icon: <CreditCard className="w-4 h-4" /> },
        { tab: 'totp', label: 'TOTP', icon: <Clock className="w-4 h-4" /> },
        { tab: 'passkeys', label: 'Passkeys', icon: <Fingerprint className="w-4 h-4" /> },
        { tab: 'generator', label: 'Generator', icon: <RefreshCw className="w-4 h-4" /> },
        { tab: 'devices', label: 'Devices', icon: <Monitor className="w-4 h-4" /> },
        { tab: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
    ];

    return (
        <div className="flex h-screen overflow-hidden">
            {/* Warm-mode sidebar */}
            <aside className="vw-warm-shell w-60 flex-shrink-0 flex flex-col border-r border-[#161320]/8">
                <div className="px-5 py-5 border-b border-[#161320]/8">
                    <div className="flex items-center gap-2.5">
                        <Shield className="w-7 h-7 text-[#D6A441]" />
                        <div>
                            <div className="text-sm font-bold text-[#161320]">VaultWares</div>
                            <div className="text-[10px] text-[#161320]/50 uppercase tracking-wider">Identity Vault</div>
                        </div>
                    </div>
                </div>
                <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
                    {navItems.map(({ tab: t, label, icon }) => (
                        <button
                            key={t}
                            onClick={() => { setTab(t); setEditingItem(null); setCreatingType(null); }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                                tab === t
                                    ? 'bg-[#D6A441]/15 text-[#D6A441] font-medium'
                                    : 'text-[#161320]/70 hover:bg-[#161320]/5'
                            }`}
                        >
                            {icon}
                            {label}
                        </button>
                    ))}
                </nav>
                <div className="px-3 py-3 border-t border-[#161320]/8">
                    <button
                        onClick={handleSync}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#161320]/70 hover:bg-[#161320]/5 transition-colors"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Sync
                    </button>
                    <button
                        onClick={handleLock}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#161320]/70 hover:bg-[#161320]/5 transition-colors"
                    >
                        <Lock className="w-4 h-4" />
                        Lock Vault
                    </button>
                </div>
            </aside>

            {/* Console-mode content */}
            <main className="vw-console-shell flex-1 overflow-y-auto">
                <div className="p-8">
                    {tab !== 'generator' && tab !== 'settings' && tab !== 'devices' && (
                        <>
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h1 className="text-2xl font-bold text-white capitalize">
                                        {tab === 'all' ? 'All Items' : tab}
                                    </h1>
                                    <p className="text-sm text-vw-console-text-secondary mt-1">
                                        {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-vw-console-text-secondary" />
                                        <input
                                            type="search"
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            placeholder="Search…"
                                            className="pl-9 pr-4 py-2 bg-vw-console-surface border border-vw-console-border rounded-lg text-sm text-white focus:outline-none focus:border-vw-gold w-64"
                                        />
                                    </div>
                                    <button
                                        onClick={() => setCreatingType('login')}
                                        className="flex items-center gap-2 px-4 py-2 bg-vw-gold text-vw-console-bg rounded-lg text-sm font-medium hover:bg-[#C69431]"
                                    >
                                        <Plus className="w-4 h-4" />
                                        New Item
                                    </button>
                                </div>
                            </div>

                            {filteredItems.length === 0 ? (
                                <div className="text-center py-20">
                                    <Shield className="w-12 h-12 text-vw-console-text-secondary/30 mx-auto mb-3" />
                                    <p className="text-vw-console-text-secondary">No items yet. Create your first vault item.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filteredItems.map((item) => (
                                        <ItemCard key={item.id} item={item} onClick={() => setEditingItem(item)} />
                                    ))}
                                </div>
                            )}

                            {creatingType && (
                                <ItemEditor
                                    itemType={creatingType}
                                    onSave={(data, metadata) => handleSaveItem(creatingType, data, metadata)}
                                    onCancel={() => setCreatingType(null)}
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
                    {tab === 'settings' && <SettingsPanel settings={settings} onSave={async (s) => { await send({ type: 'SAVE_SETTINGS', payload: s }); setSettings(s); }} />}
                    {tab === 'devices' && <DevicesPanel />}
                </div>
            </main>
        </div>
    );
}

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
                        {item.itemType === 'login' && (item.data as LoginItem).username}
                        {item.itemType === 'address' && `${(item.data as AddressItem).fullName}`}
                        {item.itemType === 'card' && `•••• ${(item.data as CardItem).cardNumber.slice(-4)}`}
                        {item.itemType === 'totp' && (item.data as TotpItem).issuer || (item.data as TotpItem).label}
                        {item.itemType === 'passkey' && (item.data as PasskeyItem).rpId}
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
                            <Eye className="w-3.5 h-3.5" /> Show code
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

function ItemEditor({ item, itemType, onSave, onCancel, onDelete }: {
    item?: VaultItem;
    itemType: ItemType;
    onSave: (data: any, metadata: any) => void;
    onCancel: () => void;
    onDelete?: () => void;
}) {
    const [label, setLabel] = useState(item?.metadata.label ?? '');
    const [favorite, setFavorite] = useState(item?.metadata.favorite ?? false);
    const [showPassword, setShowPassword] = useState(false);

    const [loginData, setLoginData] = useState<LoginItem>(item?.itemType === 'login' ? item.data as LoginItem : { url: '', username: '', password: '', notes: '', totpSecret: '' });
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
            case 'login': return normalizeDomain(loginData.url) || loginData.username || 'Login';
            case 'address': return addressData.fullName || 'Address';
            case 'card': return cardData.holderName || 'Card';
            case 'totp': return totpData.label || totpData.issuer || 'TOTP';
            case 'passkey': return passkeyData.rpId || 'Passkey';
        }
    };

    const getDomain = () => {
        if (itemType === 'login') return normalizeDomain(loginData.url);
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
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold text-white">{item ? 'Edit' : 'New'} {ITEM_TYPE_CONFIG[itemType].label}</h2>
                    <button onClick={onCancel} className="text-vw-console-text-secondary hover:text-white"><X className="w-5 h-5" /></button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className={labelClass}>Label</label>
                        <input className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={getDefaultLabel()} />
                    </div>

                    {itemType === 'login' && (
                        <>
                            <div>
                                <label className={labelClass}>URL</label>
                                <input className={inputClass} value={loginData.url} onChange={(e) => setLoginData({ ...loginData, url: e.target.value })} placeholder="https://example.com" />
                            </div>
                            <div>
                                <label className={labelClass}>Username or Email</label>
                                <input className={inputClass} value={loginData.username} onChange={(e) => setLoginData({ ...loginData, username: e.target.value })} />
                            </div>
                            <div>
                                <label className={labelClass}>Password</label>
                                <div className="flex gap-2">
                                    <input className={inputClass} type={showPassword ? 'text' : 'password'} value={loginData.password} onChange={(e) => setLoginData({ ...loginData, password: e.target.value })} />
                                    <button onClick={() => setShowPassword(!showPassword)} className="px-3 bg-vw-console-surface border border-vw-console-border rounded-lg text-vw-console-text-secondary hover:text-white">
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}>TOTP Secret (optional)</label>
                                <input className={inputClass} value={loginData.totpSecret ?? ''} onChange={(e) => setLoginData({ ...loginData, totpSecret: e.target.value })} placeholder="Base32 secret" />
                            </div>
                            <div>
                                <label className={labelClass}>Notes</label>
                                <textarea className={inputClass} rows={2} value={loginData.notes ?? ''} onChange={(e) => setLoginData({ ...loginData, notes: e.target.value })} />
                            </div>
                        </>
                    )}

                    {itemType === 'address' && (
                        <>
                            <div><label className={labelClass}>Full Name</label><input className={inputClass} value={addressData.fullName} onChange={(e) => setAddressData({ ...addressData, fullName: e.target.value })} /></div>
                            <div><label className={labelClass}>Street</label><input className={inputClass} value={addressData.street} onChange={(e) => setAddressData({ ...addressData, street: e.target.value })} /></div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className={labelClass}>City</label><input className={inputClass} value={addressData.city} onChange={(e) => setAddressData({ ...addressData, city: e.target.value })} /></div>
                                <div><label className={labelClass}>State/Province</label><input className={inputClass} value={addressData.state} onChange={(e) => setAddressData({ ...addressData, state: e.target.value })} /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className={labelClass}>ZIP/Postal Code</label><input className={inputClass} value={addressData.zipCode} onChange={(e) => setAddressData({ ...addressData, zipCode: e.target.value })} /></div>
                                <div><label className={labelClass}>Country</label><input className={inputClass} value={addressData.country} onChange={(e) => setAddressData({ ...addressData, country: e.target.value })} /></div>
                            </div>
                            <div><label className={labelClass}>Phone (optional)</label><input className={inputClass} value={addressData.phone ?? ''} onChange={(e) => setAddressData({ ...addressData, phone: e.target.value })} /></div>
                        </>
                    )}

                    {itemType === 'card' && (
                        <>
                            <div><label className={labelClass}>Cardholder Name</label><input className={inputClass} value={cardData.holderName} onChange={(e) => setCardData({ ...cardData, holderName: e.target.value })} /></div>
                            <div><label className={labelClass}>Card Number</label><input className={`${inputClass} font-mono`} value={cardData.cardNumber} onChange={(e) => setCardData({ ...cardData, cardNumber: e.target.value })} placeholder="0000 0000 0000 0000" /></div>
                            <div className="grid grid-cols-3 gap-3">
                                <div><label className={labelClass}>Month</label><input className={inputClass} value={cardData.expiryMonth} onChange={(e) => setCardData({ ...cardData, expiryMonth: e.target.value })} placeholder="MM" /></div>
                                <div><label className={labelClass}>Year</label><input className={inputClass} value={cardData.expiryYear} onChange={(e) => setCardData({ ...cardData, expiryYear: e.target.value })} placeholder="YY" /></div>
                                <div><label className={labelClass}>CVV</label><input className={inputClass} type={showPassword ? 'text' : 'password'} value={cardData.cvv} onChange={(e) => setCardData({ ...cardData, cvv: e.target.value })} /></div>
                            </div>
                            <div><label className={labelClass}>Notes</label><textarea className={inputClass} rows={2} value={cardData.notes ?? ''} onChange={(e) => setCardData({ ...cardData, notes: e.target.value })} /></div>
                        </>
                    )}

                    {itemType === 'totp' && (
                        <>
                            <div><label className={labelClass}>Label</label><input className={inputClass} value={totpData.label} onChange={(e) => setTotpData({ ...totpData, label: e.target.value })} /></div>
                            <div><label className={labelClass}>Issuer (optional)</label><input className={inputClass} value={totpData.issuer ?? ''} onChange={(e) => setTotpData({ ...totpData, issuer: e.target.value })} /></div>
                            <div><label className={labelClass}>Secret (Base32)</label><input className={`${inputClass} font-mono`} value={totpData.secret} onChange={(e) => setTotpData({ ...totpData, secret: e.target.value.toUpperCase() })} /></div>
                            <div className="grid grid-cols-3 gap-3">
                                <div><label className={labelClass}>Digits</label><select className={inputClass} value={totpData.digits} onChange={(e) => setTotpData({ ...totpData, digits: parseInt(e.target.value) })}><option value={6}>6</option><option value={8}>8</option></select></div>
                                <div><label className={labelClass}>Period</label><select className={inputClass} value={totpData.period} onChange={(e) => setTotpData({ ...totpData, period: parseInt(e.target.value) })}><option value={30}>30s</option><option value={60}>60s</option></select></div>
                                <div><label className={labelClass}>Algorithm</label><select className={inputClass} value={totpData.algorithm} onChange={(e) => setTotpData({ ...totpData, algorithm: e.target.value as any })}><option value="SHA1">SHA1</option><option value="SHA256">SHA256</option><option value="SHA512">SHA512</option></select></div>
                            </div>
                        </>
                    )}

                    {itemType === 'passkey' && (
                        <>
                            <div><label className={labelClass}>Relying Party ID</label><input className={inputClass} value={passkeyData.rpId} onChange={(e) => setPasskeyData({ ...passkeyData, rpId: e.target.value })} placeholder="example.com" /></div>
                            <div><label className={labelClass}>Credential ID</label><input className={`${inputClass} font-mono`} value={passkeyData.credentialId} onChange={(e) => setPasskeyData({ ...passkeyData, credentialId: e.target.value })} /></div>
                            <div><label className={labelClass}>Private Key</label><textarea className={`${inputClass} font-mono`} rows={3} value={passkeyData.privateKey} onChange={(e) => setPasskeyData({ ...passkeyData, privateKey: e.target.value })} /></div>
                            <div><label className={labelClass}>User Handle</label><input className={inputClass} value={passkeyData.userHandle} onChange={(e) => setPasskeyData({ ...passkeyData, userHandle: e.target.value })} /></div>
                            <div><label className={labelClass}>Notes</label><textarea className={inputClass} rows={2} value={passkeyData.notes ?? ''} onChange={(e) => setPasskeyData({ ...passkeyData, notes: e.target.value })} /></div>
                        </>
                    )}

                    <div className="flex items-center gap-2">
                        <button onClick={() => setFavorite(!favorite)} className={`flex items-center gap-1.5 text-xs ${favorite ? 'text-vw-gold' : 'text-vw-console-text-secondary'}`}>
                            <Star className={`w-4 h-4 ${favorite ? 'fill-vw-gold' : ''}`} /> Favorite
                        </button>
                    </div>
                </div>

                <div className="flex items-center justify-between mt-6 pt-4 border-t border-vw-console-border">
                    <div>
                        {onDelete && (
                            <button onClick={onDelete} className="flex items-center gap-1.5 px-3 py-2 text-sm text-vw-signal-alert hover:bg-vw-signal-alert/10 rounded-lg">
                                <Trash2 className="w-4 h-4" /> Delete
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={onCancel} className="px-4 py-2 text-sm text-vw-console-text-secondary hover:text-white">Cancel</button>
                        <button onClick={handleSave} className="px-4 py-2 bg-vw-gold text-vw-console-bg rounded-lg text-sm font-medium hover:bg-[#C69431]">Save</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function PasswordGeneratorPanel({ settings }: { settings: VaultSettings | null }) {
    const [password, setPassword] = useState('');
    const [length, setLength] = useState(settings?.defaultPasswordLength ?? 20);
    const [uppercase, setUppercase] = useState(true);
    const [lowercase, setLowercase] = useState(true);
    const [numbers, setNumbers] = useState(true);
    const [symbols, setSymbols] = useState(true);
    const [copied, setCopied] = useState(false);

    const generate = () => {
        setPassword(generatePassword({ length, uppercase, lowercase, numbers, symbols }));
    };

    useEffect(() => { generate(); }, []);

    const score = measurePasswordStrength(password);
    const copy = () => { navigator.clipboard.writeText(password); setCopied(true); setTimeout(() => setCopied(false), 1500); };

    return (
        <div className="max-w-xl">
            <h1 className="text-2xl font-bold text-white mb-2">Password Generator</h1>
            <p className="text-sm text-vw-console-text-secondary mb-6">Generate cryptographically secure passwords</p>

            <div className="vw-card p-6 space-y-5">
                <div className="flex items-center gap-3">
                    <input
                        type="text"
                        readOnly
                        value={password}
                        className="flex-1 px-4 py-3 bg-vw-console-surface border border-vw-console-border rounded-lg text-white font-mono text-sm"
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

                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-sm text-vw-console-text-secondary">Length: {length}</label>
                    </div>
                    <input type="range" min="8" max="64" value={length} onChange={(e) => setLength(parseInt(e.target.value))} className="w-full accent-vw-gold" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    {[
                        { label: 'Uppercase (A-Z)', val: uppercase, set: setUppercase },
                        { label: 'Lowercase (a-z)', val: lowercase, set: setLowercase },
                        { label: 'Numbers (0-9)', val: numbers, set: setNumbers },
                        { label: 'Symbols (!@#)', val: symbols, set: setSymbols },
                    ].map(({ label, val, set: setVal }) => (
                        <label key={label} className="flex items-center gap-2 text-sm text-vw-console-text-secondary cursor-pointer">
                            <input type="checkbox" checked={val} onChange={(e) => setVal(e.target.checked)} className="accent-vw-gold" />
                            {label}
                        </label>
                    ))}
                </div>

                <button onClick={generate} className="w-full py-2.5 bg-vw-gold text-vw-console-bg rounded-lg font-medium hover:bg-[#C69431] flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4" /> Generate
                </button>
            </div>
        </div>
    );
}

function SettingsPanel({ settings, onSave }: { settings: VaultSettings | null; onSave: (s: VaultSettings) => Promise<void> }) {
    const [local, setLocal] = useState<VaultSettings>(settings ?? { autoLockMinutes: 5, autoFillEnabled: true, autoDetectEnabled: true, defaultPasswordLength: 20, defaultPasswordComplexity: 'maximum' });
    const [saved, setSaved] = useState(false);

    const handleSave = async () => {
        await onSave(local);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
    };

    const inputClass = "px-3 py-2 bg-vw-console-surface border border-vw-console-border rounded-lg text-sm text-white focus:outline-none focus:border-vw-gold";

    return (
        <div className="max-w-xl">
            <h1 className="text-2xl font-bold text-white mb-6">Settings</h1>
            <div className="vw-card p-6 space-y-5">
                <div>
                    <label className="block text-xs font-medium text-vw-console-text-secondary mb-1.5">Auto-lock (minutes)</label>
                    <input type="number" min="0" max="120" className={inputClass} value={local.autoLockMinutes} onChange={(e) => setLocal({ ...local, autoLockMinutes: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                    <label className="block text-xs font-medium text-vw-console-text-secondary mb-1.5">Default password length</label>
                    <input type="number" min="8" max="64" className={inputClass} value={local.defaultPasswordLength} onChange={(e) => setLocal({ ...local, defaultPasswordLength: parseInt(e.target.value) || 20 })} />
                </div>
                <div>
                    <label className="block text-xs font-medium text-vw-console-text-secondary mb-1.5">Default complexity</label>
                    <select className={inputClass} value={local.defaultPasswordComplexity} onChange={(e) => setLocal({ ...local, defaultPasswordComplexity: e.target.value as any })}>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="maximum">Maximum</option>
                    </select>
                </div>
                <label className="flex items-center gap-2 text-sm text-vw-console-text-secondary cursor-pointer">
                    <input type="checkbox" checked={local.autoFillEnabled} onChange={(e) => setLocal({ ...local, autoFillEnabled: e.target.checked })} className="accent-vw-gold" />
                    Auto-fill forms
                </label>
                <label className="flex items-center gap-2 text-sm text-vw-console-text-secondary cursor-pointer">
                    <input type="checkbox" checked={local.autoDetectEnabled} onChange={(e) => setLocal({ ...local, autoDetectEnabled: e.target.checked })} className="accent-vw-gold" />
                    Auto-detect login/signup forms
                </label>
                <button onClick={handleSave} className="w-full py-2.5 bg-vw-gold text-vw-console-bg rounded-lg font-medium hover:bg-[#C69431] flex items-center justify-center gap-2">
                    {saved ? <><Check className="w-4 h-4" /> Saved</> : 'Save Settings'}
                </button>
            </div>
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
            <h1 className="text-2xl font-bold text-white mb-6">Devices</h1>
            {loading ? (
                <div className="flex items-center gap-2 text-vw-console-text-secondary"><Loader2 className="w-4 h-4 animate-spin" /> Loading devices…</div>
            ) : devices.length === 0 ? (
                <div className="vw-card p-6 text-center">
                    <Monitor className="w-10 h-10 text-vw-console-text-secondary/30 mx-auto mb-2" />
                    <p className="text-sm text-vw-console-text-secondary">No devices registered yet.</p>
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
                                    <span className="px-2 py-0.5 text-xs bg-vw-gold/20 text-vw-gold rounded-full font-medium">Master</span>
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
