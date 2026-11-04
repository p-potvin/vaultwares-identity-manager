import React, { useRef, useState } from 'react';
import { FileUp, Loader2, Check } from 'lucide-react';
import { t } from '../i18n/strings';

/**
 * Restore this device's keychain from a recovery kit file.
 *
 * Renders bare fields — each surface provides its own container and heading:
 * the vault unlock screen (locked out), the vault settings (a keychain that
 * unlocks but can no longer decrypt), and the onboarding restore step. The
 * variant only switches the input/button chrome between the dark console
 * surfaces and the warm onboarding shell; the logic is identical.
 *
 * The kit is verified against its own master key in the background before any
 * local state changes, so a wrong PIN or a corrupt file is a no-op.
 */
export function KitRestorePanel({ variant = 'console', onRestored }: {
    variant?: 'console' | 'warm';
    onRestored: () => void;
}) {
    const [fileName, setFileName] = useState('');
    const [kitEncoded, setKitEncoded] = useState('');
    const [pin, setPin] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);
    const fileInput = useRef<HTMLInputElement>(null);

    const warm = variant === 'warm';

    const labelClass = warm
        ? 'block text-xs font-medium text-[#161320]/70 mb-1.5'
        : 'block text-xs font-medium text-vw-console-text-secondary mb-1.5';
    const inputClass = warm
        ? 'w-full px-3 py-2 bg-white border border-[#161320]/10 rounded-lg text-sm text-[#161320] focus:outline-none focus:border-vw-gold'
        : 'w-full px-3 py-2 bg-vw-console-surface border border-vw-console-border rounded-lg text-sm text-white focus:outline-none focus:border-vw-gold';

    const pickFile = async (file: File | undefined) => {
        if (!file) return;
        try {
            setKitEncoded((await file.text()).trim());
            setFileName(file.name);
            setError('');
        } catch {
            setError(t('kitRestoreReadFailed'));
        }
    };

    const restore = async () => {
        setBusy(true);
        setError('');
        const resp = await chrome.runtime.sendMessage({
            type: 'RESTORE_FROM_KIT',
            payload: { kitEncoded, pin },
        });
        setBusy(false);
        if (resp?.success) {
            setDone(true);
            onRestored();
        } else {
            setError(resp?.error ?? t('kitRestoreFailed'));
        }
    };

    if (done) {
        return (
            <p className={`flex items-center gap-2 text-sm ${warm ? 'text-[#161320]' : 'text-white'}`}>
                <Check className="w-4 h-4 text-vw-signal-online" />
                {t('kitRestoreSuccess')}
            </p>
        );
    }

    return (
        <div className="space-y-3">
            <div>
                <label className={labelClass}>{t('kitRestoreFileLabel')}</label>
                <input
                    ref={fileInput}
                    type="file"
                    accept=".vwrecovery,application/octet-stream"
                    onChange={(e) => void pickFile(e.target.files?.[0])}
                    className="hidden"
                />
                <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    className={`w-full py-2.5 border border-dashed rounded-lg text-sm flex items-center justify-center gap-2 transition-colors ${
                        warm
                            ? 'border-[#161320]/20 text-[#161320]/70 hover:bg-white'
                            : 'border-vw-console-border text-vw-console-text-secondary hover:bg-vw-console-surface'
                    }`}
                >
                    <FileUp className="w-4 h-4" />
                    {fileName ? t('kitRestoreFileLoaded', { name: fileName }) : t('kitRestoreChooseFile')}
                </button>
            </div>
            <div>
                <label className={labelClass}>{t('kitRestorePinLabel')}</label>
                <input
                    type="password"
                    value={pin}
                    onChange={(e) => { setPin(e.target.value); setError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && kitEncoded && pin && restore()}
                    placeholder="••••"
                    className={inputClass}
                />
            </div>
            {error && (
                <p className={`text-xs ${warm ? 'text-red-600' : 'text-vw-signal-alert'}`}>{error}</p>
            )}
            <button
                type="button"
                onClick={restore}
                disabled={busy || !kitEncoded || !pin}
                className="w-full py-2.5 bg-vw-gold text-white rounded-lg text-sm font-medium hover:bg-[#C69431] disabled:opacity-50 flex items-center justify-center gap-2"
            >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('kitRestoreAction')}
            </button>
        </div>
    );
}
