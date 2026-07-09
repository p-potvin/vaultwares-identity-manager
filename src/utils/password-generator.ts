import { randomBytes } from '@noble/hashes/utils';

const SETS = {
    uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lowercase: 'abcdefghijklmnopqrstuvwxyz',
    numbers: '0123456789',
    symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
};

export interface PasswordOptions {
    length: number;
    uppercase: boolean;
    lowercase: boolean;
    numbers: boolean;
    symbols: boolean;
}

export function generatePassword(opts: PasswordOptions): string {
    let charset = '';
    if (opts.uppercase) charset += SETS.uppercase;
    if (opts.lowercase) charset += SETS.lowercase;
    if (opts.numbers) charset += SETS.numbers;
    if (opts.symbols) charset += SETS.symbols;
    if (!charset) charset = SETS.lowercase + SETS.numbers;

    const bytes = randomBytes(opts.length);
    let result = '';
    for (let i = 0; i < opts.length; i++) {
        result += charset[bytes[i] % charset.length];
    }
    return result;
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
