import { randomBytes } from '@noble/hashes/utils';

const SETS = {
    uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lowercase: 'abcdefghijklmnopqrstuvwxyz',
    numbers: '0123456789',
    symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
    standardSymbols: '!@#$%^&*()-_=+',
};

export type GeneratorPresetId = 'classic' | 'correct-horse' | 'token' | 'custom';

export interface PasswordOptions {
    length: number;
    uppercase: boolean;
    lowercase: boolean;
    numbers: boolean;
    symbols: boolean;
    standardSymbolsOnly: boolean;
}

export interface PassphraseOptions {
    wordCount: number;
    delimiter: string;
    capitalize: boolean;
    suffixType: 'none' | 'numeric' | 'alphanumeric';
    suffixLength: number;
}

export interface GeneratorPreset {
    id: GeneratorPresetId;
    label: string;
    description: string;
    type: 'password' | 'passphrase' | 'token';
    passwordOpts?: PasswordOptions;
    passphraseOpts?: PassphraseOptions;
}

export const PRESETS: GeneratorPreset[] = [
    {
        id: 'classic',
        label: 'Classic',
        description: 'Mixed charset, 20 chars, standard symbols only',
        type: 'password',
        passwordOpts: {
            length: 20,
            uppercase: true,
            lowercase: true,
            numbers: true,
            symbols: true,
            standardSymbolsOnly: true,
        },
    },
    {
        id: 'correct-horse',
        label: 'Correct-Horse',
        description: '4 random words joined by dash, capitalized, with 3-digit suffix',
        type: 'passphrase',
        passphraseOpts: {
            wordCount: 4,
            delimiter: '-',
            capitalize: true,
            suffixType: 'numeric',
            suffixLength: 3,
        },
    },
    {
        id: 'token',
        label: 'The Token',
        description: 'JWT-like token using Web Crypto (base64url segments)',
        type: 'token',
    },
];

const WORD_LIST: string[] = [
    'anchor', 'breeze', 'candle', 'drift', 'ember', 'falcon', 'grove', 'harbor',
    'ivory', 'jungle', 'kettle', 'lantern', 'meadow', 'nectar', 'orbit', 'puzzle',
    'quartz', 'ripple', 'summit', 'thunder', 'umber', 'velvet', 'willow', 'xenon',
    'yonder', 'zenith', 'amber', 'basil', 'cipher', 'dawn', 'echo', 'frost',
    'gale', 'haven', 'iris', 'jade', 'knoll', 'lumen', 'marsh', 'noble',
    'opal', 'plume', 'quill', 'ridge', 'solace', 'tide', 'urban', 'vow',
    'wisp', 'xylem', 'yarn', 'zephyr', 'arbor', 'bloom', 'cliff', 'dune',
    'fable', 'grain', 'helm', 'isle', 'jewel', 'knot', 'leaf', 'moss',
    'nest', 'ocean', 'pine', 'quay', 'reed', 'sage', 'twin', 'urge',
    'vale', 'wade', 'yelp', 'zest', 'blaze', 'crest', 'dusk', 'fern',
    'glow', 'haze', 'iron', 'jolt', 'keel', 'loom', 'mirk', 'nook',
];

function randomInt(max: number): number {
    const bytes = randomBytes(4);
    const val = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
    return Math.abs(val) % max;
}

function pickWord(): string {
    return WORD_LIST[randomInt(WORD_LIST.length)];
}

function generateSuffix(type: PassphraseOptions['suffixType'], length: number): string {
    if (type === 'none' || length <= 0) return '';
    const charset = type === 'numeric' ? SETS.numbers : SETS.numbers + SETS.lowercase;
    let suffix = '';
    const bytes = randomBytes(length);
    for (let i = 0; i < length; i++) {
        suffix += charset[bytes[i] % charset.length];
    }
    return suffix;
}

export function generatePassphrase(opts: PassphraseOptions): string {
    const words: string[] = [];
    for (let i = 0; i < opts.wordCount; i++) {
        let word = pickWord();
        if (opts.capitalize) {
            word = word.charAt(0).toUpperCase() + word.slice(1);
        }
        words.push(word);
    }
    const base = words.join(opts.delimiter);
    const suffix = generateSuffix(opts.suffixType, opts.suffixLength);
    return suffix ? `${base}${opts.delimiter}${suffix}` : base;
}

export async function generateToken(): Promise<string> {
    const seg1 = btoa(String.fromCharCode(...randomBytes(16))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const seg2 = btoa(String.fromCharCode(...randomBytes(24))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const seg3 = btoa(String.fromCharCode(...randomBytes(16))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    return `${seg1}.${seg2}.${seg3}`;
}

export function generatePassword(opts: PasswordOptions): string {
    let charset = '';
    if (opts.uppercase) charset += SETS.uppercase;
    if (opts.lowercase) charset += SETS.lowercase;
    if (opts.numbers) charset += SETS.numbers;
    if (opts.symbols) charset += opts.standardSymbolsOnly ? SETS.standardSymbols : SETS.symbols;
    if (!charset) charset = SETS.lowercase + SETS.numbers;

    const bytes = randomBytes(opts.length);
    let result = '';
    for (let i = 0; i < opts.length; i++) {
        result += charset[bytes[i] % charset.length];
    }
    return result;
}

export async function generateFromPreset(preset: GeneratorPreset): Promise<string> {
    switch (preset.type) {
        case 'password':
            return generatePassword(preset.passwordOpts!);
        case 'passphrase':
            return generatePassphrase(preset.passphraseOpts!);
        case 'token':
            return generateToken();
    }
}

export function measurePasswordStrength(password: string): number {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 16) score++;
    if (password.length >= 24) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return Math.min(score, 4);
}

export function strengthLabel(score: number): string {
    return ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'][score] ?? 'Weak';
}

export function strengthColor(score: number): string {
    return ['#FF6B7A', '#F0B94B', '#F0B94B', '#6BE675', '#55D6FF'][score] ?? '#F0B94B';
}
