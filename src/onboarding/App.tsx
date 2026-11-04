import React, { useState } from 'react';
import { Shield, Lock, Download, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { t } from '../i18n/strings';
import { KitRestorePanel } from '../vault/KitRestorePanel';

type Step = 'welcome' | 'account' | 'pin' | 'recovery' | 'done' | 'restore';

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
            setError(t('onboardEmailInvalid'));
            return;
        }
        setError('');
        setStep('pin');
    };

    const handlePinNext = async () => {
        if (pin.length < 4) {
            setError(t('onboardPinTooShort'));
            return;
        }
        if (pin !== pinConfirm) {
            setError(t('onboardPinMismatch'));
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
            setError(resp.error ?? t('onboardSetupFailed'));
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
            setError(resp.error ?? t('onboardKitFailed'));
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
                        <p className="text-sm text-[#161320]/60">{t('onboardSubtitle')}</p>
                    </div>
                </div>

                {step === 'welcome' && (
                    <div className="space-y-6">
                        <div className="space-y-3">
                            <h2 className="text-lg font-semibold text-[#161320]">{t('onboardWelcomeTitle')}</h2>
                            <p className="text-sm text-[#161320]/70">
                                {t('onboardWelcomeBody')}
                            </p>
                            <div className="bg-vw-warm-muted rounded-lg p-4 space-y-2">
                                <div className="flex items-start gap-2">
                                    <Check className="w-4 h-4 text-vw-signal-online mt-0.5 flex-shrink-0" />
                                    <span className="text-xs text-[#161320]/80">{t('onboardFeatureItems')}</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <Check className="w-4 h-4 text-vw-signal-online mt-0.5 flex-shrink-0" />
                                    <span className="text-xs text-[#161320]/80">{t('onboardFeatureSync')}</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <Check className="w-4 h-4 text-vw-signal-online mt-0.5 flex-shrink-0" />
                                    <span className="text-xs text-[#161320]/80">{t('onboardFeaturePqc')}</span>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => setStep('account')}
                            className="w-full py-3 bg-vw-gold text-white rounded-lg font-medium hover:bg-[color-mix(in_srgb,_var(--vault-console-gold)_80%,_#000)] transition-colors"
                        >
                            {t('onboardGetStarted')}
                        </button>
                        <button
                            onClick={() => setStep('restore')}
                            className="text-xs text-[#161320]/60 hover:text-[#161320] transition-colors"
                        >
                            {t('kitRestoreLink')}
                        </button>
                    </div>
                )}

                {step === 'restore' && (
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <h2 className="text-lg font-semibold text-[#161320]">{t('kitRestoreTitle')}</h2>
                            <p className="text-sm text-[#161320]/70">{t('kitRestoreBody')}</p>
                        </div>
                        <KitRestorePanel
                            variant="warm"
                            onRestored={() => {
                                chrome.tabs.create({ url: chrome.runtime.getURL('vault.html') });
                                window.close();
                            }}
                        />
                        <button
                            onClick={() => setStep('welcome')}
                            className="text-xs text-[#161320]/60 hover:text-[#161320] transition-colors"
                        >
                            {t('actionCancel')}
                        </button>
                    </div>
                )}

                {step === 'account' && (
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <h2 className="text-lg font-semibold text-[#161320]">{t('onboardAccountTitle')}</h2>
                            <p className="text-sm text-[#161320]/70">{t('onboardAccountBody')}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[#161320] mb-1.5">{t('onboardEmailLabel')}</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                className="w-full px-4 py-2.5 bg-white border border-[#161320]/10 rounded-lg text-[#161320] focus:outline-none focus:border-vw-gold"
                            />
                        </div>
                        {error && <p className="text-sm text-vw-signal-alert">{error}</p>}
                        <button
                            onClick={handleAccountNext}
                            className="w-full py-3 bg-vw-gold text-white rounded-lg font-medium hover:bg-[color-mix(in_srgb,_var(--vault-console-gold)_80%,_#000)] transition-colors"
                        >
                            {t('onboardContinue')}
                        </button>
                    </div>
                )}

                {step === 'pin' && (
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <h2 className="text-lg font-semibold text-[#161320]">{t('onboardPinTitle')}</h2>
                            <p className="text-sm text-[#161320]/70">{t('onboardPinBody')}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[#161320] mb-1.5">{t('onboardPinLabel')}</label>
                            <input
                                type="password"
                                value={pin}
                                onChange={(e) => setPin(e.target.value)}
                                placeholder="••••"
                                className="w-full px-4 py-2.5 bg-white border border-[#161320]/10 rounded-lg text-[#161320] focus:outline-none focus:border-vw-gold font-mono"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[#161320] mb-1.5">{t('onboardPinConfirmLabel')}</label>
                            <input
                                type="password"
                                value={pinConfirm}
                                onChange={(e) => setPinConfirm(e.target.value)}
                                placeholder="••••"
                                className="w-full px-4 py-2.5 bg-white border border-[#161320]/10 rounded-lg text-[#161320] focus:outline-none focus:border-vw-gold font-mono"
                            />
                        </div>
                        {error && <p className="text-sm text-vw-signal-alert">{error}</p>}
                        <button
                            onClick={handlePinNext}
                            disabled={loading}
                            className="w-full py-3 bg-vw-gold text-white rounded-lg font-medium hover:bg-[color-mix(in_srgb,_var(--vault-console-gold)_80%,_#000)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                            {loading ? t('onboardGeneratingKeys') : t('onboardCreateVault')}
                        </button>
                    </div>
                )}

                {step === 'recovery' && (
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <h2 className="text-lg font-semibold text-[#161320]">{t('onboardRecoveryTitle')}</h2>
                            <p className="text-sm text-[#161320]/70">
                                {t('onboardRecoveryBody')}
                            </p>
                        </div>
                        <div className="bg-[color-mix(in_srgb,_var(--vault-signal-warning)_22%,_var(--vault-warm-raised))] border border-[#161320]/10 rounded-lg p-4 flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-vw-signal-warning flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-[#161320]/80">
                                {t('onboardRecoveryWarning')}
                            </p>
                        </div>
                        {!recoveryKit ? (
                            <button
                                onClick={handleGenerateKit}
                                disabled={loading}
                                className="w-full py-3 bg-vw-gold text-white rounded-lg font-medium hover:bg-[color-mix(in_srgb,_var(--vault-console-gold)_80%,_#000)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                {t('onboardGenerateKit')}
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={handleDownloadKit}
                                    className="w-full py-3 bg-vw-console-raised text-white rounded-lg font-medium hover:bg-vw-console-elevated transition-colors flex items-center justify-center gap-2"
                                >
                                    <Download className="w-4 h-4" />
                                    {kitDownloaded ? t('onboardDownloadAgain') : t('onboardDownloadKit')}
                                </button>
                                {kitDownloaded && (
                                    <button
                                        onClick={handleFinish}
                                        className="w-full py-3 bg-vw-gold text-white rounded-lg font-medium hover:bg-[color-mix(in_srgb,_var(--vault-console-gold)_80%,_#000)] transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Check className="w-4 h-4" />
                                        {t('onboardOpenVault')}
                                    </button>
                                )}
                            </>
                        )}
                        {error && <p className="text-sm text-vw-signal-alert">{error}</p>}
                    </div>
                )}
            </div>
        </div>
    );
}
