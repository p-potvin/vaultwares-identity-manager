/**
 * Slide-in TOTP / 2FA prompt attached to the right side of the screen.
 * Accurately mimics Proton Pass 2FA behavior:
 * - Slides in from the right edge with smooth transition
 * - Displays live ticking 6-digit TOTP code, seconds countdown and progress bar
 * - Single-click "Fill this field" fills the code into target 2FA input(s) and copies to clipboard
 * - Also provides a copy code action and dismiss button
 */

import { TOKENS, HOST_RESET, BASE_FONT_STYLE } from './tokens';
import { generateTotpCode, getTotpRemainingSeconds } from '../utils/totp';
import { t } from '../i18n/strings';

const HOST_ID = 'vw-totp-slide-prompt';

export interface TotpPromptOptions {
    accountLabel: string;
    secret: string;
    digits?: number;
    period?: number;
    algorithm?: 'SHA1' | 'SHA256' | 'SHA512';
    onFill: (code: string) => void;
    onDismiss?: () => void;
}

let activePrompt: {
    dispose: () => void;
} | null = null;

function styleSheet(): string {
    return `
        ${BASE_FONT_STYLE}
        .container {
            position: fixed;
            top: 24px;
            right: 24px;
            width: 320px;
            z-index: 2147483647;
            background: ${TOKENS.consoleSurface};
            border: 1px solid ${TOKENS.consoleBorderSubtle};
            border-radius: ${TOKENS.radiusLg};
            box-shadow: ${TOKENS.shadowOverlay};
            color: ${TOKENS.consoleTextStrong};
            overflow: hidden;
            animation: vwSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            user-select: none;
            box-sizing: border-box;
        }
        @keyframes vwSlideIn {
            from {
                opacity: 0;
                transform: translateX(40px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }
        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 14px;
            background: ${TOKENS.consoleRaised};
            border-bottom: 1px solid ${TOKENS.consoleBorderSubtle};
        }
        .brand {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            color: ${TOKENS.gold};
        }
        .brand .dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: ${TOKENS.gold};
        }
        .close-btn {
            background: none;
            border: none;
            color: ${TOKENS.consoleTextMuted};
            cursor: pointer;
            padding: 2px 6px;
            font-size: 14px;
            line-height: 1;
            border-radius: 4px;
        }
        .close-btn:hover {
            color: ${TOKENS.consoleTextStrong};
            background: ${TOKENS.consoleElevated};
        }
        .content {
            padding: 14px;
            text-align: center;
        }
        .title {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: ${TOKENS.consoleTextSecondary};
            margin-bottom: 3px;
        }
        .account {
            font-size: 12px;
            font-weight: 600;
            color: ${TOKENS.consoleTextStrong};
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-bottom: 10px;
        }
        .code-box {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 24px;
            font-weight: 800;
            letter-spacing: 0.18em;
            color: ${TOKENS.gold};
            background: ${TOKENS.consoleBg};
            border: 1px solid ${TOKENS.consoleBorderSubtle};
            padding: 9px 12px;
            border-radius: ${TOKENS.radiusMd};
            margin-bottom: 10px;
            cursor: pointer;
            transition: all 0.15s ease;
        }
        .code-box:hover {
            border-color: ${TOKENS.gold}88;
            background: ${TOKENS.consoleRaised};
        }
        .meta-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 11px;
            color: ${TOKENS.consoleTextSecondary};
            margin-bottom: 8px;
        }
        .timer-badge {
            font-weight: 600;
            color: ${TOKENS.consoleTextMuted};
        }
        .timer-badge.urgent {
            color: #ef4444;
        }
        .progress-bar {
            height: 4px;
            background: ${TOKENS.consoleBg};
            border-radius: 2px;
            overflow: hidden;
            margin-bottom: 12px;
        }
        .progress-fill {
            height: 100%;
            background: ${TOKENS.gold};
            transition: width 1s linear, background-color 0.3s;
        }
        .progress-fill.urgent {
            background: #ef4444;
        }
        .fill-btn {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 9px 14px;
            border-radius: ${TOKENS.radiusMd};
            background: ${TOKENS.gold};
            color: ${TOKENS.consoleBg};
            border: none;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: opacity 0.15s ease;
        }
        .fill-btn:hover {
            opacity: 0.9;
        }
    `;
}

export function dismissTotpSlidePrompt(): void {
    if (activePrompt) {
        activePrompt.dispose();
        activePrompt = null;
    }
    document.getElementById(HOST_ID)?.remove();
}

export function showTotpSlidePrompt(options: TotpPromptOptions): void {
    dismissTotpSlidePrompt();

    const host = document.createElement('div');
    host.id = HOST_ID;
    host.setAttribute('style', `${HOST_RESET} position: fixed; top: 0; right: 0; z-index: 2147483647; pointer-events: auto;`);
    const root = host.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = styleSheet();
    root.appendChild(style);

    const container = document.createElement('div');
    container.className = 'container';

    // Header
    const header = document.createElement('div');
    header.className = 'header';
    const brand = document.createElement('div');
    brand.className = 'brand';
    const dot = document.createElement('span');
    dot.className = 'dot';
    brand.append(dot, document.createTextNode('VaultWares 2FA'));

    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.textContent = '✕';
    closeBtn.title = 'Close';
    closeBtn.addEventListener('click', () => {
        dismissTotpSlidePrompt();
        options.onDismiss?.();
    });

    header.append(brand, closeBtn);
    container.appendChild(header);

    // Body
    const content = document.createElement('div');
    content.className = 'content';

    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = 'Verification Code';

    const account = document.createElement('div');
    account.className = 'account';
    account.textContent = options.accountLabel;

    const codeBox = document.createElement('div');
    codeBox.className = 'code-box';
    codeBox.title = 'Click to copy';

    const metaRow = document.createElement('div');
    metaRow.className = 'meta-row';
    const metaLabel = document.createElement('span');
    metaLabel.textContent = 'One-Time Password';
    const timerBadge = document.createElement('span');
    timerBadge.className = 'timer-badge';

    metaRow.append(metaLabel, timerBadge);

    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    const progressFill = document.createElement('div');
    progressFill.className = 'progress-fill';
    progressBar.appendChild(progressFill);

    const fillBtn = document.createElement('button');
    fillBtn.className = 'fill-btn';
    fillBtn.textContent = 'Fill this field';

    content.append(title, account, codeBox, metaRow, progressBar, fillBtn);
    container.appendChild(content);
    root.appendChild(container);
    document.documentElement.appendChild(host);

    const period = options.period || 30;
    const digits = options.digits || 6;
    const algorithm = options.algorithm || 'SHA1';

    let currentCode = '';

    const update = () => {
        const raw = generateTotpCode(options.secret, { digits, period, algorithm });
        currentCode = raw;
        // Format with space in middle if 6 digits (e.g. 123 456)
        codeBox.textContent = raw.length === 6 ? `${raw.slice(0, 3)} ${raw.slice(3)}` : raw;

        const remaining = getTotpRemainingSeconds(period);
        timerBadge.textContent = `${remaining}s`;

        const percent = (remaining / period) * 100;
        progressFill.style.width = `${percent}%`;

        if (remaining <= 5) {
            timerBadge.classList.add('urgent');
            progressFill.classList.add('urgent');
        } else {
            timerBadge.classList.remove('urgent');
            progressFill.classList.remove('urgent');
        }
    };

    update();
    const timer = setInterval(update, 1000);

    const copyCode = async () => {
        try {
            await navigator.clipboard.writeText(currentCode);
            const original = codeBox.textContent;
            codeBox.textContent = '✓ Copied!';
            setTimeout(() => {
                if (codeBox) codeBox.textContent = currentCode.length === 6 ? `${currentCode.slice(0, 3)} ${currentCode.slice(3)}` : currentCode;
            }, 1000);
        } catch {}
    };

    codeBox.addEventListener('click', copyCode);

    fillBtn.addEventListener('click', () => {
        dismissTotpSlidePrompt();
        options.onFill(currentCode);
        try {
            navigator.clipboard.writeText(currentCode);
        } catch {}
    });

    activePrompt = {
        dispose: () => {
            clearInterval(timer);
            host.remove();
        },
    };
}
