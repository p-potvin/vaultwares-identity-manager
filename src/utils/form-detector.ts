import type { FormDetectionResult, DetectedField, FieldRole } from '../types';

/** Keywords that strongly indicate a sign-up/registration page. */
const SIGNUP_KEYWORDS = [
    'sign up', 'signup', 'register', 'registration', 'create account',
    'create your account', 'new account', 'join', 'get started', 'start free',
];

/** Field name/id/autocomplete patterns mapped to roles. */
const FIELD_ROLE_PATTERNS: Array<{ patterns: RegExp; role: FieldRole }> = [
    {
        patterns: /\b(first[_\s-]?name|fname|given[_\s-]?name|forename)\b/i,
        role: 'firstName',
    },
    {
        patterns: /\b(last[_\s-]?name|lname|surname|family[_\s-]?name)\b/i,
        role: 'lastName',
    },
    {
        patterns: /\b(full[_\s-]?name|name)\b/i,
        role: 'fullName',
    },
    {
        patterns: /\b(email[_\s-]?(address|confirm|2)?|e-mail)\b/i,
        role: 'email',
    },
    {
        patterns: /\b(confirm[_\s-]?email|email[_\s-]?confirm|verify[_\s-]?email)\b/i,
        role: 'emailConfirm',
    },
    {
        patterns: /\b(user[_\s-]?name|handle|nickname|login)\b/i,
        role: 'username',
    },
    {
        patterns: /\b(confirm[_\s-]?pass(word)?|pass(word)?[_\s-]?confirm|re[_\s-]?enter|repeat[_\s-]?pass)\b/i,
        role: 'passwordConfirm',
    },
    {
        patterns: /\b(pass(word)?|pwd|secret)\b/i,
        role: 'password',
    },
    {
        patterns: /\b(phone([_\s-]?number)?|mobile|tel(ephone)?|cell)\b/i,
        role: 'phone',
    },
    {
        patterns: /\b(birth[_\s-]?(date|day)|dob|date[_\s-]?of[_\s-]?birth)\b/i,
        role: 'birthDate',
    },
    {
        patterns: /\b(address|street|addr)\b/i,
        role: 'street',
    },
    {
        patterns: /\b(city|town|locality)\b/i,
        role: 'city',
    },
    {
        patterns: /\b(state|province|region)\b/i,
        role: 'state',
    },
    {
        patterns: /\b(country|nation)\b/i,
        role: 'country',
    },
    {
        patterns: /\b(zip|postal[_\s-]?code|postcode)\b/i,
        role: 'zipCode',
    },
];

const getFieldRole = (input: HTMLInputElement | HTMLSelectElement): FieldRole => {
    const candidates = [
        input.name,
        input.id,
        input.getAttribute('autocomplete') ?? '',
        input.getAttribute('placeholder') ?? '',
        input.getAttribute('aria-label') ?? '',
        getLabelText(input),
    ].join(' ').toLowerCase();

    for (const { patterns, role } of FIELD_ROLE_PATTERNS) {
        if (patterns.test(candidates)) return role;
    }

    if (input instanceof HTMLInputElement && input.type === 'password') return 'password';
    if (input instanceof HTMLInputElement && input.type === 'email') return 'email';
    if (input instanceof HTMLInputElement && input.type === 'tel') return 'phone';
    if (input instanceof HTMLInputElement && input.type === 'date') return 'birthDate';

    return 'unknown';
};

const getLabelText = (input: HTMLInputElement | HTMLSelectElement): string => {
    const id = input.id;

    if (id) {
        const label = document.querySelector<HTMLLabelElement>(`label[for="${id}"]`);
        if (label) return label.textContent ?? '';
    }

    const parent = input.closest('label');

    if (parent) return parent.textContent ?? '';

    return '';
};

const pageContainsSignupKeyword = (): boolean => {
    const bodyText = document.body.innerText.toLowerCase();
    const titleText = document.title.toLowerCase();
    const headings = Array.from(
        document.querySelectorAll<HTMLElement>('h1, h2, h3, button[type=submit], a'),
    )
        .map(el => el.textContent ?? '')
        .join(' ')
        .toLowerCase();

    const combined = `${bodyText} ${titleText} ${headings}`;

    return SIGNUP_KEYWORDS.some(kw => combined.includes(kw));
};

const hasPasswordConfirmField = (fields: DetectedField[]): boolean =>
    fields.some(f => f.role === 'passwordConfirm');

const countPasswordFields = (fields: DetectedField[]): number =>
    fields.filter(f => f.role === 'password' || f.role === 'passwordConfirm').length;

export const detectSignupForm = (): FormDetectionResult => {
    const allInputs = Array.from(
        document.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
            'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=checkbox]):not([type=radio]), select',
        ),
    );

    const fields: DetectedField[] = allInputs.map(el => ({
        element: el,
        role: getFieldRole(el),
    }));

    let score = 0;

    if (pageContainsSignupKeyword()) score += 3;
    if (hasPasswordConfirmField(fields)) score += 4;
    if (countPasswordFields(fields) >= 2) score += 3;
    if (fields.some(f => f.role === 'email')) score += 1;
    if (fields.some(f => f.role === 'username')) score += 1;
    if (fields.some(f => f.role === 'firstName')) score += 1;

    return { detected: score >= 4, score, fields };
};
