import React, { useState } from 'react';
import { Shield, Lock, Download, Check, AlertTriangle, Loader2 } from 'lucide-react';

type Step = 'welcome' | 'account' | 'pin' | 'recovery' | 'done';

function send<T>(msg: { type: string; payload?: any }): Promise<{ success: boolean; data?: T; error?: string }> {
    return chrome.runtime.sendMessage(msg);
}

export default function App() {
    const [step, setStep] = useState<Step>('welcome');
    const [email, setEmail] = useState('');
    const [pin, setPin] = useState('');
    const [pinConfirm, setPinConfirm] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [recoveryKit, setRecoveryKit] = useState<any>(null);
    const [kitDownloaded, setKitDownloaded] = useState(false);

    const handleAccountNext = () => {
        if (!email || !email.includes('@')) {
            setError('Please enter a valid email address');
            return;
        }
        setError('');
        setStep('pin');
    };

    const handlePinNext = async () => {
        if (pin.length < 4) {
            setError('PIN must be at least 4 digits');
            return;
        }
        if (pin !== pinConfirm) {
            setError('PINs do not match');
            return;
        }
        setError('');
        setLoading(true);
        const resp = await send<{ deviceId: string; deviceRole: string }>({
            type: 'SETUP_ACCOUNT',
            payload: { email, pin },
        });
        setLoading(false);
        if (resp.success) {
            setStep('recovery');
        } else {
            setError(resp.error ?? 'Setup failed');
        }
    };

    const handleGenerateKit = async () => {
        setLoading(true);
        const resp = await send<any>({
            type: 'GENERATE_RECOVERY_KIT',
            payload: { pin },
        });
        setLoading(false);
        if (resp.success) {
            setRecoveryKit(resp.data);
        } else {
            setError(resp.error ?? 'Failed to generate recovery kit');
        }
    };

    const handleDownloadKit = async () => {
        if (!recoveryKit) return;
        await send({ type: 'DOWNLOAD_RECOVERY_KIT', payload: { kit: recoveryKit } });
        setKitDownloaded(true);
    };

    const handleFinish = () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('vault.html') });
        window.close();
    };

    return (
        <div className="vw-warm-shell min-h-screen flex items-center justify-center p-8">
            <div className="vw-warm-card p-10 max-w-lg w-full">
                <div className="flex items-center gap-3 mb-8">
                    <Shield className="w-8 h-8 text-vw-gold" />
                    <div>
                        <h1 className="text-xl font-bold text-[#161320]">VaultWares</h1>
                        <p className="text-sm text-[#161320]/60">Identity Manager Setup</p>
                    </div>
                </div>

                {step === 'welcome' && (
                    <div className="space-y-6">
                        <div className="space-y-3">
                            <h2 className="text-lg font-semibold text-[#161320]">Welcome to your zero-knowledge vault</h2>
                            <p className="text-sm text-[#161320]/70">
                                VaultWares uses post-quantum cryptography (ML-KEM-768, ML-DSA-65) to protect your data.
                                Your vault is encrypted on your device and never decrypted on our servers.
                            </p>
                            <div className="bg-[#ECE5D8] rounded-lg p-4 space-y-2">
                                <div className="flex items-start gap-2">
                                    <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                                    <span className="text-xs text-[#161320]/80">Passwords, addresses, cards, TOTP, and passkeys</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                                    <span className="text-xs text-[#161320]/80">Encrypted sync across devices</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                                    <span className="text-xs text-[#161320]/80">Post-quantum cryptography (NIST standardized)</span>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => setStep('account')}
                            className="w-full py-3 bg-[#D6A441] text-white rounded-lg font-medium hover:bg-[#C69431] transition-colors"
                        >
                            Get Started
                        </button>
                    </div>
                )}

                {step === 'account' && (
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <h2 className="text-lg font-semibold text-[#161320]">Create your account</h2>
                            <p className="text-sm text-[#161320]/70">This email identifies your account. Your vault data stays encrypted.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[#161320] mb-1.5">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                className="w-full px-4 py-2.5 bg-white border border-[#161320]/10 rounded-lg text-[#161320] focus:outline-none focus:border-[#D6A441]"
                            />
                        </div>
                        {error && <p className="text-sm text-red-600">{error}</p>}
                        <button
                            onClick={handleAccountNext}
                            className="w-full py-3 bg-[#D6A441] text-white rounded-lg font-medium hover:bg-[#C69431] transition-colors"
                        >
                            Continue
                        </button>
                    </div>
                )}

                {step === 'pin' && (
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <h2 className="text-lg font-semibold text-[#161320]">Set your unlock PIN</h2>
                            <p className="text-sm text-[#161320]/70">This PIN decrypts your vault locally. Choose something memorable — there is no recovery without your kit.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[#161320] mb-1.5">PIN</label>
                            <input
                                type="password"
                                value={pin}
                                onChange={(e) => setPin(e.target.value)}
                                placeholder="••••"
                                className="w-full px-4 py-2.5 bg-white border border-[#161320]/10 rounded-lg text-[#161320] focus:outline-none focus:border-[#D6A441] font-mono"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[#161320] mb-1.5">Confirm PIN</label>
                            <input
                                type="password"
                                value={pinConfirm}
                                onChange={(e) => setPinConfirm(e.target.value)}
                                placeholder="••••"
                                className="w-full px-4 py-2.5 bg-white border border-[#161320]/10 rounded-lg text-[#161320] focus:outline-none focus:border-[#D6A441] font-mono"
                            />
                        </div>
                        {error && <p className="text-sm text-red-600">{error}</p>}
                        <button
                            onClick={handlePinNext}
                            disabled={loading}
                            className="w-full py-3 bg-[#D6A441] text-white rounded-lg font-medium hover:bg-[#C69431] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                            {loading ? 'Generating keys…' : 'Create Vault'}
                        </button>
                    </div>
                )}

                {step === 'recovery' && (
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <h2 className="text-lg font-semibold text-[#161320]">Save your recovery kit</h2>
                            <p className="text-sm text-[#161320]/70">
                                If you lose this device or forget your PIN, the recovery kit is the only way to regain access to your vault.
                                Store it somewhere safe — we cannot recover it for you.
                            </p>
                        </div>
                        <div className="bg-[#FFF3CD] border border-[#161320]/10 rounded-lg p-4 flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-[#161320]/80">
                                Without your recovery kit, losing your device means permanent loss of vault access.
                            </p>
                        </div>
                        {!recoveryKit ? (
                            <button
                                onClick={handleGenerateKit}
                                disabled={loading}
                                className="w-full py-3 bg-[#D6A441] text-white rounded-lg font-medium hover:bg-[#C69431] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                Generate Recovery Kit
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={handleDownloadKit}
                                    className="w-full py-3 bg-[#2A2340] text-white rounded-lg font-medium hover:bg-[#453763] transition-colors flex items-center justify-center gap-2"
                                >
                                    <Download className="w-4 h-4" />
                                    {kitDownloaded ? 'Downloaded — Download Again' : 'Download Recovery Kit'}
                                </button>
                                {kitDownloaded && (
                                    <button
                                        onClick={handleFinish}
                                        className="w-full py-3 bg-[#D6A441] text-white rounded-lg font-medium hover:bg-[#C69431] transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Check className="w-4 h-4" />
                                        Open My Vault
                                    </button>
                                )}
                            </>
                        )}
                        {error && <p className="text-sm text-red-600">{error}</p>}
                    </div>
                )}
            </div>
        </div>
    );
}
