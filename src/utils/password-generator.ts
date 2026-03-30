import type { GeneratePasswordOptions } from '../types';

const UPPERCASE = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWERCASE = 'abcdefghjkmnpqrstuvwxyz';
const NUMBERS = '23456789';
const SYMBOLS = '!@#$%^&*-_=+?';

const ALL_CHARS =
    UPPERCASE + LOWERCASE + NUMBERS + SYMBOLS;

/** Generates a cryptographically random integer in [0, max). */
const randomInt = (max: number): number => {
    const array = new Uint32Array(1);
    let result: number;

    do {
        crypto.getRandomValues(array);
        result = array[0]! % max;
    } while (array[0]! >= Math.floor(0xffffffff / max) * max);

    return result;
};

/** Picks a random character from a string. */
const pick = (charset: string): string => charset[randomInt(charset.length)]!;

/** Shuffles an array in-place using Fisher-Yates. */
const shuffle = (arr: string[]): string[] => {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [arr[i], arr[j]] = [arr[j]!, arr[i]!];
    }

    return arr;
};

export const generatePassword = (options?: Partial<GeneratePasswordOptions>): string => {
    const opts: GeneratePasswordOptions = {
        length: options?.length ?? 16,
        uppercase: options?.uppercase ?? true,
        lowercase: options?.lowercase ?? true,
        numbers: options?.numbers ?? true,
        symbols: options?.symbols ?? true,
    };

    const required: string[] = [];

    if (opts.uppercase) required.push(pick(UPPERCASE));
    if (opts.lowercase) required.push(pick(LOWERCASE));
    if (opts.numbers) required.push(pick(NUMBERS));
    if (opts.symbols) required.push(pick(SYMBOLS));

    const pool = [
        opts.uppercase ? UPPERCASE : '',
        opts.lowercase ? LOWERCASE : '',
        opts.numbers ? NUMBERS : '',
        opts.symbols ? SYMBOLS : '',
    ].join('') || ALL_CHARS;

    const remaining = Array.from(
        { length: Math.max(0, opts.length - required.length) },
        () => pick(pool),
    );

    return shuffle([...required, ...remaining]).join('');
};

export const measurePasswordStrength = (password: string): 0 | 1 | 2 | 3 | 4 => {
    let score = 0;

    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    return Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
};

export const strengthLabel = (score: 0 | 1 | 2 | 3 | 4): string => {
    return ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'][score]!;
};
