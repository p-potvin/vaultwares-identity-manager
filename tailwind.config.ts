import type { Config } from 'tailwindcss';

const config: Config = {
    content: ['./src/**/*.{ts,tsx,html}'],
    theme: {
        extend: {
            colors: {
                'vw-warm-bg': 'var(--vault-warm-bg)',
                'vw-warm-raised': 'var(--vault-warm-raised)',
                'vw-warm-muted': 'var(--vault-warm-muted)',
                'vw-warm-border': 'var(--vault-warm-border-subtle)',
                'vw-console-bg': 'var(--vault-console-bg)',
                'vw-console-surface': 'var(--vault-console-surface)',
                'vw-console-raised': 'var(--vault-console-raised)',
                'vw-console-elevated': 'var(--vault-console-elevated)',
                'vw-console-active': 'var(--vault-console-active)',
                'vw-console-text': 'var(--vault-console-text)',
                'vw-console-border': 'var(--vault-console-border-subtle)',
                'vw-console-text-secondary': 'var(--vault-console-text-secondary)',
                'vw-gold': 'var(--vault-console-gold)',
                'vw-violet': 'var(--vault-console-violet)',
                'vw-signal-online': 'var(--vault-signal-online)',
                'vw-signal-relay': 'var(--vault-signal-relay)',
                'vw-signal-sync': 'var(--vault-signal-sync)',
                'vw-signal-warning': 'var(--vault-signal-warning)',
                'vw-signal-alert': 'var(--vault-signal-alert)',
            },
            fontFamily: {
                sans: ['Inter', 'Segoe UI', 'ui-sans-serif', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
            },
            borderRadius: {
                'vw-card': '28px',
            },
            animation: {
                'led-pulse': 'ledPulse 4s ease-in-out infinite',
            },
            keyframes: {
                ledPulse: {
                    '0%': { opacity: '0.85', transform: 'scale(0.98)' },
                    '50%': { opacity: '1', transform: 'scale(1)' },
                    '100%': { opacity: '0.85', transform: 'scale(0.98)' },
                },
            },
        },
    },
    plugins: [],
};

export default config;
